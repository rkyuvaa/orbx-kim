import time
from datetime import UTC, datetime, timedelta
import jwt
import pytest
from app.core.config import settings
from app.core.security import create_token, hash_password
from app.models import User, UserRole
from app.models.user import UserStatus
from tests.conftest import DEFAULT_PASSWORD, auth_headers, make_user


def test_case_1_correct_credentials_succeeds(client, db):
    """1. Correct username and correct password -> Login succeeds."""
    user = make_user("test_sales@kim.com", UserRole.SALES_EXECUTIVE, "Sales Person")
    user.username = "test_sales_user"
    db.add(user)
    db.commit()

    # Login with email
    resp1 = client.post(
        "/api/v1/auth/login",
        json={"email": "test_sales@kim.com", "password": DEFAULT_PASSWORD},
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "access_token" in data1
    assert data1["user"]["email"] == "test_sales@kim.com"

    # Login with username
    resp2 = client.post(
        "/api/v1/auth/login",
        json={"email": "test_sales_user", "password": DEFAULT_PASSWORD},
    )
    assert resp2.status_code == 200
    assert "access_token" in resp2.json()


def test_case_2_correct_user_incorrect_password_fails(client, db):
    """2. Correct username and incorrect password -> Login fails."""
    user = make_user("user_wrong_pass@kim.com", UserRole.SALES_EXECUTIVE)
    db.add(user)
    db.commit()

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "user_wrong_pass@kim.com", "password": "WrongPassword123!"},
    )
    assert resp.status_code == 401
    assert "access_token" not in resp.json()
    assert resp.json().get("detail") == "Invalid email or password"


