from datetime import datetime, date, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles, require_permission
from app.db.session import get_db
from app.models import User, UserRole, Activity
from app.models.hr import (
    Attendance,
    AttendanceStatus,
    LeaveRequest,
    LeaveStatus,
    PayrollRecord,
    PayrollStatus,
    PerformanceReview,
    PerformanceStatus,
)
from app.schemas.hr import (
    AttendanceCreate,
    AttendanceOut,
    AttendanceUpdate,
    LeaveRequestCreate,
    LeaveRequestUpdate,
    LeaveRequestApprove,
    LeaveRequestReject,
    LeaveRequestOut,
    PayrollRecordCreate,
    PayrollRecordUpdate,
    PayrollRecordProcess,
    PayrollRecordOut,
    PerformanceReviewCreate,
    PerformanceReviewUpdate,
    PerformanceReviewOut,
    EmployeeAttendanceSummary,
    DepartmentAttendanceReport,
)

router = APIRouter(prefix="/hr", tags=["hr"])


def _log_activity(
    db: Session,
    user: User,
    action: str,
    entity_type: str,
    entity_id: int,
    changes: dict | None = None,
) -> None:
    """Log activity to audit trail"""
    activity = Activity(
        actor_id=user.id,
        action=f"{action} {entity_type} #{entity_id}",
    )
    db.add(activity)
    db.commit()


def _format_attendance(rec: Attendance) -> AttendanceOut:
    out = AttendanceOut.model_validate(rec)
    out.user_name = rec.user.full_name if rec.user else "Unknown"
    return out


def _format_leave(req: LeaveRequest) -> LeaveRequestOut:
    out = LeaveRequestOut.model_validate(req)
    out.user_name = req.user.full_name if req.user else "Unknown"
    out.approved_by_name = req.approved_by.full_name if req.approved_by else None
    return out


def _format_payroll(rec: PayrollRecord) -> PayrollRecordOut:
    out = PayrollRecordOut.model_validate(rec)
    out.user_name = rec.user.full_name if rec.user else "Unknown"
    return out


def _format_performance(rev: PerformanceReview) -> PerformanceReviewOut:
    out = PerformanceReviewOut.model_validate(rev)
    out.user_name = rev.user.full_name if rev.user else "Unknown"
    out.reviewer_name = rev.reviewer.full_name if rev.reviewer else "Unknown"
    return out


# ============================================================================
# Attendance Endpoints
# ============================================================================


