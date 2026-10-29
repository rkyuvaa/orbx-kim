import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.models.document_sequence import DocumentSequence
from app.models.user import User, UserRole
from app.services.document_numbering import (
    format_document_number,
    generate_next_document_number,
    preview_document_number,
    resolve_tokens,
)
from app.core.security import hash_password


def auth_headers(client: TestClient, email: str = "admin@kim.com", password: str = "testpass123") -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_resolve_tokens_and_format():
    fixed_time = datetime(2026, 10, 28, 12, 0, 0, tzinfo=timezone.utc)
    # Test token replacement
    resolved = resolve_tokens("VC-{YYYYMMDD}-{YY}-", now=fixed_time)
    assert resolved == "VC-20261028-26-"

    # Test formatting with padding
    formatted = format_document_number(
        prefix="VC-",
        padding=4,
        number=1,
        suffix="",
        now=fixed_time,
    )
    assert formatted == "VC-0001"

    formatted_large = format_document_number(
        prefix="CMP/",
        padding=6,
        number=42,
        suffix="-A",
        now=fixed_time,
    )
    assert formatted_large == "CMP/000042-A"


def test_generate_next_document_number(db):
    # Generates initial sequence automatically
    num1 = generate_next_document_number(
        db,
        document_type="complaint",
        default_prefix="VC-",
        default_padding=4,
    )
    assert num1 == "VC-0001"

    num2 = generate_next_document_number(
        db,
        document_type="complaint",
        default_prefix="VC-",
        default_padding=4,
    )
    assert num2 == "VC-0002"

    seq = db.query(DocumentSequence).filter_by(document_type="complaint").first()
    assert seq is not None
    assert seq.next_number == 3


def test_document_numbering_api_and_complaint_integration(db, client):
    # Create admin user
    admin = User(
        email="admin@kim.com",
        full_name="System Admin",
        role=UserRole.ADMIN,
        password_hash=hash_password("testpass123"),
    )
    db.add(admin)
    db.commit()

    headers = auth_headers(client, "admin@kim.com", "testpass123")

    # 1. Create complaint document sequence
    create_resp = client.post(
        "/api/v1/document-numbering",
        headers=headers,
        json={
            "document_type": "complaint",
            "name": "Vehicle Service Complaint",
            "description": "Complaint numbering sequence",
            "prefix": "VC-",
            "padding": 4,
            "next_number": 100,
            "suffix": "",
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201
    data = create_resp.json()
    assert data["sample_preview"] == "VC-0100"

    # 2. Update sequence settings: change prefix to "KIM-CMP-" and padding to 5
    update_resp = client.put(
        "/api/v1/document-numbering/complaint",
        headers=headers,
        json={
            "prefix": "KIM-CMP-",
            "padding": 5,
            "next_number": 1,
        },
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["prefix"] == "KIM-CMP-"
    assert updated_data["padding"] == 5
    assert updated_data["next_number"] == 1
    assert updated_data["sample_preview"] == "KIM-CMP-00001"

    # 3. Generating next complaint number uses the updated settings
    next_no = generate_next_document_number(db, "complaint")
    assert next_no == "KIM-CMP-00001"

    next_no_2 = generate_next_document_number(db, "complaint")
    assert next_no_2 == "KIM-CMP-00002"

    # 4. Test preview endpoint
    prev_resp = client.post(
        "/api/v1/document-numbering/preview",
        headers=headers,
        json={
            "prefix": "WO-{YYYY}-",
            "padding": 4,
            "next_number": 25,
            "suffix": "",
        },
    )
    assert prev_resp.status_code == 200
    assert "WO-" in prev_resp.json()["preview"]
    assert prev_resp.json()["preview"].endswith("-0025")

    # 5. Set prefix to "TEST-CMP-" and padding 3, next_number 50
    update_resp = client.put(
        "/api/v1/document-numbering/complaint",
        headers=headers,
        json={
            "prefix": "TEST-CMP-",
            "padding": 3,
            "next_number": 50,
        },
    )
    assert update_resp.status_code == 200

    # 6. Submit universal complaint and assert complaint_no matches new format
    complaint_resp = client.post(
        "/api/v1/vehicle-service/public/universal-register",
        json={
            "vehicle_number": "KA01AB1234",
            "reported_by": "John Doe",
            "reported_phone": "9876543210",
            "category": "BATTERY",
            "severity": "HIGH",
            "description": "Battery draining rapidly",
        },
    )
    assert complaint_resp.status_code == 201
    complaint_data = complaint_resp.json()
    assert complaint_data["complaint_no"] == "TEST-CMP-050"

    # Same vehicle on the same day should be blocked to prevent duplicates (429)
    duplicate_resp = client.post(
        "/api/v1/vehicle-service/public/universal-register",
        json={
            "vehicle_number": "KA01AB1234",
            "reported_by": "Jane Doe",
            "reported_phone": "9876543211",
            "category": "MOTOR",
            "severity": "MEDIUM",
            "description": "Motor heating up",
        },
    )
    assert duplicate_resp.status_code == 429
    assert "Maximum 1 request per day" in duplicate_resp.json()["detail"]

    # Different vehicle should succeed and get TEST-CMP-051
    complaint_resp2 = client.post(
        "/api/v1/vehicle-service/public/universal-register",
        json={
            "vehicle_number": "KA02CD5678",
            "reported_by": "Jane Doe",
            "reported_phone": "9876543211",
            "category": "MOTOR",
            "severity": "MEDIUM",
            "description": "Motor heating up",
        },
    )
    assert complaint_resp2.status_code == 201
    assert complaint_resp2.json()["complaint_no"] == "TEST-CMP-051"
