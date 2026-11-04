import uuid
import httpx
import pytest

from app.models import SmsSetting, UserRole
from app.models.vehicle_service import VSComplaint, VSVehicle
from app.services.sms_service import (
    clean_phone_number,
    dispatch_sms,
    format_otp_message,
    format_registration_message,
    send_closure_otp_sms,
    send_registration_sms,
)
from tests.conftest import auth_headers, login, make_user


def test_clean_phone_number():
    assert clean_phone_number("9876543210") == "9876543210"
    assert clean_phone_number("+919876543210") == "9876543210"
    assert clean_phone_number("919876543210") == "9876543210"
    assert clean_phone_number("09876543210") == "9876543210"
    assert clean_phone_number("+91 98765-43210") == "9876543210"


def test_format_registration_message_placeholders():
    template = (
        "Dear Customer, your vehicle service complaint has been registered successfully. "
        "Service ID: {#alphanumeric#} Date: {#alphanumeric#} Our support team will contact you shortly. "
        "KIM EV Service: Your service request {complaint_no} for vehicle {vehicle_number} has been registered."
    )
    result = format_registration_message(
        template=template,
        complaint_no="VC-0005",
        vehicle_number="TN66P7023",
        date_str="04-11-2026",
    )
    assert "Service ID: VC-0005" in result
    assert "Date: 04-11-2026" in result
    assert "Your service request VC-0005 for vehicle TN66P7023 has been registered" in result


def test_format_otp_message_placeholders():
    template = (
        "Dear Customer, Your vehicle service has been completed successfully. "
        "Service ID: {#alphanumeric#} OTP: {#numeric#} Please share this OTP with our technician to confirm service completion. "
        "Thank you, Konwert India Motors."
    )
    result = format_otp_message(
        template=template,
        complaint_no="VC-0005",
        otp_code="789012",
    )
    assert "Service ID: VC-0005" in result
    assert "OTP: 789012" in result


def test_dispatch_sms_simulation_when_no_credentials():
    success, msg = dispatch_sms(
        phone="9876543210",
        message="Test message",
        config={"is_enabled": True, "username": None, "password": None},
    )
    assert success is True
    assert "Simulated dispatch" in msg


def test_dispatch_sms_with_textguru_mock(monkeypatch):
    recorded_calls = []

    def mock_get(self, url, params=None):
        recorded_calls.append({"url": url, "params": params})
        return httpx.Response(200, text="1701:Success:20261104123456", request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    success, msg = dispatch_sms(
        phone="9876543210",
        message="Service ID: VC-0005",
        template_id="1207161234567890123",
        config={
            "provider": "textguru",
            "api_url": "https://www.textguru.in/api/v22.0/",
            "api_method": "GET",
            "username": "myuser",
            "password": "mypassword",
            "sender_id": "KIMEV",
            "entity_id": "1201159123456789012",
            "is_enabled": True,
        },
    )
    assert success is True
    assert "1701:Success" in msg
    assert len(recorded_calls) == 1
    call = recorded_calls[0]
    assert call["params"]["username"] == "myuser"
    assert call["params"]["password"] == "mypassword"
    assert call["params"]["dmobile"] == "919876543210"
    assert call["params"]["source"] == "KIMEV"
    assert call["params"]["dlttempid"] == "1207161234567890123"
    assert call["params"]["entityid"] == "1201159123456789012"


def test_sms_settings_api(client, db):
    user = make_user("admin@kim.com", UserRole.ADMIN)
    db.add(user)
    db.commit()
    headers = auth_headers(login(client, email=user.email))

    # 1. GET settings
    get_res = client.get("/api/v1/sms-settings", headers=headers)
    assert get_res.status_code == 200, get_res.text
    data = get_res.json()
    assert data["provider"] == "textguru"
    assert data["has_password"] is False

    # 2. POST update settings
    update_res = client.post(
        "/api/v1/sms-settings",
        json={
            "provider": "textguru",
            "username": "tg_user_1",
            "password": "SecretPassword123",
            "sender_id": "KONWRT",
            "entity_id": "1201159000000000001",
            "registration_template_id": "1207160000000000001",
            "otp_template_id": "1207160000000000002",
            "is_enabled": True,
        },
        headers=headers,
    )
    assert update_res.status_code == 200, update_res.text
    updated = update_res.json()
    assert updated["username"] == "tg_user_1"
    assert updated["sender_id"] == "KONWRT"
    assert updated["has_password"] is True

    # 3. Preserves password when omitted/empty
    second_update = client.post(
        "/api/v1/sms-settings",
        json={
            "sender_id": "KIMEV",
            "password": "",
        },
        headers=headers,
    )
    assert second_update.status_code == 200
    assert second_update.json()["sender_id"] == "KIMEV"
    assert second_update.json()["has_password"] is True

    # 4. Test endpoint
    test_res = client.post(
        "/api/v1/sms-settings/test",
        json={"test_phone": "9876543210"},
        headers=headers,
    )
    assert test_res.status_code == 200
    assert test_res.json()["success"] is True


def test_vehicle_service_complaint_and_otp_sms_triggers(client, db, monkeypatch):
    user = make_user("service-tech@kim.com", UserRole.ADMIN)
    vehicle = VSVehicle(
        vehicle_number="TN66P7023",
        owner_name="Ramesh Kumar",
        owner_phone="9787317484",
        qr_token=uuid.uuid4().hex,
    )
    db.add_all([user, vehicle])
    db.commit()

    dispatched = []

    def mock_dispatch(phone, message, template_id=None, **kwargs):
        dispatched.append({"phone": phone, "message": message, "template_id": template_id})
        return True, "Success"

    monkeypatch.setattr("app.services.sms_service.dispatch_sms", mock_dispatch)

    headers = auth_headers(login(client, email=user.email))

    # 1. Create work order -> triggers registration SMS
    create_res = client.post(
        "/api/v1/vehicle-service/complaints",
        json={
            "vehicle_id": vehicle.id,
            "reported_by": "Ramesh Kumar",
            "reported_phone": "9787317484",
            "category": "BREAKDOWN",
            "severity": "MEDIUM",
            "description": "Engine hesitation",
            "assigned_to_id": user.id,
        },
        headers=headers,
    )
    assert create_res.status_code == 201, create_res.text
    complaint_data = create_res.json()
    complaint_id = complaint_data["id"]
    complaint_no = complaint_data["complaint_no"]

    assert len(dispatched) == 1
    reg_sms = dispatched[0]
    assert reg_sms["phone"] == "9787317484"
    assert complaint_no in reg_sms["message"]
    assert "registered successfully" in reg_sms["message"]

    # 2. Send closure OTP -> triggers OTP SMS with complaint_no and 6-digit OTP
    otp_res = client.post(
        f"/api/v1/vehicle-service/complaints/{complaint_id}/send-otp",
        json={},
        headers=headers,
    )
    assert otp_res.status_code == 200, otp_res.text
    assert len(dispatched) == 2
    otp_sms = dispatched[1]
    assert otp_sms["phone"] == "9787317484"
    assert complaint_no in otp_sms["message"]
    assert "confirm service completion" in otp_sms["message"]
