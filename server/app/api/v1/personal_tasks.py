import csv
import io
import json
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.db.session import get_db
from app.models.projects import (
    Task, TaskStatusDef, TaskPriority, TaskStatusCategory,
    TaskAssignee, TaskTag, TaskTagMap, TaskTimeEntry, TaskActivity
)
from app.models.personal_settings import PersonalSettings, PersonalReminder, PersonalTemplate
from app.models.user import User
from app.schemas.projects import (
    TaskCreate, TaskOut, TaskUpdate, TaskTimeEntryOut, TaskTimeEntryCreate,
    TaskActivityOut, CancelTaskRequest, PersonalSettingsOut, PersonalSettingsUpdate,
    PersonalReminderCreate, PersonalReminderOut, PersonalTemplateCreate, PersonalTemplateOut,
    WorkloadSummaryOut, WorkloadDailyItem, WorkloadRiskTask, MyDaySummaryOut, WeeklyReviewOut
)
from app.core.deps import get_current_user, require_permission
from app.api.v1.tasks import (
    _format_task_out, _generate_task_number, _generate_personal_task_number, _validate_task_dates,
    spawn_next_recurring_task
)

router = APIRouter(prefix="/tasks/personal", tags=["personal_tasks"], dependencies=[Depends(require_permission("view", "tasks"))])


def _log_pt_activity(db: Session, task_id: int, user_id: int, action: str, field_name: str = None, old_val: str = None, new_val: str = None, source: str = "user"):
    act = TaskActivity(
        task_id=task_id,
        actor_id=user_id,
        action=action,
        field_name=field_name,
        old_value=str(old_val) if old_val is not None else None,
        new_value=str(new_val) if new_val is not None else None,
        source=source
    )
    db.add(act)


def _get_or_create_personal_settings(db: Session, user_id: int) -> PersonalSettings:
    ps = db.query(PersonalSettings).filter(PersonalSettings.user_id == user_id).first()
    if not ps:
        ps = PersonalSettings(
            user_id=user_id,
            timezone="Asia/Kolkata",
            working_hours_per_day=8.0,
            working_days="MON,TUE,WED,THU,FRI",
            quiet_hours_start="22:00",
            quiet_hours_end="07:00",
            digest_time="07:30",
            default_reminder_presets="1d,1h,due",
            max_timer_hours=8.0,
            auto_stop_timer_at_eod=True,
            holidays_json=[]
        )
        db.add(ps)
        db.commit()
        db.refresh(ps)
    return ps


def _sync_parent_due_and_progress(db: Session, parent_id: Optional[int], user_id: int):
    if not parent_id:
        return
    parent = db.query(Task).filter(Task.id == parent_id, Task.is_personal.is_(True), Task.created_by == user_id).first()
    if not parent:
        return

    subtasks = db.query(Task).filter(
        Task.parent_task_id == parent_id,
        Task.is_deleted.is_(False)
    ).all()

    if not subtasks:
        return

    # Calculate rollup progress
    total = len(subtasks)
    completed = sum(1 for s in subtasks if s.is_completed)
    parent.progress_percentage = round((completed / total) * 100.0, 1)

    # Rollup due date if enabled
    if parent.parent_due_follows_subtasks:
        sub_due_dates = [s.due_date for s in subtasks if s.due_date is not None]
        if sub_due_dates:
            latest_due = max(sub_due_dates)
            if parent.due_date != latest_due:
                old_due = parent.due_date
                parent.due_date = latest_due
                _log_pt_activity(db, parent.id, user_id, "UPDATED", field_name="due_date", old_val=old_due, new_val=latest_due, source="system")

    db.add(parent)
    db.commit()


# =========================================================================
# 1. CORE CRUD & LIFECYCLE
# =========================================================================

