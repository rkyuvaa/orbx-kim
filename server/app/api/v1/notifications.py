from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Notification, PlannedActivity, User
from app.schemas.notifications import NotificationOut

router = APIRouter(prefix="/users/me/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Get regular notifications
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    # Get planned activities due today or overdue assigned to this user
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=UTC)
    planned_activities = (
        db.query(PlannedActivity)
        .filter(
            PlannedActivity.assigned_to == user.id,
            PlannedActivity.status == "PLANNED",
            PlannedActivity.due_date.isnot(None),
            PlannedActivity.due_date <= today_start,
        )
        .order_by(PlannedActivity.due_date.asc())
        .all()
    )

    # Convert planned activities to notification-like objects
    activity_notifications = []
    for act in planned_activities:
        activity_notifications.append({
            "id": -act.id,  # Negative ID to distinguish from real notifications
            "message": f"Activity due: [{act.activity_type_name}] {act.subject}",
            "is_read": False,
            "created_at": act.due_date,
            "planned_activity_id": act.id,
            "due_date": act.due_date,
            "link": f"/leads/{act.application_id}" if act.application_id else None,
        })

    # Combine and sort by created_at descending
    all_notifications = [NotificationOut.model_validate(n) for n in notifications]
    for an in activity_notifications:
        all_notifications.append(NotificationOut(**an))

    all_notifications.sort(key=lambda n: n.created_at, reverse=True)
    return all_notifications


@router.patch("/{notif_id}/read", response_model=NotificationOut)
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id, Notification.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notif.read_at is None:
        from datetime import datetime

        notif.read_at = datetime.now(UTC)
        db.add(notif)
        db.commit()
        db.refresh(notif)
    return NotificationOut.model_validate(notif)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import datetime

    db.query(Notification).filter(
        Notification.user_id == user.id, Notification.read_at.is_(None)
    ).update({Notification.read_at: datetime.now(UTC)})
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
