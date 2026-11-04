import pytest
from app.models.enums import UserRole
from tests.conftest import DEFAULT_PASSWORD, auth_headers, login

def test_rbac_admin_full_crud(seeded_client, db):
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # 1. DEPARTMENT CRUD
    dept_payload = {
        "name": "Software Engineering",
        "code": "ENG-DEPT",
        "description": "Core software engineering department",
        "status": "ACTIVE",
    }
    dept_resp = seeded_client.post("/api/v1/admin/departments", json=dept_payload, headers=headers)
    assert dept_resp.status_code == 201, dept_resp.text
    dept_id = dept_resp.json()["id"]

    dept_list = seeded_client.get("/api/v1/admin/departments", headers=headers)
    assert dept_list.status_code == 200
    assert any(d["id"] == dept_id for d in dept_list.json())

    dept_tree = seeded_client.get("/api/v1/admin/departments/tree", headers=headers)
    assert dept_tree.status_code == 200

    # 2. ROLE CRUD
    role_payload = {
        "name": "Project Manager",
        "code": "ROLE_PM",
        "description": "Manages projects and project teams",
        "status": "ACTIVE",
    }
    role_resp = seeded_client.post("/api/v1/admin/roles", json=role_payload, headers=headers)
    assert role_resp.status_code == 201, role_resp.text
    role_id = role_resp.json()["id"]

    role_list = seeded_client.get("/api/v1/admin/roles", headers=headers)
    assert role_list.status_code == 200
    assert any(r["id"] == role_id for r in role_list.json())

    # Duplicate Role
    dup_resp = seeded_client.post(
        f"/api/v1/admin/roles/{role_id}/duplicate",
        json={"new_name": "Senior Project Manager", "new_code": "ROLE_SPM"},
        headers=headers,
    )
    assert dup_resp.status_code == 201, dup_resp.text
    dup_role_id = dup_resp.json()["id"]

    # Delete Duplicated Role
    del_role_resp = seeded_client.delete(f"/api/v1/admin/roles/{dup_role_id}", headers=headers)
    assert del_role_resp.status_code == 204

    # 3. USER MANAGEMENT CRUD
    user_payload = {
        "email": "dev.user@kim.com",
        "username": "devuser",
        "password": "Password123!",
        "full_name": "Developer User",
        "primary_role": "SALES_EXECUTIVE",
        "status": "ACTIVE",
        "department_ids": [dept_id],
        "role_ids": [role_id],
    }
    user_resp = seeded_client.post("/api/v1/admin/users", json=user_payload, headers=headers)
    assert user_resp.status_code == 201, user_resp.text
    created_user_id = user_resp.json()["id"]

    user_get = seeded_client.get(f"/api/v1/admin/users/{created_user_id}", headers=headers)
    assert user_get.status_code == 200
    assert user_get.json()["email"] == "dev.user@kim.com"

    # User List with Pagination & Filters
    user_list = seeded_client.get("/api/v1/admin/users?page=1&page_size=10", headers=headers)
    assert user_list.status_code == 200
    assert user_list.json()["total"] >= 1

    # Effective Permissions View
    eff_perm = seeded_client.get(f"/api/v1/admin/users/{created_user_id}/effective-permissions", headers=headers)
    assert eff_perm.status_code == 200

    # Soft Delete User
    user_del = seeded_client.delete(f"/api/v1/admin/users/{created_user_id}", headers=headers)
    assert user_del.status_code == 204

    # Confirm user is deleted
    user_after_del = seeded_client.get(f"/api/v1/admin/users/{created_user_id}", headers=headers)
    assert user_after_del.status_code == 404