@router.get("/list", response_model=List[TaskOut])
def get_personal_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    include_completed: bool = Query(True),
    include_archived: bool = Query(False),
    start_date: Optional[date] = Query(None),
    due_date: Optional[date] = Query(None),
    limit: Optional[int] = Query(None),
    offset: Optional[int] = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get personal tasks with full filtering"""
    query = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    )

    if not include_archived:
        query = query.filter(Task.is_archived.is_(False))

    if not include_completed:
        query = query.filter(Task.is_completed.is_(False))

    if priority:
        query = query.filter(Task.priority == priority.upper())

    if status:
        query = query.join(TaskStatusDef, Task.status_id == TaskStatusDef.id, isouter=True).filter(
            or_(TaskStatusDef.name.ilike(f"%{status}%"), TaskStatusDef.category == status.upper())
        )

    if tag:
        query = query.join(TaskTagMap, Task.id == TaskTagMap.task_id).join(TaskTag, TaskTagMap.tag_id == TaskTag.id).filter(
            TaskTag.name.ilike(f"%{tag}%")
        )

    if q and q.strip():
        raw_q = q.strip()
        clean_q = raw_q[1:] if raw_q.startswith("#") else raw_q
        term = f"%{raw_q}%"
        clean_term = f"%{clean_q}%"
        query = query.filter(
            or_(
                Task.title.ilike(term),
                Task.description.ilike(term),
                Task.task_number.ilike(term),
                Task.tags.ilike(term),
                Task.tags.ilike(clean_term),
                Task.id.in_(
                    db.query(TaskTagMap.task_id).join(TaskTag, TaskTagMap.tag_id == TaskTag.id).filter(TaskTag.name.ilike(clean_term))
                )
            )
        )

    if start_date:
        query = query.filter(Task.start_date >= start_date)
    if due_date:
        query = query.filter(Task.due_date <= due_date)

    query = query.order_by(Task.due_date.asc().nullslast(), Task.priority.desc(), Task.created_at.desc())
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    tasks = query.all()
    return [_format_task_out(t, db) for t in tasks]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
@router.post("/create", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_personal_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new personal task strictly isolated from projects"""
    if not data.title or not data.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task title is mandatory")

    # Start date defaults to today ON CREATION ONLY
    start_dt = data.start_date or datetime.now(timezone.utc).date()

    # Validate dates
    if data.due_date and start_dt and data.due_date < start_dt:
        # Override logged as warning per spec
        pass

    task_num = _generate_personal_task_number(db, current_user.id)

    # Validate positive estimated hours
    est_hours = max(0.0, float(data.estimated_hours or 0.0))
    est_mins = int(est_hours * 60) if est_hours > 0 else (data.estimated_minutes or 0)

    task = Task(
        task_number=task_num,
        is_personal=True,
        project_id=None,
        phase_id=None,
        parent_task_id=data.parent_task_id,
        milestone_id=None,
        title=data.title.strip(),
        description=data.description,
        type_id=data.type_id,
        status_id=data.status_id,
        priority=data.priority or TaskPriority.NORMAL,
        assignee_id=current_user.id,
        created_by=current_user.id,
        updated_by=current_user.id,
        start_date=start_dt,
        start_time=data.start_time,
        due_date=data.due_date,
        due_time=data.due_time,
        planned_date=getattr(data, 'planned_date', None) or data.due_date,
        estimated_minutes=est_mins,
        estimated_hours=est_hours,
        parent_due_follows_subtasks=getattr(data, 'parent_due_follows_subtasks', True) if getattr(data, 'parent_due_follows_subtasks', None) is not None else True,
        recurrence_rule=data.recurrence_rule,
        recurrence_end_date=data.recurrence_end_date,
        recurring_task_id=data.recurring_task_id,
        reminder_at=data.reminder_at,
        reminder_status=data.reminder_status or "PENDING",
        blocked_reason=getattr(data, 'blocked_reason', None),
        is_completed=False,
        is_archived=False,
        is_deleted=False
    )

    if not task.status_id:
        first_status = db.query(TaskStatusDef).filter(TaskStatusDef.is_active.is_(True)).order_by(TaskStatusDef.display_order).first()
        if first_status:
            task.status_id = first_status.id

    db.add(task)
    db.commit()
    db.refresh(task)

    db.add(TaskAssignee(task_id=task.id, user_id=current_user.id, assigned_by=current_user.id))

    # Tags handling
    tids_to_add = set(data.tag_ids or [])
    if data.tag_names:
        for tname in data.tag_names:
            tname = tname.strip()
            if not tname: continue
            tag_obj = db.query(TaskTag).filter(TaskTag.name == tname).first()
            if not tag_obj:
                tag_obj = TaskTag(name=tname)
                db.add(tag_obj)
                db.commit()
                db.refresh(tag_obj)
            tids_to_add.add(tag_obj.id)

    for tid in tids_to_add:
        db.add(TaskTagMap(task_id=task.id, tag_id=tid))

    _log_pt_activity(db, task.id, current_user.id, "CREATED", new_val=task.title, source="user")

    # If parent exists, sync parent progress & due date
    if task.parent_task_id:
        _sync_parent_due_and_progress(db, task.parent_task_id, current_user.id)

    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


