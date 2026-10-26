from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles, require_permission
from app.db.session import get_db
from app.models import (
    ActivityType,
    Application,
    ApplicationStatus,
    CrmDropdownOption,
    CrmTab,
    CrmTabField,
    CrmTabFilter,
    CrmTabStageMapping,
    FinanceCompany,
    Branch,
    CostCenter,
    PipelineStage,
    StageAutomoveRule,
    User,
    UserRole,
    VehicleModel,
)
from app.schemas.master import (
    ActivityTypeCreate,
    ActivityTypeOut,
    ActivityTypeUpdate,
    CrmDropdownOptionCreate,
    CrmDropdownOptionOut,
    CrmDropdownOptionUpdate,
    CrmTabCreate,
    CrmTabFieldCreate,
    CrmTabFieldOut,
    CrmTabFieldUpdate,
    CrmTabFilterOut,
    CrmTabOut,
    CrmTabUpdate,
    FinanceCompanyBrief,
    FinanceCompanyCreate,
    FinanceCompanyUpdate,
    BranchCreate,
    BranchOut,
    BranchUpdate,
    CostCenterCreate,
    CostCenterOut,
    CostCenterUpdate,
    StageAutomoveRuleCreate,
    StageAutomoveRuleOut,
    StageAutomoveRuleUpdate,
    StageCreate,
    StageOut,
    StageUpdate,
    UserBrief,
    VehicleModelCreate,
    VehicleModelOut,
    VehicleModelUpdate,
)

router = APIRouter(prefix="/masters", tags=["masters"])


