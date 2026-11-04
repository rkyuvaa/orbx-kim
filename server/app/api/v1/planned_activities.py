from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_application_access, require_permission
from app.db.session import get_db
from app.models import (
    ActivityLog,
    Application,
    Notification,
    PlannedActivity,
    User,
)
from app.schemas.application import (
    PlannedActivityCreate,
    PlannedActivityOut,
    PlannedActivityUpdate,
)

router = APIRouter(prefix="/applications", tags=["planned-activities"])


@router.get("/{app_id}/planned-activities", response_model=list[PlannedActivityOut])
def list_planned_activities(
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("view", "activities")),
):
    planned = (
        db.query(PlannedActivity)
        .filter(PlannedActivity.application_id == app.id)
        .order_by(PlannedActivity.created_at.desc())
        .all()
    )
    return [
        PlannedActivityOut(
            id=p.id,
            application_id=p.application_id,
            activity_type_id=p.activity_type_id,
            activity_type_name=p.activity_type_name,
            subject=p.subject,
            notes=p.notes,
            due_date=p.due_date,
            status=p.status,
            assigned_to=p.assigned_to,
            assignee_name=p.assignee.full_name if p.assignee else None,
            created_by=p.created_by,
            creator_name=p.creator.full_name if p.creator else None,
            created_at=p.created_at,
            completed_at=p.completed_at,
        )
        for p in planned
    ]


@router.post("/{app_id}/planned-activities", response_model=PlannedActivityOut, status_code=status.HTTP_201_CREATED)
def create_planned_activity(
    app_id: int,
    payload: PlannedActivityCreate,
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create", "activities")),
):
    act = PlannedActivity(
        application_id=app.id,
        activity_type_id=payload.activity_type_id,
        activity_type_name=payload.activity_type_name,
        subject=payload.subject,
        notes=payload.notes,
        due_date=payload.due_date,
        status="PLANNED",
        assigned_to=payload.assigned_to or user.id,
        created_by=user.id,
    )
    db.add(act)
    db.flush()

    # Log inside ActivityLog for the application
    log_value = f"[{payload.activity_type_name}] {payload.subject}"
    if payload.notes:
        log_value += f" — {payload.notes}"
    db.add(
        ActivityLog(
            application_id=app.id,
            actor_id=user.id,
            field_name="Activity Planned",
            old_value=None,
            new_value=log_value,
        )
    )

    # Always notify the assignee so the activity appears in their inbox
    assignee_id = payload.assigned_to or user.id
    assignee_label = "assigned to you" if assignee_id != user.id else "you scheduled"
    db.add(
        Notification(
            user_id=assignee_id,
            message=f"Activity {assignee_label}: [{payload.activity_type_name}] {payload.subject} for {app.app_no}",
        )
    )

    db.commit()
    db.refresh(act)
    return PlannedActivityOut(
        id=act.id,
        application_id=act.application_id,
        activity_type_id=act.activity_type_id,
        activity_type_name=act.activity_type_name,
        subject=act.subject,
        notes=act.notes,
        due_date=act.due_date,
        status=act.status,
        assigned_to=act.assigned_to,
        assignee_name=act.assignee.full_name if act.assignee else None,
        created_by=act.created_by,
        creator_name=act.creator.full_name if act.creator else None,
        created_at=act.created_at,
        completed_at=act.completed_at,
    )


@router.patch("/{app_id}/planned-activities/{act_id}", response_model=PlannedActivityOut)
def update_planned_activity(
    app_id: int,
    act_id: int,
    payload: PlannedActivityUpdate,
    app: Application = Depends(require_application_access),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("edit", "activities")),
):
    act = db.get(PlannedActivity, act_id)
    if not act or act.application_id != app.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned activity not found")

    old_status = act.status
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(act, field, value)

    if payload.status == "COMPLETED" and old_status != "COMPLETED":
        act.completed_at = datetime.now(timezone.utc)
        db.add(
            ActivityLog(
                application_id=app.id,
                actor_id=user.id,
                field_name="Activity Completed",
                old_value=f"[{act.activity_type_name}] {act.subject}",
                new_value="COMPLETED",
            )
        )

    db.add(act)
    db.commit()
    db.refresh(act)
    return PlannedActivityOut(
        id=act.id,
        application_id=act.application_id,
        activity_type_id=act.activity_type_id,
        activity_type_name=act.activity_type_name,
        subject=act.subject,
        notes=act.notes,
        due_date=act.due_date,
        status=act.status,
        assigned_to=act.assigned_to,
        assignee_name=act.assignee.full_name if act.assignee else None,
        created_by=act.created_by,
        creator_name=act.creator.full_name if act.creator else None,
        created_at=act.created_at,
        completed_at=act.completed_at,
    )