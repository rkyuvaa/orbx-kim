import pytest
from app.models.enums import UserRole
from app.models.rbac import (
    Permission,
    Role,
    RolePermission,
    UserPermission,
    UserRole as RbacUserRole,
    PermissionStatus,
)
from app.models.user import User, UserStatus
from app.core.security import hash_password
from app.db.seed_rbac import seed_rbac_data
from app.services.rbac_service import get_user_effective_permissions_data, can_user
from tests.conftest import DEFAULT_PASSWORD, auth_headers, login


def test_super_admin_has_all_modules(db):
    """Test that a super_admin user receives universal wildcard access to all modules."""
    seed_rbac_data(db)

    super_admin_role = db.query(Role).filter(Role.code == "super_admin").first()
    assert super_admin_role is not None

    user = User(
        email="super_admin_test@kim.com",
        password_hash=hash_password(DEFAULT_PASSWORD),
        full_name="Super Admin Tester",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()

    db.add(RbacUserRole(user_id=user.id, role_id=super_admin_role.id, is_primary=True))
    db.commit()

    eff = get_user_effective_permissions_data(db, user)
    granted = [p for p in eff.permissions if p.granted]
    total_perms = db.query(Permission).count()

    assert len(granted) == total_perms
    assert can_user(db, user, "view", "crm_dashboard") is True
    assert can_user(db, user, "view", "leads") is True
    assert can_user(db, user, "view", "projects") is True
    assert can_user(db, user, "view", "plm") is True
    assert can_user(db, user, "view", "hr_master") is True
    assert can_user(db, user, "view", "renewal_tracker") is True
    assert can_user(db, user, "view", "users") is True


def test_sales_executive_allowed_modules_only(db):
    """Test that sales_executive user can ONLY access CRM and Project resources, denied other modules."""
    seed_rbac_data(db)

    sales_exec_role = db.query(Role).filter(Role.code == "sales_executive").first()
    assert sales_exec_role is not None

    user = User(
        email="sales_exec_test@kim.com",
        password_hash=hash_password(DEFAULT_PASSWORD),
        full_name="Sales Executive Tester",
        role=UserRole.SALES_EXECUTIVE,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()

    db.add(RbacUserRole(user_id=user.id, role_id=sales_exec_role.id, is_primary=True))
    db.commit()

    eff = get_user_effective_permissions_data(db, user)
    granted_perms = {p.permission_code for p in eff.permissions if p.granted}

    # Allowed in CRM & Project & Task
    assert "crm:leads:view" in granted_perms
    assert "crm:crm_dashboard:view" in granted_perms
    assert "project_task:projects:view" in granted_perms
    assert "project_task:my_tasks:view" in granted_perms
    assert can_user(db, user, "view", "leads") is True
    assert can_user(db, user, "view", "projects") is True

    # STRICTLY DENIED: HR, PLM, Renewal Tracker, Requirements, Policy Compliance, Administration
    assert "hr_employee:hr_master:view" not in granted_perms
    assert "plm:plm:view" not in granted_perms
    assert "renewal_tracker_module:renewal_tracker:view" not in granted_perms
    assert "administration:users:view" not in granted_perms
    assert can_user(db, user, "view", "hr_master") is False
    assert can_user(db, user, "view", "plm") is False
    assert can_user(db, user, "view", "renewal_tracker") is False
    assert can_user(db, user, "view", "users") is False


def test_hr_manager_allowed_modules_only(db):
    """Test that hr_manager user can ONLY access HR resources, denied CRM, PLM, Admin."""
    seed_rbac_data(db)

    hr_role = db.query(Role).filter(Role.code == "hr_manager").first()
    assert hr_role is not None

    user = User(
        email="hr_manager_test@kim.com",
        password_hash=hash_password(DEFAULT_PASSWORD),
        full_name="HR Manager Tester",
        role=UserRole.SALES_EXECUTIVE,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()

    db.add(RbacUserRole(user_id=user.id, role_id=hr_role.id, is_primary=True))
    db.commit()

    eff = get_user_effective_permissions_data(db, user)
    granted_perms = {p.permission_code for p in eff.permissions if p.granted}

    # Allowed in HR
    assert "hr_employee:hr_master:view" in granted_perms
    assert "hr_employee:hr_attendance:view" in granted_perms
    assert "hr_employee:hr_leave:view" in granted_perms
    assert can_user(db, user, "view", "hr_master") is True
    assert can_user(db, user, "view", "hr_attendance") is True

    # STRICTLY DENIED: CRM, PLM, Renewal Tracker, Admin
    assert "crm:crm_dashboard:view" not in granted_perms
    assert "crm:leads:view" not in granted_perms
    assert "plm:plm:view" not in granted_perms
    assert "renewal_tracker_module:renewal_tracker:view" not in granted_perms
    assert "administration:users:view" not in granted_perms
    assert can_user(db, user, "view", "crm_dashboard") is False
    assert can_user(db, user, "view", "leads") is False
    assert can_user(db, user, "view", "plm") is False
    assert can_user(db, user, "view", "users") is False


def test_employee_allowed_modules_only(db):
    """Test that employee user can only access Self Service, Leave, Attendance, and My Tasks."""
    seed_rbac_data(db)

    emp_role = db.query(Role).filter(Role.code == "employee").first()
    assert emp_role is not None

    user = User(
        email="employee_test@kim.com",
        password_hash=hash_password(DEFAULT_PASSWORD),
        full_name="Employee Tester",
        role=UserRole.SALES_EXECUTIVE,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()

    db.add(RbacUserRole(user_id=user.id, role_id=emp_role.id, is_primary=True))
    db.commit()

    eff = get_user_effective_permissions_data(db, user)
    granted_perms = {p.permission_code for p in eff.permissions if p.granted}

    # Allowed in Employee scope
    assert "hr_employee:hr_self_service:view" in granted_perms
    assert "hr_employee:hr_attendance:view" in granted_perms
    assert "hr_employee:hr_leave:view" in granted_perms
    assert "project_task:my_tasks:view" in granted_perms
    assert can_user(db, user, "view", "hr_self_service") is True
    assert can_user(db, user, "view", "my_tasks") is True

    # DENIED: CRM, PLM, HR Recruitment, Renewal, Admin
    assert "crm:crm_dashboard:view" not in granted_perms
    assert "crm:leads:view" not in granted_perms
    assert "hr_employee:hr_recruitment:view" not in granted_perms
    assert "plm:plm:view" not in granted_perms
    assert "administration:users:view" not in granted_perms
    assert can_user(db, user, "view", "crm_dashboard") is False
    assert can_user(db, user, "view", "leads") is False
    assert can_user(db, user, "view", "plm") is False
    assert can_user(db, user, "view", "users") is False


def test_user_role_update_demotion(seeded_client, db):
    """Test that updating a user from Admin role to Employee role properly demotes access."""
    seed_rbac_data(db)

    admin_token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    admin_headers = auth_headers(admin_token)

    emp_role = db.query(Role).filter(Role.code == "employee").first()
    admin_role = db.query(Role).filter(Role.code == "admin").first()
    assert emp_role is not None
    assert admin_role is not None

    # Create user with Admin role
    test_user = User(
        email="demote_target@kim.com",
        password_hash=hash_password(DEFAULT_PASSWORD),
        full_name="Demote Target",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(test_user)
    db.commit()
    db.add(RbacUserRole(user_id=test_user.id, role_id=admin_role.id, is_primary=True))
    db.commit()

    # Verify initially has Admin permissions
    eff_before = get_user_effective_permissions_data(db, test_user)
    granted_before = [p for p in eff_before.permissions if p.granted]
    assert len(granted_before) > 100

    # Call API to update user to Employee role
    resp = seeded_client.patch(
        f"/api/v1/admin/users/{test_user.id}",
        json={
            "role_ids": [emp_role.id],
            "primary_role": "employee",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # Refresh user from DB
    db.refresh(test_user)
    assert test_user.role != UserRole.ADMIN

    # Verify permissions are now demoted
    eff_after = get_user_effective_permissions_data(db, test_user)
    granted_after = [p for p in eff_after.permissions if p.granted]
    assert len(granted_after) == 35
    assert can_user(db, test_user, "view", "crm_dashboard") is False
    assert can_user(db, test_user, "view", "users") is False
    assert can_user(db, test_user, "view", "hr_self_service") is True