@router.post("/attendance", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def create_attendance(
    payload: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create", "hr_attendance")),
):
    """Create attendance record for an employee"""
    # Verify user exists
    employee = db.query(User).filter(User.id == payload.user_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Check if attendance record already exists for this date
    existing = db.query(Attendance).filter(
        and_(
            Attendance.user_id == payload.user_id,
            Attendance.attendance_date == payload.attendance_date,
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance record already exists for this date",
        )

    attendance = Attendance(**payload.model_dump())
    db.add(attendance)
    db.flush()

    _log_activity(
        db,
        current_user,
        "CREATE",
        "ATTENDANCE",
        attendance.id,
        {"user_id": payload.user_id, "date": str(payload.attendance_date)},
    )

    return _format_attendance(attendance)


@router.get("/attendance", response_model=list[AttendanceOut])
def list_attendance(
    user_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status_filter: Optional[AttendanceStatus] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view", "hr_attendance")),
):
    """List attendance records with filters and eager-loaded user profiles"""
    query = db.query(Attendance).options(joinedload(Attendance.user))

    if user_id:
        query = query.filter(Attendance.user_id == user_id)
    if start_date:
        query = query.filter(Attendance.attendance_date >= start_date)
    if end_date:
        query = query.filter(Attendance.attendance_date <= end_date)
    if status_filter:
        query = query.filter(Attendance.status == status_filter)

    records = query.order_by(Attendance.attendance_date.desc()).offset(offset).limit(limit).all()

    return [_format_attendance(rec) for rec in records]


@router.get("/attendance/{id}", response_model=AttendanceOut)
def get_attendance(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view", "hr_attendance")),
):
    """Get single attendance record"""
    record = db.query(Attendance).filter(Attendance.id == id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    return _format_attendance(record)


@router.put("/attendance/{id}", response_model=AttendanceOut)
def update_attendance(
    id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit", "hr_attendance")),
):
    """Update attendance record"""
    record = db.query(Attendance).filter(Attendance.id == id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    record.updated_at = datetime.now(timezone.utc)
    db.commit()

    _log_activity(
        db,
        current_user,
        "UPDATE",
        "ATTENDANCE",
        record.id,
        update_data,
    )

    return _format_attendance(record)


@router.delete("/attendance/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delete", "hr_attendance")),
):
    """Delete attendance record"""
    record = db.query(Attendance).filter(Attendance.id == id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    db.delete(record)
    db.commit()

    _log_activity(
        db,
        current_user,
        "DELETE",
        "ATTENDANCE",
        id,
    )


# ============================================================================
# Leave Request Endpoints
# ============================================================================


@router.post("/leave-requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
def create_leave_request(
    payload: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create", "hr_leave")),
):
    """Create leave request"""
    # Verify user exists
    employee = db.query(User).filter(User.id == payload.user_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Validate dates
    if payload.start_date > payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date",
        )

    leave_request = LeaveRequest(**payload.model_dump())
    db.add(leave_request)
    db.flush()

    _log_activity(
        db,
        current_user,
        "CREATE",
        "LEAVE_REQUEST",
        leave_request.id,
        {"user_id": payload.user_id, "leave_type": str(payload.leave_type)},
    )

    return _format_leave(leave_request)


@router.get("/leave-requests", response_model=list[LeaveRequestOut])
def list_leave_requests(
    user_id: Optional[int] = Query(None),
    status_filter: Optional[LeaveStatus] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view", "hr_leave")),
):
    """List leave requests with filters and eager loaded relations"""
    query = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.user),
            joinedload(LeaveRequest.approved_by),
        )
    )

    if user_id:
        query = query.filter(LeaveRequest.user_id == user_id)
    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter)

    requests = query.order_by(LeaveRequest.created_at.desc()).offset(offset).limit(limit).all()

    return [_format_leave(req) for req in requests]


@router.post("/leave-requests/{id}/approve", response_model=LeaveRequestOut)
def approve_leave_request(
    id: int,
    payload: LeaveRequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approve", "hr_leave")),
):
    """Approve leave request (HR/Manager only)"""
    leave_request = db.query(LeaveRequest).filter(LeaveRequest.id == id).first()
    if not leave_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if leave_request.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve leave request with status {leave_request.status}",
        )

    leave_request.status = LeaveStatus.APPROVED
    leave_request.approved_by_id = payload.approved_by_id
    leave_request.approval_date = datetime.now(timezone.utc)
    db.commit()

    _log_activity(
        db,
        current_user,
        "APPROVE",
        "LEAVE_REQUEST",
        leave_request.id,
    )

    return _format_leave(leave_request)


@router.post("/leave-requests/{id}/reject", response_model=LeaveRequestOut)
def reject_leave_request(
    id: int,
    payload: LeaveRequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approve", "hr_leave")),
):
    """Reject leave request (HR/Manager only)"""
    leave_request = db.query(LeaveRequest).filter(LeaveRequest.id == id).first()
    if not leave_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if leave_request.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject leave request with status {leave_request.status}",
        )

    leave_request.status = LeaveStatus.REJECTED
    leave_request.rejection_reason = payload.rejection_reason
    db.commit()

    _log_activity(
        db,
        current_user,
        "REJECT",
        "LEAVE_REQUEST",
        leave_request.id,
    )

    return _format_leave(leave_request)


# ============================================================================
# Payroll Endpoints
# ============================================================================


