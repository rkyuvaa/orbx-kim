import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.deps import can_access_application, get_current_user, require_application_access, require_permission
from app.db.session import get_db
from app.models import (
    Activity,
    ActivityLog,
    ActivityType,
    Application,
    ApplicationStatus,
    CrmLeadCustomFieldValue,
    CrmTabField,
    Disbursement,
    DisbursementStatus,
    FinanceCompany,
    FinanceStatus,
    FinanceSubmission,
    User,
    UserRole,
    VehicleModel,
)
from app.schemas.application import (
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationOut,
    ApplicationUpdate,
    BulkAssignRequest,
    BulkDeleteRequest,
    BulkStatusChangeRequest,
    TabCounts,
)
from app.schemas.master import (
    CrmLeadCustomFieldValueOut,
    CrmLeadCustomFieldValueSave,
    ToggleVerificationInput,
    VerificationDocumentOut,
)
from app.schemas.notifications import ActivityLogOut
from app.services.aging import aging_tone, duration_between, format_aging
from app.services.auth import next_app_no, touch_application
from app.services.automove_service import evaluate_automove_rules
from app.services.ocr_analyzer import analyze_document_quality

router = APIRouter(prefix="/applications", tags=["applications"])

RECENT_WINDOW = 50


def _to_out(app: Application) -> ApplicationOut:
    stg_key = getattr(app, "stage_key", None)
    if not stg_key:
        stg_key = "new" if app.status == ApplicationStatus.LEAD else "applications"
    return ApplicationOut(
        id=app.id,
        app_no=app.app_no,
        customer_name=app.customer_name or "",
        customer_phone=app.customer_phone or "",
        vehicle=app.vehicle or "",
        vehicle_number=getattr(app, "vehicle_number", None),
        vehicle_year=getattr(app, "vehicle_year", None),
        fuel_type=getattr(app, "fuel_type", None),
        customer_status=getattr(app, "customer_status", None),
        coupon_code=getattr(app, "coupon_code", None),
        lost_reason=getattr(app, "lost_reason", None),
        amount=float(app.amount) if app.amount is not None else 0.0,
        status=app.status,
        stage_key=stg_key,
        lead_source=getattr(app, "lead_source", None),
        lead_score=getattr(app, "lead_score", 0) or 0,
        finance_company_id=app.finance_company_id,
        finance_company_name=app.finance_company.name if app.finance_company else None,
        vehicle_model_id=app.vehicle_model_id,
        vehicle_price=float(app.vehicle_price) if app.vehicle_price is not None else None,
        down_payment=float(app.down_payment) if app.down_payment is not None else None,
        assigned_to=app.assigned_to,
        assigned_to_name=app.assigned_user.full_name if app.assigned_user else None,
        created_at=app.created_at,
        updated_at=app.updated_at,
        aging_label=format_aging(duration_between(app.updated_at)),
        aging_tone=aging_tone(duration_between(app.updated_at)),
    )


def _pending_action_condition():
    from sqlalchemy import exists, or_
    sub1 = exists().where(
        (FinanceSubmission.application_id == Application.id)
        & (FinanceSubmission.status == FinanceStatus.QUERY)
        & (FinanceSubmission.query_note.isnot(None))
    )
    sub2 = exists().where(
        (Disbursement.application_id == Application.id)
        & (Disbursement.status == DisbursementStatus.PENDING_UTR)
    )
    return or_(
        (Application.status == ApplicationStatus.QUERY) & sub1,
        (Application.status == ApplicationStatus.DISBURSEMENT) & sub2,
    )


def _recent_ids(db: Session) -> list[int]:
    return [
        r[0]
        for r in db.query(Application.id)
        .filter(Application.status != ApplicationStatus.LEAD)
        .order_by(Application.created_at.desc())
        .limit(RECENT_WINDOW)
        .all()
    ]


def _tab_counts(db: Session, user: User, scope: str) -> TabCounts:
    base = db.query(Application)
    if scope == "recent":
        recent_ids = _recent_ids(db)
        if recent_ids:
            base = base.filter(Application.id.in_(recent_ids))
    all_count = base.count()
    mine = base.filter(Application.assigned_to == user.id).count()
    pending = base.filter(_pending_action_condition()).count()
    return TabCounts(all=all_count, mine=mine, pending=pending)


