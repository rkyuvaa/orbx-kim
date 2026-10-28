import json
import urllib.request
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Notification, User
from app.models.enums import ComplaintCategory, ComplaintSeverity, ComplaintStatus, MaintenanceStatus, RegisteredVia
from app.models.user import UserStatus
from app.services.document_numbering import generate_next_document_number
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
    VSKitUpdate,
    VSMaintenanceCreate,
    VSMaintenanceOut,
    VSMaintenanceUpdate,
    VSPublicComplaintCreate,
    VSPublicVehicleInfo,
    VSServiceCostCreate,
    VSServiceCostOut,
    VSSeverityCount,
    VSStatusCount,
    VSUniversalComplaintCreate,
    VSVehicleCreate,
    VSVehicleOut,
    VSVehicleUpdate,
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
            is_required=comp.is_required,
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
    kit = db.query(VSKit).filter(VSKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    if payload.kit_name is not None:
        kit.kit_name = payload.kit_name
    if payload.description is not None:
        kit.description = payload.description
    if payload.is_active is not None:
        kit.is_active = payload.is_active

    db.commit()
    db.refresh(kit)
    return kit


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
    vehicle = db.query(VSVehicle).filter(VSVehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    complaint_no = _generate_complaint_no(db)
    gps_addr = payload.gps_address or _reverse_geocode_area_and_city(payload.gps_latitude, payload.gps_longitude)
    complaint = VSComplaint(
        complaint_no=complaint_no,
        vehicle_id=payload.vehicle_id,
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
