import uuid

from app.api.v1 import vehicle_service
from app.models import UserRole
from app.models.vehicle_service import VSComplaint, VSVehicle
from tests.conftest import auth_headers, login, make_user


def test_workflow_updates_and_attachments_persist(client, db, monkeypatch, tmp_path):
    user = make_user("service-admin@kim.com", UserRole.ADMIN)
    vehicle = VSVehicle(
        vehicle_number="TEST-001",
        owner_name="Test Owner",
        owner_phone="1234567890",
        qr_token=uuid.uuid4().hex,
    )
    db.add_all([user, vehicle])
    db.flush()
    complaint = VSComplaint(
        complaint_no="VS-TEST-001",
        vehicle_id=vehicle.id,
        reported_by="Test Owner",
        reported_phone="1234567890",
        description="Service workflow test",
    )
    db.add(complaint)
    db.commit()
    complaint_id = complaint.id

    upload_root = tmp_path / "vehicle_service"
    monkeypatch.setattr(vehicle_service, "VS_UPLOADS_DIR", upload_root)
    headers = auth_headers(login(client, email=user.email))

    document_uploads = (
        ("initial-checklist", "initial.pdf"),
        ("master-checklist", "master.pdf"),
        ("complaints-8d", "report.pdf"),
    )
    for endpoint, filename in document_uploads:
        response = client.post(
            f"/api/v1/vehicle-service/complaints/{complaint_id}/{endpoint}",
            files={"file": (filename, b"test document", "application/pdf")},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        url = response.json()["url"]
        assert url.startswith("/uploads/vehicle_service/")
        assert (upload_root / url.removeprefix("/uploads/vehicle_service/")).is_file()
        workflow_response = client.patch(
            f"/api/v1/vehicle-service/complaints/{complaint_id}",
            json={"technician_remarks": "Updated after upload"},
            headers=headers,
        )
        assert workflow_response.status_code == 200, workflow_response.text
        workflow_data = workflow_response.json()
        assert workflow_data[
            {
                "initial-checklist": "initial_checklist_url",
                "master-checklist": "master_checklist_url",
                "complaints-8d": "complaints_8d_url",
            }[endpoint]
        ] == url

    images_response = client.post(
        f"/api/v1/vehicle-service/complaints/{complaint_id}/vehicle-images",
        files=[("files", ("vehicle.png", b"test image", "image/png"))],
        headers=headers,
    )
    assert images_response.status_code == 200, images_response.text
    image_url = images_response.json()["urls"][0]
    assert (upload_root / image_url.removeprefix("/uploads/vehicle_service/")).is_file()
    image_update_response = client.patch(
        f"/api/v1/vehicle-service/complaints/{complaint_id}",
        json={"service_type": "PAID"},
        headers=headers,
    )
    assert image_update_response.status_code == 200, image_update_response.text
    assert image_update_response.json()["vehicle_images"] == f'["{image_url}"]'

    workflow_response = client.patch(
        f"/api/v1/vehicle-service/complaints/{complaint_id}",
        json={
            "est_delivery_date": "2026-11-02",
            "can_data_collected": False,
            "technician_remarks": "Inspected",
            "odometer_reading": 123.5,
            "timer_started_at": "2026-11-01T10:00:00Z",
            "service_hours": 1.25,
            "service_type": "PAID",
        },
        headers=headers,
    )
    assert workflow_response.status_code == 200, workflow_response.text
    assert workflow_response.json()["can_data_collected"] is False

    db.expire_all()
    saved = db.get(VSComplaint, complaint_id)
    assert saved is not None
    assert saved.initial_checklist_url is not None
    assert saved.master_checklist_url is not None
    assert saved.complaints_8d_url is not None
    assert saved.vehicle_images == f'["{image_url}"]'
    assert saved.est_delivery_date.isoformat() == "2026-11-02"
    assert saved.can_data_collected is False
    assert saved.technician_remarks == "Inspected"
    assert saved.odometer_reading == 123.5
    assert saved.service_hours == 1.25
    assert saved.service_type.value == "PAID"