def _filtered_query(
    db: Session,
    user: User,
    scope: str,
    tab: str,
    q: str | None,
    status_filter: ApplicationStatus | None,
    finance_company_id: int | None,
    date_from: datetime | None,
    date_to: datetime | None,
    stage_key: str | None = None,
    module: str | None = None,
):
    query = db.query(Application)

    if module:
        lead_stage_keys = ["new", "lead", "leads", "contacted", "interested", "not_interested", "not-interested", "qualified"]
        if module.upper() == "LEAD":
            query = query.filter(
                (Application.status == ApplicationStatus.LEAD)
                | (func.lower(Application.stage_key).in_(lead_stage_keys))
            )
        elif module.upper() == "OPPORTUNITY":
            query = query.filter(
                (Application.status != ApplicationStatus.LEAD)
                & (~func.lower(Application.stage_key).in_(lead_stage_keys))
            )

    # Apply role-based filtering
    if user.role == UserRole.SALES_EXECUTIVE:
        # Sales executives see all leads in LEAD status, applications assigned to them, and unassigned items
        query = query.filter(
            (Application.status == ApplicationStatus.LEAD)
            | (Application.assigned_to == user.id)
            | (Application.assigned_to.is_(None))
        )
    elif user.role == UserRole.FINANCE_OFFICER:
        # Finance officers see applications in finance-related stages
        finance_stages = [
            ApplicationStatus.FINANCE,
            ApplicationStatus.QUERY,
            ApplicationStatus.SANCTIONED,
        ]
        query = query.filter(Application.status.in_(finance_stages))
    elif user.role == UserRole.DELIVERY_TEAM:
        # Delivery team sees applications in delivery/disbursement stages
        delivery_stages = [
            ApplicationStatus.DELIVERY,
            ApplicationStatus.DISBURSEMENT,
            ApplicationStatus.COMPLETED,
        ]
        query = query.filter(Application.status.in_(delivery_stages))
    # ADMIN sees all - no additional filter needed

    if scope == "recent":
        recent_ids = _recent_ids(db)
        query = query.filter(Application.id.in_(recent_ids)) if recent_ids else query.filter(False)
    if tab == "mine":
        query = query.filter(Application.assigned_to == user.id)
    elif tab == "pending":
        query = query.filter(_pending_action_condition())
    if status_filter:
        query = query.filter(Application.status == status_filter)
    if finance_company_id:
        query = query.filter(Application.finance_company_id == finance_company_id)
    if date_from:
        query = query.filter(Application.created_at >= date_from)
    if date_to:
        query = query.filter(Application.created_at <= date_to)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            func.lower(Application.app_no).like(like.lower())
            | func.lower(Application.customer_name).like(like.lower())
            | Application.customer_phone.like(like)
            | func.lower(Application.vehicle).like(like.lower())
        )
    if stage_key:
        from app.models.pipeline_stage import PipelineStage as PipelineStageModel
        from app.services.dashboard import STATUS_KEY_MAP
        stage = db.query(PipelineStageModel).filter(PipelineStageModel.key == stage_key).first()
        target_status = stage.status if (stage and stage.status) else None
        if not target_status:
            target_status = STATUS_KEY_MAP.get(stage_key.lower())
            if not target_status and stage:
                target_status = STATUS_KEY_MAP.get(stage.label.lower())
        if target_status:
            query = query.filter(Application.status == target_status)
    return query


