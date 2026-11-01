import uuid

from app.models import UserRole
from app.models.vehicle_service import VSComplaint, VSTechnicianAdvice, VSVehicle
from tests.conftest import auth_headers, login, make_user


def test_technician_advice_crud_assigns_persistent_serial_numbers(client, db):
    user = make_user("technician-advice@kim.com", UserRole.ADMIN)
    vehicle = VSVehicle(
        vehicle_number="ADVICE-001",
        owner_name="Test Owner",
        owner_phone="1234567890",
        qr_token=uuid.uuid4().hex,
    )
    db.add_all([user, vehicle])
    db.flush()
    complaint = VSComplaint(
        complaint_no="VS-ADVICE-001",
        vehicle_id=vehicle.id,
        reported_by="Test Owner",
        reported_phone="1234567890",
        description="Technician advice test",
    )
    other_complaint = VSComplaint(
        complaint_no="VS-ADVICE-002",
        vehicle_id=vehicle.id,
        reported_by="Test Owner",
        reported_phone="1234567890",
        description="Second work order",
    )
    db.add_all([complaint, other_complaint])
    db.commit()
    headers = auth_headers(login(client, email=user.email))
    base_url = f"/api/v1/vehicle-service/complaints/{complaint.id}/technician-advice"
    blocked_create = client.post(
        base_url,
        json={"issue_to_resolve": "Must remain blocked"},
        headers=headers,
    )
    assert blocked_create.status_code == 409
    assigned = client.patch(
        f"/api/v1/vehicle-service/complaints/{complaint.id}",
        json={"assigned_to_id": user.id},
        headers=headers,
    )
    assert assigned.status_code == 200, assigned.text

    assert client.get(base_url, headers=headers).json() == []
    other_url = f"/api/v1/vehicle-service/complaints/{other_complaint.id}/technician-advice"
    assert client.get(other_url, headers=headers).json() == []

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

    wrong_work_order = client.patch(
        f"{other_url}/{next_entry.json()['id']}",
        json={"issue_to_resolve": "Cross-work-order update"},
        headers=headers,
    )
    assert wrong_work_order.status_code == 404