def test_case_3_nonexistent_user_fails(client, db):
    """3. Nonexistent username and any password -> Login fails."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent_ghost_user@kim.com", "password": "SomePassword123!"},
    )
    assert resp.status_code == 401
    assert "access_token" not in resp.json()
    assert resp.json().get("detail") == "Invalid email or password"


def test_case_4_empty_credentials_fail(client, db):
    """4. Empty username or password -> Login fails."""
    # Completely empty strings
    resp1 = client.post(
        "/api/v1/auth/login",
        json={"email": "", "password": ""},
    )
    assert resp1.status_code in [401, 422]
    assert "access_token" not in resp1.json()

    # Whitespace only email
    resp2 = client.post(
        "/api/v1/auth/login",
        json={"email": "   ", "password": "ValidPassword123!"},
    )
    assert resp2.status_code in [401, 422]
    assert "access_token" not in resp2.json()

    # Whitespace only password
    resp3 = client.post(
        "/api/v1/auth/login",
        json={"email": "valid@kim.com", "password": "   "},
    )
    assert resp3.status_code in [401, 422]
    assert "access_token" not in resp3.json()


def test_case_5_repeated_incorrect_password_rate_limiting(client, db):
    """5. Incorrect password repeated multiple times -> Login continues to fail and rate limiting applies."""
    user = make_user("lockout_test@kim.com", UserRole.SALES_EXECUTIVE)
    db.add(user)
    db.commit()

    # Attempt 4 failed logins
    for attempt in range(1, 5):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "lockout_test@kim.com", "password": f"bad_pass_{attempt}"},
        )
        assert resp.status_code == 401
        assert "access_token" not in resp.json()

    # 5th failed login triggers account lockout (429 Too Many Requests)
    resp5 = client.post(
        "/api/v1/auth/login",
        json={"email": "lockout_test@kim.com", "password": "bad_pass_5"},
    )
    assert resp5.status_code == 429
    assert "locked" in resp5.json().get("detail", "").lower()

    # 6th attempt (even with correct password) is blocked due to active lock
    resp6 = client.post(
        "/api/v1/auth/login",
        json={"email": "lockout_test@kim.com", "password": DEFAULT_PASSWORD},
    )
    assert resp6.status_code == 429
    assert "locked" in resp6.json().get("detail", "").lower()


def test_case_6_tampered_expired_invalid_token_rejected(client, db):
    """6. Missing, invalid, expired, or tampered authentication token -> Protected API access is rejected."""
    user = make_user("token_test@kim.com", UserRole.SALES_EXECUTIVE)
    db.add(user)
    db.commit()

    # Missing token
    resp_missing = client.get("/api/v1/auth/me")
    assert resp_missing.status_code == 401

    # Completely bogus/tampered token
    resp_tampered = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-valid-token-string"})
    assert resp_tampered.status_code == 401

    # Tampered signature
    valid_token = create_token(str(user.id), "access", timedelta(minutes=15))
    parts = valid_token.split(".")
    tampered_sig_token = f"{parts[0]}.{parts[1]}.badsignature123456"
    resp_tampered_sig = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered_sig_token}"})
    assert resp_tampered_sig.status_code == 401

    # Expired token
    now = datetime.now(UTC)
    expired_payload = {
        "sub": str(user.id),
        "type": "access",
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
    }
    expired_token = jwt.encode(expired_payload, settings.secret_key, algorithm=settings.algorithm)
    resp_expired = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp_expired.status_code == 401

    # Refresh token presented to access-only endpoint
    refresh_token = create_token(str(user.id), "refresh", timedelta(hours=10))
    resp_wrong_type = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh_token}"})
    assert resp_wrong_type.status_code == 401


def test_case_7_direct_access_protected_endpoint_without_auth(client):
    """7. Direct access to a protected dashboard without authentication -> Access is denied."""
    assert client.get("/api/v1/dashboard").status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/admin/users").status_code == 401
    assert client.get("/api/v1/projects").status_code == 401
    assert client.get("/api/v1/applications").status_code == 401
    assert client.get("/api/v1/hr/attendance").status_code == 401


def test_case_8_existing_valid_users_all_roles_login_normally(client, db):
    """8. Existing valid users can still log in normally."""
    roles = [
        (UserRole.ADMIN, "admin_role_test@kim.com"),
        (UserRole.SALES_EXECUTIVE, "sales_role_test@kim.com"),
        (UserRole.FINANCE_OFFICER, "finance_role_test@kim.com"),
        (UserRole.DELIVERY_TEAM, "delivery_role_test@kim.com"),
    ]
    for role, email in roles:
        u = make_user(email, role, f"User {role.value}")
        db.add(u)
    db.commit()

    for role, email in roles:
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": DEFAULT_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["email"] == email
        assert data["user"]["role"] == role.value
        assert "access_token" in data


def test_case_9_roles_and_permissions_enforced_after_login(client, db):
    """9. Existing user roles and permissions remain enforced after login."""
    sales_user = make_user("sales_perm_check@kim.com", UserRole.SALES_EXECUTIVE)
    admin_user = make_user("admin_perm_check@kim.com", UserRole.ADMIN)
    db.add_all([sales_user, admin_user])
    db.commit()

    # Sales user logs in
    resp_sales = client.post(
        "/api/v1/auth/login",
        json={"email": "sales_perm_check@kim.com", "password": DEFAULT_PASSWORD},
    )
    sales_token = resp_sales.json()["access_token"]

    # Sales user attempting admin endpoint should be 403 Forbidden
    resp_forbidden = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert resp_forbidden.status_code == 403

    # Admin user logs in
    resp_admin = client.post(
        "/api/v1/auth/login",
        json={"email": "admin_perm_check@kim.com", "password": DEFAULT_PASSWORD},
    )
    admin_token = resp_admin.json()["access_token"]

    # Admin user accessing admin endpoint should succeed (200 OK)
    resp_admin_access = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin_access.status_code == 200


def test_case_10_server_error_and_exceptions_never_authenticate(client, db):
    """10. Server errors, database errors, and password-verification exceptions must never result in successful authentication."""
    # User with a corrupted / plaintext hash
    corrupt_user = User(
        email="corrupt_hash_user@kim.com",
        password_hash="plaintext_x_not_argon2",
        full_name="Corrupt User",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    # Inactive user
    inactive_user = User(
        email="inactive_user@kim.com",
        password_hash=hash_password(DEFAULT_PASSWORD),
        full_name="Inactive User",
        role=UserRole.SALES_EXECUTIVE,
        status=UserStatus.INACTIVE,
    )
    db.add_all([corrupt_user, inactive_user])
    db.commit()

    # Attempt to log in with corrupt hash user (even typing the exact plaintext hash as password)
    resp_corrupt = client.post(
        "/api/v1/auth/login",
        json={"email": "corrupt_hash_user@kim.com", "password": "plaintext_x_not_argon2"},
    )
    assert resp_corrupt.status_code == 401
    assert "access_token" not in resp_corrupt.json()

    # Attempt to log in with inactive user with correct password
    resp_inactive = client.post(
        "/api/v1/auth/login",
        json={"email": "inactive_user@kim.com", "password": DEFAULT_PASSWORD},
    )
    assert resp_inactive.status_code == 401
    assert "access_token" not in resp_inactive.json()
