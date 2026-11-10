import pytest
from app.models.push_subscription import PushSubscription
from app.models.user import User
from tests.conftest import auth_headers, login


def test_push_public_key(client):
    response = client.get("/api/v1/push/public-key")
    assert response.status_code == 200
    data = response.json()
    assert "public_key" in data
    assert len(data["public_key"]) > 30


def test_push_subscribe_and_status_and_unsubscribe(seeded_client, db):
    tokens = login(seeded_client)
    headers = auth_headers(tokens)

    # Initially 0 subscriptions
    status_resp = seeded_client.get("/api/v1/push/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["is_subscribed"] is False

    # Subscribe device
    endpoint = "https://fcm.googleapis.com/fcm/send/test-token-12345"
    sub_payload = {
        "endpoint": endpoint,
        "keys": {
            "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9Q0=",
            "auth": "tBHItJI5svbpez7KI4CCXg==",
        },
        "user_agent": "TestBrowser/1.0",
    }
    sub_resp = seeded_client.post("/api/v1/push/subscribe", json=sub_payload, headers=headers)
    assert sub_resp.status_code == 201

    # Check status now
    status_resp2 = seeded_client.get("/api/v1/push/status", headers=headers)
    assert status_resp2.status_code == 200
    assert status_resp2.json()["is_subscribed"] is True
    assert status_resp2.json()["subscription_count"] >= 1

    # Test unsubscribe
    unsub_resp = seeded_client.post("/api/v1/push/unsubscribe", json={"endpoint": endpoint}, headers=headers)
    assert unsub_resp.status_code == 200
    assert unsub_resp.json()["deleted"] == 1

    # Status back to not subscribed
    status_resp3 = seeded_client.get("/api/v1/push/status", headers=headers)
    assert status_resp3.status_code == 200
    assert status_resp3.json()["is_subscribed"] is False


def test_push_personal_settings_toggles(seeded_client, db):
    tokens = login(seeded_client)
    headers = auth_headers(tokens)

    # 1. Fetch current settings
    resp = seeded_client.get("/api/v1/tasks/personal/settings", headers=headers)
    assert resp.status_code == 200
    settings = resp.json()
    assert settings["push_task_assigned"] is True
    assert settings["push_task_due_today"] is True
    assert settings["push_log_note_update"] is True
    assert settings["push_task_completed"] is True
    assert settings["push_task_comments"] is True

    # 2. Update push settings: disable assigned & completed
    patch_payload = {
        "push_task_assigned": False,
        "push_task_completed": False,
    }
    update_resp = seeded_client.put("/api/v1/tasks/personal/settings", json=patch_payload, headers=headers)
    assert update_resp.status_code == 200, update_resp.text
    updated = update_resp.json()
    assert updated["push_task_assigned"] is False
    assert updated["push_task_completed"] is False
    assert updated["push_task_due_today"] is True
    assert updated["push_log_note_update"] is True
    assert updated["push_task_comments"] is True

    # 3. Verify helper is_push_category_enabled
    from app.services.push_notification_service import is_push_category_enabled
    user = db.query(User).filter_by(email="sales@kim.com").first()
    assert is_push_category_enabled(db, user.id, "push_task_assigned") is False
    assert is_push_category_enabled(db, user.id, "push_task_completed") is False
    assert is_push_category_enabled(db, user.id, "push_task_due_today") is True
    assert is_push_category_enabled(db, user.id, "push_log_note_update") is True
    assert is_push_category_enabled(db, user.id, "push_task_comments") is True

