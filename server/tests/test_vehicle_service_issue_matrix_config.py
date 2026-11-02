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


def test_issue_matrix_import_persists_exact_headers_and_upserts_rows(client, db):
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
    application_id = response.json()["row_ids"][0]
    assert application_id

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
            "row_ids": [application_id],
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


def test_issue_matrix_import_upserts_by_application_id_and_rolls_back_invalid_batch(client, db):
    user = make_user("issue-matrix-upsert@kim.com", UserRole.ADMIN)
    db.add(user)
    db.commit()
    headers = auth_headers(login(client, email=user.email))
    url = "/api/v1/vehicle-service/issue-matrix/config"

    original_row = ["Throttle tight/jammed", "Throttle"] + [""] * 20
    original_row[10] = "2"
    original_row[21] = "THR-001"
    created = client.put(
        url,
        json={
            "headers": ISSUE_MATRIX_HEADERS,
            "rows": [original_row],
            "row_ids": ["APP-001"],
            "source_filename": "initial.xlsx",
        },
        headers=headers,
    )
    assert created.status_code == 200, created.text
    assert created.json()["row_ids"] == ["APP-001"]

    partial_headers = ["Application ID", "Issue"]
    partial_update = client.put(
        url,
        json={
            "headers": partial_headers,
            "rows": [["APP-001", "Throttle jammed"], ["APP-002", "Speed fluctuating"], ["", "Autocut off issue"]],
            "row_ids": ["APP-001", "APP-002", ""],
            "source_filename": "updates.xlsx",
        },
        headers=headers,
    )
    assert partial_update.status_code == 200, partial_update.text
    result = partial_update.json()
    assert len(result["rows"]) == 3
    assert result["rows"][0][0] == "Throttle jammed"
    assert result["rows"][0][1] == "Throttle"
    assert result["rows"][0][10] == "2"
    assert result["row_ids"][0] == "APP-001"
    assert result["row_ids"][1] == "APP-002"
    assert result["row_ids"][2].startswith("IM-")

    invalid_batch = client.put(
        url,
        json={
            "headers": ["Application ID", "Issue", "Qty"],
            "rows": [["APP-001", "Should not persist", "4"], ["APP-003", "Invalid quantity", "-1"]],
            "row_ids": ["APP-001", "APP-003"],
            "source_filename": "invalid.xlsx",
        },
        headers=headers,
    )
    assert invalid_batch.status_code == 422
    assert 'Row 3, column "Qty"' in invalid_batch.json()["detail"]
    unchanged = client.get(url, headers=headers).json()
    assert unchanged["rows"] == result["rows"]
    assert unchanged["row_ids"] == result["row_ids"]

    duplicate_ids = client.put(
        url,
        json={
            "headers": ["Application ID", "Issue"],
            "rows": [["APP-001", "first"], ["APP-001", "second"]],
            "row_ids": ["APP-001", "APP-001"],
            "source_filename": "duplicate.xlsx",
        },
        headers=headers,
    )
    assert duplicate_ids.status_code == 422
    assert client.get(url, headers=headers).json()["rows"] == result["rows"]
