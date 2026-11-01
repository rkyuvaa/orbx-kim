from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import AppDataDocument

router = APIRouter(
    prefix="/app-data",
    tags=["app-data"],
    dependencies=[Depends(get_current_user)],
)


class AppDataOut(BaseModel):
    key: str
    value: Any | None = None
    revision: int = 0
    updated_at: datetime | None = None


class AppDataUpdate(BaseModel):
    value: Any
    expected_revision: int = Field(ge=0)


def _revision_conflict(key: str, record: AppDataDocument | None) -> dict[str, Any]:
    return {
        "message": "Application data changed since it was loaded.",
        "key": key,
        "value": record.value if record else None,
        "revision": record.revision if record else 0,
    }


@router.get("/{key}", response_model=AppDataOut)
def get_app_data(
    key: str,
    db: Session = Depends(get_db),
) -> AppDataOut:
    record = (
        db.query(AppDataDocument)
        .filter(AppDataDocument.key == key)
        .first()
    )
    if record is None:
        return AppDataOut(key=key)
    return AppDataOut(
        key=record.key,
        value=record.value,
        revision=record.revision,
        updated_at=record.updated_at,
    )


@router.put("/{key}", response_model=AppDataOut)
def put_app_data(
    key: str,
    payload: AppDataUpdate,
    db: Session = Depends(get_db),
) -> AppDataOut:
    record = (
        db.query(AppDataDocument)
        .filter(AppDataDocument.key == key)
        .first()
    )
    if record is None:
        if payload.expected_revision != 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_revision_conflict(key, None),
            )
        record = AppDataDocument(key=key, value=payload.value, revision=1)
        db.add(record)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            latest = db.query(AppDataDocument).filter(AppDataDocument.key == key).first()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_revision_conflict(key, latest),
            ) from exc
    else:
        if record.revision != payload.expected_revision:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_revision_conflict(key, record),
            )
        result = db.execute(
            update(AppDataDocument)
            .where(
                AppDataDocument.key == key,
                AppDataDocument.revision == payload.expected_revision,
            )
            .values(
                value=payload.value,
                revision=AppDataDocument.revision + 1,
                updated_at=func.now(),
            )
        )
        if result.rowcount != 1:
            db.rollback()
            latest = db.query(AppDataDocument).filter(AppDataDocument.key == key).first()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_revision_conflict(key, latest),
            )
        db.commit()
    db.refresh(record)
    return AppDataOut(
        key=record.key,
        value=record.value,
        revision=record.revision,
        updated_at=record.updated_at,
    )