@router.put("/{task_id}", response_model=TaskOut)
@router.patch("/{task_id}", response_model=TaskOut)
def update_personal_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update personal task ensuring isolation, audit trail, and preserving start_date"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).first()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    update_dict = data.model_dump(exclude_unset=True)

    # Exclude blocked project fields
    blocked_fields = ['project_id', 'milestone_id', 'phase_id', 'is_personal', 'tag_ids', 'tag_names', 'edit_series']
    for bf in blocked_fields:
        if bf in update_dict:
            del update_dict[bf]

    # Preserve start_date on edit if unset or None in update
    if 'start_date' in update_dict and update_dict['start_date'] is None:
        del update_dict['start_date']

    old_due = task.due_date

    # Apply changes and log audit
    for key, val in update_dict.items():
        if hasattr(task, key):
            old_val = getattr(task, key)
            if old_val != val:
                setattr(task, key, val)
                _log_pt_activity(db, task.id, current_user.id, "UPDATED", field_name=key, old_val=old_val, new_val=val, source="user")

    # If due_date changed, recalculate reminders
    if 'due_date' in update_dict and update_dict['due_date'] != old_due:
        new_due = update_dict['due_date']
        reminders = db.query(PersonalReminder).filter(
            PersonalReminder.task_id == task.id,
            PersonalReminder.status.in_(["pending", "snoozed"])
        ).all()
        for r in reminders:
            if r.reminder_type == "due" and new_due:
                r.scheduled_at = datetime.combine(new_due, datetime.min.time(), tzinfo=timezone.utc)
            elif r.reminder_type == "1d" and new_due:
                r.scheduled_at = datetime.combine(new_due - timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
            elif r.reminder_type == "1h" and new_due:
                r.scheduled_at = datetime.combine(new_due, datetime.min.time(), tzinfo=timezone.utc) - timedelta(hours=1)
            db.add(r)

    # Recalculate estimated_minutes if estimated_hours changed
    if 'estimated_hours' in update_dict and update_dict['estimated_hours'] is not None:
        task.estimated_minutes = int(float(update_dict['estimated_hours']) * 60)

    # Handle completion status
    if data.is_completed is not None:
        if data.is_completed and not task.is_completed:
            task.is_completed = True
            task.completed_at = datetime.now(timezone.utc)
            task.completed_by = current_user.id
            task.progress_percentage = 100.0
            task.cancelled_at = None
            task.cancellation_reason = None
            # Automatically synchronize status_id to Completed/Done status
            done_status = db.query(TaskStatusDef).filter(
                or_(
                    TaskStatusDef.name.ilike("Done"),
                    TaskStatusDef.name.ilike("Completed"),
                    TaskStatusDef.is_terminal.is_(True)
                )
            ).first()
            if done_status:
                task.status_id = done_status.id
            _log_pt_activity(db, task.id, current_user.id, "COMPLETED", source="user")
            # Cancel pending routine reminders
            db.query(PersonalReminder).filter(
                PersonalReminder.task_id == task.id,
                PersonalReminder.status == "pending"
            ).update({"status": "cancelled"})
            spawn_next_recurring_task(db, task, current_user.id)
        elif not data.is_completed and task.is_completed:
            task.is_completed = False
            task.completed_at = None
            task.completed_by = None
            task.cancelled_at = None
            # Automatically revert status_id to To Do
            todo_status = db.query(TaskStatusDef).filter(
                TaskStatusDef.name.ilike("To Do")
            ).first()
            if todo_status:
                task.status_id = todo_status.id
            _log_pt_activity(db, task.id, current_user.id, "REOPENED", source="user")

    # Tags handling
    if data.tag_ids is not None or data.tag_names is not None:
        db.query(TaskTagMap).filter(TaskTagMap.task_id == task.id).delete()
        tids_to_add = set(data.tag_ids or [])
        if data.tag_names:
            for tname in data.tag_names:
                tname = tname.strip()
                if not tname: continue
                tag_obj = db.query(TaskTag).filter(TaskTag.name == tname).first()
                if not tag_obj:
                    tag_obj = TaskTag(name=tname)
                    db.add(tag_obj)
                    db.commit()
                    db.refresh(tag_obj)
                tids_to_add.add(tag_obj.id)
        for tid in tids_to_add:
            db.add(TaskTagMap(task_id=task.id, tag_id=tid))

    task.updated_by = current_user.id
    db.add(task)
    db.commit()
    db.refresh(task)

    if task.parent_task_id:
        _sync_parent_due_and_progress(db, task.parent_task_id, current_user.id)

    return _format_task_out(task, db)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_personal_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a personal task and preserve audit trail"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).first()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    task.is_deleted = True
    task.updated_by = current_user.id
    _log_pt_activity(db, task.id, current_user.id, "DELETED", source="user")

    db.add(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{task_id}/archive", response_model=TaskOut)
def archive_personal_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Archive task (soft archive) retaining full audit history"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    task.is_archived = True
    task.updated_by = current_user.id
    _log_pt_activity(db, task.id, current_user.id, "ARCHIVED", source="user")
    db.add(task)
    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


@router.post("/{task_id}/restore", response_model=TaskOut)
def restore_personal_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore archived or soft-deleted personal task"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    task.is_archived = False
    task.is_deleted = False
    task.updated_by = current_user.id
    _log_pt_activity(db, task.id, current_user.id, "RESTORED", source="user")
    db.add(task)
    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


@router.post("/{task_id}/cancel", response_model=TaskOut)
def cancel_personal_task(
    task_id: int,
    data: CancelTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a task with mandatory cancellation reason"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    if not data.reason or not data.reason.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancellation reason is required")

    task.cancelled_at = datetime.now(timezone.utc)
    task.cancellation_reason = data.reason.strip()
    task.is_completed = False

    # Stop pending reminders
    db.query(PersonalReminder).filter(
        PersonalReminder.task_id == task.id,
        PersonalReminder.status == "pending"
    ).update({"status": "cancelled"})

    _log_pt_activity(db, task.id, current_user.id, "CANCELLED", field_name="cancellation_reason", new_val=data.reason.strip(), source="user")
    db.add(task)
    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


@router.post("/{task_id}/reopen", response_model=TaskOut)
def reopen_personal_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reopen a completed or cancelled task"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    task.is_completed = False
    task.completed_at = None
    task.completed_by = None
    task.cancelled_at = None
    task.cancellation_reason = None
    todo_status = db.query(TaskStatusDef).filter(
        TaskStatusDef.name.ilike("To Do")
    ).first()
    if todo_status:
        task.status_id = todo_status.id

    _log_pt_activity(db, task.id, current_user.id, "REOPENED", source="user")
    db.add(task)
    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


# =========================================================================
# 2. SUBTASKS FOR PERSONAL TASKS
# =========================================================================

@router.post("/{task_id}/subtasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_personal_subtask(
    task_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a subtask under a parent personal task"""
    parent = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).first()
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent task not found")

    data.parent_task_id = parent.id
    data.is_personal = True
    subtask_out = create_personal_task(data, db, current_user)
    _sync_parent_due_and_progress(db, parent.id, current_user.id)
    return subtask_out


# =========================================================================
# 3. TIME TRACKING (TIMER & MANUAL ENTRIES)
# =========================================================================

@router.get("/active-timer", response_model=Optional[TaskTimeEntryOut])
def get_active_timer(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get active running timer for current user"""
    entry = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.user_id == current_user.id,
        TaskTimeEntry.ended_at.is_(None)
    ).first()
    if not entry:
        return None
    out = TaskTimeEntryOut.model_validate(entry)
    out.user_name = current_user.full_name
    return out


@router.post("/{task_id}/timer/start", response_model=TaskTimeEntryOut)
def start_personal_timer(
    task_id: int,
    force_switch: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start timer on a personal task. If another is running and force_switch=True, auto-stops it."""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    active = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.user_id == current_user.id,
        TaskTimeEntry.ended_at.is_(None)
    ).first()

    now = datetime.now(timezone.utc)

    if active:
        if not force_switch and active.task_id != task.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Timer already running on task #{active.task_id}. Pass force_switch=true to switch."
            )
        elif active.task_id == task.id:
            # Already running on this task
            out = TaskTimeEntryOut.model_validate(active)
            out.user_name = current_user.full_name
            return out
        else:
            # Stop existing active timer
            start_dt = active.started_at
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            active.ended_at = now
            duration = max(1, int((now - start_dt).total_seconds() / 60))
            active.duration_minutes = duration
            prev_task = db.get(Task, active.task_id)
            if prev_task:
                prev_task.actual_minutes += duration
                prev_task.actual_hours = round(prev_task.actual_minutes / 60.0, 2)
                db.add(prev_task)
            db.add(active)

    entry = TaskTimeEntry(
        task_id=task.id,
        user_id=current_user.id,
        started_at=now,
        source="timer"
    )
    db.add(entry)
    _log_pt_activity(db, task.id, current_user.id, "TIMER_STARTED", source="timer")
    db.commit()
    db.refresh(entry)

    out = TaskTimeEntryOut.model_validate(entry)
    out.user_name = current_user.full_name
    return out


@router.post("/{task_id}/timer/stop", response_model=TaskTimeEntryOut)
def stop_personal_timer(
    task_id: int,
    description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop active timer and calculate duration"""
    entry = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.task_id == task_id,
        TaskTimeEntry.user_id == current_user.id,
        TaskTimeEntry.ended_at.is_(None)
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active timer found for task")

    now = datetime.now(timezone.utc)
    start_dt = entry.started_at
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    entry.ended_at = now
    duration = max(1, int((now - start_dt).total_seconds() / 60))
    entry.duration_minutes = duration
    if description:
        entry.description = description

    # Check max timer hours from settings
    ps = _get_or_create_personal_settings(db, current_user.id)
    if duration > int(ps.max_timer_hours * 60):
        entry.flagged_for_review = True

    task = db.get(Task, task_id)
    if task:
        task.actual_minutes += entry.duration_minutes
        task.actual_hours = round(task.actual_minutes / 60.0, 2)
        db.add(task)

    _log_pt_activity(db, task_id, current_user.id, "TIMER_STOPPED", new_val=f"{duration} mins", source="timer")
    db.commit()
    db.refresh(entry)

    out = TaskTimeEntryOut.model_validate(entry)
    out.user_name = current_user.full_name
    return out


@router.get("/{task_id}/time-entries", response_model=List[TaskTimeEntryOut])
def get_personal_time_entries(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List time entries for a personal task"""
    entries = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.task_id == task_id,
        TaskTimeEntry.user_id == current_user.id
    ).order_by(TaskTimeEntry.started_at.desc()).all()
    results = []
    for e in entries:
        out = TaskTimeEntryOut.model_validate(e)
        out.user_name = current_user.full_name
        results.append(out)
    return results


@router.post("/{task_id}/time-entries", response_model=TaskTimeEntryOut, status_code=status.HTTP_201_CREATED)
def add_personal_manual_time_entry(
    task_id: int,
    data: TaskTimeEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add manual time log entry"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    ended = data.ended_at or datetime.now(timezone.utc)
    duration = data.duration_minutes
    if duration <= 0 and data.started_at and ended:
        duration = int((ended - data.started_at).total_seconds() / 60)
    duration = max(1, duration)

    entry = TaskTimeEntry(
        task_id=task.id,
        user_id=current_user.id,
        started_at=data.started_at,
        ended_at=ended,
        duration_minutes=duration,
        description=data.description,
        source="manual"
    )
    task.actual_minutes += duration
    task.actual_hours = round(task.actual_minutes / 60.0, 2)

    _log_pt_activity(db, task.id, current_user.id, "TIME_LOGGED", new_val=f"{duration} mins manual", source="user")
    db.add(entry)
    db.add(task)
    db.commit()
    db.refresh(entry)

    out = TaskTimeEntryOut.model_validate(entry)
    out.user_name = current_user.full_name
    return out


@router.delete("/time-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_personal_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a time entry and adjust task actual hours"""
    entry = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.id == entry_id,
        TaskTimeEntry.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time entry not found")

    task = db.get(Task, entry.task_id)
    if task:
        task.actual_minutes = max(0, task.actual_minutes - entry.duration_minutes)
        task.actual_hours = round(task.actual_minutes / 60.0, 2)
        db.add(task)

    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =========================================================================
# 4. WORKLOAD MANAGEMENT & CAPACITY
# =========================================================================

@router.get("/workload", response_model=WorkloadSummaryOut)
def get_personal_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate workload metrics according to Section 6 of specification:
    - Remaining effort = max(estimated_hours - actual_hours, 0)
    - Workload % = (Planned remaining hours / Available working hours) * 100
    - Exclude Completed and Cancelled tasks
    - Over-capacity warning, tasks at risk, overdue counts
    """
    settings = _get_or_create_personal_settings(db, current_user.id)
    working_days_set = set(d.strip().upper() for d in settings.working_days.split(","))
    daily_hours = settings.working_hours_per_day or 8.0

    holidays_set = set()
    if settings.holidays_json and isinstance(settings.holidays_json, list):
        for h in settings.holidays_json:
            if isinstance(h, dict) and "date" in h:
                holidays_set.add(h["date"])

    today = datetime.now(timezone.utc).date()
    # Next 7 days
    days_range = [today + timedelta(days=i) for i in range(7)]

    # Fetch active incomplete tasks
    active_tasks = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False),
        Task.is_archived.is_(False),
        Task.is_completed.is_(False),
        Task.cancelled_at.is_(None)
    ).all()

    # Map remaining effort per task
    task_remaining_map = {}
    for t in active_tasks:
        est = float(t.estimated_hours or 0.0)
        act = float(t.actual_hours or 0.0)
        task_remaining_map[t.id] = max(0.0, est - act)

    daily_breakdown = []
    week_available = 0.0
    week_planned = 0.0
    overloaded_days = []

    day_abbrs = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

    for d in days_range:
        d_str = d.isoformat()
        day_abbr = day_abbrs[d.weekday()]
        is_working = day_abbr in working_days_set
        is_holiday = d_str in holidays_set

        avail = daily_hours if (is_working and not is_holiday) else 0.0
        week_available += avail

        # Tasks allocated to this day by planned_date (fallback to due_date)
        day_tasks = [t for t in active_tasks if (t.planned_date == d or (t.planned_date is None and t.due_date == d))]
        planned_hrs = sum(float(t.estimated_hours or 0.0) for t in day_tasks)
        remaining_hrs = sum(task_remaining_map.get(t.id, 0.0) for t in day_tasks)

        week_planned += remaining_hrs

        if remaining_hrs > avail and avail > 0:
            overloaded_days.append(d_str)

        daily_breakdown.append(WorkloadDailyItem(
            date=d_str,
            day_name=day_abbr,
            is_working_day=is_working,
            is_holiday=is_holiday,
            available_hours=avail,
            planned_hours=round(planned_hrs, 2),
            remaining_hours=round(remaining_hrs, 2),
            tasks_count=len(day_tasks),
            tasks=[_format_task_out(t, db) for t in day_tasks]
        ))

    # Overdue tasks
    overdue_tasks = [t for t in active_tasks if t.due_date and t.due_date < today]
    overdue_count = len(overdue_tasks)
    overdue_remaining = sum(task_remaining_map.get(t.id, 0.0) for t in overdue_tasks)

    # Today's totals
    today_tasks = [t for t in active_tasks if t.planned_date == today or (t.planned_date is None and t.due_date == today)]
    today_est = sum(float(t.estimated_hours or 0.0) for t in today_tasks)
    today_act = sum(float(t.actual_hours or 0.0) for t in today_tasks)
    today_rem = sum(task_remaining_map.get(t.id, 0.0) for t in today_tasks)

    # Tasks at risk: due date is soon but remaining hours exceeds available hours before due date
    tasks_at_risk = []
    for t in active_tasks:
        if t.due_date:
            days_until_due = (t.due_date - today).days
            rem_hrs = task_remaining_map.get(t.id, 0.0)
            if days_until_due < 0:
                tasks_at_risk.append(WorkloadRiskTask(
                    id=t.id,
                    task_number=t.task_number,
                    title=t.title,
                    due_date=t.due_date,
                    priority=t.priority.value if hasattr(t.priority, 'value') else str(t.priority),
                    estimated_hours=float(t.estimated_hours or 0.0),
                    actual_hours=float(t.actual_hours or 0.0),
                    remaining_hours=round(rem_hrs, 2),
                    status_name=t.status_def.name if t.status_def else None,
                    risk_reason="Task is overdue with incomplete effort"
                ))
            elif days_until_due <= 2 and rem_hrs > daily_hours:
                tasks_at_risk.append(WorkloadRiskTask(
                    id=t.id,
                    task_number=t.task_number,
                    title=t.title,
                    due_date=t.due_date,
                    priority=t.priority.value if hasattr(t.priority, 'value') else str(t.priority),
                    estimated_hours=float(t.estimated_hours or 0.0),
                    actual_hours=float(t.actual_hours or 0.0),
                    remaining_hours=round(rem_hrs, 2),
                    status_name=t.status_def.name if t.status_def else None,
                    risk_reason=f"Requires {round(rem_hrs, 1)}h but only {days_until_due} day(s) remain"
                ))

    utilization = round((week_planned / week_available * 100.0), 1) if week_available > 0 else 0.0

    # Total estimated vs actual for user
    all_user_tasks = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).all()
    total_est = sum(float(t.estimated_hours or 0.0) for t in all_user_tasks)
    total_act = sum(float(t.actual_hours or 0.0) for t in all_user_tasks)

    return WorkloadSummaryOut(
        today_estimated_hours=round(today_est, 2),
        today_actual_hours=round(today_act, 2),
        today_remaining_hours=round(today_rem, 2),
        week_available_hours=round(week_available, 2),
        week_planned_hours=round(week_planned, 2),
        week_remaining_hours=round(week_planned, 2),
        utilization_pct=utilization,
        is_overloaded=len(overloaded_days) > 0 or utilization > 100.0,
        overloaded_days=overloaded_days,
        tasks_at_risk=tasks_at_risk,
        overdue_count=overdue_count,
        overdue_remaining_hours=round(overdue_remaining, 2),
        daily_breakdown=daily_breakdown,
        estimated_vs_actual={"estimated": round(total_est, 2), "actual": round(total_act, 2)}
    )


@router.get("/my-day", response_model=MyDaySummaryOut)
def get_my_day_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Today's tasks and overdue items with quick metrics"""
    today = datetime.now(timezone.utc).date()

    # Active tasks for today
    today_tasks_q = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False),
        Task.is_archived.is_(False),
        or_(Task.planned_date == today, and_(Task.planned_date.is_(None), Task.due_date == today))
    ).order_by(Task.is_completed.asc(), Task.priority.desc()).all()

    # Overdue tasks
    overdue_tasks_q = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False),
        Task.is_archived.is_(False),
        Task.is_completed.is_(False),
        Task.cancelled_at.is_(None),
        Task.due_date < today
    ).order_by(Task.due_date.asc(), Task.priority.desc()).all()

    today_est = sum(float(t.estimated_hours or 0.0) for t in today_tasks_q)
    today_act = sum(float(t.actual_hours or 0.0) for t in today_tasks_q)
    today_rem = sum(max(0.0, float(t.estimated_hours or 0.0) - float(t.actual_hours or 0.0)) for t in today_tasks_q if not t.is_completed)
    today_comp = sum(1 for t in today_tasks_q if t.is_completed)

    active_timer_entry = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.user_id == current_user.id,
        TaskTimeEntry.ended_at.is_(None)
    ).first()
    active_timer_out = None
    if active_timer_entry:
        active_timer_out = TaskTimeEntryOut.model_validate(active_timer_entry)
        active_timer_out.user_name = current_user.full_name

    return MyDaySummaryOut(
        today_tasks=[_format_task_out(t, db) for t in today_tasks_q],
        overdue_tasks=[_format_task_out(t, db) for t in overdue_tasks_q],
        today_total_estimated_hours=round(today_est, 2),
        today_remaining_hours=round(today_rem, 2),
        today_actual_hours=round(today_act, 2),
        today_completed_count=today_comp,
        active_timer=active_timer_out
    )


