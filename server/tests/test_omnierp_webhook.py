from app.core.config import settings
from app.models import AppDataDocument


def webhook_headers():
    return {"Authorization": "Bearer test-omnierp-token"}


def test_omnierp_ping_requires_valid_bearer_token(client, monkeypatch):
    monkeypatch.setattr(settings, "omnierp_employee_webhook_token", "test-omnierp-token")

    unauthenticated = client.post(
        "/api/v1/integrations/omnierp/employees/webhook",
        json={"event": "test.ping", "source": "Omni ERP"},
    )
    assert unauthenticated.status_code == 401

    response = client.post(
        "/api/v1/integrations/omnierp/employees/webhook",
        headers=webhook_headers(),
        json={"event": "test.ping", "source": "Omni ERP"},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True, "event": "test.ping"}


def test_omnierp_employee_created_and_updated_upsert_by_employee_id(
    client, db, monkeypatch
):
    monkeypatch.setattr(settings, "omnierp_employee_webhook_token", "test-omnierp-token")
    endpoint = "/api/v1/integrations/omnierp/employees/webhook"
    employee = {
        "id": 12,
        "employee_id": "EMP012",
        "name": "Employee One",
        "email": "employee@example.invalid",
        "phone": "9876543210",
        "designation": "Project Engineer",
        "reporting_manager": "Manager One",
        "manager_name": "Manager One",
        "department_id": 3,
        "department_name": "Operations",
        "branch_id": 1,
        "branch_name": "Head Office",
        "shift_id": 1,
        "shift_name": "General Shift",
        "date_of_joining": "2024-05-01",
        "date_of_leaving": None,
        "basic_salary": 45000,
        "is_active": True,
        "uan": "101234567890",
        "esi_number": "3100012345",
    }

    created = client.post(
        endpoint,
        headers=webhook_headers(),
        json={"event": "employee.created", "data": employee},
    )
    assert created.status_code == 200
    assert created.json()["created"] == 1
    assert created.json()["updated"] == 0

    employee["name"] = "Employee One Updated"
    employee["department_name"] = "Engineering"
    updated = client.post(
        endpoint,
        headers=webhook_headers(),
        json={"event": "employee.updated", "data": employee},
    )
    assert updated.status_code == 200
    assert updated.json()["created"] == 0
    assert updated.json()["updated"] == 1

    records = db.query(AppDataDocument).filter_by(key="crm_employee_master_data").one().value
    assert len(records) == 1
    assert records[0]["id"] == "omnierp:EMP012"
    assert records[0]["emp_id"] == "EMP012"
    assert records[0]["name"] == "Employee One Updated"
    assert records[0]["department"] == "Engineering"
    assert records[0]["branch"] == "Head Office"
    assert records[0]["reporting_manager"] == "Manager One"
    assert records[0]["joining_date"] == "2024-05-01"
    assert records[0]["gross_salary"] == "45000"
    assert records[0]["status"] == "Active"


def test_omnierp_batch_sync_updates_existing_records_without_removing_local_fields(
    client, db, monkeypatch
):
    monkeypatch.setattr(settings, "omnierp_employee_webhook_token", "test-omnierp-token")
    db.add(
        AppDataDocument(
            key="crm_employee_master_data",
            value=[
                {
                    "id": "local-1",
                    "emp_id": "EMP012",
                    "name": "Old Name",
                    "status": "Active",
                    "linked_user": "user-1",
                }
            ],
            revision=3,
        )
    )
    db.commit()

    response = client.post(
        "/api/v1/integrations/omnierp/employees/webhook",
        headers=webhook_headers(),
        json={
            "event": "employee.sync_batch",
            "count": 2,
            "data": [
                {"employee_id": "EMP012", "name": "Updated Name", "is_active": False},
                {"employee_id": "EMP013", "name": "New Employee"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["created"] == 1
    assert response.json()["updated"] == 1
    assert response.json()["total"] == 2

    document = db.query(AppDataDocument).filter_by(key="crm_employee_master_data").one()
    assert document.revision == 4
    assert document.value[0]["id"] == "local-1"
    assert document.value[0]["name"] == "Updated Name"
    assert document.value[0]["linked_user"] == "user-1"
    assert document.value[0]["status"] == "Inactive"
    assert document.value[1]["emp_id"] == "EMP013"
    assert document.value[1]["name"] == "New Employee"


def test_omnierp_webhook_validates_batch_count_and_requires_configuration(
    client, monkeypatch
):
    monkeypatch.setattr(settings, "omnierp_employee_webhook_token", None)
    endpoint = "/api/v1/integrations/omnierp/employees/webhook"
    payload = {"event": "employee.sync_batch", "count": 1, "data": []}

    unconfigured = client.post(endpoint, headers=webhook_headers(), json=payload)
    assert unconfigured.status_code == 503

    monkeypatch.setattr(settings, "omnierp_employee_webhook_token", "test-omnierp-token")
    invalid_batch = client.post(endpoint, headers=webhook_headers(), json=payload)
    assert invalid_batch.status_code == 422
