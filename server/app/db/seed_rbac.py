"""Seed script for initializing RBAC default modules, resources, actions, permissions, roles, and departments."""

from sqlalchemy.orm import Session
from app.models.rbac import (
    Action,
    AuditActionType,
    Department,
    DepartmentUser,
    FieldPermissionType,
    Module,
    Permission,
    PermissionStatus,
    Resource,
    Role,
    RoleDataScope,
    RolePermission,
    UserRole as RbacUserRole,
    DataScopeType,
)
from app.models.user import User
from app.models.enums import UserRole


def seed_rbac_data(db: Session) -> None:
    """Populate default RBAC structure if not present."""
    # 1. Modules
    modules_data = [
        {"name": "PLM", "code": "plm", "display_order": 1, "icon": "Cpu"},
        {"name": "CRM Management", "code": "crm", "display_order": 2, "icon": "Users"},
        {"name": "Vehicle Service", "code": "vehicle_service_module", "display_order": 3, "icon": "Car"},
        {"name": "Project & Task Management", "code": "project_task", "display_order": 4, "icon": "FolderPlus"},
        {"name": "HR & Employee Management", "code": "hr_employee", "display_order": 4, "icon": "Users"},
        {"name": "Renewal Tracker", "code": "renewal_tracker_module", "display_order": 5, "icon": "RefreshCw"},
        {"name": "Requirements Management", "code": "requirements_module", "display_order": 6, "icon": "ClipboardList"},
        {"name": "KIM - Policy & Compliance", "code": "policy_compliance_module", "display_order": 7, "icon": "ShieldCheck"},
        {"name": "Administration", "code": "administration", "display_order": 8, "icon": "ShieldCheck"},
        {"name": "Reports & Analytics", "code": "reports", "display_order": 9, "icon": "BarChart3"},
        {"name": "System Configuration", "code": "configuration", "display_order": 10, "icon": "Settings2"},
        {"name": "Other", "code": "other", "display_order": 11, "icon": "Settings"},
    ]

    modules_map = {}
    for m in modules_data:
        mod = db.query(Module).filter(Module.code == m["code"]).first()
        if not mod:
            mod = Module(
                name=m["name"],
                code=m["code"],
                display_order=m["display_order"],
                icon=m["icon"],
                status=PermissionStatus.ACTIVE,
            )
            db.add(mod)
            db.flush()
        modules_map[m["code"]] = mod

    # 2. Resources
    resources_data = [
        # PLM
        {"module_code": "plm", "name": "PLM Dashboard", "code": "plm", "display_order": 1},

        # CRM
        {"module_code": "crm", "name": "CRM Dashboard", "code": "crm_dashboard", "display_order": 1},
        {"module_code": "crm", "name": "Leads", "code": "leads", "display_order": 2},
        {"module_code": "crm", "name": "Customers", "code": "customers", "display_order": 3},
        {"module_code": "crm", "name": "Opportunities", "code": "opportunities", "display_order": 4},
        {"module_code": "crm", "name": "Activities", "code": "activities", "display_order": 5},
        {"module_code": "crm", "name": "CRM Reports", "code": "crm_reports", "display_order": 6},
        {"module_code": "crm", "name": "CRM Configuration", "code": "crm_configuration", "display_order": 7},

        # Vehicle Service
        {"module_code": "vehicle_service_module", "name": "Vehicle Service Dashboard", "code": "vs_dashboard", "display_order": 1},
        {"module_code": "vehicle_service_module", "name": "Work Orders & Complaints", "code": "vs_work_orders", "display_order": 2},
        {"module_code": "vehicle_service_module", "name": "Vehicle Service History", "code": "vs_service_history", "display_order": 3},
        {"module_code": "vehicle_service_module", "name": "Service Reports & Misuse", "code": "vs_reports", "display_order": 4},
        {"module_code": "vehicle_service_module", "name": "Kit & Vehicle Configuration", "code": "vs_configuration", "display_order": 5},

        # Project & Task
        {"module_code": "project_task", "name": "Projects", "code": "projects", "display_order": 1},
        {"module_code": "project_task", "name": "Tasks", "code": "tasks", "display_order": 2},
        {"module_code": "project_task", "name": "My Task", "code": "my_tasks", "display_order": 3},
        {"module_code": "project_task", "name": "Project Configuration", "code": "project_configuration", "display_order": 4},

        # HR & Employee
        {"module_code": "hr_employee", "name": "Recruitment", "code": "hr_recruitment", "display_order": 1},
        {"module_code": "hr_employee", "name": "Employee On/off boarding", "code": "hr_onboarding", "display_order": 2},
        {"module_code": "hr_employee", "name": "Employee Master", "code": "hr_master", "display_order": 3},
        {"module_code": "hr_employee", "name": "Attendance", "code": "hr_attendance", "display_order": 4},
        {"module_code": "hr_employee", "name": "Leave Management", "code": "hr_leave", "display_order": 5},
        {"module_code": "hr_employee", "name": "Payroll", "code": "hr_payroll", "display_order": 6},
        {"module_code": "hr_employee", "name": "Self Service", "code": "hr_self_service", "display_order": 7},
        {"module_code": "hr_employee", "name": "HR Reports", "code": "hr_reports", "display_order": 8},
        {"module_code": "hr_employee", "name": "HR Configuration", "code": "hr_configuration", "display_order": 9},

        # Renewal Tracker
        {"module_code": "renewal_tracker_module", "name": "Renewal Tracker", "code": "renewal_tracker", "display_order": 1},
        {"module_code": "renewal_tracker_module", "name": "Renewal Reports", "code": "renewal_reports", "display_order": 2},
        {"module_code": "renewal_tracker_module", "name": "Renewal Configuration", "code": "renewal_configuration", "display_order": 3},

        # Requirements
        {"module_code": "requirements_module", "name": "Material Requirement", "code": "req_material", "display_order": 1},
        {"module_code": "requirements_module", "name": "IT Requirement", "code": "req_it", "display_order": 2},

        # Policy & Compliance
        {"module_code": "policy_compliance_module", "name": "Company Policies", "code": "compliance_policies", "display_order": 1},
        {"module_code": "policy_compliance_module", "name": "Compliance Audit", "code": "compliance_audit", "display_order": 2},
        {"module_code": "policy_compliance_module", "name": "SOPs", "code": "compliance_sops", "display_order": 3},
        {"module_code": "policy_compliance_module", "name": "Acknowledgements", "code": "compliance_acknowledgements", "display_order": 4},

        # Administration
        {"module_code": "administration", "name": "Users", "code": "users", "display_order": 1},
        {"module_code": "administration", "name": "Roles", "code": "roles", "display_order": 2},
        {"module_code": "administration", "name": "Departments", "code": "departments", "display_order": 3},
        {"module_code": "administration", "name": "Permissions", "code": "permissions", "display_order": 4},
        {"module_code": "administration", "name": "Access Audit Log", "code": "audit_logs", "display_order": 5},

        # Reports
        {"module_code": "reports", "name": "Reports Summary", "code": "summary_reports", "display_order": 1},

        # System Configuration
        {"module_code": "configuration", "name": "System Masters", "code": "masters", "display_order": 1},
        {"module_code": "configuration", "name": "Automove Rules", "code": "automove_rules", "display_order": 2},

        # Other
        {"module_code": "other", "name": "Notifications", "code": "notifications", "display_order": 1},
        {"module_code": "other", "name": "System Settings", "code": "settings", "display_order": 2},
    ]

    resources_map = {}
    for r in resources_data:
        mod = modules_map.get(r["module_code"])
        if not mod:
            continue
        res = db.query(Resource).filter(Resource.module_id == mod.id, Resource.code == r["code"]).first()
        if not res:
            res = Resource(
                module_id=mod.id,
                name=r["name"],
                code=r["code"],
                display_order=r["display_order"],
                status=PermissionStatus.ACTIVE,
            )
            db.add(res)
            db.flush()
        resources_map[r["code"]] = res

    # 3. Actions
    standard_actions = [
        {"name": "View", "code": "view", "display_order": 1},
        {"name": "Create", "code": "create", "display_order": 2},
        {"name": "Edit", "code": "edit", "display_order": 3},
        {"name": "Delete", "code": "delete", "display_order": 4},
        {"name": "Export", "code": "export", "display_order": 5},
        {"name": "Import", "code": "import", "display_order": 6},
        {"name": "Approve", "code": "approve", "display_order": 7},
    ]

    actions_map = {}
    for res_code, res in resources_map.items():
        actions_map[res_code] = {}
        for a in standard_actions:
            act = db.query(Action).filter(Action.resource_id == res.id, Action.code == a["code"]).first()
            if not act:
                act = Action(
                    resource_id=res.id,
                    name=a["name"],
                    code=a["code"],
                    display_order=a["display_order"],
                    status=PermissionStatus.ACTIVE,
                )
                db.add(act)
                db.flush()
            actions_map[res_code][a["code"]] = act

    # 4. Permissions (module:resource:action)
    permissions_map = {}
    for res_code, res in resources_map.items():
        for act_code, act in actions_map[res_code].items():
            perm_code = f"{res.module.code}:{res_code}:{act_code}"
            perm = db.query(Permission).filter(Permission.code == perm_code).first()
            if not perm:
                perm = Permission(
                    module_id=res.module_id,
                    resource_id=res.id,
                    action_id=act.id,
                    code=perm_code,
                    description=f"{act.name} permission on {res.name}",
                    status=PermissionStatus.ACTIVE,
                )
                db.add(perm)
                db.flush()
            permissions_map[perm_code] = perm

    # 5. Departments
    root_dept = db.query(Department).filter(Department.code == "COMPANY").first()
    if not root_dept:
        root_dept = Department(name="KIM Finance HQ", code="COMPANY", description="Headquarters", status=PermissionStatus.ACTIVE)
        db.add(root_dept)
        db.flush()

    depts_data = [
        {"name": "Sales", "code": "SALES", "parent_id": root_dept.id},
        {"name": "Domestic Sales", "code": "DOM_SALES", "parent_id": None}, # will set after sales
        {"name": "International Sales", "code": "INT_SALES", "parent_id": None},
        {"name": "Finance", "code": "FINANCE", "parent_id": root_dept.id},
        {"name": "HR & Admin", "code": "HR", "parent_id": root_dept.id},
        {"name": "Operations", "code": "OPERATIONS", "parent_id": root_dept.id},
        {"name": "IT & Systems", "code": "IT", "parent_id": root_dept.id},
    ]

    sales_dept = db.query(Department).filter(Department.code == "SALES").first()
    if not sales_dept:
        sales_dept = Department(name="Sales", code="SALES", description="Sales & Business Development", parent_id=root_dept.id, status=PermissionStatus.ACTIVE)
        db.add(sales_dept)
        db.flush()

    for d in depts_data:
        dept = db.query(Department).filter(Department.code == d["code"]).first()
        if not dept:
            parent_id = d["parent_id"]
            if d["code"] in ["DOM_SALES", "INT_SALES"]:
                parent_id = sales_dept.id
            dept = Department(name=d["name"], code=d["code"], parent_id=parent_id, status=PermissionStatus.ACTIVE)
            db.add(dept)
            db.flush()

    # 6. Roles
    default_roles = [
        {"name": "Super Admin", "code": "super_admin", "is_system": True, "description": "Full system access & administration"},
        {"name": "Admin", "code": "admin", "is_system": True, "description": "Administrative control and user management"},
        {"name": "Sales Manager", "code": "sales_manager", "is_system": False, "description": "Departmental sales overview and approvals"},
        {"name": "Sales Executive", "code": "sales_executive", "is_system": False, "description": "Lead creation and assigned application processing"},
        {"name": "Finance Officer", "code": "finance_officer", "is_system": False, "description": "Sanction and loan disbursement processing"},
        {"name": "Delivery Team", "code": "delivery_team", "is_system": False, "description": "Vehicle delivery and document verification"},
        {"name": "HR Manager", "code": "hr_manager", "is_system": False, "description": "Employee and user status management"},
        {"name": "Employee", "code": "employee", "is_system": False, "description": "Base employee role"},
    ]

    roles_map = {}
    for r in default_roles:
        role = db.query(Role).filter(Role.code == r["code"]).first()
        if not role:
            role = Role(
                name=r["name"],
                code=r["code"],
                is_system=r["is_system"],
                description=r["description"],
                status=PermissionStatus.ACTIVE,
            )
            db.add(role)
            db.flush()
        roles_map[r["code"]] = role

    # Assign all permissions to Super Admin & Admin
    all_perms = db.query(Permission).all()
    super_admin_role = roles_map.get("super_admin")
    admin_role = roles_map.get("admin")

    for p in all_perms:
        if super_admin_role:
            rp = db.query(RolePermission).filter(RolePermission.role_id == super_admin_role.id, RolePermission.permission_id == p.id).first()
            if not rp:
                db.add(RolePermission(role_id=super_admin_role.id, permission_id=p.id, granted=True))
        if admin_role:
            rp = db.query(RolePermission).filter(RolePermission.role_id == admin_role.id, RolePermission.permission_id == p.id).first()
            if not rp:
                db.add(RolePermission(role_id=admin_role.id, permission_id=p.id, granted=True))

    # Module allocations for standard roles
    role_resource_allocations = {
        "sales_executive": ["crm_dashboard", "leads", "opportunities", "customers", "activities", "crm_reports", "crm_configuration", "projects", "tasks", "my_tasks", "masters"],
        "sales_manager": ["crm_dashboard", "leads", "opportunities", "customers", "activities", "crm_reports", "crm_configuration", "projects", "tasks", "my_tasks", "summary_reports", "masters"],
        "finance_officer": ["crm_dashboard", "leads", "opportunities", "crm_reports", "summary_reports", "masters"],
        "delivery_team": ["crm_dashboard", "leads", "opportunities", "masters"],
        "hr_manager": ["hr_recruitment", "hr_onboarding", "hr_master", "hr_attendance", "hr_leave", "hr_payroll", "hr_self_service", "hr_reports", "hr_configuration", "masters"],
        "employee": ["hr_self_service", "hr_attendance", "hr_leave", "my_tasks", "tasks"],
    }

    for role_code, res_codes in role_resource_allocations.items():
        role_obj = roles_map.get(role_code)
        if not role_obj:
            continue
        for p in all_perms:
            if p.resource and p.resource.code in res_codes:
                rp = db.query(RolePermission).filter(RolePermission.role_id == role_obj.id, RolePermission.permission_id == p.id).first()
                if not rp:
                    db.add(RolePermission(role_id=role_obj.id, permission_id=p.id, granted=True))

    # Link Super Admin role to default admin user(s)
    admin_users = db.query(User).filter(User.email.in_(["admin@kim.com", "admin@test.com"])).all()
    for admin_user in admin_users:
        if admin_user and super_admin_role:
            ur = db.query(RbacUserRole).filter(RbacUserRole.user_id == admin_user.id, RbacUserRole.role_id == super_admin_role.id).first()
            if not ur:
                db.add(RbacUserRole(user_id=admin_user.id, role_id=super_admin_role.id, is_primary=True))

    db.commit()
