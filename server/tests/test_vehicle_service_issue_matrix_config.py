import uuid

from app.models import UserRole
from app.models.vehicle_service import VSComplaint, VSIssueMatrixConfig, VSVehicle
from tests.conftest import auth_headers, login, make_user


ISSUE_MATRIX_HEADERS = [
    "Issue",
    "System",
    "Subsystem",
    "Priority",
    "Safety Risk",
    "Operable Vehicle",
    "Diagnostic Method",
    "Action Type",
    "Corrective Action",
    "Part ID",
    "Qty",
    "SOP",
    "Labour Time in Minutes",
    "Serviceable Location",
    "Warranty",
    "Warranty Policy",
    "Loaner Vehicle Required",
    "Part Cost",
    "Rework Cost (Software, Connector, Terminal)",
    "Labour Cost",
    "Root Cause Category",
    "Issue Code",
]


def test_issue_matrix_import_persists_exact_headers_and_replaces_rows(client, db):
    user = make_user("issue-matrix@kim.com", UserRole.ADMIN)
    vehicle = VSVehicle(
        vehicle_number="MATRIX-001",
        owner_name="Matrix Tester",
        owner_phone="1234567890",
        qr_token=uuid.uuid4().hex,
    )
    db.add_all([user, vehicle])
    db.flush()
    complaint = VSComplaint(
        complaint_no="VS-MATRIX-001",
        vehicle_id=vehicle.id,
        reported_by="Matrix Tester",
        reported_phone="1234567890",
        description="Issue Matrix selection test",
    )
    other_complaint = VSComplaint(
        complaint_no="VS-MATRIX-002",
        vehicle_id=vehicle.id,
        reported_by="Matrix Tester",
        reported_phone="1234567890",
        description="Second Issue Matrix selection test",
    )
    db.add_all([complaint, other_complaint])
    db.commit()
    headers = auth_headers(login(client, email=user.email))
    url = "/api/v1/vehicle-service/issue-matrix/config"
    selected_url = f"/api/v1/vehicle-service/complaints/{complaint.id}/issue-matrix-items"
    other_selected_url = f"/api/v1/vehicle-service/complaints/{other_complaint.id}/issue-matrix-items"
    assigned = client.patch(
        f"/api/v1/vehicle-service/complaints/{complaint.id}",
        json={"assigned_to_id": user.id},
        headers=headers,
    )
    assert assigned.status_code == 200, assigned.text

    assert client.get(url, headers=headers).json() is None

    first_row = ["Cluster not powering ON", "Instrument Cluster"] + [""] * 20
    first_row[21] = "SERP1CLU01"
    response = client.put(
        url,
        json={
            "headers": ISSUE_MATRIX_HEADERS,
            "rows": [first_row],
            "source_filename": "P1 Vehicle issue details work process and cost.xlsx",
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["headers"] == ISSUE_MATRIX_HEADERS
    assert response.json()["rows"] == [first_row]

    selected = client.post(selected_url, json={"row_indexes": [0]}, headers=headers)
    assert selected.status_code == 201, selected.text
    assert selected.json()[0]["issue_code"] == "SERP1CLU01"
    assert selected.json()[0]["issue_row"] == first_row
    assert client.get(other_selected_url, headers=headers).json() == []

    duplicate_selection = client.post(selected_url, json={"row_indexes": [0]}, headers=headers)
    assert duplicate_selection.status_code == 201, duplicate_selection.text
    assert duplicate_selection.json() == []

    invalid_headers = ISSUE_MATRIX_HEADERS.copy()
    invalid_headers[0] = "Issue Description"
    invalid = client.put(
        url,
        json={"headers": invalid_headers, "rows": [first_row], "source_filename": "other.xlsx"},
        headers=headers,
    )
    assert invalid.status_code == 422

    replacement_row = ["Display flickering", "Instrument Cluster"] + [""] * 20
    replacement = client.put(
        url,
        json={
            "headers": ISSUE_MATRIX_HEADERS,
            "rows": [replacement_row],
            "source_filename": "replacement.xlsx",
        },
        headers=headers,
    )
    assert replacement.status_code == 200, replacement.text
    assert client.get(url, headers=headers).json()["rows"] == [replacement_row]
    saved_selection = client.get(selected_url, headers=headers).json()
    assert len(saved_selection) == 1
    assert saved_selection[0]["issue_row"] == first_row

    deleted = client.delete(f"{selected_url}/{saved_selection[0]['id']}", headers=headers)
    assert deleted.status_code == 204, deleted.text
    assert client.get(selected_url, headers=headers).json() == []
    cross_work_order_delete = client.delete(
        f"{other_selected_url}/{saved_selection[0]['id']}",
        headers=headers,
    )
    assert cross_work_order_delete.status_code == 404

    db.expire_all()
    saved = db.get(VSIssueMatrixConfig, 1)
    assert saved is not None
    assert saved.headers == ISSUE_MATRIX_HEADERS
    assert saved.source_filename == "replacement.xlsx"
