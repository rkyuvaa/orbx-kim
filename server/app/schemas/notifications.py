from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime
    link: Optional[str] = None
    # Optional fields for planned activity notifications
    planned_activity_id: Optional[int] = None
    due_date: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ActivityLogOut(BaseModel):
    id: int
    application_id: int
    actor_id: int | None
    actor_name: str | None
    field_name: str
    old_value: str | None
    new_value: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
