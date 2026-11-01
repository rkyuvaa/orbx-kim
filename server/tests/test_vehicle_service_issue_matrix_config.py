from app.models import UserRole
from app.models.vehicle_service import VSIssueMatrixConfig
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
    db.add(user)
    db.commit()
    headers = auth_headers(login(client, email=user.email))
    url = "/api/v1/vehicle-service/issue-matrix/config"

    assert client.get(url, headers=headers).json() is None

    first_row = ["Cluster not powering ON", "Instrument Cluster"] + [""] * 20
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

    db.expire_all()
    saved = db.get(VSIssueMatrixConfig, 1)
    assert saved is not None
    assert saved.headers == ISSUE_MATRIX_HEADERS
    assert saved.source_filename == "replacement.xlsx"
