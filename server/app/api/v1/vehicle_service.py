import json
import random
import string
import urllib.request
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Notification, User
from app.models.enums import (
    ComplaintCategory,
    ComplaintSeverity,
    ComplaintStatus,
    MaintenanceStatus,
    RegisteredVia,
    UserRole,
)
from app.models.crm_dropdown_option import CrmDropdownOption
from app.models.user import UserStatus
from app.services.document_numbering import generate_next_document_number
from app.services.pdf_kit_parser import parse_kit_traceability_pdf
from app.models.vehicle_service import (
    VSComponentHistory,
    VSComplaint,
    VSComplaintNote,
    VSCustomerFeedback,
    VSKit,
    VSKitComponentType,
    VSMaintenanceSchedule,
    VSServiceCost,
    VSVehicle,
    VSVehicleComponent,
)
from app.models.vs_custom_field import (
    VSCustomFieldDefinition,
    VSCustomFieldTab,
    VSComplaintCustomFieldValue,
)
from app.schemas.vehicle_service import (
    VSAnomalyAlert,
    VSCategoryCount,
    VSComponentHistoryOut,
    VSComponentReplaceRequest,
    VSComplaintCloseRequest,
    VSComplaintCreate,
    VSComplaintNoteCreate,
    VSComplaintNoteOut,
    VSComplaintOut,
    VSComplaintUpdate,
    VSCustomerFeedbackCreate,
    VSCustomerFeedbackOut,
    VSDashboardKPIs,
    VSDashboardOut,
    VSKitCreate,
    VSKitOut,
    VSKitPdfParsePreview,
    VSKitUpdate,
    VSMaintenanceCreate,
    VSMaintenanceOut,
    VSMaintenanceUpdate,
    VSPublicComplaintCreate,
    VSPublicVehicleInfo,
    VSServiceCostCreate,
    VSServiceCostOut,
    VSSendOTPRequest,
    VSSendOTPResponse,
    VSSeverityCount,
    VSStatusCount,
    VSUniversalComplaintCreate,
    VSVerifyOTPRequest,
    VSVerifyOTPResponse,
        VSFileUploadResponse,
        VSVehicleImagesUploadResponse,
        VSVehicleCreate,
        VSVehicleOut,
        VSVehicleUpdate,
    VSCustomFieldTabCreate,
    VSCustomFieldTabUpdate,
    VSCustomFieldTabOut,
    VSCustomFieldDefinitionCreate,
    VSCustomFieldDefinitionUpdate,
    VSCustomFieldDefinitionOut,
    VSComplaintCustomFieldValueCreate,
    VSComplaintCustomFieldValueUpdate,
    VSComplaintCustomFieldValueOut,
    VSComplaintCustomFieldValueBulkSave,
)

router = APIRouter(prefix="/vehicle-service", tags=["vehicle-service"])


def _generate_complaint_no(db: Session) -> str:
    return generate_next_document_number(
        db,
        document_type="complaint",
        default_prefix="VC-",
        default_padding=4,
        default_name="Vehicle Service Complaint",
        default_description="Unique sequence identifier for customer and staff vehicle service complaints",
    )


def _reverse_geocode_area_and_city(lat: Optional[float], lng: Optional[float]) -> Optional[str]:
    """Reverse geocode latitude and longitude into 'Area, City' using OpenStreetMap Nominatim."""
    if lat is None or lng is None:
        return None
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=14&addressdetails=1"
        req = urllib.request.Request(url, headers={"User-Agent": "KIM-ERP/2.0 (CRM-VehicleService)"})
        with urllib.request.urlopen(req, timeout=2.5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                addr = data.get("address", {})
                area = (
                    addr.get("suburb")
                    or addr.get("neighbourhood")
                    or addr.get("residential")
                    or addr.get("subdistrict")
                    or addr.get("locality")
                    or addr.get("road")
                    or addr.get("village")
                    or ""
                )
                city = (
                    addr.get("city")
                    or addr.get("town")
                    or addr.get("municipality")
                    or addr.get("city_district")
                    or addr.get("state_district")
                    or addr.get("county")
                    or addr.get("state")
                    or ""
                )
                if area and city and area.lower() != city.lower():
                    return f"{area}, {city}"
                return area or city or None
    except Exception as e:
        print("[WARNING] Reverse geocoding error:", e)
    return None


def _trigger_critical_notifications(
    db: Session, complaint: VSComplaint, vehicle: VSVehicle
) -> None:
    if complaint.severity in (ComplaintSeverity.CRITICAL, ComplaintSeverity.HIGH):
        # Notify active users
        active_users = (
            db.query(User).filter(User.status == UserStatus.ACTIVE).all()
        )
        alert_label = "CRITICAL ALERT" if complaint.severity == ComplaintSeverity.CRITICAL else "HIGH ALERT"
        msg = (
            f"[{alert_label}] {complaint.complaint_no} raised for {vehicle.vehicle_number} "
            f"({complaint.category}): {complaint.description[:80]}"
        )
        for u in active_users:
            notification = Notification(user_id=u.id, message=msg)
            db.add(notification)
        db.flush()


def _trigger_customer_sms(phone: str, complaint_no: str, vehicle_number: str) -> None:
    """SMS trigger placeholder hook. Can be configured with external SMS gateway API."""
    msg = (
        f"KIM EV Service: Your service request {complaint_no} for vehicle {vehicle_number} "
        f"has been registered. Our technician will contact you shortly."
    )
    # Log SMS dispatch for audit & tracking
    print(f"[SMS TRIGGER] Dispatching SMS to {phone}: '{msg}'")


def _format_complaint_out(c: VSComplaint) -> VSComplaintOut:
    return VSComplaintOut(
        id=c.id,
        complaint_no=c.complaint_no,
        vehicle_id=c.vehicle_id,
        vehicle_number=c.vehicle.vehicle_number if c.vehicle else None,
        owner_name=c.vehicle.owner_name if c.vehicle else None,
        owner_phone=c.vehicle.owner_phone if c.vehicle else None,
        affected_component_id=c.affected_component_id,
        affected_component_label=c.affected_component.component_label if c.affected_component else None,
        affected_component_serial=c.affected_component.serial_number if c.affected_component else None,
        reported_by=c.reported_by,
        reported_phone=c.reported_phone,
        category=c.category,
        severity=c.severity,
        description=c.description,
        gps_latitude=c.gps_latitude,
        gps_longitude=c.gps_longitude,
        gps_address=c.gps_address,
        registered_via=c.registered_via,
        status=c.status,
        assigned_to_id=c.assigned_to_id,
        assigned_to_name=c.assigned_to.full_name if c.assigned_to else None,
        acknowledged_at=c.acknowledged_at,
        resolved_at=c.resolved_at,
        closed_at=c.closed_at,
        resolution_summary=c.resolution_summary,
        created_at=c.created_at,
        updated_at=c.updated_at,
        notes=[
            VSComplaintNoteOut.model_validate(n) for n in (c.notes or [])
        ],
        feedback=(
            VSCustomerFeedbackOut.model_validate(c.feedback)
            if c.feedback
            else None
        ),
        costs=[VSServiceCostOut.model_validate(cost) for cost in (c.costs or [])],
        custom_field_values=[
            VSComplaintCustomFieldValueOut.model_validate(v) for v in (c.custom_field_values or [])
        ],
    )


def _format_vehicle_out(v: VSVehicle, db: Session) -> VSVehicleOut:
    open_count = (
        db.query(func.count(VSComplaint.id))
        .filter(
            VSComplaint.vehicle_id == v.id,
            VSComplaint.status.in_([ComplaintStatus.OPEN, ComplaintStatus.ACKNOWLEDGED, ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS]),
        )
        .scalar()
        or 0
    )
    return VSVehicleOut(
        id=v.id,
        vehicle_number=v.vehicle_number,
        chassis_number=v.chassis_number,
        kit_id=v.kit_id,
        kit_number=v.kit.kit_number if v.kit else None,
        kit_name=v.kit.kit_name if v.kit else None,
        retrofit_date=v.retrofit_date,
        owner_name=v.owner_name,
        owner_phone=v.owner_phone,
        owner_address=v.owner_address,
        warranty_expiry=v.warranty_expiry,
        last_service_date=v.last_service_date,
        total_mileage_km=v.total_mileage_km,
        qr_token=v.qr_token,
        is_active=v.is_active,
        created_at=v.created_at,
        updated_at=v.updated_at,
        components=v.components or [],
        open_complaints_count=open_count,
    )


# ============================================================================
# Public QR Endpoints (No Auth Required)
# ============================================================================

@router.get("/public/register/{qr_token}", response_model=VSPublicVehicleInfo)
def get_public_vehicle_by_qr(qr_token: str, db: Session = Depends(get_db)):
    vehicle = (
        db.query(VSVehicle)
        .filter(VSVehicle.qr_token == qr_token, VSVehicle.is_active == True)  # noqa: E712
        .first()
    )
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found or QR code is invalid",
        )

    return VSPublicVehicleInfo(
        vehicle_id=vehicle.id,
        vehicle_number=vehicle.vehicle_number,
        owner_name=vehicle.owner_name,
        owner_phone=vehicle.owner_phone,
        kit_number=vehicle.kit.kit_number if vehicle.kit else None,
        kit_name=vehicle.kit.kit_name if vehicle.kit else None,
        warranty_expiry=vehicle.warranty_expiry,
        components=vehicle.components or [],
    )