def _to_out(model: VehicleModel) -> VehicleModelOut:
    return VehicleModelOut(
        id=model.id,
        name=model.name,
        vehicle_price=float(model.vehicle_price),
        down_payment=float(model.down_payment),
        loan_amount=float(model.loan_amount),
        finance_company_id=model.finance_company_id,
        finance_company_name=model.finance_company.name if model.finance_company else None,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


# ---------------------------------------------------------------------------
# Vehicle models
# ---------------------------------------------------------------------------


@router.get("/vehicle-models", response_model=list[VehicleModelOut])
def list_vehicle_models(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    models = db.query(VehicleModel).order_by(VehicleModel.name.asc()).all()
    return [_to_out(m) for m in models]


@router.post("/vehicle-models", response_model=VehicleModelOut, status_code=status.HTTP_201_CREATED)
def create_vehicle_model(
    payload: VehicleModelCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    name = (payload.name or "").strip()
    if not name:
        count = db.query(VehicleModel).count() + 1
        name = f"Vehicle Model {count}"
        while db.query(VehicleModel).filter(VehicleModel.name == name).first():
            count += 1
            name = f"Vehicle Model {count}"
    else:
        _ensure_unique(db, VehicleModel, VehicleModel.name, name)

    vehicle_price = float(payload.vehicle_price or 0.0)
    down_payment = float(payload.down_payment or 0.0)
    loan_amount = float(payload.loan_amount or 0.0)
    if not loan_amount and vehicle_price > down_payment:
        loan_amount = vehicle_price - down_payment

    model = VehicleModel(
        name=name,
        vehicle_price=vehicle_price,
        down_payment=down_payment,
        loan_amount=loan_amount,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _to_out(model)


@router.patch("/vehicle-models/{model_id}", response_model=VehicleModelOut)
def update_vehicle_model(
    model_id: int,
    payload: VehicleModelUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    model = db.get(VehicleModel, model_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle model not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if name:
            _ensure_unique(db, VehicleModel, VehicleModel.name, name, exclude_id=model_id)
            data["name"] = name
        else:
            del data["name"]
    for field, value in data.items():
        if value is not None:
            setattr(model, field, value)
    db.add(model)
    db.commit()
    db.refresh(model)
    return _to_out(model)


@router.delete("/vehicle-models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle_model(
    model_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    model = db.get(VehicleModel, model_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle model not found")
    db.delete(model)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Finance companies (financiers)
# ---------------------------------------------------------------------------


@router.get("/finance-companies", response_model=list[FinanceCompanyBrief])
def list_finance_companies(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(FinanceCompany).order_by(FinanceCompany.name.asc()).all()


@router.post("/finance-companies", response_model=FinanceCompanyBrief, status_code=status.HTTP_201_CREATED)
def create_finance_company(
    payload: FinanceCompanyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    _ensure_unique(db, FinanceCompany, FinanceCompany.name, payload.name)
    company = FinanceCompany(
        name=payload.name,
        email=payload.email,
        contact_number=payload.contact_number,
        address=payload.address,
        total_apps=0,
        approved=0,
        rejected=0,
        avg_time_days=0,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.patch("/finance-companies/{company_id}", response_model=FinanceCompanyBrief)
def update_finance_company(
    company_id: int,
    payload: FinanceCompanyUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    company = db.get(FinanceCompany, company_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finance company not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        _ensure_unique(db, FinanceCompany, FinanceCompany.name, data["name"], exclude_id=company_id)
    for field, value in data.items():
        setattr(company, field, value)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/finance-companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_finance_company(
    company_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    company = db.get(FinanceCompany, company_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finance company not found")
    in_use = (
        db.query(func.count(Application.id))
        .filter(Application.finance_company_id == company_id)
        .scalar()
    ) or 0
    if in_use:
        raise _conflict(
            "This financier is used by applications and cannot be deleted"
        )
    db.delete(company)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Pipeline stages
# ---------------------------------------------------------------------------


@router.get("/stages", response_model=list[StageOut])
def list_stages(
    module: Optional[str] = Query(default=None, description="Filter by module: LEAD or OPPORTUNITY"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        query = db.query(PipelineStage).order_by(PipelineStage.order_index.asc(), PipelineStage.id.asc())
        if module and hasattr(PipelineStage, "module"):
            try:
                query = query.filter(PipelineStage.module == module.upper())
                stages = query.all()
            except Exception:
                db.rollback()
                stages = db.query(PipelineStage).order_by(PipelineStage.order_index.asc(), PipelineStage.id.asc()).all()
        else:
            stages = query.all()
        status_map = {
            "leads": ApplicationStatus.LEAD,
            "lead": ApplicationStatus.LEAD,
            "applications": ApplicationStatus.APPLICATION,
            "application": ApplicationStatus.APPLICATION,
            "verification": ApplicationStatus.VERIFICATION,
            "finance": ApplicationStatus.FINANCE,
            "query": ApplicationStatus.QUERY,
            "sanctioned": ApplicationStatus.SANCTIONED,
            "delivery": ApplicationStatus.DELIVERY,
            "disburse": ApplicationStatus.DISBURSEMENT,
            "disbursement": ApplicationStatus.DISBURSEMENT,
            "completed": ApplicationStatus.COMPLETED,
        }
        now = datetime.now(timezone.utc)
        result = []
        for s in stages:
            st = s.status or status_map.get(s.key.lower(), ApplicationStatus.APPLICATION)
            c_at = s.created_at or now
            u_at = s.updated_at or now
            result.append(
                StageOut(
                    id=s.id,
                    key=s.key,
                    label=s.label,
                    status=st,
                    order_index=s.order_index or 0,
                    enabled=s.enabled if s.enabled is not None else True,
                    color=getattr(s, "color", None),
                    module=getattr(s, "module", "OPPORTUNITY") or "OPPORTUNITY",
                    created_at=c_at,
                    updated_at=u_at,
                )
            )
        return result
    except Exception as err:
        import logging
        logging.error(f"Error in list_stages: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(err))


@router.post("/stages", response_model=StageOut, status_code=status.HTTP_201_CREATED)
def create_stage(
    payload: StageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    _ensure_unique(db, PipelineStage, PipelineStage.key, payload.key)
    stage = PipelineStage(
        key=payload.key,
        label=payload.label,
        order_index=payload.order_index,
        enabled=payload.enabled,
        color=payload.color,
        module=payload.module or "OPPORTUNITY",
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.patch("/stages/{stage_id}", response_model=StageOut)
def update_stage(
    stage_id: int,
    payload: StageUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    stage = db.get(PipelineStage, stage_id)
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("key") is not None:
        _ensure_unique(db, PipelineStage, PipelineStage.key, data["key"], exclude_id=stage_id)
    for field, value in data.items():
        setattr(stage, field, value)
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    stage = db.get(PipelineStage, stage_id)
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")
    db.delete(stage)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Activity types
# ---------------------------------------------------------------------------


@router.get("/activity-types", response_model=list[ActivityTypeOut])
def list_activity_types(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(ActivityType).order_by(ActivityType.name.asc()).all()


@router.post("/activity-types", response_model=ActivityTypeOut, status_code=status.HTTP_201_CREATED)
def create_activity_type(
    payload: ActivityTypeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    _ensure_unique(db, ActivityType, ActivityType.name, payload.name)
    act_type = ActivityType(
        name=payload.name,
        description=payload.description,
        icon=payload.icon or "Calendar",
    )
    db.add(act_type)
    db.commit()
    db.refresh(act_type)
    return act_type


@router.patch("/activity-types/{type_id}", response_model=ActivityTypeOut)
def update_activity_type(
    type_id: int,
    payload: ActivityTypeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    act_type = db.get(ActivityType, type_id)
    if not act_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity type not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        _ensure_unique(db, ActivityType, ActivityType.name, data["name"], exclude_id=type_id)
    for field, value in data.items():
        setattr(act_type, field, value)
    db.add(act_type)
    db.commit()
    db.refresh(act_type)
    return act_type


@router.delete("/activity-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_type(
    type_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    act_type = db.get(ActivityType, type_id)
    if not act_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity type not found")
    db.delete(act_type)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Dynamic CRM Tabs
# ---------------------------------------------------------------------------


def _build_tab_out(db: Session, tab: CrmTab, user: User) -> CrmTabOut:
    stage_ids = [m.stage_id for m in tab.stage_mappings]
    stage_names = [m.stage.label for m in tab.stage_mappings if m.stage]
    
    # Calculate count based on stage mapping and visibility
    app_query = db.query(Application)
    if stage_ids:
        app_query = app_query.filter(Application.vehicle_model_id.in_(stage_ids) | Application.id.isnot(None))
        # Filter applications based on stage status values of mapped stages
        mapped_statuses = [m.stage.status for m in tab.stage_mappings if m.stage and m.stage.status]
        if mapped_statuses:
            app_query = app_query.filter(Application.status.in_(mapped_statuses))
    
    # Filter by user role if tab restricts visibility
    if tab.visibility_type == "ROLES" and tab.allowed_roles:
        allowed = [r.strip() for r in tab.allowed_roles.split(",") if r.strip()]
        if user.role.value not in allowed and user.role != UserRole.ADMIN:
            count = 0
        else:
            count = app_query.count()
    else:
        count = app_query.count()

    filters_out = [
        CrmTabFilterOut(
            id=f.id,
            field=f.field,
            operator=f.operator,
            value=f.value,
            logical_operator=f.logical_operator,
        )
        for f in tab.filter_rules
    ]

    now = datetime.now(timezone.utc)
    return CrmTabOut(
        id=tab.id,
        module_id=tab.module_id,
        name=tab.name,
        code=tab.code,
        description=tab.description,
        icon=tab.icon or "Layers",
        display_order=tab.display_order,
        is_active=tab.is_active,
        is_default=tab.is_default,
        visibility_type=tab.visibility_type,
        allowed_roles=tab.allowed_roles,
        stage_ids=stage_ids,
        stage_names=stage_names,
        filters=filters_out,
        count=count,
        created_at=tab.created_at or now,
        updated_at=tab.updated_at or now,
    )


@router.get("/tabs", response_model=list[CrmTabOut])
def list_tabs(
    module: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(CrmTab)
    if module:
        m = module.upper()
        if m == "LEAD":
            query = query.filter(func.upper(CrmTab.module_id).in_(["LEAD", "CRM"]))
        else:
            query = query.filter(func.upper(CrmTab.module_id) == m)
    tabs = query.order_by(CrmTab.display_order.asc(), CrmTab.id.asc()).all()
    filtered_tabs = []
    for tab in tabs:
        if not tab.is_active:
            continue
        if tab.visibility_type == "ROLES" and tab.allowed_roles:
            allowed = [r.strip() for r in tab.allowed_roles.split(",") if r.strip()]
            if user.role.value not in allowed and user.role != UserRole.ADMIN:
                continue
        filtered_tabs.append(_build_tab_out(db, tab, user))
    return filtered_tabs


@router.post("/tabs", response_model=CrmTabOut, status_code=status.HTTP_201_CREATED)
def create_tab(
    payload: CrmTabCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    _ensure_unique(db, CrmTab, CrmTab.code, payload.code)
    
    target_module = (payload.module_id or "LEAD").upper()
    if payload.is_default:
        db.query(CrmTab).filter(func.upper(CrmTab.module_id) == target_module).update({CrmTab.is_default: False})
        
    tab = CrmTab(
        module_id=target_module,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        icon=payload.icon or "Layers",
        display_order=payload.display_order,
        is_active=payload.is_active,
        is_default=payload.is_default,
        visibility_type=payload.visibility_type,
        allowed_roles=payload.allowed_roles,
    )
    db.add(tab)
    db.flush()

    for stage_id in payload.stage_ids:
        db.add(CrmTabStageMapping(tab_id=tab.id, stage_id=stage_id))

    for flt in payload.filters:
        db.add(
            CrmTabFilter(
                tab_id=tab.id,
                field=flt.field,
                operator=flt.operator,
                value=flt.value,
                logical_operator=flt.logical_operator,
            )
        )

    db.commit()
    db.refresh(tab)
    return _build_tab_out(db, tab, user)


@router.patch("/tabs/{tab_id}", response_model=CrmTabOut)
def update_tab(
    tab_id: int,
    payload: CrmTabUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    tab = db.get(CrmTab, tab_id)
    if not tab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tab not found")

    data = payload.model_dump(exclude_unset=True)
    stage_ids = data.pop("stage_ids", None)
    filters = data.pop("filters", None)

    if data.get("code") is not None:
        _ensure_unique(db, CrmTab, CrmTab.code, data["code"], exclude_id=tab_id)

    target_module = (data.get("module_id") or tab.module_id or "LEAD").upper()
    if data.get("is_default") is True:
        db.query(CrmTab).filter(CrmTab.id != tab_id, func.upper(CrmTab.module_id) == target_module).update({CrmTab.is_default: False})

    for field, value in data.items():
        setattr(tab, field, value)

    if stage_ids is not None:
        db.query(CrmTabStageMapping).filter(CrmTabStageMapping.tab_id == tab_id).delete()
        for sid in stage_ids:
            db.add(CrmTabStageMapping(tab_id=tab_id, stage_id=sid))

    if filters is not None:
        db.query(CrmTabFilter).filter(CrmTabFilter.tab_id == tab_id).delete()
        for flt in filters:
            db.add(
                CrmTabFilter(
                    tab_id=tab_id,
                    field=flt["field"] if isinstance(flt, dict) else flt.field,
                    operator=flt["operator"] if isinstance(flt, dict) else flt.operator,
                    value=flt["value"] if isinstance(flt, dict) else flt.value,
                    logical_operator=flt.get("logical_operator", "AND") if isinstance(flt, dict) else flt.logical_operator,
                )
            )

    db.commit()
    db.refresh(tab)
    return _build_tab_out(db, tab, user)


@router.delete("/tabs/{tab_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tab(
    tab_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    tab = db.get(CrmTab, tab_id)
    if not tab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tab not found")
    db.delete(tab)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _ensure_unique(db: Session, model, column, value: str, exclude_id: int | None = None) -> None:
    query = db.query(model).filter(column == value)
    if exclude_id is not None:
        query = query.filter(model.id != exclude_id)
    if query.first() is not None:
        raise _conflict("An entry with this name already exists")


# --- Dynamic Tab Field Management Endpoints ---

@router.get("/tabs/{tab_id}/fields", response_model=list[CrmTabFieldOut])
def list_tab_fields(
    tab_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tab = db.get(CrmTab, tab_id)
    if not tab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tab not found")

    fields = (
        db.query(CrmTabField)
        .filter(CrmTabField.tab_id == tab_id, CrmTabField.is_archived == False)
        .order_by(CrmTabField.display_order.asc(), CrmTabField.id.asc())
        .all()
    )
    return fields


@router.post("/tabs/{tab_id}/fields", response_model=CrmTabFieldOut, status_code=status.HTTP_201_CREATED)
def create_tab_field(
    tab_id: int,
    payload: CrmTabFieldCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    tab = db.get(CrmTab, tab_id)
    if not tab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tab not found")

    # Check for duplicate field name in same tab
    existing = (
        db.query(CrmTabField)
        .filter(CrmTabField.tab_id == tab_id, CrmTabField.name == payload.name, CrmTabField.is_archived == False)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Field with name '{payload.name}' already exists in this tab")

    field = CrmTabField(
        tab_id=tab_id,
        name=payload.name,
        label=payload.label,
        field_type=payload.field_type,
        is_required=payload.is_required,
        is_visible=payload.is_visible,
        is_readonly=payload.is_readonly,
        is_searchable=payload.is_searchable,
        is_filterable=payload.is_filterable,
        is_sortable=payload.is_sortable,
        display_order=payload.display_order,
        placeholder=payload.placeholder,
        help_text=payload.help_text,
        default_value=payload.default_value,
        options=payload.options,
        file_config=payload.file_config,
        field_permissions=payload.field_permissions,
        stage_rules=payload.stage_rules,
        dependent_rules=payload.dependent_rules,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.patch("/tabs/{tab_id}/fields/{field_id}", response_model=CrmTabFieldOut)
def update_tab_field(
    tab_id: int,
    field_id: int,
    payload: CrmTabFieldUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    field = db.get(CrmTabField, field_id)
    if not field or field.tab_id != tab_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None and data["name"] != field.name:
        dup = (
            db.query(CrmTabField)
            .filter(CrmTabField.tab_id == tab_id, CrmTabField.name == data["name"], CrmTabField.id != field_id, CrmTabField.is_archived == False)
            .first()
        )
        if dup:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Field name '{data['name']}' already exists in this tab")

    for key, value in data.items():
        setattr(field, key, value)

    db.commit()
    db.refresh(field)
    return field


@router.delete("/tabs/{tab_id}/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tab_field(
    tab_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    field = db.get(CrmTabField, field_id)
    if not field or field.tab_id != tab_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    # Soft delete / archive to protect historical data
    field.is_archived = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tabs/{tab_id}/fields/reorder", response_model=list[CrmTabFieldOut])
def reorder_tab_fields(
    tab_id: int,
    field_ids: list[int],
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    for idx, f_id in enumerate(field_ids):
        db.query(CrmTabField).filter(CrmTabField.id == f_id, CrmTabField.tab_id == tab_id).update({CrmTabField.display_order: idx})
    db.commit()

    return (
        db.query(CrmTabField)
        .filter(CrmTabField.tab_id == tab_id, CrmTabField.is_archived == False)
        .order_by(CrmTabField.display_order.asc())
        .all()
    )


@router.get("/users", response_model=list[UserBrief])
def list_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.user import UserStatus
    users = db.query(User).filter(User.status == UserStatus.ACTIVE).order_by(User.full_name.asc()).all()
    return [
        UserBrief(
            id=u.id,
            full_name=u.full_name or u.email,
            role=u.role,
            email=u.email,
        )
        for u in users
    ]


# ---------------------------------------------------------------------------
# Stage Auto-Move Rules
# ---------------------------------------------------------------------------


def _automove_to_out(rule: StageAutomoveRule) -> StageAutomoveRuleOut:
    return StageAutomoveRuleOut(
        id=rule.id,
        name=rule.name,
        module=getattr(rule, "module", "LEAD") or "LEAD",
        trigger_type=rule.trigger_type,
        field_name=rule.field_name,
        field_id=rule.field_id,
        field_label=rule.field.label if rule.field else None,
        condition_operator=rule.condition_operator,
        condition_value=rule.condition_value,
        source_stage_key=rule.source_stage_key,
        target_status=rule.target_status,
        target_stage_key=getattr(rule, "target_stage_key", None),
        is_enabled=rule.is_enabled,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


@router.get("/automove-rules", response_model=list[StageAutomoveRuleOut])
def list_automove_rules(
    module: Optional[str] = Query(default=None, description="Filter by module: LEAD or OPPORTUNITY"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(StageAutomoveRule).order_by(StageAutomoveRule.id.asc())
    if module and hasattr(StageAutomoveRule, "module"):
        try:
            query = query.filter(StageAutomoveRule.module == module.upper())
            rules = query.all()
        except Exception:
            db.rollback()
            rules = db.query(StageAutomoveRule).order_by(StageAutomoveRule.id.asc()).all()
    else:
        rules = query.all()
    return [_automove_to_out(r) for r in rules]


@router.post("/automove-rules", response_model=StageAutomoveRuleOut, status_code=status.HTTP_201_CREATED)
def create_automove_rule(
    payload: StageAutomoveRuleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    rule = StageAutomoveRule(
        name=payload.name,
        module=payload.module or "LEAD",
        trigger_type=payload.trigger_type,
        field_name=payload.field_name,
        field_id=payload.field_id,
        condition_operator=payload.condition_operator,
        condition_value=payload.condition_value,
        source_stage_key=payload.source_stage_key,
        target_status=payload.target_status,
        target_stage_key=payload.target_stage_key,
        is_enabled=payload.is_enabled,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _automove_to_out(rule)


@router.patch("/automove-rules/{rule_id}", response_model=StageAutomoveRuleOut)
def update_automove_rule(
    rule_id: int,
    payload: StageAutomoveRuleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    rule = db.get(StageAutomoveRule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auto-move rule not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(rule, field, value)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _automove_to_out(rule)


@router.delete("/automove-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_automove_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    rule = db.get(StageAutomoveRule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auto-move rule not found")
    db.delete(rule)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Cost Centers Master APIs
# ---------------------------------------------------------------------------

def _cc_to_out(cc: CostCenter) -> CostCenterOut:
    return CostCenterOut(
        id=cc.id,
        code=cc.code,
        name=cc.name,
        description=cc.description,
        department_id=cc.department_id,
        department_name=cc.department.name if cc.department else None,
        company_id=cc.company_id,
        company_name=cc.company.name if cc.company else None,
        is_active=cc.is_active,
        created_at=cc.created_at,
        updated_at=cc.updated_at,
    )


@router.get("/cost-centers", response_model=list[CostCenterOut])
def list_cost_centers(
    department_id: Optional[int] = None,
    company_id: Optional[int] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(CostCenter)
    if active_only:
        query = query.filter(CostCenter.is_active.is_(True))
    if department_id:
        query = query.filter(CostCenter.department_id == department_id)
    if company_id:
        query = query.filter(CostCenter.company_id == company_id)
    centers = query.order_by(CostCenter.code.asc()).all()
    return [_cc_to_out(c) for c in centers]


@router.post("/cost-centers", response_model=CostCenterOut, status_code=status.HTTP_201_CREATED)
def create_cost_center(
    payload: CostCenterCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    existing = db.query(CostCenter).filter(CostCenter.code.ilike(payload.code.strip())).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cost center code already exists")
    
    cc = CostCenter(
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        description=payload.description,
        department_id=payload.department_id,
        company_id=payload.company_id,
        is_active=payload.is_active,
    )
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return _cc_to_out(cc)


@router.get("/cost-centers/{cost_center_id}", response_model=CostCenterOut)
def get_cost_center(
    cost_center_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cc = db.get(CostCenter, cost_center_id)
    if not cc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cost Center not found")
    return _cc_to_out(cc)


@router.patch("/cost-centers/{cost_center_id}", response_model=CostCenterOut)
def update_cost_center(
    cost_center_id: int,
    payload: CostCenterUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    cc = db.get(CostCenter, cost_center_id)
    if not cc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cost Center not found")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"]:
        data["code"] = data["code"].strip().upper()
        dup = db.query(CostCenter).filter(CostCenter.code == data["code"], CostCenter.id != cc.id).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cost Center code already exists")
    for field, val in data.items():
        setattr(cc, field, val)
    db.commit()
    db.refresh(cc)
    return _cc_to_out(cc)


@router.delete("/cost-centers/{cost_center_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_center(
    cost_center_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    cc = db.get(CostCenter, cost_center_id)
    if not cc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cost Center not found")
    db.delete(cc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Branches Master APIs
# ---------------------------------------------------------------------------

def _branch_to_out(b: Branch) -> BranchOut:
    return BranchOut(
        id=b.id,
        code=b.code,
        name=b.name,
        company_id=b.company_id,
        company_name=b.company.name if b.company else None,
        address=b.address,
        is_active=b.is_active,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


@router.get("/branches", response_model=list[BranchOut])
def list_branches(
    company_id: Optional[int] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Branch)
    if active_only:
        query = query.filter(Branch.is_active.is_(True))
    if company_id:
        query = query.filter(Branch.company_id == company_id)
    branches = query.order_by(Branch.name.asc()).all()
    return [_branch_to_out(b) for b in branches]


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    existing = db.query(Branch).filter(Branch.code.ilike(payload.code.strip())).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Branch code already exists")
    
    branch = Branch(
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        company_id=payload.company_id,
        address=payload.address,
        is_active=payload.is_active,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return _branch_to_out(branch)


@router.patch("/branches/{branch_id}", response_model=BranchOut)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"]:
        data["code"] = data["code"].strip().upper()
        dup = db.query(Branch).filter(Branch.code == data["code"], Branch.id != branch.id).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Branch code already exists")
    for field, val in data.items():
        setattr(branch, field, val)
    db.commit()
    db.refresh(branch)
    return _branch_to_out(branch)


@router.delete("/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    db.delete(branch)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# CRM Dropdown Options APIs
# ---------------------------------------------------------------------------

def _dropdown_option_to_out(opt: CrmDropdownOption) -> CrmDropdownOptionOut:
    return CrmDropdownOptionOut(
        id=opt.id,
        category=opt.category,
        label=opt.label,
        value=opt.value,
        order_index=opt.order_index,
        is_active=opt.is_active,
        created_at=opt.created_at,
        updated_at=opt.updated_at,
    )


@router.get("/dropdown-options", response_model=list[CrmDropdownOptionOut])
def list_dropdown_options(
    category: Optional[str] = Query(default=None, description="Category filter (e.g. fuel_type, customer_status, lead_source, lost_reason)"),
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(CrmDropdownOption)
    if category:
        query = query.filter(CrmDropdownOption.category == category.lower().strip())
    if active_only:
        query = query.filter(CrmDropdownOption.is_active.is_(True))
    opts = query.order_by(CrmDropdownOption.order_index.asc(), CrmDropdownOption.label.asc()).all()
    return [_dropdown_option_to_out(o) for o in opts]


@router.post("/dropdown-options", response_model=CrmDropdownOptionOut, status_code=status.HTTP_201_CREATED)
def create_dropdown_option(
    payload: CrmDropdownOptionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    cat = payload.category.lower().strip()
    label = payload.label.strip()
    value = payload.value.strip() or label.lower().replace(" ", "_")

    existing = db.query(CrmDropdownOption).filter(
        CrmDropdownOption.category == cat,
        func.lower(CrmDropdownOption.value) == value.lower()
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Option '{label}' already exists in {cat}")

    opt = CrmDropdownOption(
        category=cat,
        label=label,
        value=value,
        order_index=payload.order_index,
        is_active=payload.is_active,
    )
    db.add(opt)
    db.commit()
    db.refresh(opt)
    return _dropdown_option_to_out(opt)


@router.patch("/dropdown-options/{option_id}", response_model=CrmDropdownOptionOut)
def update_dropdown_option(
    option_id: int,
    payload: CrmDropdownOptionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    opt = db.get(CrmDropdownOption, option_id)
    if not opt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")
    data = payload.model_dump(exclude_unset=True)
    if "label" in data and data["label"]:
        data["label"] = data["label"].strip()
    if "value" in data and data["value"]:
        data["value"] = data["value"].strip()
        dup = db.query(CrmDropdownOption).filter(
            CrmDropdownOption.category == opt.category,
            func.lower(CrmDropdownOption.value) == data["value"].lower(),
            CrmDropdownOption.id != opt.id
        ).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Option value already exists in this category")
    for field, val in data.items():
        setattr(opt, field, val)
    db.commit()
    db.refresh(opt)
    return _dropdown_option_to_out(opt)


@router.delete("/dropdown-options/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dropdown_option(
    option_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    opt = db.get(CrmDropdownOption, option_id)
    if not opt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")
    db.delete(opt)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)