def _stage_counts(
    db: Session,
    user: User,
    scope: str,
    tab: str,
    q: str | None,
    finance_company_id: int | None,
    date_from: datetime | None,
    date_to: datetime | None,
    module: str | None,
) -> dict[str, int]:
    base_query = _filtered_query(
        db, user, scope, tab, q, status_filter=None, finance_company_id=finance_company_id,
        date_from=date_from, date_to=date_to, stage_key=None, module=module
    )

    stage_key_counts = base_query.with_entities(Application.stage_key, func.count(Application.id)).group_by(Application.stage_key).all()
    status_counts = base_query.with_entities(Application.status, func.count(Application.id)).group_by(Application.status).all()

    res: dict[str, int] = {}
    for sk, cnt in stage_key_counts:
        if sk:
            res[sk.lower().strip()] = cnt
    for st, cnt in status_counts:
        if st:
            st_str = st.value if hasattr(st, "value") else str(st)
            res[st_str.lower().strip()] = cnt
    return res


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    scope: str = Query("all", pattern="^(all|recent)$"),
    tab: str = Query("all", pattern="^(all|mine|pending)$"),
    q: str | None = None,
    status: ApplicationStatus | None = None,
    finance_company_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    stage_key: str | None = None,
    module: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "leads")),
):
    query = _filtered_query(
        db, user, scope, tab, q, status, finance_company_id, date_from, date_to, stage_key, module
    )
    total = query.count()
    items = (
        query.order_by(Application.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ApplicationListResponse(
        items=[_to_out(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        tab_counts=_tab_counts(db, user, scope),
        stage_counts=_stage_counts(
            db, user, scope, tab, q, finance_company_id, date_from, date_to, module
        ),
    )


@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(
    app: Application = Depends(require_application_access),
):
    return _to_out(app)


@router.get("/{app_id}/activity", response_model=list[ActivityLogOut])
def get_application_activity(
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
):
    try:
        logs = (
            db.query(ActivityLog)
            .filter(ActivityLog.application_id == app.id)
            .order_by(ActivityLog.created_at.desc())
            .all()
        )
        res = []
        for log in logs:
            actor_name = None
            if getattr(log, "actor", None):
                actor_name = getattr(log.actor, "full_name", None) or getattr(log.actor, "email", None)
            res.append(
                ActivityLogOut(
                    id=log.id,
                    application_id=log.application_id,
                    actor_id=log.actor_id,
                    actor_name=actor_name,
                    field_name=log.field_name,
                    old_value=log.old_value,
                    new_value=log.new_value,
                    created_at=log.created_at,
                )
            )
        return res
    except Exception as e:
        logger.error(f"Error fetching application activity: {e}")
        return []


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "leads")),
):
    try:
        app_number = next_app_no(db)
        app_status = payload.status or ApplicationStatus.LEAD
        stg_key = payload.stage_key
        if not stg_key:
            stg_key = "new" if app_status == ApplicationStatus.LEAD else "applications"

        vehicle_name = payload.vehicle or ""
        if not vehicle_name and payload.vehicle_model_id:
            vm = db.get(VehicleModel, payload.vehicle_model_id)
            if vm:
                vehicle_name = vm.name

        assigned_to_id = payload.assigned_to if payload.assigned_to else user.id

        app = Application(
            app_no=app_number,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            vehicle=vehicle_name,
            vehicle_number=payload.vehicle_number,
            vehicle_year=payload.vehicle_year,
            fuel_type=payload.fuel_type,
            customer_status=payload.customer_status,
            coupon_code=payload.coupon_code,
            lost_reason=payload.lost_reason,
            amount=payload.amount or 0.0,
            status=app_status,
            stage_key=stg_key,
            lead_source=payload.lead_source,
            finance_company_id=payload.finance_company_id,
            vehicle_model_id=payload.vehicle_model_id,
            vehicle_price=payload.vehicle_price,
            down_payment=payload.down_payment,
            assigned_to=assigned_to_id,
        )
        db.add(app)
        db.flush()
        db.add(
            Activity(
                application_id=app.id,
                actor_id=user.id,
                action=f"Created application {app.app_no}",
            )
        )
        db.commit()
        db.refresh(app)
        if app.status != ApplicationStatus.LEAD:
            evaluate_automove_rules(db, app, user)
            db.refresh(app)
        return _to_out(app)
    except Exception as err:
        db.rollback()
        import logging
        logging.error(f"Error creating application: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not create application: {str(err)}")


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_application(
    app_id: int,
    payload: ApplicationUpdate,
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "leads")),
):
    data = payload.model_dump(exclude_unset=True)

    # Track field changes for activity log
    field_mapping = {
        'customer_name': 'Customer Name',
        'customer_phone': 'Customer Phone',
        'vehicle': 'Vehicle',
        'vehicle_number': 'Vehicle Number',
        'vehicle_year': 'Vehicle Year',
        'fuel_type': 'Fuel Type',
        'customer_status': 'Customer Status',
        'coupon_code': 'Coupon Code',
        'lost_reason': 'Lost Reason',
        'amount': 'Loan Amount',
        'status': 'Status',
        'stage_key': 'Stage',
        'lead_source': 'Lead Source',
        'finance_company_id': 'Finance Company',
        'vehicle_model_id': 'Vehicle Model',
        'vehicle_price': 'Vehicle Price',
        'down_payment': 'Down Payment',
        'assigned_to': 'Responsible',
    }

    if payload.stage_key is not None:
        from app.models.pipeline_stage import PipelineStage as PipelineStageModel
        stg = db.query(PipelineStageModel).filter(PipelineStageModel.key == payload.stage_key).first()
        if stg and stg.status:
            setattr(app, 'status', stg.status)
    elif payload.status is not None and payload.status != ApplicationStatus.LEAD:
        lead_keys = ('new', 'contacted', 'interested', 'not-interested', 'not_interested', 'qualified')
        if not getattr(app, 'stage_key', None) or str(app.stage_key).lower() in lead_keys:
            setattr(app, 'stage_key', 'applications')

    for field, value in data.items():
        old_value = getattr(app, field)
        if old_value != value:
            # Get display values for relationships
            old_display = str(old_value) if old_value is not None else None
            new_display = str(value) if value is not None else None

            # Special handling for IDs / numbers / enums to show human-readable names
            if field == 'finance_company_id':
                fc_new = db.get(FinanceCompany, value) if value else None
                fc_old = db.get(FinanceCompany, old_value) if old_value else None
                new_display = fc_new.name if fc_new else (str(value) if value else 'None')
                old_display = fc_old.name if fc_old else (str(old_value) if old_value else 'None')
            elif field == 'vehicle_model_id':
                vm_new = db.get(VehicleModel, value) if value else None
                vm_old = db.get(VehicleModel, old_value) if old_value else None
                new_display = vm_new.name if vm_new else (str(value) if value else 'None')
                old_display = vm_old.name if vm_old else (str(old_value) if old_value else 'None')
            elif field in ('vehicle_price', 'down_payment', 'amount'):
                old_num = float(old_value) if old_value is not None else None
                new_num = float(value) if value is not None else None
                if old_num == new_num:
                    setattr(app, field, value)
                    continue
                old_display = f"₹{old_num:,.2f}" if old_num is not None else "₹0.00"
                new_display = f"₹{new_num:,.2f}" if new_num is not None else "₹0.00"
            else:
                old_display = str(old_value) if old_value is not None else ""
                new_display = str(value) if value is not None else ""

            db.add(
                ActivityLog(
                    application_id=app.id,
                    actor_id=user.id,
                    field_name=field_mapping.get(field, field),
                    old_value=old_display,
                    new_value=new_display,
                )
            )
        setattr(app, field, value)

    touch_application(db, app)
    db.add(
        Activity(
            application_id=app.id,
            actor_id=user.id,
            action=f"Updated application {app.app_no}",
        )
    )
    db.commit()
    db.refresh(app)
    evaluate_automove_rules(db, app, user)
    return _to_out(app)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "leads")),
):
    db.delete(app)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Custom Field Values & Document Verification Endpoints ---