@router.get("/public/complaint-categories")
def get_public_complaint_categories(db: Session = Depends(get_db)):
    """Retrieve active complaint categories from configuration."""
    opts = (
        db.query(CrmDropdownOption)
        .filter(
            CrmDropdownOption.category == "complaint_category",
            CrmDropdownOption.is_active == True,  # noqa: E712
        )
        .order_by(CrmDropdownOption.order_index.asc(), CrmDropdownOption.label.asc())
        .all()
    )
    if opts:
        return [{"key": o.value, "label": o.label} for o in opts]

    # Standard default categories if none configured yet
    return [
        {"key": "BREAKDOWN", "label": "Vehicle Breakdown"},
        {"key": "BATTERY", "label": "Battery / Range Issue"},
        {"key": "MOTOR", "label": "Motor Issue"},
        {"key": "CONTROLLER", "label": "Controller / Throttle"},
        {"key": "CHARGING", "label": "Charging Failure"},
        {"key": "PERFORMANCE", "label": "Speed / Performance"},
        {"key": "OTHER", "label": "Other Issue"},
    ]


@router.post("/public/register/{qr_token}", response_model=VSComplaintOut, status_code=status.HTTP_201_CREATED)
def submit_public_complaint(
    qr_token: str,
    payload: VSPublicComplaintCreate,
    db: Session = Depends(get_db),
):
    vehicle = (
        db.query(VSVehicle)
        .filter(VSVehicle.qr_token == qr_token, VSVehicle.is_active == True)  # noqa: E712
        .first()
    )
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found or QR code is invalid",
        )

    # Prevent duplicate complaints: Maximum 1 request per vehicle per day
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    existing_today = (
        db.query(VSComplaint)
        .filter(
            VSComplaint.vehicle_id == vehicle.id,
            VSComplaint.created_at >= today_start,
        )
        .first()
    )
    if existing_today:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"A service request ({existing_today.complaint_no}) has already been registered for vehicle {vehicle.vehicle_number} today. Maximum 1 request per day is allowed to prevent duplicate requests.",
        )

    complaint_no = _generate_complaint_no(db)
    gps_addr = payload.gps_address or _reverse_geocode_area_and_city(payload.gps_latitude, payload.gps_longitude)
    complaint = VSComplaint(
        complaint_no=complaint_no,
        vehicle_id=vehicle.id,
        affected_component_id=payload.affected_component_id,
        reported_by=payload.reported_by,
        reported_phone=payload.reported_phone,
        category=payload.category,
        severity=payload.severity or ComplaintSeverity.MEDIUM,
        description=payload.description or f"{payload.category} service request reported for {vehicle.vehicle_number}",
        gps_latitude=payload.gps_latitude,
        gps_longitude=payload.gps_longitude,
        gps_address=gps_addr,
        registered_via=RegisteredVia.QR,
        status=ComplaintStatus.OPEN,
    )
    db.add(complaint)
    db.flush()

    # Add initial note
    loc_str = gps_addr or "Customer Location"
    init_note = VSComplaintNote(
        complaint_id=complaint.id,
        author_name=f"Customer ({payload.reported_by})",
        note=f"Complaint registered via QR scan at {loc_str}. Category: {payload.category}",
        is_status_change=False,
    )
    db.add(init_note)

    _trigger_critical_notifications(db, complaint, vehicle)
    _trigger_customer_sms(payload.reported_phone, complaint.complaint_no, vehicle.vehicle_number)

    db.commit()
    db.refresh(complaint)
    return _format_complaint_out(complaint)


@router.get("/public/lookup", response_model=Optional[VSPublicVehicleInfo])
def lookup_public_vehicle(vehicle_number: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    clean_no = vehicle_number.strip().upper()
    vehicle = (
        db.query(VSVehicle)
        .filter(VSVehicle.vehicle_number == clean_no, VSVehicle.is_active == True)  # noqa: E712
        .first()
    )
    if not vehicle:
        return None

    return VSPublicVehicleInfo(
        vehicle_id=vehicle.id,
        vehicle_number=vehicle.vehicle_number,
        owner_name=vehicle.owner_name,
        owner_phone=vehicle.owner_phone,
        kit_number=vehicle.kit.kit_number if vehicle.kit else None,
        kit_name=vehicle.kit.kit_name if vehicle.kit else None,
        warranty_expiry=vehicle.warranty_expiry,
        components=vehicle.components or [],
    )


@router.post("/public/universal-register", response_model=VSComplaintOut, status_code=status.HTTP_201_CREATED)
def submit_universal_complaint(
    payload: VSUniversalComplaintCreate,
    db: Session = Depends(get_db),
):
    clean_no = payload.vehicle_number.strip().upper()
    vehicle = (
        db.query(VSVehicle)
        .filter(VSVehicle.vehicle_number == clean_no)
        .first()
    )
    if not vehicle:
        # Auto-register vehicle in master so customer complaints are never rejected
        vehicle = VSVehicle(
            vehicle_number=clean_no,
            owner_name=payload.reported_by.strip(),
            owner_phone=payload.reported_phone.strip(),
            qr_token=uuid.uuid4().hex,
            is_active=True,
        )
        db.add(vehicle)
        db.flush()
    else:
        # Keep contact phone updated if not present
        if not vehicle.owner_phone and payload.reported_phone:
            vehicle.owner_phone = payload.reported_phone.strip()

    # Prevent duplicate complaints: Maximum 1 request per vehicle per day
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    existing_today = (
        db.query(VSComplaint)
        .filter(
            VSComplaint.vehicle_id == vehicle.id,
            VSComplaint.created_at >= today_start,
        )
        .first()
    )
    if existing_today:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"A service request ({existing_today.complaint_no}) has already been registered for vehicle {clean_no} today. Maximum 1 request per day is allowed to prevent duplicate requests.",
        )

    complaint_no = _generate_complaint_no(db)
    desc = (payload.description or "").strip() or f"{payload.category} service issue reported for {clean_no}"
    gps_addr = payload.gps_address or _reverse_geocode_area_and_city(payload.gps_latitude, payload.gps_longitude)

    complaint = VSComplaint(
        complaint_no=complaint_no,
        vehicle_id=vehicle.id,
        affected_component_id=payload.affected_component_id,
        reported_by=payload.reported_by.strip(),
        reported_phone=payload.reported_phone.strip(),
        category=payload.category,
        severity=payload.severity or ComplaintSeverity.MEDIUM,
        description=desc,
        gps_latitude=payload.gps_latitude,
        gps_longitude=payload.gps_longitude,
        gps_address=gps_addr,
        registered_via=RegisteredVia.QR,
        status=ComplaintStatus.OPEN,
    )
    complaint.vehicle = vehicle
    db.add(complaint)
    db.flush()

    # Initial Note
    gps_info = gps_addr or "Customer Location"
    init_note = VSComplaintNote(
        complaint_id=complaint.id,
        author_name=f"Customer ({payload.reported_by})",
        note=f"Complaint registered via Universal QR link at {gps_info}. Category: {payload.category}",
        is_status_change=False,
    )
    db.add(init_note)

    try:
        _trigger_critical_notifications(db, complaint, vehicle)
    except Exception as e:
        print("[WARNING] Critical notification error:", e)

    try:
        _trigger_customer_sms(payload.reported_phone, complaint.complaint_no, vehicle.vehicle_number)
    except Exception as e:
        print("[WARNING] SMS dispatch error:", e)

    db.commit()
    db.refresh(complaint)
    return _format_complaint_out(complaint)


