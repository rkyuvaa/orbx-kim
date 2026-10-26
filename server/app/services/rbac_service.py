import json
from typing import Any
from fastapi import Request
from sqlalchemy.orm import Session

from app.models.rbac import (
    Action,
    AuditActionType,
    AuditLog,
    DepartmentUser,
    Module,
    Permission,
    PermissionStatus,
    Resource,
    Role,
    RoleDataScope,
    RoleFieldPermission,
    RolePermission,
    UserPermission,
    UserRole as RbacUserRole,
    DataScopeType,
    FieldPermissionType,
)
from app.models.user import User, UserStatus
from app.models.enums import UserRole
from app.schemas.rbac import EffectiveAccessSummary, EffectivePermissionItem


def log_audit_event(
    db: Session,
    action_type: AuditActionType,
    user_id: int | None = None,
    module: str | None = None,
    resource: str | None = None,
    record_id: str | None = None,
    previous_value: Any | None = None,
    new_value: Any | None = None,
    req: Request | None = None,
    success: bool = True,
    error_message: str | None = None,
) -> AuditLog:
    """Record a security or access audit log entry."""
    ip_addr = None
    user_agent = None
    if req:
        ip_addr = req.client.host if req.client else None
        user_agent = req.headers.get("user-agent")

    prev_str = json.dumps(previous_value, default=str) if isinstance(previous_value, (dict, list)) else (str(previous_value) if previous_value is not None else None)
    new_str = json.dumps(new_value, default=str) if isinstance(new_value, (dict, list)) else (str(new_value) if new_value is not None else None)

    audit_entry = AuditLog(
        user_id=user_id,
        action_type=action_type,
        module=module,
        resource=resource,
        record_id=str(record_id) if record_id is not None else None,
        previous_value=prev_str,
        new_value=new_str,
        ip_address=ip_addr,
        user_agent=user_agent,
        success=success,
        error_message=error_message,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry


def get_user_active_roles(db: Session, user: User) -> list[Role]:
    """Gather all active roles assigned to a user via RbacUserRole table or matching User.role code."""
    rbac_user_roles = db.query(RbacUserRole).filter(RbacUserRole.user_id == user.id).all()
    roles_list = [ur.role for ur in rbac_user_roles if ur.role and ur.role.status == PermissionStatus.ACTIVE]
    role_ids = {r.id for r in roles_list if r}

    # Only fall back to legacy User.role if no dynamic RbacUserRole assignments exist
    if not role_ids and user.role:
        role_code = user.role.value if hasattr(user.role, "value") else str(user.role)
        role_code = role_code.lower()
        role_by_code = db.query(Role).filter(Role.status == PermissionStatus.ACTIVE, Role.code.ilike(role_code)).first()
        if not role_by_code:
            from app.db.seed_rbac import seed_rbac_data
            try:
                seed_rbac_data(db)
                role_by_code = db.query(Role).filter(Role.status == PermissionStatus.ACTIVE, Role.code.ilike(role_code)).first()
            except Exception:
                pass
        if role_by_code and role_by_code.id not in role_ids:
            roles_list.append(role_by_code)

    return roles_list


def get_user_effective_permissions_data(db: Session, user: User) -> EffectiveAccessSummary:
    """Calculate and return effective permissions for a user with source metadata."""
    # Active check
    if user.status != UserStatus.ACTIVE:
        return EffectiveAccessSummary(
            user_id=user.id,
            user_name=user.full_name,
            roles=[],
            departments=[],
            permissions=[],
        )

    # Gather user roles
    roles = get_user_active_roles(db, user)

    # ONLY true super_admin role gets universal wildcard bypass
    is_super_admin = any(r.code == "super_admin" for r in roles)

    # Gather user departments
    dept_users = db.query(DepartmentUser).filter(DepartmentUser.user_id == user.id).all()
    departments = [du.department.name for du in dept_users if du.department]

    all_permissions = db.query(Permission).all()
    effective_items: list[EffectivePermissionItem] = []

    if is_super_admin:
        for p in all_permissions:
            effective_items.append(
                EffectivePermissionItem(
                    permission_code=p.code,
                    module_code=p.module.code if p.module else "",
                    resource_code=p.resource.code if p.resource else "",
                    action_code=p.action.code if p.action else "",
                    granted=True,
                    source_type="SUPER_ADMIN",
                    source_name="Super Admin Role",
                    scope_type=DataScopeType.ALL,
                )
            )
        return EffectiveAccessSummary(
            user_id=user.id,
            user_name=user.full_name,
            roles=[r.name for r in roles] or ["Admin"],
            departments=departments,
            permissions=effective_items,
        )

    # Gather direct user overrides
    user_overrides = db.query(UserPermission).filter(UserPermission.user_id == user.id).all()
    override_map = {uo.permission_id: uo for uo in user_overrides}

    # Gather role permissions
    role_perm_map: dict[int, list[Role]] = {}
    for r in roles:
        for rp in r.permissions:
            if rp.granted:
                if rp.permission_id not in role_perm_map:
                    role_perm_map[rp.permission_id] = []
                role_perm_map[rp.permission_id].append(r)

    for p in all_permissions:
        # Check direct override first
        if p.id in override_map:
            uo = override_map[p.id]
            source_t = "DIRECT_GRANT" if uo.granted else "DIRECT_RESTRICTION"
            effective_items.append(
                EffectivePermissionItem(
                    permission_code=p.code,
                    module_code=p.module.code if p.module else "",
                    resource_code=p.resource.code if p.resource else "",
                    action_code=p.action.code if p.action else "",
                    granted=uo.granted,
                    source_type=source_t,
                    source_name=f"Direct Override: {uo.reason or ('Granted' if uo.granted else 'Restricted')}",
                    scope_type=DataScopeType.ALL,
                )
            )
        elif p.id in role_perm_map:
            granting_roles = role_perm_map[p.id]
            role_names = ", ".join([r.name for r in granting_roles])
            effective_items.append(
                EffectivePermissionItem(
                    permission_code=p.code,
                    module_code=p.module.code if p.module else "",
                    resource_code=p.resource.code if p.resource else "",
                    action_code=p.action.code if p.action else "",
                    granted=True,
                    source_type="ROLE",
                    source_name=f"Role: {role_names}",
                    scope_type=DataScopeType.ALL,
                )
            )
        else:
            effective_items.append(
                EffectivePermissionItem(
                    permission_code=p.code,
                    module_code=p.module.code if p.module else "",
                    resource_code=p.resource.code if p.resource else "",
                    action_code=p.action.code if p.action else "",
                    granted=False,
                    source_type="NO_ACCESS",
                    source_name="Not Granted",
                    scope_type=DataScopeType.OWN,
                )
            )

    return EffectiveAccessSummary(
        user_id=user.id,
        user_name=user.full_name,
        roles=[r.name for r in roles],
        departments=departments,
        permissions=effective_items,
    )


def can_user(
    db: Session,
    user: User,
    action_code: str,
    resource_code: str,
    record: Any | None = None,
) -> bool:
    """Central authorization engine: evaluates user status, roles, overrides, and scopes."""
    if not user or user.status != UserStatus.ACTIVE:
        return False

    # 1. Super Admin check: only true super_admin role gets universal wildcard
    roles = get_user_active_roles(db, user)
    if any(r.code == "super_admin" for r in roles):
        return True

    # Parse inputs to resolve module, resource, and action
    module_code = None
    resolved_resource = resource_code
    resolved_action = action_code

    if ":" in resource_code:
        parts = resource_code.split(":")
        if len(parts) == 3:
            module_code, resolved_resource, resolved_action = parts[0], parts[1], parts[2]
        elif len(parts) == 2:
            if parts[1] in ["view", "create", "edit", "delete", "export", "import", "approve"]:
                resolved_resource, resolved_action = parts[0], parts[1]
            else:
                module_code, resolved_resource = parts[0], parts[1]

    # Find matching permission in DB
    perm_query = db.query(Permission).join(Permission.resource).join(Permission.action)
    if module_code:
        perm_query = perm_query.join(Permission.module).filter(Module.code == module_code)

    perm = perm_query.filter(
        Resource.code == resolved_resource,
        Action.code == resolved_action
    ).first()

    if not perm:
        # Secondary fallback: search by code ending with :resource_code:action_code
        perm = db.query(Permission).filter(Permission.code.endswith(f":{resolved_resource}:{resolved_action}")).first()

    if not perm:
        # Permission not registered or resource unmapped -> Default Deny
        return False

    # 2. Direct User Override
    user_perm = (
        db.query(UserPermission)
        .filter(UserPermission.user_id == user.id, UserPermission.permission_id == perm.id)
        .first()
    )
    if user_perm is not None:
        if not user_perm.granted:
            return False
        return True

    # 3. Combined Role Permissions
    has_role_grant = False
    role_ids = [r.id for r in roles]
    if role_ids:
        rp = (
            db.query(RolePermission)
            .filter(
                RolePermission.role_id.in_(role_ids),
                RolePermission.permission_id == perm.id,
                RolePermission.granted == True,
            )
            .first()
        )
        if rp:
            has_role_grant = True

    if not has_role_grant:
        return False

    # 4. Record Scope Check (if record provided)
    if record is not None:
        assigned_to = getattr(record, "assigned_to", None)
        created_by = getattr(record, "created_by", None)
        user_id = getattr(record, "user_id", None)
        
        if assigned_to == user.id or created_by == user.id or user_id == user.id:
            return True

    return True


def get_user_field_permissions(db: Session, user: User, resource_code: str) -> dict[str, FieldPermissionType]:
    """Get field-level access overrides for a specific resource."""
    roles = get_user_active_roles(db, user)
    if any(r.code == "super_admin" for r in roles):
        return {}

    rbac_user_roles = db.query(RbacUserRole).filter(RbacUserRole.user_id == user.id).all()
    role_ids = [ur.role_id for ur in rbac_user_roles]

    if not role_ids:
        return {}

    field_perms = (
        db.query(RoleFieldPermission)
        .join(RoleFieldPermission.resource)
        .filter(RoleFieldPermission.role_id.in_(role_ids), RoleFieldPermission.resource.has(code=resource_code))
        .all()
    )

    result = {}
    for fp in field_perms:
        result[fp.field_name] = fp.permission_type
    return result
