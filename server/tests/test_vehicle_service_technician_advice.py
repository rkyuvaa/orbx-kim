from app.models import UserRole
from app.models.vehicle_service import VSTechnicianAdvice
from tests.conftest import auth_headers, login, make_user


def test_technician_advice_crud_assigns_persistent_serial_numbers(client, db):
    user = make_user("technician-advice@kim.com", UserRole.ADMIN)
    db.add(user)
    db.commit()
    headers = auth_headers(login(client, email=user.email))
    base_url = "/api/v1/vehicle-service/technician-advice"

    assert client.get(base_url, headers=headers).json() == []

    created = client.post(
        base_url,
        json={"issue_to_resolve": "Inspect the battery connector"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    advice = created.json()
    assert advice["serial_number"] == "TA-0001"
    assert advice["issue_to_resolve"] == "Inspect the battery connector"

    updated = client.patch(
        f"{base_url}/{advice['id']}",
        json={"issue_to_resolve": "Inspect and secure the battery connector"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["serial_number"] == "TA-0001"
    assert updated.json()["issue_to_resolve"] == "Inspect and secure the battery connector"

    db.expire_all()
    saved = db.get(VSTechnicianAdvice, advice["id"])
    assert saved is not None
    assert saved.issue_to_resolve == "Inspect and secure the battery connector"

    deleted = client.delete(f"{base_url}/{advice['id']}", headers=headers)
    assert deleted.status_code == 200, deleted.text

    next_entry = client.post(
        base_url,
        json={"issue_to_resolve": "Check the brake cable"},
        headers=headers,
    )
    assert next_entry.status_code == 201, next_entry.text
    assert next_entry.json()["serial_number"] == "TA-0002"