@router.post("/payroll", response_model=PayrollRecordOut, status_code=status.HTTP_201_CREATED)
def create_payroll_record(
    payload: PayrollRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create", "hr_payroll")),
):
    """Create payroll record"""
    # Verify user exists
    employee = db.query(User).filter(User.id == payload.user_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Calculate net salary
    net_salary = payload.base_salary + payload.allowances - payload.deductions

    payroll = PayrollRecord(
        **payload.model_dump(),
        net_salary=net_salary,
    )
    db.add(payroll)
    db.flush()

    _log_activity(
        db,
        current_user,
        "CREATE",
        "PAYROLL",
        payroll.id,
        {"user_id": payload.user_id, "month": str(payload.payroll_month)},
    )

    return _format_payroll(payroll)


@router.get("/payroll", response_model=list[PayrollRecordOut])
def list_payroll_records(
    user_id: Optional[int] = Query(None),
    status_filter: Optional[PayrollStatus] = Query(None),
    start_month: Optional[date] = Query(None),
    end_month: Optional[date] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view", "hr_payroll")),
):
    """List payroll records with filters and eager loaded user"""
    query = db.query(PayrollRecord).options(joinedload(PayrollRecord.user))

    if user_id:
        query = query.filter(PayrollRecord.user_id == user_id)
    if status_filter:
        query = query.filter(PayrollRecord.status == status_filter)
    if start_month:
        query = query.filter(PayrollRecord.payroll_month >= start_month)
    if end_month:
        query = query.filter(PayrollRecord.payroll_month <= end_month)

    records = query.order_by(PayrollRecord.payroll_month.desc()).offset(offset).limit(limit).all()

    return [_format_payroll(rec) for rec in records]


@router.put("/payroll/{id}", response_model=PayrollRecordOut)
def update_payroll_record(
    id: int,
    payload: PayrollRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit", "hr_payroll")),
):
    """Update payroll record"""
    record = db.query(PayrollRecord).filter(PayrollRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll record not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Recalculate net salary if salary components change
    if "base_salary" in update_data or "allowances" in update_data or "deductions" in update_data:
        base = update_data.get("base_salary", record.base_salary)
        allowances = update_data.get("allowances", record.allowances)
        deductions = update_data.get("deductions", record.deductions)
        update_data["net_salary"] = base + allowances - deductions

    for field, value in update_data.items():
        setattr(record, field, value)

    record.updated_at = datetime.now(timezone.utc)
    db.commit()

    _log_activity(
        db,
        current_user,
        "UPDATE",
        "PAYROLL",
        record.id,
        update_data,
    )

    return _format_payroll(record)


# ============================================================================
# Performance Review Endpoints
# ============================================================================


@router.post("/performance-reviews", response_model=PerformanceReviewOut, status_code=status.HTTP_201_CREATED)
def create_performance_review(
    payload: PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create performance review"""
    # Verify employee and reviewer exist
    employee = db.query(User).filter(User.id == payload.user_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    reviewer = db.query(User).filter(User.id == payload.reviewer_id).first()
    if not reviewer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reviewer not found")

    review = PerformanceReview(**payload.model_dump())
    db.add(review)
    db.flush()

    _log_activity(
        db,
        current_user,
        "CREATE",
        "PERFORMANCE_REVIEW",
        review.id,
        {"user_id": payload.user_id, "rating": payload.rating},
    )

    return _format_performance(review)


@router.get("/performance-reviews", response_model=list[PerformanceReviewOut])
def list_performance_reviews(
    user_id: Optional[int] = Query(None),
    reviewer_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List performance reviews with eager-loaded reviewers"""
    query = (
        db.query(PerformanceReview)
        .options(
            joinedload(PerformanceReview.user),
            joinedload(PerformanceReview.reviewer),
        )
    )

    if user_id:
        query = query.filter(PerformanceReview.user_id == user_id)
    if reviewer_id:
        query = query.filter(PerformanceReview.reviewer_id == reviewer_id)

    reviews = query.order_by(PerformanceReview.review_date.desc()).offset(offset).limit(limit).all()

    return [_format_performance(rev) for rev in reviews]


@router.get("/performance-reviews/{id}", response_model=PerformanceReviewOut)
def get_performance_review(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single performance review"""
    review = db.query(PerformanceReview).filter(PerformanceReview.id == id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Performance review not found")

    return _format_performance(review)