# ============================================================================
# Authenticated Kit Master Endpoints
# ============================================================================

@router.get("/kits", response_model=List[VSKitOut])
def list_kits(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VSKit)
    if is_active is not None:
        query = query.filter(VSKit.is_active == is_active)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(VSKit.kit_number.ilike(s), VSKit.kit_name.ilike(s)))
    return query.order_by(VSKit.kit_number.asc()).all()


@router.post("/kits", response_model=VSKitOut, status_code=status.HTTP_201_CREATED)
def create_kit(
    payload: VSKitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(VSKit).filter(VSKit.kit_number == payload.kit_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kit with number '{payload.kit_number}' already exists",
        )

    kit = VSKit(
        kit_number=payload.kit_number,
        kit_name=payload.kit_name,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        vehicle_number=payload.vehicle_number,
        installed_on=payload.installed_on,
        description=payload.description,
        is_active=True,
    )
    db.add(kit)
    db.flush()

    for comp in payload.component_types:
        ct = VSKitComponentType(
            kit_id=kit.id,
            component_type=comp.component_type,
            label=comp.label,
            serial_number=comp.serial_number,
            is_required=comp.is_required,
        )
        db.add(ct)

    db.commit()
    db.refresh(kit)
    return kit


@router.post("/kits/parse-pdf", response_model=VSKitPdfParsePreview)
async def parse_kit_pdf_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Parse stock traceability PDF and return extracted Kit Name, Kit ID, Customer, and components preview."""
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF document.")
    contents = await file.read()
    try:
        data = parse_kit_traceability_pdf(contents)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Kit PDF: {str(e)}")


@router.post("/kits/import-pdf", response_model=VSKitOut, status_code=status.HTTP_201_CREATED)
async def import_kit_pdf_endpoint(
    file: UploadFile = File(...),
    vehicle_number: Optional[str] = Form(None),
    installed_on: Optional[date] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import Kit and components directly from stock traceability PDF into KIT Master."""
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF document.")
    contents = await file.read()
    try:
        data = parse_kit_traceability_pdf(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Kit PDF: {str(e)}")

    existing = db.query(VSKit).filter(VSKit.kit_number == data["kit_number"]).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Kit with number '{data['kit_number']}' already exists in Kit Master.",
        )

    v_num = (vehicle_number or "").strip() or None
    final_installed_on = installed_on or data.get("installed_on")
    kit = VSKit(
        kit_number=data["kit_number"],
        kit_name=data["kit_name"],
        customer_name=data["customer_name"],
        vehicle_number=v_num,
        installed_on=final_installed_on,
        description=f"Imported from {file.filename}. Customer: {data['customer_name']}",
        is_active=True,
    )
    db.add(kit)
    db.flush()

    for comp in data["components"]:
        ct = VSKitComponentType(
            kit_id=kit.id,
            component_type=comp["component_type"],
            label=comp["label"],
            serial_number=comp["serial_number"],
            is_required=comp["is_required"],
        )
        db.add(ct)

    db.commit()
    db.refresh(kit)
    return kit


@router.get("/kits/{kit_id}", response_model=VSKitOut)
def get_kit(
    kit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    kit = db.query(VSKit).filter(VSKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")
    return kit


@router.patch("/kits/{kit_id}", response_model=VSKitOut)
def update_kit(
    kit_id: int,
    payload: VSKitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update Kit Master record and component details. Only Admin role can perform edits."""
    is_admin = current_user.role == UserRole.ADMIN
    if not is_admin:
        from app.services.rbac_service import get_user_active_roles, can_user
        roles = get_user_active_roles(db, current_user)
        is_super = any(r.code in ("super_admin", "admin") for r in roles if r and r.code)
        can_edit = can_user(db, current_user, "edit", "vehicle_service") or can_user(db, current_user, "edit", "kits")
        if not is_super and not can_edit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admin role can edit Kit Master records and component details.",
            )

    kit = db.query(VSKit).filter(VSKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    if payload.kit_number is not None and payload.kit_number.strip():
        new_no = payload.kit_number.strip().upper()
        if new_no != kit.kit_number:
            existing = db.query(VSKit).filter(VSKit.kit_number == new_no, VSKit.id != kit_id).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Kit number '{new_no}' is already used by another kit.")
            kit.kit_number = new_no
    if payload.kit_name is not None:
        kit.kit_name = payload.kit_name.strip()
    if payload.customer_name is not None:
        kit.customer_name = payload.customer_name.strip() if payload.customer_name else None
    if payload.customer_phone is not None:
        kit.customer_phone = payload.customer_phone.strip() if payload.customer_phone else None
    if payload.vehicle_number is not None:
        kit.vehicle_number = payload.vehicle_number.strip().upper() if payload.vehicle_number else None
    if payload.installed_on is not None:
        kit.installed_on = payload.installed_on
    if payload.description is not None:
        kit.description = payload.description.strip() if payload.description else None
    if payload.is_active is not None:
        kit.is_active = payload.is_active

    if payload.component_types is not None:
        # Match existing components to preserve IDs and avoid foreign key or session conflicts
        existing_by_type = {c.component_type: c for c in kit.component_types}
        new_comps = []
        for comp in payload.component_types:
            c_type = comp.component_type.strip()
            if c_type in existing_by_type:
                ct = existing_by_type[c_type]
                ct.label = comp.label.strip()
                ct.serial_number = comp.serial_number.strip() if comp.serial_number else None
                ct.is_required = comp.is_required
                new_comps.append(ct)
            else:
                ct = VSKitComponentType(
                    kit_id=kit.id,
                    component_type=c_type,
                    label=comp.label.strip(),
                    serial_number=comp.serial_number.strip() if comp.serial_number else None,
                    is_required=comp.is_required,
                )
                new_comps.append(ct)
        kit.component_types = new_comps

    db.commit()
    db.refresh(kit)
    return kit


@router.delete("/kits/{kit_id}")
def delete_kit(
    kit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a Kit Master definition and its associated component types."""
    kit = db.query(VSKit).filter(VSKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    # Check if any registered vehicle is currently linked to this kit
    linked_vehicles = db.query(VSVehicle).filter(VSVehicle.kit_id == kit_id).count()
    if linked_vehicles > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete kit '{kit.kit_name}' because {linked_vehicles} vehicle(s) are actively linked to it. Please reassign or remove linked vehicles first.",
        )

    db.delete(kit)
    db.commit()
    return {"success": True, "message": f"Kit '{kit.kit_name}' deleted successfully"}


# ============================================================================
# Authenticated Vehicle Master Endpoints
# ============================================================================

@router.get("/vehicles", response_model=List[VSVehicleOut])
def list_vehicles(
    search: Optional[str] = None,
    kit_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VSVehicle)
    if is_active is not None:
        query = query.filter(VSVehicle.is_active == is_active)
    if kit_id:
        query = query.filter(VSVehicle.kit_id == kit_id)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                VSVehicle.vehicle_number.ilike(s),
                VSVehicle.owner_name.ilike(s),
                VSVehicle.owner_phone.ilike(s),
                VSVehicle.chassis_number.ilike(s),
            )
        )

    vehicles = query.order_by(VSVehicle.created_at.desc()).all()
    return [_format_vehicle_out(v, db) for v in vehicles]


@router.post("/vehicles", response_model=VSVehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: VSVehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(VSVehicle).filter(VSVehicle.vehicle_number == payload.vehicle_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle '{payload.vehicle_number}' is already registered",
        )

    qr_token = uuid.uuid4().hex

    vehicle = VSVehicle(
        vehicle_number=payload.vehicle_number.strip().upper(),
        chassis_number=payload.chassis_number,
        kit_id=payload.kit_id,
        retrofit_date=payload.retrofit_date,
        owner_name=payload.owner_name,
        owner_phone=payload.owner_phone,
        owner_address=payload.owner_address,
        warranty_expiry=payload.warranty_expiry,
        total_mileage_km=payload.total_mileage_km,
        qr_token=qr_token,
        is_active=True,
    )
    db.add(vehicle)
    db.flush()

    for comp in payload.components:
        c = VSVehicleComponent(
            vehicle_id=vehicle.id,
            component_type_id=comp.component_type_id,
            component_type=comp.component_type,
            component_label=comp.component_label,
            serial_number=comp.serial_number.strip(),
            installed_date=comp.installed_date or payload.retrofit_date,
            is_active=True,
        )
        db.add(c)

    db.commit()
    db.refresh(vehicle)
    return _format_vehicle_out(vehicle, db)


@router.get("/vehicles/{vehicle_id}", response_model=VSVehicleOut)
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = db.query(VSVehicle).filter(VSVehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return _format_vehicle_out(vehicle, db)


@router.patch("/vehicles/{vehicle_id}", response_model=VSVehicleOut)
def update_vehicle(
    vehicle_id: int,
    payload: VSVehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = db.query(VSVehicle).filter(VSVehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if payload.chassis_number is not None:
        vehicle.chassis_number = payload.chassis_number
    if payload.owner_name is not None:
        vehicle.owner_name = payload.owner_name
    if payload.owner_phone is not None:
        vehicle.owner_phone = payload.owner_phone
    if payload.owner_address is not None:
        vehicle.owner_address = payload.owner_address
    if payload.warranty_expiry is not None:
        vehicle.warranty_expiry = payload.warranty_expiry
    if payload.last_service_date is not None:
        vehicle.last_service_date = payload.last_service_date
    if payload.total_mileage_km is not None:
        vehicle.total_mileage_km = payload.total_mileage_km
    if payload.is_active is not None:
        vehicle.is_active = payload.is_active

    db.commit()
    db.refresh(vehicle)
    return _format_vehicle_out(vehicle, db)


@router.post(
    "/vehicles/{vehicle_id}/components/{component_id}/replace",
    response_model=VSComponentHistoryOut,
    status_code=status.HTTP_201_CREATED,
)
def replace_component(
    vehicle_id: int,
    component_id: int,
    payload: VSComponentReplaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    component = (
        db.query(VSVehicleComponent)
        .filter(VSVehicleComponent.id == component_id, VSVehicleComponent.vehicle_id == vehicle_id)
        .first()
    )
    if not component:
        raise HTTPException(status_code=404, detail="Vehicle component not found")

    old_serial = component.serial_number
    new_serial = payload.new_serial_number.strip()

    # Create history entry
    hist = VSComponentHistory(
        vehicle_component_id=component.id,
        old_serial_number=old_serial,
        new_serial_number=new_serial,
        replaced_date=payload.replaced_date,
        reason=payload.reason,
        replaced_by_id=current_user.id,
        complaint_id=payload.complaint_id,
    )
    db.add(hist)

    # Update active serial number in component
    component.serial_number = new_serial
    component.installed_date = payload.replaced_date

    # If linked to a complaint, add note to complaint
    if payload.complaint_id:
        note = VSComplaintNote(
            complaint_id=payload.complaint_id,
            author_id=current_user.id,
            author_name=current_user.full_name,
            note=f"Replaced {component.component_label} (Old SN: {old_serial} → New SN: {new_serial}). Reason: {payload.reason or 'Faulty/Damaged'}",
            is_status_change=False,
        )
        db.add(note)

    db.commit()
    db.refresh(hist)

    return VSComponentHistoryOut(
        id=hist.id,
        vehicle_component_id=hist.vehicle_component_id,
        old_serial_number=hist.old_serial_number,
        new_serial_number=hist.new_serial_number,
        replaced_date=hist.replaced_date,
        reason=hist.reason,
        replaced_by_id=hist.replaced_by_id,
        replaced_by_name=current_user.full_name,
        complaint_id=hist.complaint_id,
        created_at=hist.created_at,
    )


# ============================================================================
# Authenticated Complaints Endpoints
# ============================================================================

@router.get("/complaints", response_model=List[VSComplaintOut])
def list_complaints(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    vehicle_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VSComplaint)
    if status:
        query = query.filter(VSComplaint.status == status)
    if severity:
        query = query.filter(VSComplaint.severity == severity)
    if category:
        query = query.filter(VSComplaint.category == category)
    if vehicle_id:
        query = query.filter(VSComplaint.vehicle_id == vehicle_id)
    if search:
        s = f"%{search}%"
        query = query.join(VSVehicle).filter(
            or_(
                VSComplaint.complaint_no.ilike(s),
                VSComplaint.reported_by.ilike(s),
                VSComplaint.description.ilike(s),
                VSVehicle.vehicle_number.ilike(s),
            )
        )

    complaints = query.order_by(VSComplaint.created_at.desc()).all()
    return [_format_complaint_out(c) for c in complaints]


@router.post("/complaints", response_model=VSComplaintOut, status_code=status.HTTP_201_CREATED)
def create_complaint(
    payload: VSComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = None
    if payload.vehicle_id:
        vehicle = db.query(VSVehicle).filter(VSVehicle.id == payload.vehicle_id).first()

    # If vehicle not found by vehicle_id, look up or create vehicle linked to Kit Master
    if not vehicle and payload.kit_id:
        kit = db.query(VSKit).filter(VSKit.id == payload.kit_id).first()
        if kit:
            v_no = (kit.vehicle_number or payload.vehicle_number or kit.kit_number).strip().upper()
            vehicle = db.query(VSVehicle).filter(
                or_(
                    VSVehicle.kit_id == kit.id,
                    VSVehicle.vehicle_number == v_no,
                )
            ).first()
            if not vehicle:
                vehicle = VSVehicle(
                    vehicle_number=v_no,
                    kit_id=kit.id,
                    owner_name=kit.customer_name or payload.reported_by,
                    owner_phone=payload.reported_phone or "0000000000",
                    retrofit_date=kit.installed_on,
                    qr_token=uuid.uuid4().hex,
                    is_active=True,
                )
                db.add(vehicle)
                db.flush()
                for ct in kit.component_types:
                    vc = VSVehicleComponent(
                        vehicle_id=vehicle.id,
                        component_type_id=ct.id,
                        component_type=ct.component_type,
                        component_label=ct.label,
                        serial_number=ct.serial_number or f"{ct.component_type}-SN",
                        installed_date=kit.installed_on,
                        is_active=True,
                    )
                    db.add(vc)
                db.flush()

    if not vehicle and payload.vehicle_number:
        v_no = payload.vehicle_number.strip().upper()
        vehicle = db.query(VSVehicle).filter(VSVehicle.vehicle_number == v_no).first()
        if not vehicle:
            vehicle = VSVehicle(
                vehicle_number=v_no,
                owner_name=payload.reported_by,
                owner_phone=payload.reported_phone,
                qr_token=uuid.uuid4().hex,
                is_active=True,
            )
            db.add(vehicle)
            db.flush()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found. Please select a valid Kit Master record.")

    complaint_no = _generate_complaint_no(db)
    gps_addr = payload.gps_address or _reverse_geocode_area_and_city(payload.gps_latitude, payload.gps_longitude)
    complaint = VSComplaint(
        complaint_no=complaint_no,
        vehicle_id=vehicle.id,
        affected_component_id=payload.affected_component_id,
        reported_by=payload.reported_by,
        reported_phone=payload.reported_phone,
        category=payload.category,
        severity=payload.severity,
        description=payload.description,
        gps_latitude=payload.gps_latitude,
        gps_longitude=payload.gps_longitude,
        gps_address=gps_addr,
        registered_via=RegisteredVia.STAFF,
        status=ComplaintStatus.OPEN,
        assigned_to_id=payload.assigned_to_id,
    )
    db.add(complaint)
    db.flush()

    loc_info = f" at {gps_addr}" if gps_addr else ""
    note = VSComplaintNote(
        complaint_id=complaint.id,
        author_id=current_user.id,
        author_name=current_user.full_name,
        note=f"Complaint registered by {current_user.full_name}{loc_info}. Severity: {payload.severity}",
        is_status_change=False,
    )
    db.add(note)

    _trigger_critical_notifications(db, complaint, vehicle)

    db.commit()
    db.refresh(complaint)
    return _format_complaint_out(complaint)


@router.get("/complaints/{complaint_id}", response_model=VSComplaintOut)
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return _format_complaint_out(complaint)


@router.patch("/complaints/{complaint_id}", response_model=VSComplaintOut)
def update_complaint(
    complaint_id: int,
    payload: VSComplaintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = complaint.status

    if payload.severity is not None:
        complaint.severity = payload.severity
    if payload.affected_component_id is not None:
        complaint.affected_component_id = payload.affected_component_id
    if payload.resolution_summary is not None:
        complaint.resolution_summary = payload.resolution_summary

    if payload.assigned_to_id is not None and payload.assigned_to_id != complaint.assigned_to_id:
        complaint.assigned_to_id = payload.assigned_to_id
        if complaint.status == ComplaintStatus.OPEN:
            complaint.status = ComplaintStatus.ASSIGNED
        assignee = db.query(User).filter(User.id == payload.assigned_to_id).first()
        assignee_name = assignee.full_name if assignee else f"User #{payload.assigned_to_id}"
        db.add(
            VSComplaintNote(
                complaint_id=complaint.id,
                author_id=current_user.id,
                author_name=current_user.full_name,
                note=f"Assigned to {assignee_name}",
                is_status_change=True,
            )
        )

    if payload.status is not None and payload.status != old_status:
        complaint.status = payload.status
        now = datetime.now(UTC)
        if payload.status == ComplaintStatus.ACKNOWLEDGED and not complaint.acknowledged_at:
            complaint.acknowledged_at = now
        elif payload.status == ComplaintStatus.RESOLVED and not complaint.resolved_at:
            complaint.resolved_at = now
        elif payload.status == ComplaintStatus.CLOSED and not complaint.closed_at:
            complaint.closed_at = now

        db.add(
            VSComplaintNote(
                complaint_id=complaint.id,
                author_id=current_user.id,
                author_name=current_user.full_name,
                note=f"Status changed from {old_status} to {payload.status}",
                is_status_change=True,
            )
        )

    db.commit()
    db.refresh(complaint)
    return _format_complaint_out(complaint)


@router.post("/complaints/{complaint_id}/notes", response_model=VSComplaintNoteOut, status_code=status.HTTP_201_CREATED)
def add_complaint_note(
    complaint_id: int,
    payload: VSComplaintNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    note = VSComplaintNote(
        complaint_id=complaint.id,
        author_id=current_user.id,
        author_name=current_user.full_name,
        note=payload.note,
        is_status_change=False,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return VSComplaintNoteOut.model_validate(note)


@router.post("/complaints/{complaint_id}/close", response_model=VSComplaintOut)
def close_complaint(
    complaint_id: int,
    payload: VSComplaintCloseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Check OTP verification before closing
    if not complaint.otp_verified:
        raise HTTPException(
            status_code=400,
            detail="OTP verification required before closing work order",
        )

    complaint.status = ComplaintStatus.CLOSED
    complaint.closed_at = datetime.now(UTC)
    complaint.resolution_summary = payload.resolution_summary

    # Update vehicle last service date
    if complaint.vehicle:
        complaint.vehicle.last_service_date = date.today()

    db.add(
        VSComplaintNote(
            complaint_id=complaint.id,
            author_id=current_user.id,
            author_name=current_user.full_name,
            note=f"Work Order Closed: {payload.resolution_summary}",
            is_status_change=True,
        )
    )

    if payload.rating is not None:
        feedback = VSCustomerFeedback(
            complaint_id=complaint.id,
            rating=payload.rating,
            comment=payload.feedback_comment,
        )
        db.add(feedback)

    db.commit()
    db.refresh(complaint)
    return _format_complaint_out(complaint)


def _send_sms_otp(phone: str, otp_code: str) -> None:
    """SMS service placeholder - logs OTP for now. Replace with actual SMS gateway integration."""
    message = f"Your OTP for vehicle service complaint is: {otp_code}. Valid for 5 minutes."
    print(f"[SMS OTP] Sending to {phone}: {message}")


@router.post("/complaints/{complaint_id}/send-otp", response_model=VSSendOTPResponse)
def send_otp(
    complaint_id: int,
    payload: VSSendOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send 6-digit OTP to the reported phone number on the complaint."""
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Generate 6-digit OTP
    otp_code = ''.join(random.choices(string.digits, k=6))
    otp_expires_at = datetime.now(UTC) + timedelta(minutes=5)

    # Save OTP to complaint
    complaint.otp_code = otp_code
    complaint.otp_expires_at = otp_expires_at
    complaint.otp_verified = False

    db.flush()

    # Send OTP via SMS (placeholder)
    _send_sms_otp(complaint.reported_phone, otp_code)

    db.commit()

    return VSSendOTPResponse(
        success=True,
        message=f"OTP sent to {complaint.reported_phone}",
        expires_at=otp_expires_at,
    )


@router.post("/complaints/{complaint_id}/verify-otp", response_model=VSVerifyOTPResponse)
def verify_otp(
    complaint_id: int,
    payload: VSVerifyOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify the OTP code sent to the complaint's reported phone number."""
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if not complaint.otp_code or not complaint.otp_expires_at:
        raise HTTPException(
            status_code=400,
            detail="No OTP sent yet. Please send OTP first.",
        )

    # Check if OTP is expired - handle both naive and aware datetimes
    from datetime import timezone
    expires_at = complaint.otp_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(UTC) > expires_at:
        raise HTTPException(
            status_code=400,
            detail="OTP has expired. Please request a new OTP.",
        )

    # Verify OTP
    if payload.otp_code != complaint.otp_code:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP code.",
        )

    # Mark OTP as verified
    complaint.otp_verified = True
    complaint.otp_code = None
    complaint.otp_expires_at = None

    db.commit()

    return VSVerifyOTPResponse(
        success=True,
        message="OTP verified successfully. You can now close the work order.",
    )


# ============================================================================
# Service Workflow File Upload Endpoints
# ============================================================================

@router.post("/complaints/{complaint_id}/initial-checklist", response_model=VSFileUploadResponse)
async def upload_initial_checklist(
    complaint_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload initial checklist PDF/image for a complaint."""
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Validate file type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, and PNG files are allowed")

    # Upload file (placeholder - implement actual file storage)
    # For now, we'll save the file to a local uploads directory
    import os
    upload_dir = "uploads/vehicle_service/initial_checklists"
    os.makedirs(upload_dir, exist_ok=True)

    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{complaint_id}_{uuid.uuid4().hex}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Save URL to complaint
    file_url = f"/uploads/vehicle_service/initial_checklists/{unique_filename}"
    complaint.initial_checklist_url = file_url
    db.commit()

    return VSFileUploadResponse(url=file_url)


@router.post("/complaints/{complaint_id}/master-checklist", response_model=VSFileUploadResponse)
async def upload_master_checklist(
    complaint_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload master checklist PDF/image for a complaint."""
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Validate file type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, and PNG files are allowed")

    import os
    upload_dir = "uploads/vehicle_service/master_checklists"
    os.makedirs(upload_dir, exist_ok=True)

    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{complaint_id}_{uuid.uuid4().hex}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/uploads/vehicle_service/master_checklists/{unique_filename}"
    complaint.master_checklist_url = file_url
    db.commit()

    return VSFileUploadResponse(url=file_url)


@router.post("/complaints/{complaint_id}/complaints-8d", response_model=VSFileUploadResponse)
async def upload_complaints_8d(
    complaint_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload 8D complaints report PDF/image for a complaint."""
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Validate file type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, and PNG files are allowed")

    import os
    upload_dir = "uploads/vehicle_service/complaints_8d"
    os.makedirs(upload_dir, exist_ok=True)

    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{complaint_id}_{uuid.uuid4().hex}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/uploads/vehicle_service/complaints_8d/{unique_filename}"
    complaint.complaints_8d_url = file_url
    db.commit()

    return VSFileUploadResponse(url=file_url)


@router.post("/complaints/{complaint_id}/vehicle-images", response_model=VSVehicleImagesUploadResponse)
async def upload_vehicle_images(
    complaint_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload multiple vehicle images for a complaint."""
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Validate file types
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg']
    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Only JPEG and PNG images are allowed")

    import os
    import json
    upload_dir = "uploads/vehicle_service/vehicle_images"
    os.makedirs(upload_dir, exist_ok=True)

    urls = []
    for file in files:
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{complaint_id}_{uuid.uuid4().hex}{file_extension}"
        file_path = os.path.join(upload_dir, unique_filename)

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        file_url = f"/uploads/vehicle_service/vehicle_images/{unique_filename}"
        urls.append(file_url)

    # Store as JSON array in vehicle_images field
    existing_images = json.loads(complaint.vehicle_images) if complaint.vehicle_images else []
    existing_images.extend(urls)
    complaint.vehicle_images = json.dumps(existing_images)
    db.commit()

    return VSVehicleImagesUploadResponse(urls=urls)


@router.post("/complaints/{complaint_id}/costs", response_model=VSServiceCostOut, status_code=status.HTTP_201_CREATED)
def add_service_cost(
    complaint_id: int,
    payload: VSServiceCostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    total = round(payload.quantity * payload.unit_price, 2)
    cost = VSServiceCost(
        complaint_id=complaint.id,
        item_name=payload.item_name,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        total_price=total,
    )
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return VSServiceCostOut.model_validate(cost)


@router.delete("/complaints/{complaint_id}")
def delete_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a work order / complaint. Only super admin or admin can perform this action."""
    is_admin = current_user.role == UserRole.ADMIN
    if not is_admin:
        from app.services.rbac_service import get_user_active_roles, can_user
        roles = get_user_active_roles(db, current_user)
        is_super = any(r.code in ("super_admin", "admin") for r in roles if r and r.code)
        can_del = can_user(db, current_user, "delete", "complaints") or can_user(db, current_user, "delete", "vehicle_service")
        if not is_super and not can_del:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin or Admin can delete work orders.",
            )

    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Work Order / Complaint not found")

    complaint_no = complaint.complaint_no
    db.delete(complaint)
    db.commit()
    return {"success": True, "message": f"Work Order '{complaint_no}' deleted successfully"}


# ============================================================================
# Authenticated Maintenance Schedule Endpoints
# ============================================================================

@router.get("/maintenance", response_model=List[VSMaintenanceOut])
def list_maintenance(
    vehicle_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VSMaintenanceSchedule)
    if vehicle_id:
        query = query.filter(VSMaintenanceSchedule.vehicle_id == vehicle_id)
    if status:
        query = query.filter(VSMaintenanceSchedule.status == status)

    records = query.order_by(VSMaintenanceSchedule.scheduled_date.asc()).all()
    return [
        VSMaintenanceOut(
            id=m.id,
            vehicle_id=m.vehicle_id,
            vehicle_number=m.vehicle.vehicle_number if m.vehicle else None,
            title=m.title,
            service_type=m.service_type,
            scheduled_date=m.scheduled_date,
            completed_date=m.completed_date,
            status=m.status,
            notes=m.notes,
            technician_id=m.technician_id,
            technician_name=m.technician.full_name if m.technician else None,
            cost=m.cost,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in records
    ]


@router.post("/maintenance", response_model=VSMaintenanceOut, status_code=status.HTTP_201_CREATED)
def create_maintenance(
    payload: VSMaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = db.query(VSVehicle).filter(VSVehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    m = VSMaintenanceSchedule(
        vehicle_id=payload.vehicle_id,
        title=payload.title,
        service_type=payload.service_type,
        scheduled_date=payload.scheduled_date,
        notes=payload.notes,
        technician_id=payload.technician_id,
        cost=payload.cost,
        status=MaintenanceStatus.SCHEDULED,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return VSMaintenanceOut(
        id=m.id,
        vehicle_id=m.vehicle_id,
        vehicle_number=vehicle.vehicle_number,
        title=m.title,
        service_type=m.service_type,
        scheduled_date=m.scheduled_date,
        completed_date=m.completed_date,
        status=m.status,
        notes=m.notes,
        technician_id=m.technician_id,
        technician_name=m.technician.full_name if m.technician else None,
        cost=m.cost,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


@router.patch("/maintenance/{maintenance_id}", response_model=VSMaintenanceOut)
def update_maintenance(
    maintenance_id: int,
    payload: VSMaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.query(VSMaintenanceSchedule).filter(VSMaintenanceSchedule.id == maintenance_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")

    if payload.status is not None:
        m.status = payload.status
        if payload.status == MaintenanceStatus.COMPLETED and not m.completed_date:
            m.completed_date = date.today()
            if m.vehicle:
                m.vehicle.last_service_date = date.today()
    if payload.completed_date is not None:
        m.completed_date = payload.completed_date
    if payload.notes is not None:
        m.notes = payload.notes
    if payload.cost is not None:
        m.cost = payload.cost
    if payload.technician_id is not None:
        m.technician_id = payload.technician_id

    db.commit()
    db.refresh(m)
    return VSMaintenanceOut(
        id=m.id,
        vehicle_id=m.vehicle_id,
        vehicle_number=m.vehicle.vehicle_number if m.vehicle else None,
        title=m.title,
        service_type=m.service_type,
        scheduled_date=m.scheduled_date,
        completed_date=m.completed_date,
        status=m.status,
        notes=m.notes,
        technician_id=m.technician_id,
        technician_name=m.technician.full_name if m.technician else None,
        cost=m.cost,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


# ============================================================================
# Dashboard & Analytics Endpoints
# ============================================================================

@router.get("/dashboard", response_model=VSDashboardOut)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_vehicles = db.query(func.count(VSVehicle.id)).scalar() or 0

    open_complaints = (
        db.query(func.count(VSComplaint.id))
        .filter(
            VSComplaint.status.in_([
                ComplaintStatus.OPEN,
                ComplaintStatus.ACKNOWLEDGED,
                ComplaintStatus.ASSIGNED,
                ComplaintStatus.IN_PROGRESS,
            ])
        )
        .scalar()
        or 0
    )

    critical_alerts = (
        db.query(func.count(VSComplaint.id))
        .filter(
            VSComplaint.severity == ComplaintSeverity.CRITICAL,
            VSComplaint.status.in_([
                ComplaintStatus.OPEN,
                ComplaintStatus.ACKNOWLEDGED,
                ComplaintStatus.ASSIGNED,
                ComplaintStatus.IN_PROGRESS,
            ]),
        )
        .scalar()
        or 0
    )

    pending_maintenance = (
        db.query(func.count(VSMaintenanceSchedule.id))
        .filter(VSMaintenanceSchedule.status.in_([MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS]))
        .scalar()
        or 0
    )

    now = datetime.now(UTC)
    month_start = datetime(now.year, now.month, 1, tzinfo=UTC)
    resolved_this_month = (
        db.query(func.count(VSComplaint.id))
        .filter(
            VSComplaint.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
            VSComplaint.resolved_at >= month_start,
        )
        .scalar()
        or 0
    )

    # Average resolution time in hours
    resolved_complaints = (
        db.query(VSComplaint)
        .filter(
            VSComplaint.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
            VSComplaint.resolved_at.isnot(None),
        )
        .all()
    )
    total_hours = 0.0
    valid_count = 0
    for c in resolved_complaints:
        if c.resolved_at and c.created_at:
            delta = (c.resolved_at - c.created_at).total_seconds() / 3600.0
            if delta >= 0:
                total_hours += delta
                valid_count += 1
    avg_hours = round(total_hours / valid_count, 1) if valid_count > 0 else 0.0

    kpis = VSDashboardKPIs(
        total_vehicles=total_vehicles,
        open_complaints=open_complaints,
        critical_alerts=critical_alerts,
        pending_maintenance=pending_maintenance,
        resolved_this_month=resolved_this_month,
        avg_resolution_hours=avg_hours,
    )

    # By category
    cat_rows = (
        db.query(VSComplaint.category, func.count(VSComplaint.id))
        .group_by(VSComplaint.category)
        .all()
    )
    by_category = [VSCategoryCount(category=r[0], count=r[1]) for r in cat_rows]

    # By severity
    sev_rows = (
        db.query(VSComplaint.severity, func.count(VSComplaint.id))
        .group_by(VSComplaint.severity)
        .all()
    )
    by_severity = [VSSeverityCount(severity=r[0], count=r[1]) for r in sev_rows]

    # By status
    status_rows = (
        db.query(VSComplaint.status, func.count(VSComplaint.id))
        .group_by(VSComplaint.status)
        .all()
    )
    by_status = [VSStatusCount(status=r[0], count=r[1]) for r in status_rows]

    # Recent complaints
    recent = (
        db.query(VSComplaint)
        .order_by(VSComplaint.created_at.desc())
        .limit(10)
        .all()
    )
    recent_complaints = [_format_complaint_out(c) for c in recent]

    # Anomaly detection: flag vehicles with > 2 complaints in the same category within last 30 days
    thirty_days_ago = now - timedelta(days=30)
    anomaly_rows = (
        db.query(
            VSComplaint.vehicle_id,
            VSVehicle.vehicle_number,
            VSComplaint.category,
            func.count(VSComplaint.id).label("c_count"),
        )
        .join(VSVehicle, VSComplaint.vehicle_id == VSVehicle.id)
        .filter(VSComplaint.created_at >= thirty_days_ago)
        .group_by(VSComplaint.vehicle_id, VSVehicle.vehicle_number, VSComplaint.category)
        .having(func.count(VSComplaint.id) >= 3)
        .all()
    )
    anomalies = [
        VSAnomalyAlert(
            vehicle_id=r[0],
            vehicle_number=r[1],
            category=r[2],
            complaints_count=r[3],
            message=f"Vehicle {r[1]} has reported {r[3]} {r[2]} complaints within the last 30 days. Investigate component quality or usage pattern.",
        )
        for r in anomaly_rows
    ]

    return VSDashboardOut(
        kpis=kpis,
        by_category=by_category,
        by_severity=by_severity,
        by_status=by_status,
        recent_complaints=recent_complaints,
        anomalies=anomalies,
    )


    # ============================================================================
# Custom Fields Endpoints for Vehicle Service
# ============================================================================

# Tabs
@router.get("/custom-fields/tabs", response_model=list[VSCustomFieldTabOut])
def list_custom_field_tabs(
    department_id: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VSCustomFieldTab)
    if active_only:
        query = query.filter(VSCustomFieldTab.is_active == True)
    if department_id:
        query = query.filter(VSCustomFieldTab.department_id == department_id)
    return query.order_by(VSCustomFieldTab.display_order).all()


@router.post("/custom-fields/tabs", response_model=VSCustomFieldTabOut, status_code=status.HTTP_201_CREATED)
def create_custom_field_tab(
    payload: VSCustomFieldTabCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tab = VSCustomFieldTab(**payload.model_dump())
    db.add(tab)
    db.commit()
    db.refresh(tab)
    return tab


@router.patch("/custom-fields/tabs/{tab_id}", response_model=VSCustomFieldTabOut)
def update_custom_field_tab(
    tab_id: int,
    payload: VSCustomFieldTabUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tab = db.query(VSCustomFieldTab).filter(VSCustomFieldTab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(tab, k, v)
    db.commit()
    db.refresh(tab)
    return tab


@router.delete("/custom-fields/tabs/{tab_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_field_tab(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tab = db.query(VSCustomFieldTab).filter(VSCustomFieldTab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    db.delete(tab)
    db.commit()


# Field Definitions
@router.get("/custom-fields/definitions", response_model=list[VSCustomFieldDefinitionOut])
def list_custom_field_definitions(
    tab_id: Optional[int] = None,
    department_id: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VSCustomFieldDefinition)
    if tab_id:
        query = query.filter(VSCustomFieldDefinition.tab_id == tab_id)
    if department_id:
        query = query.filter(VSCustomFieldDefinition.department_id == department_id)
    if active_only:
        query = query.filter(VSCustomFieldDefinition.is_visible == True)
    return query.order_by(VSCustomFieldDefinition.tab_id, VSCustomFieldDefinition.display_order).all()


@router.get("/custom-fields/definitions/by-tab/{tab_id}", response_model=list[VSCustomFieldDefinitionOut])
def list_custom_field_definitions_by_tab(
    tab_id: int,
    department_id: Optional[str] = None,
    status: Optional[str] = None,  # Filter by required status
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VSCustomFieldDefinition).filter(VSCustomFieldDefinition.tab_id == tab_id)
    if department_id:
        query = query.filter(VSCustomFieldDefinition.department_id == department_id)
    definitions = query.order_by(VSCustomFieldDefinition.display_order).all()

    # Filter by required_by_status if status provided
    if status:
        filtered = []
        for d in definitions:
            req = d.required_by_status or {}
            if req.get(status.upper(), False):
                filtered.append(d)
        return filtered
    return definitions


@router.post("/custom-fields/definitions", response_model=VSCustomFieldDefinitionOut, status_code=status.HTTP_201_CREATED)
def create_custom_field_definition(
    payload: VSCustomFieldDefinitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check tab exists
    tab = db.query(VSCustomFieldTab).filter(VSCustomFieldTab.id == payload.tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    definition = VSCustomFieldDefinition(**payload.model_dump())
    db.add(definition)
    db.commit()
    db.refresh(definition)
    return definition


@router.patch("/custom-fields/definitions/{field_id}", response_model=VSCustomFieldDefinitionOut)
def update_custom_field_definition(
    field_id: int,
    payload: VSCustomFieldDefinitionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    field = db.query(VSCustomFieldDefinition).filter(VSCustomFieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field definition not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(field, k, v)
    db.commit()
    db.refresh(field)
    return field


@router.delete("/custom-fields/definitions/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_field_definition(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    field = db.query(VSCustomFieldDefinition).filter(VSCustomFieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field definition not found")
    db.delete(field)
    db.commit()


# Field Values
@router.get("/custom-fields/values/complaint/{complaint_id}", response_model=list[VSComplaintCustomFieldValueOut])
def get_custom_field_values_for_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    values = db.query(VSComplaintCustomFieldValue).filter(
        VSComplaintCustomFieldValue.complaint_id == complaint_id
    ).all()
    # Attach field definition for convenience
    field_ids = [v.field_id for v in values]
    fields = {f.id: f for f in db.query(VSCustomFieldDefinition).filter(VSCustomFieldDefinition.id.in_(field_ids)).all()} if field_ids else {}
    for v in values:
        v.field = fields.get(v.field_id)
    return values


@router.post("/custom-fields/values/complaint/{complaint_id}/bulk", response_model=list[VSComplaintCustomFieldValueOut])
def upsert_custom_field_values_for_complaint(
    complaint_id: int,
    payload: VSComplaintCustomFieldValueBulkSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify complaint exists
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    results = []
    for item in payload.values:
        existing = db.query(VSComplaintCustomFieldValue).filter(
            VSComplaintCustomFieldValue.complaint_id == complaint_id,
            VSComplaintCustomFieldValue.field_id == item.field_id
        ).first()
        if existing:
            existing.value = item.value
            existing.file_metadata = item.file_metadata
            existing.updated_at = datetime.now(UTC)
            results.append(existing)
        else:
            new_val = VSComplaintCustomFieldValue(
                complaint_id=complaint_id,
                field_id=item.field_id,
                value=item.value,
                file_metadata=item.file_metadata,
            )
            db.add(new_val)
            results.append(new_val)
    db.commit()
    for r in results:
        db.refresh(r)
    # Attach field definitions
    field_ids = [r.field_id for r in results]
    fields = {f.id: f for f in db.query(VSCustomFieldDefinition).filter(VSCustomFieldDefinition.id.in_(field_ids)).all()} if field_ids else {}
    for r in results:
        r.field = fields.get(r.field_id)
    return results


@router.get("/custom-fields/definitions/for-complaint/{complaint_id}", response_model=list[VSCustomFieldDefinitionOut])
def get_custom_field_definitions_for_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get field definitions applicable to a complaint based on its status and department."""
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Get vehicle to determine department if needed
    vehicle = db.query(VSVehicle).filter(VSVehicle.id == complaint.vehicle_id).first()
    department_id = getattr(vehicle, 'department_id', None) if vehicle else None

    # Get all active tabs
    tabs = db.query(VSCustomFieldTab).filter(VSCustomFieldTab.is_active == True).all()
    if department_id:
        tabs = [t for t in tabs if t.department_id is None or t.department_id == department_id]

    all_definitions = []
    for tab in tabs:
        query = db.query(VSCustomFieldDefinition).filter(
            VSCustomFieldDefinition.tab_id == tab.id,
            VSCustomFieldDefinition.is_visible == True
        )
        if department_id:
            query = query.filter(
                (VSCustomFieldDefinition.department_id.is_(None)) | 
                (VSCustomFieldDefinition.department_id == department_id)
            )
        definitions = query.order_by(VSCustomFieldDefinition.display_order).all()
        all_definitions.extend(definitions)

    return all_definitions


@router.post("/custom-fields/files/upload", response_model=dict[str, Any])
async def upload_custom_field_file(
    file: UploadFile = File(...),
    field_id: int = Form(...),
    complaint_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file for a custom field."""
    import os
    import uuid
    from pathlib import Path

    # Verify field exists and is file type
    field = db.query(VSCustomFieldDefinition).filter(VSCustomFieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    if field.field_type != "file":
        raise HTTPException(status_code=400, detail="Field is not a file type")

    # Verify complaint exists
    complaint = db.query(VSComplaint).filter(VSComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Validate file type
    file_config = field.file_config or {}
    allowed_extensions = file_config.get("allowed_extensions", ["pdf", "png", "jpg", "jpeg", "doc", "docx"])
    max_size_mb = file_config.get("max_size_mb", 10)

    file_ext = Path(file.filename).suffix.lower().lstrip(".")
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"File type .{file_ext} not allowed. Allowed: {', '.join(allowed_extensions)}"
        )

    # Check file size
    content = await file.read()
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File size exceeds {max_size_mb}MB limit")

    # Save file
    upload_dir = Path("uploads/vehicle_service/custom_fields")
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = upload_dir / unique_name

    with open(file_path, "wb") as f:
        f.write(content)

    # Return file metadata
    file_metadata = {
        "filename": unique_name,
        "original_name": file.filename,
        "size": len(content),
        "mime_type": file.content_type,
        "url": f"/api/v1/vehicle-service/custom-fields/files/{unique_name}",
        "preview_url": f"/api/v1/vehicle-service/custom-fields/files/{unique_name}/preview",
        "uploaded_at": datetime.now(UTC).isoformat(),
    }

    return file_metadata


@router.get("/custom-fields/files/{filename}")
async def download_custom_field_file(filename: str):
    """Download a custom field file."""
    from fastapi.responses import FileResponse
    file_path = Path("uploads/vehicle_service/custom_fields") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, filename=filename)


@router.get("/custom-fields/files/{filename}/preview")
async def preview_custom_field_file(filename: str):
    """Preview a custom field file (for images/PDFs)."""
    from fastapi.responses import FileResponse
    file_path = Path("uploads/vehicle_service/custom_fields") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path)