@router.get("/{app_id}/custom-fields", response_model=list[CrmLeadCustomFieldValueOut])
def get_custom_field_values(
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    values = (
        db.query(CrmLeadCustomFieldValue)
        .filter(CrmLeadCustomFieldValue.application_id == app.id)
        .all()
    )
    return values


@router.post("/{app_id}/custom-fields", response_model=list[CrmLeadCustomFieldValueOut])
def save_custom_field_values(
    payload: list[CrmLeadCustomFieldValueSave],
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    saved_list = []
    for item in payload:
        score = None
        breakdown = None
        if item.file_metadata:
            fname = item.file_metadata.get("file_name", "document")
            mtype = item.file_metadata.get("mime_type", "")
            fsize = item.file_metadata.get("file_size", 0)
            fpath = item.file_metadata.get("file_path", "")
            field_obj = db.query(CrmTabField).filter(CrmTabField.id == item.field_id).first()
            flabel = field_obj.label if field_obj else fname
            score, breakdown = analyze_document_quality(fname, mtype, fsize, fpath, flabel)

        existing = (
            db.query(CrmLeadCustomFieldValue)
            .filter(
                CrmLeadCustomFieldValue.application_id == app.id,
                CrmLeadCustomFieldValue.field_id == item.field_id,
            )
            .first()
        )
        if existing:
            existing.value = item.value
            if item.file_metadata is not None:
                existing.file_metadata = item.file_metadata
                existing.quality_score = score
                existing.quality_analysis = breakdown
            saved_list.append(existing)
        else:
            rec = CrmLeadCustomFieldValue(
                application_id=app.id,
                field_id=item.field_id,
                value=item.value,
                file_metadata=item.file_metadata,
                quality_score=score,
                quality_analysis=breakdown,
                is_verified=False,
            )
            db.add(rec)
            saved_list.append(rec)

    touch_application(db, app)
    db.commit()
    for item in saved_list:
        db.refresh(item)
    evaluate_automove_rules(db, app, user)
    return saved_list


@router.get("/{app_id}/verification-documents", response_model=list[VerificationDocumentOut])
def get_verification_documents(
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
):
    values = (
        db.query(CrmLeadCustomFieldValue)
        .join(CrmTabField, CrmLeadCustomFieldValue.field_id == CrmTabField.id)
        .filter(
            CrmLeadCustomFieldValue.application_id == app.id,
            CrmTabField.is_archived == False,
            CrmTabField.field_type == "file",
        )
        .all()
    )

    res = []
    for val in values:
        if not val.file_metadata:
            continue
        meta = val.file_metadata
        score, breakdown = analyze_document_quality(
            meta.get("file_name", "document"),
            meta.get("mime_type"),
            meta.get("file_size"),
            meta.get("file_path"),
            val.field.label if val.field else "Document",
        )
        val.quality_score = score
        val.quality_analysis = breakdown
        db.commit()

        vname = None
        if val.verified_by:
            vname = val.verified_by.full_name or val.verified_by.email

        res.append(
            VerificationDocumentOut(
                id=val.id,
                application_id=val.application_id,
                field_id=val.field_id,
                field_name=val.field.name if val.field else "file",
                field_label=val.field.label if val.field else "Document",
                file_name=meta.get("file_name", "Document"),
                file_path=meta.get("file_path", ""),
                file_size=meta.get("file_size"),
                mime_type=meta.get("mime_type"),
                uploaded_at=val.updated_at or val.created_at,
                quality_score=val.quality_score,
                quality_analysis=val.quality_analysis,
                is_verified=val.is_verified,
                verified_by_id=val.verified_by_id,
                verified_by_name=vname,
                verified_at=val.verified_at,
            )
        )

    return res


@router.post("/{app_id}/verification-documents/{value_id}/toggle-verify", response_model=VerificationDocumentOut)
def toggle_document_verification(
    value_id: int,
    payload: ToggleVerificationInput,
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = (
        db.query(CrmLeadCustomFieldValue)
        .filter(
            CrmLeadCustomFieldValue.id == value_id,
            CrmLeadCustomFieldValue.application_id == app.id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Document verification record not found")

    prev_status = "Verified (ON)" if rec.is_verified else "Pending Verification (OFF)"
    new_status = "Verified (ON)" if payload.is_verified else "Pending Verification (OFF)"

    rec.is_verified = payload.is_verified
    rec.verified_by_id = user.id if payload.is_verified else None
    rec.verified_at = datetime.now(timezone.utc) if payload.is_verified else None

    # Audit Trail (ActivityLog entry)
    field_label = rec.field.label if rec.field else "Document"
    audit_entry = ActivityLog(
        application_id=app.id,
        actor_id=user.id,
        field_name=f"Document Verification: {field_label}",
        old_value=prev_status,
        new_value=f"{new_status} by {user.full_name}",
    )
    db.add(audit_entry)
    touch_application(db, app)
    db.commit()
    db.refresh(rec)
    evaluate_automove_rules(db, app, user)

    meta = rec.file_metadata or {}
    vname = user.full_name if rec.is_verified else None

    return VerificationDocumentOut(
        id=rec.id,
        application_id=rec.application_id,
        field_id=rec.field_id,
        field_name=rec.field.name if rec.field else "file",
        field_label=rec.field.label if rec.field else "Document",
        file_name=meta.get("file_name", "Document"),
        file_path=meta.get("file_path", ""),
        file_size=meta.get("file_size"),
        mime_type=meta.get("mime_type"),
        uploaded_at=rec.updated_at or rec.created_at,
        quality_score=rec.quality_score,
        quality_analysis=rec.quality_analysis,
        is_verified=rec.is_verified,
        verified_by_id=rec.verified_by_id,
        verified_by_name=vname,
        verified_at=rec.verified_at,
    )


@router.post("/bulk/assign", status_code=status.HTTP_200_OK)
def bulk_assign_leads(
    payload: "BulkAssignRequest",
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "leads")),
):
    """Bulk assign multiple leads to a user."""
    from app.schemas.application import BulkAssignRequest

    applications = (
        db.query(Application)
        .filter(
            Application.id.in_(payload.application_ids),
            Application.status == ApplicationStatus.LEAD,
        )
        .all()
    )

    if not applications:
        raise HTTPException(status_code=404, detail="No leads found with provided IDs")

    for app in applications:
        old_assigned = app.assigned_to
        app.assigned_to = payload.assigned_to
        app.updated_at = datetime.now(timezone.utc)

        ActivityLog.create(
            db,
            application_id=app.id,
            actor_id=user.id,
            field_name="assigned_to",
            old_value=str(old_assigned) if old_assigned else None,
            new_value=str(payload.assigned_to),
        )

    db.commit()
    return {"message": f"Successfully assigned {len(applications)} leads", "count": len(applications)}


@router.post("/bulk/status", status_code=status.HTTP_200_OK)
def bulk_change_status(
    payload: "BulkStatusChangeRequest",
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "leads")),
):
    """Bulk change status of multiple leads."""
    from app.schemas.application import BulkStatusChangeRequest

    applications = (
        db.query(Application)
        .filter(
            Application.id.in_(payload.application_ids),
            Application.status == ApplicationStatus.LEAD,
        )
        .all()
    )

    if not applications:
        raise HTTPException(status_code=404, detail="No leads found with provided IDs")

    for app in applications:
        old_status = app.status
        app.status = payload.status
        app.updated_at = datetime.now(timezone.utc)

        ActivityLog.create(
            db,
            application_id=app.id,
            actor_id=user.id,
            field_name="status",
            old_value=old_status.value,
            new_value=payload.status.value,
        )

    db.commit()
    return {"message": f"Successfully updated status for {len(applications)} leads", "count": len(applications)}


@router.post("/bulk/delete", status_code=status.HTTP_200_OK)
def bulk_delete_leads(
    payload: "BulkDeleteRequest",
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete", "leads")),
):
    """Bulk delete multiple leads."""
    from app.schemas.application import BulkDeleteRequest

    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete leads")

    applications = (
        db.query(Application)
        .filter(
            Application.id.in_(payload.application_ids),
            Application.status == ApplicationStatus.LEAD,
        )
        .all()
    )

    if not applications:
        raise HTTPException(status_code=404, detail="No leads found with provided IDs")

    deleted_count = 0
    for app in applications:
        try:
            db.delete(app)
            deleted_count += 1
        except Exception as e:
            logger.error(f"Error deleting application {app.id}: {e}")

    db.commit()
    return {"message": f"Successfully deleted {deleted_count} leads", "count": deleted_count}