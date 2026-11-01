from app.core.security import hash_password
from app.models import AppDataDocument, User, UserRole

from tests.conftest import auth_headers, login


def test_app_data_is_persisted_for_authenticated_user(seeded_client, db):
    token = login(seeded_client, "admin@kim.com")
    headers = auth_headers(token)
    key = "crm_requirements_items_data"
    value = [{"id": "REQ-1", "title": "New request", "amount": 125.5}]

    missing = seeded_client.get(f"/api/v1/app-data/{key}", headers=headers)
    assert missing.status_code == 200
    assert missing.json()["value"] is None
    assert missing.json()["revision"] == 0

    saved = seeded_client.put(
        f"/api/v1/app-data/{key}",
        headers=headers,
        json={"value": value, "expected_revision": 0},
    )
    assert saved.status_code == 200
    assert saved.json()["value"] == value
    assert saved.json()["revision"] == 1

    loaded = seeded_client.get(f"/api/v1/app-data/{key}", headers=headers)
    assert loaded.status_code == 200
    assert loaded.json()["value"] == value
    assert loaded.json()["revision"] == 1
    assert db.query(AppDataDocument).filter_by(key=key).count() == 1


def test_app_data_is_shared_between_authenticated_users(seeded_client, db):
    other_user = User(
        email="other@kim.com",
        full_name="Other User",
        role=UserRole.SALES_EXECUTIVE,
        password_hash=hash_password("testpass123"),
    )
    db.add(other_user)
    db.commit()

    owner_headers = auth_headers(login(seeded_client, "admin@kim.com"))
    other_headers = auth_headers(login(seeded_client, "other@kim.com"))
    key = "crm_policy_compliance_items_data"

    saved = seeded_client.put(
        f"/api/v1/app-data/{key}",
        headers=owner_headers,
        json={"value": [{"id": "POL-1"}], "expected_revision": 0},
    )
    assert saved.status_code == 200

    other_read = seeded_client.get(f"/api/v1/app-data/{key}", headers=other_headers)
    assert other_read.status_code == 200
    assert other_read.json()["value"] == [{"id": "POL-1"}]


def test_app_data_rejects_stale_revision(seeded_client):
    headers = auth_headers(login(seeded_client, "admin@kim.com"))
    key = "crm_renewal_items"
    first_write = seeded_client.put(
        f"/api/v1/app-data/{key}",
        headers=headers,
        json={"value": [], "expected_revision": 0},
    )
    assert first_write.status_code == 200
    update = seeded_client.put(
        f"/api/v1/app-data/{key}",
        headers=headers,
        json={"value": [{"id": 1}], "expected_revision": 1},
    )
    assert update.status_code == 200
    assert update.json()["revision"] == 2

    conflict = seeded_client.put(
        f"/api/v1/app-data/{key}",
        headers=headers,
        json={"value": [{"id": 2}], "expected_revision": 1},
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["revision"] == 2
    assert conflict.json()["detail"]["value"] == [{"id": 1}]


def test_app_data_requires_authentication(client):
    response = client.get("/api/v1/app-data/crm_renewal_items")
    assert response.status_code == 401
