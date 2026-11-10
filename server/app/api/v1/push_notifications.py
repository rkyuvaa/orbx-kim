from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.push import (
    PushPublicKeyOut,
    PushStatusOut,
    PushSubscribeIn,
    PushTestResponse,
    PushUnsubscribeIn,
)
from app.services.push_notification_service import (
    get_vapid_public_key,
    send_push_to_user,
)

router = APIRouter(prefix="/push", tags=["push-notifications"])


@router.get("/public-key", response_model=PushPublicKeyOut)
def get_public_key():
    """
    Returns the VAPID public key needed by the browser to create a PushSubscription.
    """
    key = get_vapid_public_key()
    return PushPublicKeyOut(public_key=key)


@router.get("/status", response_model=PushStatusOut)
def get_push_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns whether the current user has any active push subscriptions.
    """
    count = db.query(PushSubscription).filter(PushSubscription.user_id == user.id).count()
    return PushStatusOut(is_subscribed=count > 0, subscription_count=count)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe(
    payload: PushSubscribeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Registers or updates a browser push subscription for the authenticated user.
    """
    sub = db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).first()
    if sub:
        sub.user_id = user.id
        sub.p256dh = payload.keys.p256dh
        sub.auth = payload.keys.auth
        if payload.user_agent:
            sub.user_agent = payload.user_agent
    else:
        sub = PushSubscription(
            user_id=user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=payload.user_agent,
        )
        db.add(sub)

    db.commit()
    return {"message": "Push notification subscription saved successfully"}


@router.post("/unsubscribe")
def unsubscribe(
    payload: PushUnsubscribeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Removes a push subscription endpoint for the current user.
    """
    deleted = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == payload.endpoint, PushSubscription.user_id == user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"message": "Unsubscribed successfully", "deleted": deleted}


@router.post("/test", response_model=PushTestResponse)
def test_push_notification(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Sends an instant test push notification to all active devices of the current user.
    """
    delivered = send_push_to_user(
        db=db,
        user_id=user.id,
        title="🔔 KIM Push Notification",
        body=f"Hello {user.full_name}! Push notifications are working perfectly for your account.",
        url="/notifications",
        tag="test-notification",
    )
    if delivered == 0:
        return PushTestResponse(
            success=False,
            delivered=0,
            message="No active push subscriptions found for this user. Please enable notifications in your browser first.",
        )
    return PushTestResponse(
        success=True,
        delivered=delivered,
        message=f"Test push notification sent to {delivered} device(s)!",
    )