@router.get("/weekly-review", response_model=WeeklyReviewOut)
def get_weekly_review(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Weekly review screen data: completed work, slipped tasks, estimate accuracy"""
    today = datetime.now(timezone.utc).date()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)

    completed = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False),
        Task.is_completed.is_(True),
        Task.completed_at >= datetime.combine(start_of_week, datetime.min.time(), tzinfo=timezone.utc)
    ).all()

    slipped = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False),
        Task.is_completed.is_(False),
        Task.cancelled_at.is_(None),
        Task.due_date <= end_of_week,
        Task.due_date >= start_of_week
    ).all()

    # Time entries logged this week
    time_entries = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.user_id == current_user.id,
        TaskTimeEntry.started_at >= datetime.combine(start_of_week, datetime.min.time(), tzinfo=timezone.utc)
    ).all()
    total_hours = sum(e.duration_minutes for e in time_entries) / 60.0

    # Estimate accuracy calculation
    completed_est = sum(float(t.estimated_hours or 0.0) for t in completed if (t.estimated_hours or 0) > 0)
    completed_act = sum(float(t.actual_hours or 0.0) for t in completed if (t.estimated_hours or 0) > 0)
    accuracy = 100.0
    if completed_est > 0:
        ratio = completed_act / completed_est
        accuracy = round(max(0.0, 100.0 - abs(1.0 - ratio) * 100.0), 1)

    # Hours by tag
    hours_by_tag = {}
    for t in completed:
        tags = [m.tag.name for m in t.tag_mappings if m.tag]
        for tag in tags:
            hours_by_tag[tag] = round(hours_by_tag.get(tag, 0.0) + float(t.actual_hours or 0.0), 1)

    ai_draft = f"Weekly Summary ({start_of_week} to {end_of_week}): Completed {len(completed)} tasks logging {round(total_hours, 1)} hours with an estimate accuracy of {accuracy}%. {len(slipped)} tasks slipped past their planned due date."

    return WeeklyReviewOut(
        week_start=start_of_week.isoformat(),
        week_end=end_of_week.isoformat(),
        completed_count=len(completed),
        completed_tasks=[_format_task_out(t, db) for t in completed],
        slipped_count=len(slipped),
        slipped_tasks=[_format_task_out(t, db) for t in slipped],
        total_hours_logged=round(total_hours, 2),
        estimate_accuracy_pct=accuracy,
        hours_by_tag=hours_by_tag,
        ai_summary_draft=ai_draft
    )


# =========================================================================
# 5. AUDIT TRAIL
# =========================================================================

@router.get("/{task_id}/audit", response_model=List[TaskActivityOut])
def get_task_audit_log(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Append-only audit history for a task"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal.is_(True),
        Task.created_by == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    activities = db.query(TaskActivity).filter(
        TaskActivity.task_id == task_id
    ).order_by(TaskActivity.created_at.desc()).all()

    results = []
    for a in activities:
        out = TaskActivityOut.model_validate(a)
        out.actor_name = a.actor.full_name if a.actor else "System"
        results.append(out)
    return results


@router.get("/audit-timeline", response_model=List[TaskActivityOut])
def get_personal_audit_timeline(
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recent audit timeline across all personal tasks"""
    user_task_ids = [t.id for t in db.query(Task.id).filter(Task.is_personal.is_(True), Task.created_by == current_user.id).all()]
    if not user_task_ids:
        return []

    activities = db.query(TaskActivity).filter(
        TaskActivity.task_id.in_(user_task_ids)
    ).order_by(TaskActivity.created_at.desc()).limit(limit).all()

    results = []
    for a in activities:
        out = TaskActivityOut.model_validate(a)
        out.actor_name = a.actor.full_name if a.actor else "System"
        results.append(out)
    return results


# =========================================================================
# 6. SETTINGS
# =========================================================================

@router.get("/settings", response_model=PersonalSettingsOut)
def get_personal_settings_api(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get personal settings"""
    return _get_or_create_personal_settings(db, current_user.id)


@router.put("/settings", response_model=PersonalSettingsOut)
def update_personal_settings_api(
    data: PersonalSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update personal settings"""
    ps = _get_or_create_personal_settings(db, current_user.id)
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if hasattr(ps, k) and v is not None:
            setattr(ps, k, v)
    db.add(ps)
    db.commit()
    db.refresh(ps)
    return ps


# =========================================================================
# 7. REMINDERS & NOTIFICATIONS
# =========================================================================

@router.get("/reminders", response_model=List[PersonalReminderOut])
def get_personal_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List scheduled reminders"""
    reminders = db.query(PersonalReminder).filter(
        PersonalReminder.user_id == current_user.id,
        PersonalReminder.status.in_(["pending", "snoozed"])
    ).order_by(PersonalReminder.scheduled_at.asc()).all()
    return reminders


@router.post("/{task_id}/reminders", response_model=PersonalReminderOut, status_code=status.HTTP_201_CREATED)
def create_personal_reminder(
    task_id: int,
    data: PersonalReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule reminder with unique idempotency key"""
    idemp_key = f"{task_id}_{data.reminder_type}_{data.scheduled_at.isoformat()}"
    existing = db.query(PersonalReminder).filter(PersonalReminder.idempotency_key == idemp_key).first()
    if existing:
        return existing

    reminder = PersonalReminder(
        task_id=task_id,
        user_id=current_user.id,
        reminder_type=data.reminder_type,
        scheduled_at=data.scheduled_at,
        status="pending",
        idempotency_key=idemp_key
    )
    db.add(reminder)
    _log_pt_activity(db, task_id, current_user.id, "REMINDER_SCHEDULED", new_val=data.scheduled_at.isoformat(), source="reminder-engine")
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/reminders/{reminder_id}/snooze", response_model=PersonalReminderOut)
def snooze_personal_reminder(
    reminder_id: int,
    minutes: int = Query(15),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Snooze a reminder by N minutes"""
    reminder = db.query(PersonalReminder).filter(
        PersonalReminder.id == reminder_id,
        PersonalReminder.user_id == current_user.id
    ).first()
    if not reminder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    new_time = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    reminder.scheduled_at = new_time
    reminder.status = "snoozed"
    reminder.idempotency_key = f"{reminder.task_id}_{reminder.reminder_type}_{new_time.isoformat()}"

    _log_pt_activity(db, reminder.task_id, current_user.id, "REMINDER_SNOOZED", new_val=f"{minutes} mins", source="reminder-engine")
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


# =========================================================================
# 8. TEMPLATES
# =========================================================================

@router.get("/templates", response_model=List[PersonalTemplateOut])
def get_personal_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List reusable checklists/templates"""
    return db.query(PersonalTemplate).filter(PersonalTemplate.user_id == current_user.id).order_by(PersonalTemplate.created_at.desc()).all()


@router.post("/templates", response_model=PersonalTemplateOut, status_code=status.HTTP_201_CREATED)
def create_personal_template(
    data: PersonalTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save reusable task template with subtasks"""
    subtasks_list = [{"title": s.strip()} for s in data.subtasks if s.strip()]
    template = PersonalTemplate(
        user_id=current_user.id,
        name=data.name.strip(),
        description=data.description,
        subtasks_json=subtasks_list
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.post("/templates/{template_id}/instantiate", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def instantiate_personal_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create task and child subtasks from template"""
    template = db.query(PersonalTemplate).filter(
        PersonalTemplate.id == template_id,
        PersonalTemplate.user_id == current_user.id
    ).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Create parent task
    parent_create = TaskCreate(
        title=template.name,
        description=template.description,
        is_personal=True,
        start_date=datetime.now(timezone.utc).date()
    )
    parent_out = create_personal_task(parent_create, db, current_user)

    # Create subtasks
    if template.subtasks_json and isinstance(template.subtasks_json, list):
        for item in template.subtasks_json:
            title = item.get("title", "").strip() if isinstance(item, dict) else str(item).strip()
            if title:
                sub_create = TaskCreate(
                    title=title,
                    parent_task_id=parent_out.id,
                    is_personal=True,
                    start_date=datetime.now(timezone.utc).date()
                )
                create_personal_task(sub_create, db, current_user)

    parent_task = db.get(Task, parent_out.id)
    _sync_parent_due_and_progress(db, parent_task.id, current_user.id)
    return _format_task_out(parent_task, db)


# =========================================================================
# 9. EXPORT & CALENDAR ICS
# =========================================================================

@router.get("/export")
def export_personal_tasks(
    format: str = Query("csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export tasks in CSV or JSON format"""
    tasks = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False)
    ).order_by(Task.due_date.asc().nullslast()).all()

    if format.lower() == "json":
        data = []
        for t in tasks:
            data.append({
                "id": t.id,
                "task_number": t.task_number,
                "title": t.title,
                "description": t.description,
                "status": t.status_def.name if t.status_def else "To Do",
                "priority": t.priority.value if hasattr(t.priority, 'value') else str(t.priority),
                "start_date": t.start_date.isoformat() if t.start_date else None,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "planned_date": t.planned_date.isoformat() if t.planned_date else None,
                "estimated_hours": t.estimated_hours,
                "actual_hours": t.actual_hours,
                "is_completed": t.is_completed,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "cancellation_reason": t.cancellation_reason,
                "created_at": t.created_at.isoformat() if t.created_at else None
            })
        return Response(content=json.dumps(data, indent=2), media_type="application/json", headers={"Content-Disposition": 'attachment; filename="personal_tasks.json"'})

    # CSV format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Task Number", "Title", "Status", "Priority", "Start Date", "Due Date", "Planned Date", "Estimated Hours", "Actual Hours", "Completed", "Cancellation Reason"])
    for t in tasks:
        writer.writerow([
            t.task_number,
            t.title,
            t.status_def.name if t.status_def else "To Do",
            t.priority.value if hasattr(t.priority, 'value') else str(t.priority),
            t.start_date.isoformat() if t.start_date else "",
            t.due_date.isoformat() if t.due_date else "",
            t.planned_date.isoformat() if t.planned_date else "",
            t.estimated_hours,
            t.actual_hours,
            "Yes" if t.is_completed else "No",
            t.cancellation_reason or ""
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="personal_tasks.csv"'}
    )


@router.get("/calendar.ics")
def export_personal_calendar_ics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export scheduled tasks to iCalendar (.ics) format"""
    tasks = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False),
        Task.is_completed.is_(False),
        Task.due_date.isnot(None)
    ).all()

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ORBX KIM//Personal Task Manager//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH"
    ]

    for t in tasks:
        d = t.due_date
        d_str = d.strftime("%Y%m%d")
        ics_lines.extend([
            "BEGIN:VEVENT",
            f"UID:task-{t.id}@orbxkim.local",
            f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            f"DTSTART;VALUE=DATE:{d_str}",
            f"DTEND;VALUE=DATE:{d_str}",
            f"SUMMARY:{t.title}",
            f"DESCRIPTION:{t.description or ''}",
            f"STATUS:{'CONFIRMED' if not t.is_completed else 'COMPLETED'}",
            f"PRIORITY:{'1' if t.priority == TaskPriority.URGENT else '5'}",
            "END:VEVENT"
        ])

    ics_lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(ics_lines)

    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="personal_tasks.ics"'}
    )


# =========================================================================
# 10. TAGS & SEARCH
# =========================================================================

@router.get("/tags", response_model=List[str])
def get_personal_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List unique tag names used across user's personal tasks"""
    user_task_ids = [t.id for t in db.query(Task.id).filter(Task.is_personal.is_(True), Task.created_by == current_user.id).all()]
    if not user_task_ids:
        return []

    tags = db.query(TaskTag.name).join(TaskTagMap, TaskTag.id == TaskTagMap.tag_id).filter(
        TaskTagMap.task_id.in_(user_task_ids)
    ).distinct().all()

    return [t[0] for t in tags]


@router.get("/search", response_model=List[TaskOut])
def search_personal_tasks(
    q: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Global search across personal tasks"""
    if not q or not q.strip():
        return []

    term = f"%{q.strip()}%"
    tasks = db.query(Task).filter(
        Task.is_personal.is_(True),
        Task.created_by == current_user.id,
        Task.is_deleted.is_(False),
        or_(
            Task.title.ilike(term),
            Task.description.ilike(term),
            Task.task_number.ilike(term),
            Task.tags.ilike(term)
        )
    ).order_by(Task.is_completed.asc(), Task.due_date.asc().nullslast()).limit(25).all()

    return [_format_task_out(t, db) for t in tasks]
