import secrets
from datetime import date, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import AppDataDocument

router = APIRouter(prefix="/integrations/omnierp", tags=["OmniERP integration"])
bearer_scheme = HTTPBearer(auto_error=False)
EMPLOYEE_DATA_KEY = "crm_employee_master_data"


class OmniERPEmployee(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int | str | None = None
    employee_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    designation: str | None = Field(default=None, max_length=200)
    reporting_manager: str | None = Field(default=None, max_length=200)
    manager_name: str | None = Field(default=None, max_length=200)
    department_id: int | str | None = None
    department_name: str | None = Field(default=None, max_length=200)
    branch_id: int | str | None = None
    branch_name: str | None = Field(default=None, max_length=200)
    shift_id: int | str | None = None
    shift_name: str | None = Field(default=None, max_length=200)
    date_of_joining: date | None = None
    date_of_leaving: date | None = None
    basic_salary: str | float | int | None = None
    is_active: bool | None = None
    uan: str | None = Field(default=None, max_length=100)
    esi_number: str | None = Field(default=None, max_length=100)


class OmniERPEmployeeWebhook(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event: Literal["employee.created", "employee.updated", "employee.sync_batch", "test.ping"]
    timestamp: datetime | None = None
    source: str | None = Field(default=None, max_length=100)
    data: OmniERPEmployee | Annotated[list[OmniERPEmployee], Field(max_length=1000)] | None = None
    count: int | None = Field(default=None, ge=0)
    message: str | None = None

    @model_validator(mode="after")
    def validate_event_data(self):
        if self.event in {"employee.created", "employee.updated"} and not isinstance(
            self.data, OmniERPEmployee
        ):
            raise ValueError("Employee events require one employee object in data.")
        if self.event == "employee.sync_batch":
            if not isinstance(self.data, list):
                raise ValueError("employee.sync_batch requires an employee array in data.")
            if self.count is not None and self.count != len(self.data):
                raise ValueError("count must match the number of employees in data.")
        if self.event == "test.ping" and self.data is not None:
            raise ValueError("test.ping does not accept employee data.")
        return self


def verify_omnierp_webhook_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    configured_token = settings.omnierp_employee_webhook_token
    if not configured_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OmniERP employee webhook is not configured.",
        )
    if credentials is None or credentials.scheme.lower() != "bearer" or not secrets.compare_digest(
        credentials.credentials, configured_token
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _employee_updates(employee: OmniERPEmployee) -> dict[str, str]:
    fields_set = employee.model_fields_set
    field_mapping = {
        "employee_id": "emp_id",
        "name": "name",
        "email": "email",
        "phone": "phone",
        "designation": "designation",
        "department_name": "department",
        "branch_name": "branch",
        "shift_name": "shift",
        "date_of_joining": "joining_date",
        "basic_salary": "gross_salary",
        "uan": "uan",
        "esi_number": "esi_number",
    }
    updates: dict[str, str] = {}
    for source_field, target_field in field_mapping.items():
        if source_field not in fields_set:
            continue
        value = getattr(employee, source_field)
        if isinstance(value, (date, datetime)):
            updates[target_field] = value.isoformat()
        else:
            updates[target_field] = "" if value is None else str(value).strip()

    for manager_field in ("reporting_manager", "manager_name"):
        manager_value = getattr(employee, manager_field)
        if manager_field in fields_set and manager_value is not None and manager_value.strip():
            updates["reporting_manager"] = manager_value.strip()
            break

    if "is_active" in fields_set and employee.is_active is not None:
        updates["status"] = "Active" if employee.is_active else "Inactive"
    if employee.date_of_leaving is not None:
        updates["status"] = "Inactive"
    return updates


def _upsert_employee(records: list[Any], employee: OmniERPEmployee) -> bool:
    employee_id = employee.employee_id.strip()
    if not employee_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="employee_id must not be blank.",
        )

    match = next(
        (
            record
            for record in records
            if isinstance(record, dict)
            and str(record.get("emp_id", "")).strip().casefold() == employee_id.casefold()
        ),
        None,
    )
    updates = _employee_updates(employee)
    if match is not None:
        match.update(updates)
        return False

    record: dict[str, str] = {
        "id": f"omnierp:{employee_id}",
        "emp_id": employee_id,
        "name": "",
        "email": "",
        "phone": "",
        "designation": "",
        "department": "",
        "branch": "",
        "shift": "",
        "status": "Active",
        "joining_date": "",
        "biometric_id": "",
        "gross_salary": "",
        "uan": "",
        "esi_number": "",
        "reporting_manager": "",
        "cc_persons": "",
        "linked_user": "",
        "salary_category": "",
    }
    record.update(updates)
    records.append(record)
    return True


@router.post(
    "/employees/webhook",
    dependencies=[Depends(verify_omnierp_webhook_token)],
)
def receive_employee_webhook(
    payload: OmniERPEmployeeWebhook,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if payload.event == "test.ping":
        return {"ok": True, "event": payload.event}

    incoming = payload.data if isinstance(payload.data, list) else [payload.data]
    employees = [employee for employee in incoming if isinstance(employee, OmniERPEmployee)]

    document = (
        db.query(AppDataDocument)
        .filter(AppDataDocument.key == EMPLOYEE_DATA_KEY)
        .with_for_update()
        .first()
    )
    if document is None:
        records: list[Any] = []
        document = AppDataDocument(key=EMPLOYEE_DATA_KEY, value=records, revision=1)
        db.add(document)
    else:
        if not isinstance(document.value, list):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee Master data is not in the expected list format.",
            )
        records = [dict(record) if isinstance(record, dict) else record for record in document.value]

    created = 0
    updated = 0
    for employee in employees:
        if _upsert_employee(records, employee):
            created += 1
        else:
            updated += 1

    document.value = records
    if document.id is not None:
        document.revision += 1
    db.commit()

    return {
        "ok": True,
        "event": payload.event,
        "received": len(employees),
        "created": created,
        "updated": updated,
        "total": len(records),
    }
