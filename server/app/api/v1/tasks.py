import os
import re
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form, status, Response
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_, and_, case

from app.db.session import get_db
from app.models.projects import (
    Task, TaskStatusDef, TaskPriority, TaskStatusCategory, TaskSubtask, TaskTimeLog, TaskComment,
    TaskAttachment, TaskCustomFieldDefinition, TaskCustomFieldValue, Project, ProjectPhase,
    TaskAssignee, TaskFollower, TaskTag, TaskTagMap, TaskChecklist, TaskChecklistItem,
    TaskTimeEntry, TaskDependency, TaskRelationship, TaskActivity, TaskTemplate, TaskAutomationRule,
    DependencyType, RelationshipType, WorkingCalendarHoliday, WeeklyOffDay
)
from app.models.cost_center import CostCenter
from app.models.branch import Branch
from app.models.rbac import Department
from app.models.user import User
from app.models.enums import UserRole
from app.models.notification import Notification
from app.schemas.projects import (
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TaskSubtaskCreate,
    TaskSubtaskOut,
    TaskTimeLogCreate,
    TaskTimeLogOut,
    TaskCommentCreate,
    TaskCommentOut,
    TaskAttachmentCreate,
    TaskAttachmentOut,
    CustomFieldValueCreate,
    CustomFieldValueOut,
    TaskAssigneeOut,
    TaskFollowerOut,
    TaskChecklistCreate,
    TaskChecklistOut,
    TaskChecklistItemCreate,
    TaskChecklistItemOut,
    TaskTimeEntryCreate,
    TaskTimeEntryOut,
    TaskDependencyCreate,
    TaskDependencyOut,
    TaskRelationshipCreate,
    TaskRelationshipOut,
    TaskActivityOut,
    BulkTaskActionRequest,
    BulkTaskActionResponse,
    TaskTemplateCreate,
    TaskTemplateOut,
    TaskTagOut,
    UserBriefOut,
    TaskConvertRequest,
    TaskReorderRequest,
    RescheduleDependenciesRequest,
    TaskDependencyUpdate,
    CascadePreviewItem,
    CascadePreviewOut,
    ProjectPmSettingsOut,
    ProjectPmSettingsUpdate,
)
from app.core.deps import get_current_user, require_permission

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[Depends(require_permission("view", "tasks"))])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "tasks")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# --- Working-Day Calendar Helpers ---

def _get_working_calendar(db: Session):
    """Returns (holiday_dates: set, weekly_off_days: set[int]) from DB"""
    from datetime import date as _date
    holidays = db.query(WorkingCalendarHoliday).all()
    holiday_dates: set = set()
    today_year = _date.today().year
    for h in holidays:
        # Use the 'date' column name — handle both column name variants
        hd = getattr(h, 'date', None) or getattr(h, 'holiday_date', None)
        if hd is None:
            continue
        holiday_dates.add(hd)
        if getattr(h, 'recurs_yearly', False):
            # Add recurring instance for nearby years
            for yr in range(today_year - 1, today_year + 3):
                try:
                    holiday_dates.add(hd.replace(year=yr))
                except ValueError:
                    pass

    off_rows = db.query(WeeklyOffDay).all()
    weekly_off_days: set = {r.day_of_week for r in off_rows}
    return holiday_dates, weekly_off_days


def _is_working_day(d, holiday_dates: set, weekly_off_days: set) -> bool:
    """Returns True if d is a working day (not weekend/holiday)"""
    # day_of_week in DB: 0=Sunday per WeeklyOffDay convention
    # Python weekday(): 0=Monday. Convert: Python Mon=0 → DB 2, Sun=6 → DB 1
    # Simpler: Python isoweekday(): Mon=1..Sun=7. DB stores 0=Sun,1=Mon..6=Sat
    iso = d.isoweekday()  # 1=Mon .. 7=Sun
    # Map to DB convention: 0=Sun, 1=Mon, ..., 6=Sat
    db_dow = 0 if iso == 7 else iso
    if db_dow in weekly_off_days:
        return False
    if d in holiday_dates:
        return False
    return True


def _count_working_days(start_date: date, due_date: date, holiday_dates: set, weekly_off_days: set) -> int:
    if not start_date or not due_date or due_date < start_date:
        return 1
    current = start_date
    count = 0
    while current <= due_date:
        if _is_working_day(current, holiday_dates, weekly_off_days):
            count += 1
        current += timedelta(days=1)
    return max(1, count)


def _add_working_days(start_date, days: int, holiday_dates: set, weekly_off_days: set):
    """Add N working days to start_date, skipping non-working days"""
    current = start_date
    if days == 0:
        while not _is_working_day(current, holiday_dates, weekly_off_days):
            current += timedelta(days=1)
        return current
    step = 1 if days > 0 else -1
    remaining = abs(days)
    while remaining > 0:
        current = current + timedelta(days=step)
        if _is_working_day(current, holiday_dates, weekly_off_days):
            remaining -= 1
    return current


def _compute_successor_dates(predecessor_start, predecessor_due, dep_type: str, lag_days: int, duration_days: int, holiday_dates: set, weekly_off_days: set):
    """Compute successor start/due based on dep type + lag, holiday-aware."""
    if not predecessor_due and not predecessor_start:
        return None, None

    pred_start = predecessor_start
    pred_end = predecessor_due or predecessor_start

    dur = max(1, duration_days or 1)

    if dep_type == "FS":   # Finish-to-Start: succ_start = pred_end + 1 + lag
        succ_start = _add_working_days(pred_end, 1 + lag_days, holiday_dates, weekly_off_days)
    elif dep_type == "SS": # Start-to-Start: succ_start = pred_start + lag
        succ_start = _add_working_days(pred_start or pred_end, lag_days, holiday_dates, weekly_off_days)
    elif dep_type == "FF": # Finish-to-Finish
        succ_end = _add_working_days(pred_end, lag_days, holiday_dates, weekly_off_days)
        succ_start = _add_working_days(succ_end, -(dur - 1), holiday_dates, weekly_off_days)
        return succ_start, succ_end
    elif dep_type == "SF": # Start-to-Finish
        succ_end = _add_working_days(pred_start or pred_end, lag_days, holiday_dates, weekly_off_days)
        succ_start = _add_working_days(succ_end, -(dur - 1), holiday_dates, weekly_off_days)
        return succ_start, succ_end
    else:  # Default FS
        succ_start = _add_working_days(pred_end, 1 + lag_days, holiday_dates, weekly_off_days)

    succ_end = _add_working_days(succ_start, dur - 1, holiday_dates, weekly_off_days)
    return succ_start, succ_end


# --- Helper Utilities ---

def _unpad_task_number(val: Optional[str]) -> Optional[str]:
    if not val:
        return val
    import re
    return re.sub(r'(TASK-|#|SUB-|^)0+([1-9]\d*)', r'\1\2', val)


def _generate_task_number(db: Session, project_id: Optional[int] = None) -> str:
    """Generate server-side unique human-readable task number e.g. NTP-1 or TASK-1 starting from 1 per project"""
    if project_id:
        proj = db.get(Project, project_id)
        if proj:
            p_prefix = (proj.prefix or proj.code or "").strip().upper()
            if p_prefix:
                max_num = db.query(func.count(Task.id)).filter(
                    Task.project_id == project_id,
                    Task.is_deleted.is_(False)
                ).scalar() or 0
                seq = max_num + 1
                task_num = f"{p_prefix}-{seq}"
                while db.query(Task).filter(Task.task_number == task_num).first():
                    seq += 1
                    task_num = f"{p_prefix}-{seq}"
                return task_num

    total = db.query(func.count(Task.id)).filter(
        Task.project_id.is_(None),
        Task.is_deleted.is_(False)
    ).scalar() or 0
    seq = total + 1
    task_num = f"TASK-{seq}"
    while db.query(Task).filter(Task.task_number == task_num).first():
        seq += 1
        task_num = f"TASK-{seq}"
    return task_num


def _get_task_depth(db: Session, parent_task_id: Optional[int]) -> int:
    """Calculate subtask nesting level depth"""
    depth = 1
    curr_id = parent_task_id
    visited = set()
    while curr_id:
        if curr_id in visited:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular parent relationship detected"
            )
        visited.add(curr_id)
        parent = db.get(Task, curr_id)
        if not parent:
            break
        depth += 1
        curr_id = parent.parent_task_id
        if depth > 10:
            break
    return depth


def _detect_circular_dependency(db: Session, task_id: int, target_task_id: int):
    """Detect if task_id depending on target_task_id causes a cycle"""
    if task_id == target_task_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A task cannot depend on itself"
        )
    
    # Check if target_task_id already directly or indirectly depends on task_id
    queue = [task_id]
    visited = set()
    while queue:
        curr = queue.pop(0)
        if curr in visited:
            continue
        visited.add(curr)
        if curr == target_task_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular task dependency detected"
            )
        # find tasks that depend on curr
        deps = db.query(TaskDependency).filter(TaskDependency.depends_on_task_id == curr).all()
        for d in deps:
            queue.append(d.task_id)


def _log_activity(db: Session, task_id: int, actor_id: Optional[int], action: str, field_name: Optional[str] = None, old_val: Optional[str] = None, new_val: Optional[str] = None):
    act = TaskActivity(
        task_id=task_id,
        actor_id=actor_id,
        action=action,
        field_name=field_name,
        old_value=str(old_val) if old_val is not None else None,
        new_value=str(new_val) if new_val is not None else None,
    )
    db.add(act)


def _parse_and_notify_mentions(db: Session, content: str, task: Task, actor: User):
    """Parse @mentions in text and create notifications"""
    usernames = re.findall(r'@([a-zA-Z0-9_\.\-]+)', content)
    notify_user_ids = set()

    for un in usernames:
        if un.lower() == 'assignee' and task.assignee_id:
            notify_user_ids.add(task.assignee_id)
        elif un.lower() == 'followers':
            for f in task.followers:
                notify_user_ids.add(f.user_id)
        else:
            u = db.query(User).filter(or_(User.username == un, User.email == un)).first()
            if u:
                notify_user_ids.add(u.id)

    # Remove self
    notify_user_ids.discard(actor.id)

    for uid in notify_user_ids:
        msg = f"{actor.full_name} mentioned you in task {task.task_number}: {task.title}"
        db.add(Notification(user_id=uid, message=msg))


def _update_parent_progress(db: Session, parent_id: Optional[int]):
    """Automatically calculate parent task progress percentage based on subtasks"""
    if not parent_id:
        return
    parent = db.get(Task, parent_id)
    if not parent:
        return

    subtasks = db.query(Task).filter(Task.parent_task_id == parent_id, Task.is_deleted.is_(False)).all()
    if not subtasks:
        return

    completed_count = sum(1 for st in subtasks if st.is_completed)
    total_count = len(subtasks)
    parent.progress_percentage = round((completed_count / total_count) * 100.0, 2)
    db.add(parent)
    
    # Recurse up if parent also has a parent
    if parent.parent_task_id:
        _update_parent_progress(db, parent.parent_task_id)


def _get_all_descendants(db: Session, parent_id: int) -> list[Task]:
    res = []
    children = db.query(Task).filter(Task.parent_task_id == parent_id, Task.is_deleted.is_(False)).all()
    for c in children:
        res.append(c)
        res.extend(_get_all_descendants(db, c.id))
    return res


def _sync_parent_due_date(db: Session, parent_id: Optional[int]) -> None:
    """Sync parent task dates, times, duration, and progress from child tasks (recursive upward)."""
    if not parent_id:
        return
    from app.services.rollup_service import rollup_work_item
    rollup_work_item(db, parent_id)


def _batch_load_task_metadata(db: Session, task_ids: list[int]):
    if not task_ids:
        return {}, {}, {}, {}, {}, {}

    # 1. Dependencies
    deps = (
        db.query(TaskDependency)
        .options(
            joinedload(TaskDependency.task).joinedload(Task.status_def),
            joinedload(TaskDependency.depends_on_task).joinedload(Task.status_def),
        )
        .filter(or_(TaskDependency.task_id.in_(task_ids), TaskDependency.depends_on_task_id.in_(task_ids)))
        .all()
    )
    deps_by_task: dict[int, list[TaskDependencyOut]] = {tid: [] for tid in task_ids}
    dependents_by_task: dict[int, list[TaskDependencyOut]] = {tid: [] for tid in task_ids}
    is_blocked_by_task: dict[int, bool] = {tid: False for tid in task_ids}

    for dep in deps:
        if dep.task_id in deps_by_task:
            blocker = dep.depends_on_task
            if blocker and not blocker.is_deleted:
                if not blocker.is_completed:
                    is_blocked_by_task[dep.task_id] = True
                deps_by_task[dep.task_id].append(TaskDependencyOut(
                    id=dep.id,
                    task_id=dep.task_id,
                    depends_on_task_id=dep.depends_on_task_id,
                    depends_on_task_number=blocker.task_number,
                    depends_on_task_title=blocker.title,
                    depends_on_status_name=blocker.status_def.name if blocker.status_def else None,
                    depends_on_priority=blocker.priority.value if hasattr(blocker.priority, 'value') else str(blocker.priority),
                    depends_on_due_date=blocker.due_date,
                    depends_on_is_completed=blocker.is_completed,
                    direction="BLOCKED_BY",
                    dependency_type=dep.dependency_type,
                    predecessor_task_id=dep.depends_on_task_id,
                    predecessor_task_number=blocker.task_number,
                    predecessor_task_title=blocker.title,
                    predecessor_status_name=blocker.status_def.name if blocker.status_def else None,
                    predecessor_priority=blocker.priority.value if hasattr(blocker.priority, 'value') else str(blocker.priority),
                    predecessor_due_date=blocker.due_date,
                    predecessor_is_completed=blocker.is_completed,
                    dep_type=getattr(dep.pm_dep_type, 'value', str(dep.pm_dep_type)) if dep.pm_dep_type else "FS",
                    lag_days=getattr(dep, 'lag_days', 0) or 0,
                    created_at=dep.created_at,
                ))
        if dep.depends_on_task_id in dependents_by_task:
            blocked_task = dep.task
            if blocked_task and not blocked_task.is_deleted:
                dependents_by_task[dep.depends_on_task_id].append(TaskDependencyOut(
                    id=dep.id,
                    task_id=dep.task_id,
                    depends_on_task_id=dep.depends_on_task_id,
                    depends_on_task_number=blocked_task.task_number,
                    depends_on_task_title=blocked_task.title,
                    depends_on_status_name=blocked_task.status_def.name if blocked_task.status_def else None,
                    depends_on_priority=blocked_task.priority.value if hasattr(blocked_task.priority, 'value') else str(blocked_task.priority),
                    depends_on_due_date=blocked_task.due_date,
                    depends_on_is_completed=blocked_task.is_completed,
                    direction="BLOCKING",
                    dependency_type=dep.dependency_type,
                    predecessor_task_id=dep.depends_on_task_id,
                    predecessor_task_number=blocked_task.task_number,
                    predecessor_task_title=blocked_task.title,
                    predecessor_status_name=blocked_task.status_def.name if blocked_task.status_def else None,
                    predecessor_priority=blocked_task.priority.value if hasattr(blocked_task.priority, 'value') else str(blocked_task.priority),
                    predecessor_due_date=blocked_task.due_date,
                    predecessor_is_completed=blocked_task.is_completed,
                    dep_type=getattr(dep.pm_dep_type, 'value', str(dep.pm_dep_type)) if dep.pm_dep_type else "FS",
                    lag_days=getattr(dep, 'lag_days', 0) or 0,
                    created_at=dep.created_at,
                ))

    # 2. Relationships
    rels = (
        db.query(TaskRelationship)
        .options(
            joinedload(TaskRelationship.task),
            joinedload(TaskRelationship.related_task),
        )
        .filter(or_(TaskRelationship.task_id.in_(task_ids), TaskRelationship.related_task_id.in_(task_ids)))
        .all()
    )
    rels_by_task: dict[int, list[TaskRelationshipOut]] = {tid: [] for tid in task_ids}
    for rel in rels:
        rel_out = TaskRelationshipOut(
            id=rel.id,
            task_id=rel.task_id,
            related_task_id=rel.related_task_id,
            related_task_number=rel.related_task.task_number if rel.related_task else None,
            related_task_title=rel.related_task.title if rel.related_task else None,
            relationship_type=rel.relationship_type,
            created_at=rel.created_at,
        )
        if rel.task_id in rels_by_task:
            rels_by_task[rel.task_id].append(rel_out)
        if rel.related_task_id in rels_by_task and rel.related_task_id != rel.task_id:
            rels_by_task[rel.related_task_id].append(rel_out)

    # 3. Subtask counts
    subtask_counts_rows = (
        db.query(
            Task.parent_task_id,
            func.count(Task.id).label("total"),
            func.count(case((Task.is_completed.is_(True), 1))).label("completed"),
        )
        .filter(Task.parent_task_id.in_(task_ids), Task.is_deleted.is_(False))
        .group_by(Task.parent_task_id)
        .all()
    )
    subtask_counts = {tid: {"total": 0, "completed": 0} for tid in task_ids}
    for pid, total, completed in subtask_counts_rows:
        if pid in subtask_counts:
            subtask_counts[pid] = {"total": total or 0, "completed": completed or 0}

    # 4. Nested subtasks (1 batch query)
    subtasks_rows = (
        db.query(Task)
        .options(
            joinedload(Task.project),
            joinedload(Task.assignee),
            joinedload(Task.status_def),
            joinedload(Task.cost_center),
            joinedload(Task.department),
            selectinload(Task.assignees).joinedload(TaskAssignee.user),
            selectinload(Task.followers).joinedload(TaskFollower.user),
            selectinload(Task.tag_mappings).joinedload(TaskTagMap.tag),
        )
        .filter(Task.parent_task_id.in_(task_ids), Task.is_deleted.is_(False))
        .order_by(Task.sort_order.asc(), Task.id.asc())
        .all()
    )
    subtasks_by_parent: dict[int, list[Task]] = {tid: [] for tid in task_ids}
    seen_subtask_ids_by_parent: dict[int, set[int]] = {tid: set() for tid in task_ids}
    for st in subtasks_rows:
        pid = st.parent_task_id
        if pid in subtasks_by_parent:
            if st.id not in seen_subtask_ids_by_parent[pid]:
                seen_subtask_ids_by_parent[pid].add(st.id)
                subtasks_by_parent[pid].append(st)

    # Also batch load level-2 subtasks if any child tasks exist
    child_ids = [st.id for st in subtasks_rows]
    if child_ids:
        sub_subtasks = (
            db.query(Task)
            .options(
                joinedload(Task.project),
                joinedload(Task.assignee),
                joinedload(Task.status_def),
                joinedload(Task.cost_center),
                joinedload(Task.department),
                selectinload(Task.assignees).joinedload(TaskAssignee.user),
                selectinload(Task.followers).joinedload(TaskFollower.user),
                selectinload(Task.tag_mappings).joinedload(TaskTagMap.tag),
            )
            .filter(Task.parent_task_id.in_(child_ids), Task.is_deleted.is_(False))
            .order_by(Task.sort_order.asc(), Task.id.asc())
            .all()
        )
        for sst in sub_subtasks:
            pid = sst.parent_task_id
            if pid not in subtasks_by_parent:
                subtasks_by_parent[pid] = []
                seen_subtask_ids_by_parent[pid] = set()
            if sst.id not in seen_subtask_ids_by_parent[pid]:
                seen_subtask_ids_by_parent[pid].add(sst.id)
                subtasks_by_parent[pid].append(sst)

    return deps_by_task, dependents_by_task, is_blocked_by_task, rels_by_task, subtask_counts, subtasks_by_parent


def _format_task_out(
    t: Task,
    db: Session,
    batch_deps: Optional[list] = None,
    batch_dependents: Optional[list] = None,
    batch_is_blocked: Optional[bool] = None,
    batch_rels: Optional[list] = None,
    batch_subtask_counts: Optional[dict] = None,
    batch_subtasks: Optional[list] = None,
    batch_subtasks_map: Optional[dict] = None,
    skip_nested: bool = False,
) -> TaskOut:
    out = TaskOut.model_validate(t)
    if out.task_number:
        out.task_number = _unpad_task_number(out.task_number)
    out.project_name = t.project.name if t.project else None
    out.task_list_name = t.task_list.name if t.task_list else None
    out.assignee_name = t.assignee.full_name if t.assignee else None
    out.created_by_name = t.creator.full_name if t.creator else None
    out.status_name = t.status_def.name if t.status_def else None
    out.status_color = t.status_def.color if t.status_def else "#E2E8F0"
    out.status_category = t.status_def.category.value if t.status_def and t.status_def.category else "ACTIVE"

    out.cost_center_code = t.cost_center.code if t.cost_center else None
    out.cost_center_name = t.cost_center.name if t.cost_center else None
    out.department_name = t.department.name if t.department else None

    out.assignees = [
        TaskAssigneeOut(
            id=a.id,
            task_id=a.task_id,
            user_id=a.user_id,
            assigned_at=a.assigned_at,
            user=UserBriefOut.model_validate(a.user) if a.user else None
        ) for a in t.assignees
    ]

    out.followers = [
        TaskFollowerOut(
            id=f.id,
            task_id=f.task_id,
            user_id=f.user_id,
            created_at=f.created_at,
            user=UserBriefOut.model_validate(f.user) if f.user else None
        ) for f in t.followers
    ]

    out.tags_list = [
        TaskTagOut(
            id=tm.tag.id,
            name=tm.tag.name,
            color=tm.tag.color,
            created_at=getattr(tm.tag, 'created_at', None),
        ) for tm in t.tag_mappings if tm.tag
    ]

    out.checklists = [
        TaskChecklistOut(
            id=c.id,
            task_id=c.task_id,
            title=c.title,
            items=[
                TaskChecklistItemOut(
                    id=ci.id,
                    checklist_id=ci.checklist_id,
                    title=ci.title,
                    is_completed=ci.is_completed,
                    assignee_id=ci.assignee_id,
                    assignee_name=ci.assignee.full_name if ci.assignee else None,
                    due_date=ci.due_date,
                    display_order=ci.display_order,
                ) for ci in c.items
            ]
        ) for c in t.checklists
    ]

    out.time_entries = [
        TaskTimeEntryOut(
            id=te.id,
            task_id=te.task_id,
            user_id=te.user_id,
            started_at=te.started_at,
            ended_at=te.ended_at,
            duration_minutes=te.duration_minutes,
            description=te.description,
            user_name=te.user.full_name if te.user else None,
            created_at=te.created_at,
        ) for te in t.time_entries
    ]

    if batch_deps is not None:
        dependencies_out = batch_deps
        dependents_out = batch_dependents if batch_dependents is not None else []
        is_blocked = batch_is_blocked if batch_is_blocked is not None else False
    else:
        dependencies_out = []
        dependents_out = []
        # 1. BLOCKED_BY dependencies (task t is blocked by depends_on_task_id)
        blocked_by_deps = db.query(TaskDependency).filter(TaskDependency.task_id == t.id).all()
        is_blocked = False
        for dep in blocked_by_deps:
            blocker = dep.depends_on_task
            if blocker and not blocker.is_deleted:
                if not blocker.is_completed:
                    is_blocked = True
                dependencies_out.append(TaskDependencyOut(
                    id=dep.id,
                    task_id=dep.task_id,
                    depends_on_task_id=dep.depends_on_task_id,
                    depends_on_task_number=blocker.task_number,
                    depends_on_task_title=blocker.title,
                    depends_on_status_name=blocker.status_def.name if blocker.status_def else None,
                    depends_on_priority=blocker.priority.value if hasattr(blocker.priority, 'value') else str(blocker.priority),
                    depends_on_due_date=blocker.due_date,
                    depends_on_is_completed=blocker.is_completed,
                    direction="BLOCKED_BY",
                    dependency_type=dep.dependency_type,
                    predecessor_task_id=dep.depends_on_task_id,
                    predecessor_task_number=blocker.task_number,
                    predecessor_task_title=blocker.title,
                    predecessor_status_name=blocker.status_def.name if blocker.status_def else None,
                    predecessor_priority=blocker.priority.value if hasattr(blocker.priority, 'value') else str(blocker.priority),
                    predecessor_due_date=blocker.due_date,
                    predecessor_is_completed=blocker.is_completed,
                    dep_type=getattr(dep.pm_dep_type, 'value', str(dep.pm_dep_type)) if dep.pm_dep_type else "FS",
                    lag_days=getattr(dep, 'lag_days', 0) or 0,
                    created_at=dep.created_at,
                ))

        # 2. BLOCKING dependencies (task t blocks task_id)
        blocking_deps = db.query(TaskDependency).filter(TaskDependency.depends_on_task_id == t.id).all()
        for dep in blocking_deps:
            blocked_task = dep.task
            if blocked_task and not blocked_task.is_deleted:
                dependents_out.append(TaskDependencyOut(
                    id=dep.id,
                    task_id=dep.task_id,
                    depends_on_task_id=dep.depends_on_task_id,
                    depends_on_task_number=blocked_task.task_number,
                    depends_on_task_title=blocked_task.title,
                    depends_on_status_name=blocked_task.status_def.name if blocked_task.status_def else None,
                    depends_on_priority=blocked_task.priority.value if hasattr(blocked_task.priority, 'value') else str(blocked_task.priority),
                    depends_on_due_date=blocked_task.due_date,
                    depends_on_is_completed=blocked_task.is_completed,
                    direction="BLOCKING",
                    dependency_type=dep.dependency_type,
                    predecessor_task_id=dep.depends_on_task_id,
                    predecessor_task_number=blocked_task.task_number,
                    predecessor_task_title=blocked_task.title,
                    predecessor_status_name=blocked_task.status_def.name if blocked_task.status_def else None,
                    predecessor_priority=blocked_task.priority.value if hasattr(blocked_task.priority, 'value') else str(blocked_task.priority),
                    predecessor_due_date=blocked_task.due_date,
                    predecessor_is_completed=blocked_task.is_completed,
                    dep_type=getattr(dep.pm_dep_type, 'value', str(dep.pm_dep_type)) if dep.pm_dep_type else "FS",
                    lag_days=getattr(dep, 'lag_days', 0) or 0,
                    created_at=dep.created_at,
                ))

    out.dependencies = dependencies_out
    out.dependents = dependents_out
    out.is_blocked = is_blocked
    out.start_date_locked = False
    out.controlled_by_task_number = None

    if batch_rels is not None:
        out.relationships = batch_rels
    else:
        out.relationships = [
            TaskRelationshipOut(
                id=rel.id,
                task_id=rel.task_id,
                related_task_id=rel.related_task_id,
                related_task_number=rel.related_task.task_number if rel.related_task else None,
                related_task_title=rel.related_task.title if rel.related_task else None,
                relationship_type=rel.relationship_type,
                created_at=rel.created_at,
            ) for rel in db.query(TaskRelationship).filter(or_(TaskRelationship.task_id == t.id, TaskRelationship.related_task_id == t.id)).all()
        ]

    if skip_nested:
        if batch_subtask_counts is not None:
            out.subtask_count = batch_subtask_counts.get("total", 0)
            out.completed_subtask_count = batch_subtask_counts.get("completed", 0)
        else:
            out.subtask_count = db.query(Task).filter(Task.parent_task_id == t.id, Task.is_deleted.is_(False)).count()
            out.completed_subtask_count = db.query(Task).filter(Task.parent_task_id == t.id, Task.is_deleted.is_(False), Task.is_completed.is_(True)).count()
        out.nested_subtasks = []
    else:
        if batch_subtasks is not None:
            unique_subtasks = []
            seen_ids = set()
            for st in batch_subtasks:
                if st.id not in seen_ids:
                    seen_ids.add(st.id)
                    unique_subtasks.append(st)

            out.subtask_count = len(unique_subtasks)
            out.completed_subtask_count = sum(1 for st in unique_subtasks if st.is_completed)
            out.nested_subtasks = [
                _format_task_out(
                    st,
                    db,
                    batch_subtasks=batch_subtasks_map.get(st.id, []) if batch_subtasks_map else None,
                    batch_subtasks_map=batch_subtasks_map,
                    skip_nested=False,
                ) for st in unique_subtasks
            ]
        else:
            subtasks = db.query(Task).filter(
                Task.parent_task_id == t.id,
                Task.is_deleted.is_(False)
            ).order_by(Task.sort_order.asc(), Task.id.asc()).all()
            out.subtask_count = len(subtasks)
            out.completed_subtask_count = sum(1 for st in subtasks if st.is_completed)
            out.nested_subtasks = [_format_task_out(st, db, skip_nested=False) for st in subtasks]

    from app.services.scheduling_engine import check_dependency_conflict
    out.dependency_conflict = check_dependency_conflict(db, t)
    raw_auto = getattr(t, 'auto_schedule', True)
    out.auto_schedule = True if raw_auto is None else bool(raw_auto)
    out.is_parent = out.subtask_count > 0
    if out.is_parent:
        # Dynamically derive missing start_time, due_time, start_date, or due_date from child subtasks
        if not out.start_time or not out.due_time or not out.start_date or not out.due_date:
            child_tasks = out.nested_subtasks or []
            if not child_tasks:
                child_tasks = db.query(Task).filter(Task.parent_task_id == t.id, Task.is_deleted.is_(False)).all()

            if child_tasks:
                from app.services.calendar_service import get_working_calendar as get_cal, parse_hhmm_time
                from datetime import datetime
                cal = get_cal(db)

                if not out.start_time or not out.start_date:
                    s_candidates = []
                    for ct in child_tasks:
                        c_sdate = getattr(ct, 'start_date', None)
                        c_stime = getattr(ct, 'start_time', None)
                        if c_sdate:
                            st_time = parse_hhmm_time(c_stime, cal.work_start_time)
                            s_candidates.append((datetime.combine(c_sdate, st_time), c_stime))
                    if s_candidates:
                        min_s_dt, min_raw = min(s_candidates, key=lambda x: x[0])
                        if not out.start_date:
                            out.start_date = min_s_dt.date()
                        if not out.start_time:
                            out.start_time = min_raw or min_s_dt.strftime("%H:%M")

                if not out.due_time or not out.due_date:
                    d_candidates = []
                    for ct in child_tasks:
                        c_ddate = getattr(ct, 'due_date', None)
                        c_dtime = getattr(ct, 'due_time', None)
                        if c_ddate:
                            dt_time = parse_hhmm_time(c_dtime, cal.work_end_time)
                            d_candidates.append((datetime.combine(c_ddate, dt_time), c_dtime))
                    if d_candidates:
                        max_d_dt, max_raw = max(d_candidates, key=lambda x: x[0])
                        if not out.due_date:
                            out.due_date = max_d_dt.date()
                        if not out.due_time:
                            out.due_time = max_raw or max_d_dt.strftime("%H:%M")

    effective_start_date = out.start_date or t.start_date
    effective_due_date = out.due_date or t.due_date
    effective_start_time = out.start_time or t.start_time
    effective_due_time = out.due_time or t.due_time

    if out.is_parent and effective_start_date and effective_due_date:
        from app.services.calendar_service import get_working_calendar as get_cal, count_working_hours, parse_hhmm_time
        from datetime import datetime
        cal = get_cal(db)
        s_time = parse_hhmm_time(effective_start_time, cal.work_start_time)
        d_time = parse_hhmm_time(effective_due_time, cal.work_end_time)
        s_dt = datetime.combine(effective_start_date, s_time)
        d_dt = datetime.combine(effective_due_date, d_time)
        if s_dt <= d_dt:
            c_days, c_hours = count_working_hours(s_dt, d_dt, cal)
            out.duration_working_days = c_days
            out.duration_working_hours = c_hours
        else:
            out.duration_working_days = 0
            out.duration_working_hours = 0
    elif not out.is_parent and t.duration_working_days is None and getattr(t, 'duration_working_hours', None) is None and t.start_date and t.due_date:
        from app.services.calendar_service import get_working_calendar as get_cal, count_working_hours, parse_hhmm_time
        from datetime import datetime
        cal = get_cal(db)
        s_time = parse_hhmm_time(t.start_time, cal.work_start_time)
        d_time = parse_hhmm_time(t.due_time, cal.work_end_time)
        s_dt = datetime.combine(t.start_date, s_time)
        d_dt = datetime.combine(t.due_date, d_time)
        if s_dt <= d_dt:
            c_days, c_hours = count_working_hours(s_dt, d_dt, cal)
            out.duration_working_days = c_days
            out.duration_working_hours = c_hours
        else:
            out.duration_working_days = 0
            out.duration_working_hours = 0
    else:
        out.duration_working_hours = getattr(t, 'duration_working_hours', 0) or 0

    return out


# --- Task Endpoints ---

@router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: Optional[int] = None,
    phase_id: Optional[int] = None,
    parent_task_id: Optional[int] = None,
    status_id: Optional[int] = None,
    status_category: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[int] = None,
    follower_id: Optional[int] = None,
    cost_center_id: Optional[int] = None,
    company_id: Optional[int] = None,
    q: Optional[str] = None,
    include_subtasks: bool = False,
    is_completed: Optional[bool] = None,
    is_archived: bool = False,
    my_tasks_only: bool = False,
    limit: Optional[int] = Query(None, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tasks with comprehensive ClickUp filtering and batch metadata resolution"""
    query = db.query(Task).filter(Task.is_deleted.is_(False))

    if not is_archived:
        query = query.filter(Task.is_archived.is_(False))

    if project_id:
        query = query.filter(Task.project_id == project_id)
    if phase_id:
        query = query.filter(Task.phase_id == phase_id)
    
    if parent_task_id is not None:
        query = query.filter(Task.parent_task_id == parent_task_id)
    elif not include_subtasks and not q:
        query = query.filter(Task.parent_task_id.is_(None))

    if status_id:
        query = query.filter(Task.status_id == status_id)
    if status_category:
        query = query.join(TaskStatusDef).filter(TaskStatusDef.category == status_category.upper())
    if priority:
        query = query.filter(Task.priority == priority.upper())
    
    if assignee_id:
        query = query.filter(
            or_(
                Task.assignee_id == assignee_id,
                Task.id.in_(db.query(TaskAssignee.task_id).filter(TaskAssignee.user_id == assignee_id))
            )
        )

    if follower_id:
        query = query.filter(
            Task.id.in_(db.query(TaskFollower.task_id).filter(TaskFollower.user_id == follower_id))
        )

    if my_tasks_only:
        # My Tasks scope: Show ONLY personal tasks created by this user
        query = query.filter(Task.is_personal == True, Task.created_by == current_user.id)
    else:
        # Projects Tasks scope: Show ONLY project tasks
        query = query.filter(Task.is_personal == False)
        
        # Mandatory security: Normal users can only see project tasks assigned to them
        if current_user.role != UserRole.ADMIN:
            query = query.filter(
                or_(
                    Task.assignee_id == current_user.id,
                    Task.id.in_(db.query(TaskAssignee.task_id).filter(TaskAssignee.user_id == current_user.id))
                )
            )

    if cost_center_id:
        query = query.filter(Task.cost_center_id == cost_center_id)
    if company_id:
        query = query.filter(Task.company_id == company_id)

    if is_completed is not None:
        query = query.filter(Task.is_completed == is_completed)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Task.title.ilike(like),
                Task.task_number.ilike(like),
                Task.description.ilike(like)
            )
        )

    query = (
        query.options(
            joinedload(Task.project),
            joinedload(Task.assignee),
            joinedload(Task.status_def),
            joinedload(Task.cost_center),
            joinedload(Task.department),
            selectinload(Task.assignees).joinedload(TaskAssignee.user),
            selectinload(Task.followers).joinedload(TaskFollower.user),
            selectinload(Task.tag_mappings).joinedload(TaskTagMap.tag),
            selectinload(Task.checklists).selectinload(TaskChecklist.items),
            selectinload(Task.time_entries).joinedload(TaskTimeEntry.user),
        )
        .order_by(Task.sort_order.asc(), Task.created_at.asc(), Task.id.asc())
    )

    safe_limit = limit if isinstance(limit, int) else 300
    safe_offset = offset if isinstance(offset, int) else 0
    query = query.offset(safe_offset).limit(safe_limit)

    tasks = query.all()
    task_ids = [t.id for t in tasks]
    deps_map, dependents_map, blocked_map, rels_map, subtask_counts_map, subtasks_by_parent_map = _batch_load_task_metadata(db, task_ids)

    return [
        _format_task_out(
            t,
            db,
            batch_deps=deps_map.get(t.id, []),
            batch_dependents=dependents_map.get(t.id, []),
            batch_is_blocked=blocked_map.get(t.id, False),
            batch_rels=rels_map.get(t.id, []),
            batch_subtask_counts=subtask_counts_map.get(t.id),
            batch_subtasks=subtasks_by_parent_map.get(t.id, []),
            batch_subtasks_map=subtasks_by_parent_map,
            skip_nested=False,
        )
        for t in tasks
    ]


def _validate_task_dates(data: TaskCreate | TaskUpdate):
    if data.start_date and data.due_date and data.due_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be earlier than start date"
        )
        
    if data.recurrence_end_date and data.start_date and data.recurrence_end_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recurrence end date cannot be earlier than start date"
        )
        
    if data.reminder_at and data.due_date:
        if data.reminder_at.date() > data.due_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reminder date cannot be later than due date"
            )

    # Reject dates with unreasonable year (e.g. year 0002 caused by rollup/scheduling bugs)
    if data.start_date and data.start_date.year < 1900:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date year is invalid. Please enter a valid date."
        )

def _get_task_or_404_with_auth(db: Session, task_id: int, current_user: User) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task or task.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    if current_user.role != UserRole.ADMIN:
        if task.is_personal:
            if task.created_by != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this personal task")
        else:
            is_assigned = task.assignee_id == current_user.id or any(a.user_id == current_user.id for a in task.assignees)
            if not is_assigned:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this project task")
            
    return task

def spawn_next_recurring_task(db: Session, task: Task, current_user_id: int):
    """Spawn the next occurrence of a recurring task if within end date"""
    if not task.recurrence_rule or task.recurrence_rule.get("type") == "None":
        return
    
    # Simple logic to determine next start/due date based on recurrence_rule
    # e.g., {'type': 'Daily'}, {'type': 'Weekly', 'days': [...]}, {'type': 'Monthly'}, {'type': 'Yearly'}
    from datetime import timedelta
    from dateutil.relativedelta import relativedelta
    
    rtype = task.recurrence_rule.get("type")
    
    next_start = task.start_date
    next_due = task.due_date
    
    if rtype == "Daily":
        if next_start: next_start += timedelta(days=1)
        if next_due: next_due += timedelta(days=1)
    elif rtype == "Weekly":
        if next_start: next_start += timedelta(weeks=1)
        if next_due: next_due += timedelta(weeks=1)
    elif rtype == "Monthly":
        if next_start: next_start += relativedelta(months=1)
        if next_due: next_due += relativedelta(months=1)
    elif rtype == "Yearly":
        if next_start: next_start += relativedelta(years=1)
        if next_due: next_due += relativedelta(years=1)
    elif rtype == "Custom":
        # Simplified handling for Custom
        pass
        
    if task.recurrence_end_date:
        if (next_start and next_start > task.recurrence_end_date) or (next_due and next_due > task.recurrence_end_date):
            return # Reached end of recurrence
            
    # Create the duplicate
    task_num = _generate_task_number(db, task.project_id)
    new_task = Task(
        task_number=task_num,
        project_id=task.project_id,
        phase_id=task.phase_id,
        parent_task_id=task.parent_task_id,
        milestone_id=task.milestone_id,
        is_personal=task.is_personal,
        title=task.title,
        description=task.description,
        type_id=task.type_id,
        status_id=None, # Will get default
        priority=task.priority,
        assignee_id=task.assignee_id,
        created_by=task.created_by,
        updated_by=current_user_id,
        start_date=next_start,
        start_time=task.start_time,
        due_date=next_due,
        due_time=task.due_time,
        estimated_minutes=task.estimated_minutes,
        estimated_hours=task.estimated_hours,
        recurrence_rule=task.recurrence_rule,
        recurrence_end_date=task.recurrence_end_date,
        recurring_task_id=task.recurring_task_id or task.id, # Link to original series
        reminder_at=None, # Reset reminder for new occurrence
        company_id=task.company_id,
        branch_id=task.branch_id,
        department_id=task.department_id,
        cost_center_id=task.cost_center_id,
    )
    
    first_status = db.query(TaskStatusDef).filter(TaskStatusDef.is_active.is_(True)).order_by(TaskStatusDef.display_order).first()
    if first_status:
        new_task.status_id = first_status.id
        
    db.add(new_task)
    db.flush()
    
    # Copy tags
    for tm in task.tag_mappings:
        db.add(TaskTagMap(task_id=new_task.id, tag_id=tm.tag_id))

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create", "tasks")),
):
    """Create a new task / subtask entity"""
    if not data.title or not data.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task title is mandatory")

    _validate_task_dates(data)
    if data.due_date and data.due_date.year < 1900:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date year is invalid. Please enter a valid date."
        )

    # Validate Cost Center master reference if provided
    if data.cost_center_id:
        cc = db.get(CostCenter, data.cost_center_id)
        if not cc or not cc.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_COST_CENTER", "message": "The selected cost center is invalid or inactive", "field": "cost_center_id"}
            )

    # Subtask nesting validation
    if data.parent_task_id:
        parent = db.get(Task, data.parent_task_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent task not found")
        depth = _get_task_depth(db, data.parent_task_id)
        if depth > 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subtask depth exceeds maximum allowed limit of 3 levels"
            )

    task_num = _generate_task_number(db, data.project_id)

    from app.services.calendar_service import (
        get_working_calendar as get_cal,
        walk_working_hours_forward,
        count_working_hours,
        parse_hhmm_time,
    )
    from datetime import datetime
    cal = get_cal(db)
    daily_h = cal.daily_working_hours

    dur_days = data.duration_working_days or 0
    dur_hours = data.duration_working_hours or 0

    if dur_hours >= daily_h:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duration hours ({dur_hours}h) must be less than daily working hours ({daily_h}h)."
        )

    due_dt_date = data.due_date
    due_dt_time = data.due_time
    start_dt_time = data.start_time

    if data.start_date and (dur_days > 0 or dur_hours > 0):
        s_time = parse_hhmm_time(start_dt_time, cal.work_start_time)
        s_dt = datetime.combine(data.start_date, s_time)
        total_dur = dur_days * daily_h + dur_hours
        calc_due_dt = walk_working_hours_forward(s_dt, total_dur, cal)
        due_dt_date = calc_due_dt.date()
        due_dt_time = calc_due_dt.strftime("%H:%M")
        start_dt_time = s_time.strftime("%H:%M")
    elif data.start_date and data.due_date:
        s_time = parse_hhmm_time(start_dt_time, cal.work_start_time)
        d_time = parse_hhmm_time(due_dt_time, cal.work_end_time)
        s_dt = datetime.combine(data.start_date, s_time)
        d_dt = datetime.combine(data.due_date, d_time)
        counted_days, counted_hours = count_working_hours(s_dt, d_dt, cal)
        dur_days = counted_days
        dur_hours = counted_hours
    elif dur_days == 0 and dur_hours == 0:
        dur_days = 1

    if data.task_list_id:
        from app.models.projects import ProjectTaskList
        tl = db.get(ProjectTaskList, data.task_list_id)
        if tl:
            if not data.milestone_id:
                data.milestone_id = tl.milestone_id
            if not data.project_id:
                data.project_id = tl.project_id

    if data.sort_order is not None and data.sort_order > 0:
        task_sort = data.sort_order
    elif data.parent_task_id:
        max_s = db.query(func.max(Task.sort_order)).filter(Task.parent_task_id == data.parent_task_id, Task.is_deleted.is_(False)).scalar()
        task_sort = (max_s + 1) if max_s is not None else 0
    elif data.task_list_id:
        max_s = db.query(func.max(Task.sort_order)).filter(Task.task_list_id == data.task_list_id, Task.is_deleted.is_(False)).scalar()
        task_sort = (max_s + 1) if max_s is not None else 0
    elif data.milestone_id:
        max_s = db.query(func.max(Task.sort_order)).filter(Task.milestone_id == data.milestone_id, Task.task_list_id.is_(None), Task.parent_task_id.is_(None), Task.is_deleted.is_(False)).scalar()
        task_sort = (max_s + 1) if max_s is not None else 0
    else:
        task_sort = 0

    task = Task(
        task_number=task_num,
        project_id=data.project_id,
        phase_id=data.phase_id,
        parent_task_id=data.parent_task_id,
        milestone_id=data.milestone_id,
        task_list_id=data.task_list_id,
        sort_order=task_sort,
        title=data.title.strip(),
        description=data.description,
        type_id=data.type_id,
        status_id=data.status_id,
        priority=data.priority,
        assignee_id=data.assignee_id or current_user.id,
        created_by=current_user.id,
        updated_by=current_user.id,
        start_date=data.start_date,
        start_time=start_dt_time,
        due_date=due_dt_date,
        due_time=due_dt_time,
        duration_working_days=dur_days,
        duration_working_hours=dur_hours,
        auto_schedule=data.auto_schedule if data.auto_schedule is not None else True,
        estimated_minutes=data.estimated_minutes or int(data.estimated_hours * 60),
        estimated_hours=data.estimated_hours or ((data.estimated_minutes or 0) / 60.0),
        tags=data.tags,
        company_id=data.company_id,
        branch_id=data.branch_id,
        department_id=data.department_id,
        cost_center_id=data.cost_center_id,
        recurrence_rule=data.recurrence_rule,
        recurrence_end_date=data.recurrence_end_date,
        recurring_task_id=data.recurring_task_id,
        reminder_at=data.reminder_at,
        reminder_status=data.reminder_status or "PENDING",
        completion_date=data.completion_date,
        completion_time=data.completion_time,
    )

    if not task.status_id:
        first_status = db.query(TaskStatusDef).filter(TaskStatusDef.is_active.is_(True)).order_by(TaskStatusDef.display_order).first()
        if first_status:
            task.status_id = first_status.id

    db.add(task)
    db.commit()
    db.refresh(task)

    # Assignees handling
    assignee_ids = data.assignee_ids or []
    if task.assignee_id and task.assignee_id not in assignee_ids:
        assignee_ids.append(task.assignee_id)
    
    for uid in set(assignee_ids):
        db.add(TaskAssignee(task_id=task.id, user_id=uid, assigned_by=current_user.id))
        if uid != current_user.id:
            db.add(Notification(user_id=uid, message=f"You were assigned to task {task.task_number}: {task.title}"))
        db.add(TaskFollower(task_id=task.id, user_id=uid))

    # Followers handling
    if data.follower_ids:
        for fid in set(data.follower_ids):
            if not db.query(TaskFollower).filter(TaskFollower.task_id == task.id, TaskFollower.user_id == fid).first():
                db.add(TaskFollower(task_id=task.id, user_id=fid))

    # Tags handling
    tids_to_add = set(data.tag_ids or [])
    if data.tag_names:
        for tname in data.tag_names:
            tname = tname.strip()
            if not tname: continue
            tag = db.query(TaskTag).filter(TaskTag.name == tname).first()
            if not tag:
                tag = TaskTag(name=tname)
                db.add(tag)
                db.commit()
                db.refresh(tag)
            tids_to_add.add(tag.id)
            
    for tid in tids_to_add:
        db.add(TaskTagMap(task_id=task.id, tag_id=tid))

    # Log activity
    _log_activity(db, task.id, current_user.id, "CREATED", new_val=task.title)

    if task.parent_task_id or task.milestone_id or task.project_id:
        from app.services.scheduling_engine import propagate_task_schedule_changes
        propagate_task_schedule_changes(db, task.id, current_user.id)

    if task.task_list_id:
        from app.services.rollup_service import rollup_task_list
        rollup_task_list(db, task.task_list_id)

    if task.project_id:
        from app.services.rollup_service import rollup_project
        rollup_project(db, task.project_id)

    db.commit()
    db.refresh(task)

    if task.parent_task_id:
        _update_parent_progress(db, task.parent_task_id)
        _sync_parent_due_date(db, task.parent_task_id)
        db.commit()

    return _format_task_out(task, db)


@router.get("/personal/list", response_model=List[TaskOut])
def get_personal_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all personal tasks for the current user"""
    tasks = db.query(Task).filter(
        Task.is_personal == True,
        Task.created_by == current_user.id,
        Task.is_deleted == False
    ).order_by(Task.due_date.asc(), Task.priority.desc()).all()
    return [_format_task_out(t, db) for t in tasks]


@router.post("/personal/create", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_personal_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new personal task strictly isolated from projects"""
    if not data.title or not data.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task title is mandatory")
        
    _validate_task_dates(data)
    
    task_num = _generate_task_number(db, None)

    task = Task(
        task_number=task_num,
        is_personal=True,
        project_id=None,
        phase_id=None,
        parent_task_id=None,
        milestone_id=None,
        title=data.title.strip(),
        description=data.description,
        type_id=data.type_id,
        status_id=data.status_id,
        priority=data.priority,
        assignee_id=current_user.id,
        created_by=current_user.id,
        updated_by=current_user.id,
        start_date=data.start_date,
        start_time=data.start_time,
        due_date=data.due_date,
        due_time=data.due_time,
        estimated_minutes=data.estimated_minutes or int(data.estimated_hours * 60),
        estimated_hours=data.estimated_hours or ((data.estimated_minutes or 0) / 60.0),
        recurrence_rule=data.recurrence_rule,
        recurrence_end_date=data.recurrence_end_date,
        recurring_task_id=data.recurring_task_id,
        reminder_at=data.reminder_at,
        reminder_status=data.reminder_status or "PENDING",
        completion_date=data.completion_date,
        completion_time=data.completion_time,
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
            tag = db.query(TaskTag).filter(TaskTag.name == tname).first()
            if not tag:
                tag = TaskTag(name=tname)
                db.add(tag)
                db.commit()
                db.refresh(tag)
            tids_to_add.add(tag.id)
            
    for tid in tids_to_add:
        db.add(TaskTagMap(task_id=task.id, tag_id=tid))

    _log_activity(db, task.id, current_user.id, "CREATED", new_val=task.title)
    
    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


@router.put("/personal/{task_id}", response_model=TaskOut)
@router.patch("/personal/{task_id}", response_model=TaskOut)
def update_personal_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a personal task ensuring it remains isolated"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal == True,
        Task.created_by == current_user.id,
        Task.is_deleted == False
    ).first()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")
        
    _validate_task_dates(data)

    update_dict = data.model_dump(exclude_unset=True)
    
    # Exclude any project/parent link attempts
    blocked_fields = ['project_id', 'parent_task_id', 'milestone_id', 'phase_id', 'is_personal', 'tag_ids', 'tag_names', 'edit_series']
    for bf in blocked_fields:
        if bf in update_dict:
            del update_dict[bf]

    for key, val in update_dict.items():
        if hasattr(task, key):
            setattr(task, key, val)
            _log_activity(db, task.id, current_user.id, "UPDATED", field_name=key, new_val=str(val))

    # Apply series update logic if edit_series is True
    if data.edit_series and (task.recurring_task_id or task.recurrence_rule):
        series_id = task.recurring_task_id or task.id
        future_occurrences = db.query(Task).filter(
            (Task.recurring_task_id == series_id) | (Task.id == series_id),
            Task.is_completed == False,
            Task.is_deleted == False,
            Task.id != task.id,
            Task.is_personal == True
        ).all()
        for ft in future_occurrences:
            for field, val in update_dict.items():
                if field not in ["assignee_ids", "follower_ids", "tag_ids", "tag_names", "override_dependencies", "edit_series", "is_completed", "completion_date", "completion_time", "status_id", "start_date", "due_date"]:
                    setattr(ft, field, val)

    if data.is_completed is not None:
        if data.is_completed and not task.is_completed:
            task.is_completed = True
            task.completed_at = datetime.now(timezone.utc)
            task.completed_by = current_user.id
            task.progress_percentage = 100.0
            if not task.completion_date and not data.completion_date:
                task.completion_date = datetime.now(timezone.utc).date()
            if not task.completion_time and not data.completion_time:
                task.completion_time = datetime.now(timezone.utc).strftime("%I:%M %p")
            spawn_next_recurring_task(db, task, current_user.id)
        elif not data.is_completed and task.is_completed:
            task.is_completed = False
            task.completed_at = None
            task.completed_by = None
            if "completion_date" not in data.model_dump(exclude_unset=True):
                task.completion_date = None
            if "completion_time" not in data.model_dump(exclude_unset=True):
                task.completion_time = None

    task.updated_by = current_user.id
    
    # Tags handling
    if data.tag_ids is not None or data.tag_names is not None:
        db.query(TaskTagMap).filter(TaskTagMap.task_id == task.id).delete()
        tids_to_add = set(data.tag_ids or [])
        tnames = data.tag_names
        if tnames:
            for tname in tnames:
                tname = tname.strip()
                if not tname: continue
                tag = db.query(TaskTag).filter(TaskTag.name == tname).first()
                if not tag:
                    tag = TaskTag(name=tname)
                    db.add(tag)
                    db.commit()
                    db.refresh(tag)
                tids_to_add.add(tag.id)
                
        for tid in tids_to_add:
            db.add(TaskTagMap(task_id=task.id, tag_id=tid))

    db.add(task)
    db.commit()
    db.refresh(task)

    return _format_task_out(task, db)


@router.delete("/personal/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_personal_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a personal task"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal == True,
        Task.created_by == current_user.id,
        Task.is_deleted == False
    ).first()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")

    task.is_deleted = True
    task.updated_by = current_user.id
    _log_activity(db, task.id, current_user.id, "DELETED")
    
    db.add(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get task details by ID"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)
    return _format_task_out(task, db)


@router.patch("/{task_id}", response_model=TaskOut)
@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit", "tasks")),
):
    """Update task details / status transition"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    update_dict = data.model_dump(exclude_unset=True)

    # When child tasks / subtasks exist, Start Date/Time, Due Date/Time, and Duration are auto-calculated and read-only
    has_subtasks = db.query(Task).filter(Task.parent_task_id == task_id, Task.is_deleted.is_(False)).count() > 0
    if has_subtasks:
        for f in ("start_date", "start_time", "due_date", "due_time", "duration_working_days", "duration_working_hours"):
            update_dict.pop(f, None)

    old_due_date = task.due_date
    old_start_date = task.start_date
    old_task_list_id = task.task_list_id

    if "task_list_id" in update_dict and update_dict["task_list_id"]:
        from app.models.projects import ProjectTaskList
        tl = db.get(ProjectTaskList, update_dict["task_list_id"])
        if tl:
            task.milestone_id = tl.milestone_id
            task.project_id = tl.project_id

    # Reject dates with unreasonable year (e.g. year 0002 caused by scheduling bugs)
    if "start_date" in update_dict and update_dict["start_date"] and update_dict["start_date"].year < 1900:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date year is invalid. Please enter a valid date."
        )
    if "due_date" in update_dict and update_dict["due_date"] and update_dict["due_date"].year < 1900:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date year is invalid. Please enter a valid date."
        )

    # Bidirectional Date / Duration logic
    from app.services.calendar_service import (
        get_working_calendar as get_cal,
        walk_working_hours_forward,
        walk_working_hours_backward,
        count_working_hours,
        parse_hhmm_time,
    )
    from datetime import datetime
    cal = get_cal(db)
    daily_h = cal.daily_working_hours

    if "duration_working_hours" in update_dict and update_dict["duration_working_hours"] is not None:
        if update_dict["duration_working_hours"] >= daily_h:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duration hours ({update_dict['duration_working_hours']}h) must be less than daily working hours ({daily_h}h)."
            )

    dur_changed = "duration_working_days" in update_dict or "duration_working_hours" in update_dict
    if dur_changed:
        dur_days = update_dict.get("duration_working_days", task.duration_working_days) or 0
        dur_hours = update_dict.get("duration_working_hours", task.duration_working_hours) or 0
        if dur_days == 0 and dur_hours == 0:
            dur_days = 1
        task.duration_working_days = dur_days
        task.duration_working_hours = dur_hours
        total_dur = dur_days * daily_h + dur_hours

        if task.start_date:
            s_time = parse_hhmm_time(task.start_time, cal.work_start_time)
            s_dt = datetime.combine(task.start_date, s_time)
            calc_due = walk_working_hours_forward(s_dt, total_dur, cal)
            task.due_date = calc_due.date()
            task.due_time = calc_due.strftime("%H:%M")
        elif task.due_date:
            d_time = parse_hhmm_time(task.due_time, cal.work_end_time)
            d_dt = datetime.combine(task.due_date, d_time)
            calc_start = walk_working_hours_backward(d_dt, total_dur, cal)
            task.start_date = calc_start.date()
            task.start_time = calc_start.strftime("%H:%M")
    elif "start_date" in update_dict and "due_date" not in update_dict:
        # Start date manually changed
        new_start = update_dict["start_date"]
        task.start_date = new_start
        if new_start:
            s_time = parse_hhmm_time(update_dict.get("start_time", task.start_time), cal.work_start_time)
            task.start_time = s_time.strftime("%H:%M")
            dur_days = task.duration_working_days or 0
            dur_hours = task.duration_working_hours or 0
            if dur_days == 0 and dur_hours == 0:
                dur_days = 1
            total_dur = dur_days * daily_h + dur_hours
            s_dt = datetime.combine(new_start, s_time)
            calc_due = walk_working_hours_forward(s_dt, total_dur, cal)
            task.due_date = calc_due.date()
            task.due_time = calc_due.strftime("%H:%M")
        else:
            task.start_date = None
            task.due_date = None
            task.duration_working_days = 0
            task.duration_working_hours = 0
    elif "due_date" in update_dict and "start_date" not in update_dict:
        # Due date manually changed
        new_due = update_dict["due_date"]
        task.due_date = new_due
        if new_due:
            d_time = parse_hhmm_time(update_dict.get("due_time", task.due_time), cal.work_end_time)
            task.due_time = d_time.strftime("%H:%M")
            if task.start_date:
                s_time = parse_hhmm_time(task.start_time, cal.work_start_time)
                s_dt = datetime.combine(task.start_date, s_time)
                d_dt = datetime.combine(new_due, d_time)
                if d_dt < s_dt:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Due date cannot be earlier than start date"
                    )
                c_days, c_hours = count_working_hours(s_dt, d_dt, cal)
                task.duration_working_days = c_days
                task.duration_working_hours = c_hours
            else:
                dur_days = task.duration_working_days or 0
                dur_hours = task.duration_working_hours or 0
                if dur_days == 0 and dur_hours == 0:
                    dur_days = 1
                total_dur = dur_days * daily_h + dur_hours
                d_dt = datetime.combine(new_due, d_time)
                calc_start = walk_working_hours_backward(d_dt, total_dur, cal)
                task.start_date = calc_start.date()
                task.start_time = calc_start.strftime("%H:%M")
        else:
            task.start_date = None
            task.due_date = None
            task.duration_working_days = 0
            task.duration_working_hours = 0
    elif "start_date" in update_dict and "due_date" in update_dict:
        # Both start and due date explicitly provided
        new_start = update_dict["start_date"]
        new_due = update_dict["due_date"]
        if new_start and new_due and new_due < new_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date cannot be earlier than start date"
            )
        task.start_date = new_start
        task.due_date = new_due
        if new_start and new_due:
            s_time = parse_hhmm_time(update_dict.get("start_time", task.start_time), cal.work_start_time)
            d_time = parse_hhmm_time(update_dict.get("due_time", task.due_time), cal.work_end_time)
            task.start_time = s_time.strftime("%H:%M")
            task.due_time = d_time.strftime("%H:%M")
            s_dt = datetime.combine(new_start, s_time)
            d_dt = datetime.combine(new_due, d_time)
            c_days, c_hours = count_working_hours(s_dt, d_dt, cal)
            task.duration_working_days = c_days
            task.duration_working_hours = c_hours
        elif not new_start and not new_due:
            task.start_date = None
            task.due_date = None
            task.duration_working_days = 0
            task.duration_working_hours = 0
    elif "start_time" in update_dict and "start_date" not in update_dict and "due_date" not in update_dict and not dur_changed:
        new_start_time = update_dict["start_time"]
        if new_start_time:
            s_time = parse_hhmm_time(new_start_time, cal.work_start_time)
            task.start_time = s_time.strftime("%H:%M")
        else:
            task.start_time = None
        if task.start_date and task.due_date and task.start_time and task.due_time:
            s_time = parse_hhmm_time(task.start_time, cal.work_start_time)
            d_time = parse_hhmm_time(task.due_time, cal.work_end_time)
            s_dt = datetime.combine(task.start_date, s_time)
            d_dt = datetime.combine(task.due_date, d_time)
            if s_dt <= d_dt:
                c_days, c_hours = count_working_hours(s_dt, d_dt, cal)
                task.duration_working_days = c_days
                task.duration_working_hours = c_hours
    elif "due_time" in update_dict and "start_date" not in update_dict and "due_date" not in update_dict and not dur_changed:
        new_due_time = update_dict["due_time"]
        if new_due_time:
            d_time = parse_hhmm_time(new_due_time, cal.work_end_time)
            task.due_time = d_time.strftime("%H:%M")
        else:
            task.due_time = None
        if task.start_date and task.due_date and task.start_time and task.due_time:
            s_time = parse_hhmm_time(task.start_time, cal.work_start_time)
            d_time = parse_hhmm_time(task.due_time, cal.work_end_time)
            s_dt = datetime.combine(task.start_date, s_time)
            d_dt = datetime.combine(task.due_date, d_time)
            if s_dt <= d_dt:
                c_days, c_hours = count_working_hours(s_dt, d_dt, cal)
                task.duration_working_days = c_days
                task.duration_working_hours = c_hours

    # Reject dates that conflict with predecessor dependencies unless override_dependencies is requested
    if ("start_date" in update_dict or "due_date" in update_dict or "start_time" in update_dict or "due_time" in update_dict or "duration_working_days" in update_dict or "duration_working_hours" in update_dict) and not data.override_dependencies:
        from app.services.scheduling_engine import check_dependency_conflict
        conflict = check_dependency_conflict(db, task)
        if conflict and conflict.get("has_conflict"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=conflict["conflict_message"]
            )

    # Parent task due date manual shift check
    if "due_date" in update_dict and update_dict["due_date"] and update_dict["due_date"] != old_due_date:
        has_subtasks = db.query(Task).filter(Task.parent_task_id == task.id, Task.is_deleted.is_(False)).count() > 0
        if has_subtasks:
            from app.services.scheduling_engine import handle_parent_due_date_shift
            handle_parent_due_date_shift(db, task, update_dict["due_date"], current_user.id)

    if "title" in update_dict:
        if not update_dict["title"] or not update_dict["title"].strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task title cannot be blank")
        if task.title != update_dict["title"]:
            _log_activity(db, task.id, current_user.id, "TITLE_CHANGED", old_val=task.title, new_val=update_dict["title"])

    if "cost_center_id" in update_dict and update_dict["cost_center_id"]:
        cc = db.get(CostCenter, update_dict["cost_center_id"])
        if not cc or not cc.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_COST_CENTER", "message": "The selected cost center is invalid or inactive", "field": "cost_center_id"}
            )
        if task.cost_center_id != update_dict["cost_center_id"]:
            _log_activity(db, task.id, current_user.id, "COST_CENTER_CHANGED", old_val=task.cost_center_id, new_val=update_dict["cost_center_id"])

    if "parent_task_id" in update_dict and update_dict["parent_task_id"] != task.parent_task_id:
        if update_dict["parent_task_id"]:
            from app.services.scheduling_engine import validate_circular_dependency
            validate_circular_dependency(db, task.id, update_dict["parent_task_id"])
            depth = _get_task_depth(db, update_dict["parent_task_id"])
            if depth > 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Subtask depth exceeds maximum allowed limit of 3 levels"
                )

    # Status & completion change logic
    is_completion_requested = False
    is_start_or_active_requested = False

    if "is_completed" in update_dict and update_dict["is_completed"] is True:
        is_completion_requested = True
    elif "status_id" in update_dict and update_dict["status_id"] != task.status_id:
        new_status = db.get(TaskStatusDef, update_dict["status_id"])
        if new_status:
            if new_status.category in [TaskStatusCategory.DONE, TaskStatusCategory.CLOSED] or new_status.is_terminal:
                is_completion_requested = True
            elif new_status.category != TaskStatusCategory.NOT_STARTED:
                is_start_or_active_requested = True

    if (is_completion_requested or is_start_or_active_requested) and not task.is_completed:
        # Check if task is blocked by incomplete tasks
        blocking_deps = db.query(TaskDependency).filter(TaskDependency.task_id == task.id).all()
        incomplete_blockers = []
        for dep in blocking_deps:
            if dep.depends_on_task and not dep.depends_on_task.is_deleted and not dep.depends_on_task.is_completed:
                incomplete_blockers.append(dep.depends_on_task.task_number)

        if incomplete_blockers and not data.override_dependencies:
            action_type = "finish" if is_completion_requested else "start"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "TASK_BLOCKED",
                    "message": f"Task {task.task_number} is blocked by incomplete task(s): {', '.join(incomplete_blockers)}. Predecessor must be completed before this task can {action_type}.",
                    "blocking_tasks": incomplete_blockers
                }
            )

    if is_completion_requested and not task.is_completed:

        task.is_completed = True
        task.completed_at = datetime.now(timezone.utc)
        task.completed_by = current_user.id
        if not task.completion_date and "completion_date" not in update_dict:
            task.completion_date = datetime.now(timezone.utc).date()
        if not task.completion_time and "completion_time" not in update_dict:
            task.completion_time = datetime.now(timezone.utc).strftime("%I:%M %p")
            
        task.progress_percentage = 100.0
            
        spawn_next_recurring_task(db, task, current_user.id)

        # Notify downstream dependent tasks that they are unblocked
        dependents = db.query(TaskDependency).filter(TaskDependency.depends_on_task_id == task.id).all()
        for dep in dependents:
            blocked_t = dep.task
            if blocked_t and not blocked_t.is_deleted and blocked_t.assignee_id:
                other_blockers = db.query(TaskDependency).filter(
                    TaskDependency.task_id == blocked_t.id,
                    TaskDependency.depends_on_task_id != task.id
                ).all()
                still_blocked = any(d.depends_on_task and not d.depends_on_task.is_completed for d in other_blockers)
                if not still_blocked:
                    db.add(Notification(
                        user_id=blocked_t.assignee_id,
                        message=f"Task {blocked_t.task_number}: {blocked_t.title} is now UNBLOCKED!"
                    ))

    elif "is_completed" in update_dict and update_dict["is_completed"] is False:
        task.is_completed = False
        task.completed_at = None
        task.completed_by = None
        if "completion_date" not in update_dict:
            task.completion_date = None
        if "completion_time" not in update_dict:
            task.completion_time = None
    elif "status_id" in update_dict and update_dict["status_id"] != task.status_id:
        new_status = db.get(TaskStatusDef, update_dict["status_id"])
        old_status_name = task.status_def.name if task.status_def else None
        new_status_name = new_status.name if new_status else None
        if new_status and not (new_status.category in [TaskStatusCategory.DONE, TaskStatusCategory.CLOSED] or new_status.is_terminal):
            task.is_completed = False
            task.completed_at = None
            task.completed_by = None
            if "completion_date" not in update_dict:
                task.completion_date = None
            if "completion_time" not in update_dict:
                task.completion_time = None
        _log_activity(db, task.id, current_user.id, "STATUS_CHANGED", old_val=old_status_name, new_val=new_status_name)

    if "priority" in update_dict and update_dict["priority"] != task.priority:
        _log_activity(db, task.id, current_user.id, "PRIORITY_CHANGED", old_val=task.priority, new_val=update_dict["priority"])

    if "due_date" in update_dict and update_dict["due_date"] != old_due_date:
        _log_activity(db, task.id, current_user.id, "DUE_DATE_CHANGED", old_val=old_due_date, new_val=update_dict["due_date"])

    # Update task fields
    task.updated_by = current_user.id
    for field, val in update_dict.items():
        if field not in ["assignee_ids", "follower_ids", "tag_ids", "tag_names", "override_dependencies", "edit_series"]:
            setattr(task, field, val)
            
    # Apply series update logic if edit_series is True
    if update_dict.get("edit_series") and (task.recurring_task_id or task.recurrence_rule):
        series_id = task.recurring_task_id or task.id
        future_occurrences = db.query(Task).filter(
            (Task.recurring_task_id == series_id) | (Task.id == series_id),
            Task.is_completed == False,
            Task.is_deleted == False,
            Task.id != task.id
        ).all()
        for ft in future_occurrences:
            for field, val in update_dict.items():
                if field not in ["assignee_ids", "follower_ids", "tag_ids", "tag_names", "override_dependencies", "edit_series", "is_completed", "completion_date", "completion_time", "status_id", "start_date", "due_date"]:
                    setattr(ft, field, val)

    # Multi assignees update
    if "assignee_ids" in update_dict and update_dict["assignee_ids"] is not None:
        db.query(TaskAssignee).filter(TaskAssignee.task_id == task.id).delete()
        for uid in set(update_dict["assignee_ids"]):
            db.add(TaskAssignee(task_id=task.id, user_id=uid, assigned_by=current_user.id))
            if not db.query(TaskFollower).filter(TaskFollower.task_id == task.id, TaskFollower.user_id == uid).first():
                db.add(TaskFollower(task_id=task.id, user_id=uid))

    # Followers update
    if "follower_ids" in update_dict and update_dict["follower_ids"] is not None:
        db.query(TaskFollower).filter(TaskFollower.task_id == task.id).delete()
        for fid in set(update_dict["follower_ids"]):
            db.add(TaskFollower(task_id=task.id, user_id=fid))

    # Tags update
    if "tag_ids" in update_dict or "tag_names" in update_dict:
        db.query(TaskTagMap).filter(TaskTagMap.task_id == task.id).delete()
        tids_to_add = set(update_dict.get("tag_ids") or [])
        tnames = update_dict.get("tag_names")
        if tnames:
            for tname in tnames:
                tname = tname.strip()
                if not tname: continue
                tag = db.query(TaskTag).filter(TaskTag.name == tname).first()
                if not tag:
                    tag = TaskTag(name=tname)
                    db.add(tag)
                    db.commit()
                    db.refresh(tag)
                tids_to_add.add(tag.id)
                
        for tid in tids_to_add:
            db.add(TaskTagMap(task_id=task.id, tag_id=tid))

    db.commit()
    db.refresh(task)

    from app.services.scheduling_engine import propagate_task_schedule_changes
    propagate_task_schedule_changes(db, task.id, current_user.id)

    if "task_list_id" in update_dict and old_task_list_id and old_task_list_id != task.task_list_id:
        from app.services.rollup_service import rollup_task_list
        rollup_task_list(db, old_task_list_id)
    if task.task_list_id:
        from app.services.rollup_service import rollup_task_list
        rollup_task_list(db, task.task_list_id)

    if task.parent_task_id:
        from app.services.rollup_service import rollup_work_item
        rollup_work_item(db, task.parent_task_id)

    if task.project_id:
        from app.services.rollup_service import rollup_project
        rollup_project(db, task.project_id)

    db.commit()
    db.refresh(task)

    if task.parent_task_id:
        _update_parent_progress(db, task.parent_task_id)
        _sync_parent_due_date(db, task.parent_task_id)
        db.commit()

    return _format_task_out(task, db)



@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delete", "tasks")),
):
    """Soft delete a task and all its nested descendant subtasks, updating parent rollups"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)
    
    parent_id = task.parent_task_id
    task_list_id = task.task_list_id
    milestone_id = task.milestone_id
    project_id = task.project_id

    task.is_deleted = True
    _log_activity(db, task.id, current_user.id, "DELETED")

    # Soft delete all child & descendant subtasks recursively
    def _soft_delete_descendants(p_id: int):
        child_subtasks = db.query(Task).filter(Task.parent_task_id == p_id, Task.is_deleted.is_(False)).all()
        for child in child_subtasks:
            child.is_deleted = True
            _log_activity(db, child.id, current_user.id, "DELETED")
            _soft_delete_descendants(child.id)

    _soft_delete_descendants(task.id)
    db.commit()

    from app.services.rollup_service import rollup_work_item, rollup_task_list, rollup_milestone, rollup_project

    if parent_id:
        rollup_work_item(db, parent_id)
        _update_parent_progress(db, parent_id)
        _sync_parent_due_date(db, parent_id)
        db.commit()

    if task_list_id:
        rollup_task_list(db, task_list_id)
        db.commit()

    if milestone_id:
        rollup_milestone(db, milestone_id)
        db.commit()

    if project_id:
        rollup_project(db, project_id)
        db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)



# --- Subtasks API ---

@router.put("/subtasks/{subtask_id}/toggle", response_model=TaskSubtaskOut)
def toggle_legacy_subtask(
    subtask_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy subtask toggle compatibility endpoint"""
    subtask = db.get(TaskSubtask, subtask_id)
    if subtask:
        subtask.is_completed = not subtask.is_completed
        db.commit()
        db.refresh(subtask)
        return TaskSubtaskOut.model_validate(subtask)

    # Or toggle task entity subtask
    task = db.get(Task, subtask_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")
    task.is_completed = not task.is_completed
    if task.is_completed:
        task.completed_at = datetime.now(timezone.utc)
        task.completed_by = current_user.id
        if not task.completion_date:
            task.completion_date = datetime.now(timezone.utc).date()
        if not task.completion_time:
            task.completion_time = datetime.now(timezone.utc).strftime("%I:%M %p")
    else:
        task.completed_at = None
        task.completed_by = None
        task.completion_date = None
        task.completion_time = None
    db.commit()
    db.refresh(task)
    return TaskSubtaskOut(
        id=task.id,
        task_id=task.parent_task_id or task.id,
        title=task.title,
        is_completed=task.is_completed,
        display_order=0,
        created_at=task.created_at
    )


@router.delete("/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtask(
    subtask_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a subtask (compatible with legacy TaskSubtask and ClickUp Task entity subtasks)"""
    # 1. Legacy TaskSubtask table check
    legacy_subtask = db.get(TaskSubtask, subtask_id)
    if legacy_subtask:
        parent_id = legacy_subtask.task_id
        db.delete(legacy_subtask)
        db.commit()
        if parent_id:
            _update_parent_progress(db, parent_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # 2. ClickUp Task entity subtask check
    task = db.get(Task, subtask_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    parent_id = task.parent_task_id
    task.is_deleted = True
    _log_activity(db, task.id, current_user.id, "DELETED")

    # Soft delete any nested child subtasks under this subtask
    child_subtasks = db.query(Task).filter(Task.parent_task_id == task.id, Task.is_deleted.is_(False)).all()
    for child in child_subtasks:
        child.is_deleted = True
        _log_activity(db, child.id, current_user.id, "DELETED")

    db.commit()

    if parent_id:
        _update_parent_progress(db, parent_id)
        _sync_parent_due_date(db, parent_id)
        db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)



@router.post("/{task_id}/subtasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def add_subtask(
    task_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a subtask under a parent task"""
    parent = db.get(Task, task_id)
    if not parent or parent.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent task not found")
    
    data.parent_task_id = task_id
    if not data.project_id:
        data.project_id = parent.project_id
    
    # Also save legacy TaskSubtask record for backwards compatibility
    legacy_st = TaskSubtask(task_id=task_id, title=data.title)
    db.add(legacy_st)
    
    return create_task(data, db, current_user)


# --- Legacy Time Log Endpoints ---

@router.post("/{task_id}/timelogs", response_model=TaskTimeLogOut, status_code=status.HTTP_201_CREATED)
def log_time_legacy(
    task_id: int,
    data: TaskTimeLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    log = TaskTimeLog(task_id=task.id, user_id=current_user.id, hours=data.hours, log_date=data.log_date, description=data.description)
    task.actual_hours += log.hours
    task.actual_minutes += int(log.hours * 60)
    db.add(log)
    db.add(task)
    db.commit()
    db.refresh(log)

    out = TaskTimeLogOut.model_validate(log)
    out.user_name = current_user.full_name
    return out


@router.get("/{task_id}/timelogs", response_model=List[TaskTimeLogOut])
def get_task_timelogs_legacy(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    logs = db.query(TaskTimeLog).filter(TaskTimeLog.task_id == task_id).order_by(TaskTimeLog.created_at.desc()).all()
    results = []
    for l in logs:
        out = TaskTimeLogOut.model_validate(l)
        out.user_name = l.user.full_name if l.user else None
        results.append(out)
    return results



# --- Checklist API ---

@router.post("/{task_id}/checklists", response_model=TaskChecklistOut, status_code=status.HTTP_201_CREATED)
def create_checklist(
    task_id: int,
    data: TaskChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    checklist = TaskChecklist(task_id=task.id, title=data.title.strip(), display_order=data.display_order)
    db.add(checklist)
    db.commit()
    db.refresh(checklist)

    for item_data in data.items:
        ci = TaskChecklistItem(
            checklist_id=checklist.id,
            title=item_data.title.strip(),
            assignee_id=item_data.assignee_id,
            due_date=item_data.due_date,
            display_order=item_data.display_order,
        )
        db.add(ci)

    db.commit()
    db.refresh(checklist)
    _log_activity(db, task.id, current_user.id, "CHECKLIST_CREATED", new_val=checklist.title)

    c_items = []
    comp_cnt = 0
    for item in checklist.items:
        if item.is_completed:
            comp_cnt += 1
        c_items.append(TaskChecklistItemOut(
            id=item.id,
            checklist_id=item.checklist_id,
            title=item.title,
            is_completed=item.is_completed,
            assignee_id=item.assignee_id,
            due_date=item.due_date,
            display_order=item.display_order,
            completed_at=item.completed_at,
            completed_by=item.completed_by,
            assignee=UserBriefOut.model_validate(item.assignee) if item.assignee else None,
            created_at=item.created_at,
        ))

    return TaskChecklistOut(
        id=checklist.id,
        task_id=checklist.task_id,
        title=checklist.title,
        display_order=checklist.display_order,
        items=c_items,
        completed_count=comp_cnt,
        total_count=len(c_items),
        created_at=checklist.created_at,
    )


@router.post("/checklists/{checklist_id}/items", response_model=TaskChecklistItemOut, status_code=status.HTTP_201_CREATED)
def add_checklist_item(
    checklist_id: int,
    data: TaskChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checklist = db.get(TaskChecklist, checklist_id)
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")

    ci = TaskChecklistItem(
        checklist_id=checklist.id,
        title=data.title.strip(),
        assignee_id=data.assignee_id,
        due_date=data.due_date,
        display_order=data.display_order,
    )
    db.add(ci)
    db.commit()
    db.refresh(ci)

    return TaskChecklistItemOut(
        id=ci.id,
        checklist_id=ci.checklist_id,
        title=ci.title,
        is_completed=ci.is_completed,
        assignee_id=ci.assignee_id,
        due_date=ci.due_date,
        display_order=ci.display_order,
        completed_at=ci.completed_at,
        completed_by=ci.completed_by,
        assignee=UserBriefOut.model_validate(ci.assignee) if ci.assignee else None,
        created_at=ci.created_at,
    )


@router.put("/checklist-items/{item_id}/toggle", response_model=TaskChecklistItemOut)
def toggle_checklist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(TaskChecklistItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found")

    item.is_completed = not item.is_completed
    if item.is_completed:
        item.completed_at = datetime.now(timezone.utc)
        item.completed_by = current_user.id
    else:
        item.completed_at = None
        item.completed_by = None

    db.commit()
    db.refresh(item)
    return TaskChecklistItemOut(
        id=item.id,
        checklist_id=item.checklist_id,
        title=item.title,
        is_completed=item.is_completed,
        assignee_id=item.assignee_id,
        due_date=item.due_date,
        display_order=item.display_order,
        completed_at=item.completed_at,
        completed_by=item.completed_by,
        assignee=UserBriefOut.model_validate(item.assignee) if item.assignee else None,
        created_at=item.created_at,
    )


@router.post("/checklist-items/{item_id}/convert-to-subtask", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def convert_checklist_item_to_subtask(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert a checklist item into a full subtask"""
    item = db.get(TaskChecklistItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found")

    checklist = item.checklist
    parent_task = checklist.task

    subtask_data = TaskCreate(
        title=item.title,
        project_id=parent_task.project_id,
        parent_task_id=parent_task.id,
        assignee_id=item.assignee_id or current_user.id,
        due_date=item.due_date,
    )
    new_subtask = create_task(subtask_data, db, current_user)
    db.delete(item)
    db.commit()

    return new_subtask


# --- Time Tracking API ---

@router.post("/{task_id}/timer/start", response_model=TaskTimeEntryOut)
def start_timer(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start stopwatch timer for current user on task"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    # Check active timer
    active = db.query(TaskTimeEntry).filter(
        TaskTimeEntry.user_id == current_user.id,
        TaskTimeEntry.ended_at.is_(None)
    ).first()
    if active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Active timer already running on task ID {active.task_id}. Stop it before starting a new timer."
        )

    entry = TaskTimeEntry(
        task_id=task.id,
        user_id=current_user.id,
        started_at=datetime.now(timezone.utc)
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    out = TaskTimeEntryOut.model_validate(entry)
    out.user_name = current_user.full_name
    return out


@router.post("/{task_id}/timer/stop", response_model=TaskTimeEntryOut)
def stop_timer(
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
    duration = int((now - start_dt).total_seconds() / 60)
    entry.duration_minutes = max(1, duration)
    if description:
        entry.description = description

    task = db.get(Task, task_id)
    if task:
        task.actual_minutes += entry.duration_minutes
        task.actual_hours = round(task.actual_minutes / 60.0, 2)
        db.add(task)

    db.commit()
    db.refresh(entry)

    out = TaskTimeEntryOut.model_validate(entry)
    out.user_name = current_user.full_name
    return out


@router.post("/{task_id}/time-entries", response_model=TaskTimeEntryOut, status_code=status.HTTP_201_CREATED)
def add_manual_time_entry(
    task_id: int,
    data: TaskTimeEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    ended = data.ended_at or datetime.now(timezone.utc)
    duration = data.duration_minutes
    if duration <= 0 and data.started_at and ended:
        duration = int((ended - data.started_at).total_seconds() / 60)

    entry = TaskTimeEntry(
        task_id=task.id,
        user_id=current_user.id,
        started_at=data.started_at,
        ended_at=ended,
        duration_minutes=max(1, duration),
        description=data.description
    )
    task.actual_minutes += entry.duration_minutes
    task.actual_hours = round(task.actual_minutes / 60.0, 2)

    db.add(entry)
    db.add(task)
    db.commit()
    db.refresh(entry)

    out = TaskTimeEntryOut.model_validate(entry)
    out.user_name = current_user.full_name
    return out


# --- Comments & Mentions API ---

@router.post("/{task_id}/comments", response_model=TaskCommentOut, status_code=status.HTTP_201_CREATED)
def add_task_comment(
    task_id: int,
    data: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    if not data.content or not data.content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment content cannot be empty")

    comment = TaskComment(task_id=task.id, user_id=current_user.id, content=data.content.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Mentions dispatches
    _parse_and_notify_mentions(db, comment.content, task, current_user)
    _log_activity(db, task.id, current_user.id, "COMMENT_ADDED", new_val=comment.content[:50])

    db.commit()

    out = TaskCommentOut.model_validate(comment)
    out.user_name = current_user.full_name
    out.user_photo = current_user.profile_photo
    return out


@router.get("/{task_id}/comments", response_model=List[TaskCommentOut])
def get_task_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    comments = db.query(TaskComment).filter(
        TaskComment.task_id == task_id,
        TaskComment.deleted_at.is_(None)
    ).order_by(TaskComment.created_at.asc()).all()

    results = []
    for c in comments:
        out = TaskCommentOut.model_validate(c)
        out.user_name = c.user.full_name if c.user else None
        out.user_photo = c.user.profile_photo if c.user else None
        results.append(out)
    return results


# --- Attachments API ---

@router.post("/{task_id}/attachments", response_model=TaskAttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_task_attachment(
    task_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload physical task file attachment or JSON attachment record"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        filename = body.get("filename", "attachment")
        file_size_str = body.get("file_size", "0 KB")
        file_url = body.get("file_url", "")
        attachment = TaskAttachment(
            task_id=task.id,
            uploaded_by=current_user.id,
            filename=filename,
            file_size=file_size_str,
            mime_type="application/octet-stream",
            file_url=file_url,
        )
    else:
        form = await request.form()
        file = form.get("file")
        if not file or not hasattr(file, "filename"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is required")
        filename = file.filename or "attachment"
        ext = os.path.splitext(filename)[1]
        unique_name = f"{task_id}_{uuid.uuid4().hex[:8]}{ext}"
        dest_path = os.path.join(UPLOAD_DIR, unique_name)
        content = await file.read()
        file_size_str = f"{round(len(content) / 1024.0, 1)} KB"
        with open(dest_path, "wb") as f:
            f.write(content)
        rel_url = f"/uploads/tasks/{unique_name}"
        attachment = TaskAttachment(
            task_id=task.id,
            uploaded_by=current_user.id,
            filename=filename,
            file_size=file_size_str,
            mime_type=getattr(file, "content_type", "application/octet-stream"),
            storage_path=dest_path,
            file_url=rel_url,
        )

    db.add(attachment)
    _log_activity(db, task.id, current_user.id, "ATTACHMENT_ADDED", new_val=filename)
    db.commit()
    db.refresh(attachment)

    out = TaskAttachmentOut.model_validate(attachment)
    out.uploader_name = current_user.full_name
    return out



@router.post("/{task_id}/attachments/meta", response_model=TaskAttachmentOut, status_code=status.HTTP_201_CREATED)
def add_task_attachment_meta(
    task_id: int,
    data: TaskAttachmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add attachment record via JSON payload"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    attachment = TaskAttachment(
        task_id=task.id,
        uploaded_by=current_user.id,
        filename=data.filename,
        file_size=data.file_size,
        mime_type="application/octet-stream",
        storage_path=data.storage_path,
        file_url=data.file_url,
    )
    db.add(attachment)
    _log_activity(db, task.id, current_user.id, "ATTACHMENT_ADDED", new_val=data.filename)
    db.commit()
    db.refresh(attachment)

    out = TaskAttachmentOut.model_validate(attachment)
    out.uploader_name = current_user.full_name
    return out



@router.get("/{task_id}/attachments", response_model=List[TaskAttachmentOut])
def get_task_attachments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    atts = db.query(TaskAttachment).filter(TaskAttachment.task_id == task_id).order_by(TaskAttachment.created_at.desc()).all()
    res = []
    for a in atts:
        out = TaskAttachmentOut.model_validate(a)
        out.uploader_name = a.uploader.full_name if a.uploader else None
        res.append(out)
    return res


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = db.get(TaskAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    if attachment.storage_path and os.path.exists(attachment.storage_path):
        try:
            os.remove(attachment.storage_path)
        except OSError:
            pass

    _log_activity(db, attachment.task_id, current_user.id, "ATTACHMENT_REMOVED", old_val=attachment.filename)
    db.delete(attachment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Dependencies & Relationships API ---

@router.post("/{task_id}/dependencies", response_model=TaskDependencyOut, status_code=status.HTTP_201_CREATED)
def create_task_dependency(
    task_id: int,
    data: TaskDependencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    # Support both old field (depends_on_task_id) and new field (predecessor_task_id)
    target_task_id = getattr(data, 'depends_on_task_id', None) or getattr(data, 'predecessor_task_id', None)
    if not target_task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="predecessor_task_id is required")

    target_task = db.get(Task, target_task_id)
    if not target_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target task not found")
    
    # Optional: check if user can access target task
    _get_task_or_404_with_auth(db, target_task_id, current_user)

    # Cross-project dependency block
    if task.project_id != target_task.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dependencies between tasks in different projects are not allowed."
        )

    direction = getattr(data, 'direction', None)
    if direction == "BLOCKING":
        blocked_id = target_task.id
        blocking_id = task.id
        target_display = target_task
    else:
        # task_id IS BLOCKED BY target_task (default BLOCKED_BY)
        blocked_id = task.id
        blocking_id = target_task.id
        target_display = target_task

    from app.services.scheduling_engine import validate_circular_dependency, validate_parent_child_dependency, propagate_task_schedule_changes
    validate_circular_dependency(db, blocked_id, blocking_id)
    validate_parent_child_dependency(db, blocked_id, blocking_id)

    existing_dep = db.query(TaskDependency).filter(
        TaskDependency.task_id == blocked_id,
        TaskDependency.depends_on_task_id == blocking_id
    ).first()

    if existing_dep:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dependency relationship already exists")

    # Resolve dep_type (FS/SS/FF/SF)
    dep_type_val = getattr(data, 'dep_type', 'FS') or 'FS'
    lag = getattr(data, 'lag_days', 0) or 0
    lag_h = getattr(data, 'lag_hours', 0) or 0

    from app.services.calendar_service import get_working_calendar
    calendar = get_working_calendar(db)
    if lag_h >= calendar.daily_working_hours:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lag hours ({lag_h}h) must be less than daily working hours ({calendar.daily_working_hours}h)."
        )

    dep = TaskDependency(
        task_id=blocked_id,
        depends_on_task_id=blocking_id,
        dependency_type=getattr(data, 'dependency_type', DependencyType.BLOCKS) or DependencyType.BLOCKS,
        pm_dep_type=dep_type_val,
        lag_days=lag,
        lag_hours=lag_h,
    )
    db.add(dep)
    _log_activity(db, task.id, current_user.id, "DEPENDENCY_ADDED", new_val=f"{target_display.task_number} ({dep_type_val}+{lag}d {lag_h}h)")
    db.commit()
    db.refresh(dep)

    # Automatically propagate dependency schedule to successor
    propagate_task_schedule_changes(db, blocking_id, current_user.id)
    db.commit()

    blocker = db.get(Task, blocking_id)
    return TaskDependencyOut(
        id=dep.id,
        task_id=dep.task_id,
        depends_on_task_id=dep.depends_on_task_id,
        depends_on_task_number=blocker.task_number if blocker else None,
        depends_on_task_title=blocker.title if blocker else None,
        depends_on_status_name=blocker.status_def.name if blocker and blocker.status_def else None,
        depends_on_priority=blocker.priority.value if blocker and hasattr(blocker.priority, 'value') else str(blocker.priority) if blocker else None,
        depends_on_due_date=blocker.due_date if blocker else None,
        depends_on_is_completed=blocker.is_completed if blocker else False,
        direction=direction or "BLOCKED_BY",
        dependency_type=dep.dependency_type,
        predecessor_task_id=blocking_id,
        predecessor_task_number=blocker.task_number if blocker else None,
        predecessor_task_title=blocker.title if blocker else None,
        dep_type=dep_type_val,
        lag_days=lag,
        lag_hours=lag_h,
        created_at=dep.created_at,
    )


@router.patch("/dependencies/{dependency_id}", response_model=TaskDependencyOut)
def update_task_dependency(
    dependency_id: int,
    data: TaskDependencyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing dependency's type and/or lag days + hours"""
    dep = db.get(TaskDependency, dependency_id)
    if not dep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")

    if data.dep_type is not None:
        dep.pm_dep_type = data.dep_type
    if data.lag_days is not None:
        dep.lag_days = data.lag_days
    if data.lag_hours is not None:
        from app.services.calendar_service import get_working_calendar
        calendar = get_working_calendar(db)
        if data.lag_hours >= calendar.daily_working_hours:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lag hours ({data.lag_hours}h) must be less than daily working hours ({calendar.daily_working_hours}h)."
            )
        dep.lag_hours = data.lag_hours

    _log_activity(db, dep.task_id, current_user.id, "DEPENDENCY_UPDATED",
                  new_val=f"{dep.pm_dep_type}+{dep.lag_days}d {dep.lag_hours}h")
    db.commit()
    db.refresh(dep)

    from app.services.scheduling_engine import propagate_task_schedule_changes
    propagate_task_schedule_changes(db, dep.depends_on_task_id, current_user.id)
    db.commit()

    blocker = db.get(Task, dep.depends_on_task_id)
    return TaskDependencyOut(
        id=dep.id,
        task_id=dep.task_id,
        depends_on_task_id=dep.depends_on_task_id,
        depends_on_task_number=blocker.task_number if blocker else None,
        depends_on_task_title=blocker.title if blocker else None,
        depends_on_is_completed=blocker.is_completed if blocker else False,
        direction="BLOCKED_BY",
        dependency_type=dep.dependency_type,
        predecessor_task_id=dep.depends_on_task_id,
        predecessor_task_number=blocker.task_number if blocker else None,
        predecessor_task_title=blocker.title if blocker else None,
        dep_type=getattr(dep.pm_dep_type, 'value', str(dep.pm_dep_type)) if dep.pm_dep_type else "FS",
        lag_days=dep.lag_days or 0,
        lag_hours=dep.lag_hours or 0,
        created_at=dep.created_at,
    )


@router.delete("/dependencies/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{task_id}/dependencies/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_dependency(
    dependency_id: int,
    task_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dep = db.get(TaskDependency, dependency_id)
    if not dep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")

    _log_activity(db, dep.task_id, current_user.id, "DEPENDENCY_REMOVED")
    db.delete(dep)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{task_id}/auto-adjust-date", response_model=TaskOut)
def auto_adjust_task_date_endpoint(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Auto Adjust Date endpoint to resolve dependency conflicts on task_id"""
    _get_task_or_404_with_auth(db, task_id, current_user)
    from app.services.scheduling_engine import auto_adjust_task_dates
    task = auto_adjust_task_dates(db, task_id, current_user.id)
    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


# --- Bulk Actions API ---

@router.post("/bulk-action", response_model=BulkTaskActionResponse)
def bulk_task_action(
    req: BulkTaskActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = []
    for tid in req.task_ids:
        tasks.append(_get_task_or_404_with_auth(db, tid, current_user))
        
    if not tasks:
        return BulkTaskActionResponse(success=False, affected_count=0, message="No matching tasks found")

    affected = 0
    for t in tasks:
        if req.action == "change_status" and req.status_id:
            t.status_id = req.status_id
            _log_activity(db, t.id, current_user.id, "BULK_STATUS_CHANGE")
            affected += 1
        elif req.action == "set_priority" and req.priority:
            t.priority = req.priority
            _log_activity(db, t.id, current_user.id, "BULK_PRIORITY_CHANGE")
            affected += 1
        elif req.action == "assign" and req.assignee_id:
            t.assignee_id = req.assignee_id
            db.add(TaskAssignee(task_id=t.id, user_id=req.assignee_id, assigned_by=current_user.id))
            affected += 1
        elif req.action == "set_dates":
            if req.start_date:
                t.start_date = req.start_date
            if req.due_date:
                t.due_date = req.due_date
            affected += 1
        elif req.action == "archive":
            t.is_archived = True
            affected += 1
        elif req.action == "delete":
            t.is_deleted = True
            affected += 1

    db.commit()
    return BulkTaskActionResponse(
        success=True,
        affected_count=affected,
        message=f"Successfully applied {req.action} on {affected} task(s)."
    )


# --- Activity Log API ---

@router.get("/{task_id}/activities", response_model=List[TaskActivityOut])
def get_task_activities(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activities = db.query(TaskActivity).filter(TaskActivity.task_id == task_id).order_by(TaskActivity.created_at.desc()).all()
    res = []
    for a in activities:
        res.append(TaskActivityOut(
            id=a.id,
            task_id=a.task_id,
            actor_id=a.actor_id,
            actor_name=a.actor.full_name if a.actor else None,
            action=a.action,
            field_name=a.field_name,
            old_value=a.old_value,
            new_value=a.new_value,
            created_at=a.created_at,
        ))
    return res


# --- Task Custom Fields Values API ---

@router.get("/{task_id}/custom-fields", response_model=List[CustomFieldValueOut])
def get_task_custom_fields(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    values = db.query(TaskCustomFieldValue).filter(TaskCustomFieldValue.task_id == task_id).all()
    results = []
    for val in values:
        field_def = db.get(TaskCustomFieldDefinition, val.field_id)
        results.append(CustomFieldValueOut(
            id=val.id,
            field_id=val.field_id,
            field_label=field_def.label if field_def else f"Field {val.field_id}",
            value=val.value
        ))
    return results


@router.post("/{task_id}/custom-fields", response_model=CustomFieldValueOut)
def save_task_custom_field(
    task_id: int,
    data: CustomFieldValueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    field_def = db.get(TaskCustomFieldDefinition, data.field_id)
    if not field_def:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom field definition not found")

    val = db.query(TaskCustomFieldValue).filter(
        TaskCustomFieldValue.task_id == task_id,
        TaskCustomFieldValue.field_id == data.field_id
    ).first()

    if val:
        val.value = data.value
    else:
        val = TaskCustomFieldValue(task_id=task_id, field_id=data.field_id, value=data.value)
        db.add(val)

    db.commit()
    db.refresh(val)
    return CustomFieldValueOut(
        id=val.id,
        field_id=val.field_id,
        field_label=field_def.label,
        value=val.value
    )


# --- Subtask & Dependency Workflow Endpoints ---

@router.post("/{task_id}/convert-to-task", response_model=TaskOut)
def convert_subtask_to_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert a subtask to a top-level task (parent_task_id = None)"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    old_parent_id = task.parent_task_id
    task.parent_task_id = None
    task.updated_by = current_user.id
    db.add(task)
    _log_activity(db, task.id, current_user.id, "CONVERTED_TO_TOP_LEVEL_TASK")
    db.commit()
    db.refresh(task)

    if old_parent_id:
        _update_parent_progress(db, old_parent_id)
        _sync_parent_due_date(db, old_parent_id)
        db.commit()

    return _format_task_out(task, db)


@router.post("/{task_id}/convert-to-subtask", response_model=TaskOut)
def convert_task_to_subtask(
    task_id: int,
    data: TaskConvertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert a task to a subtask under target_parent_id"""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    if not data.target_parent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="target_parent_id is required")

    target_parent = db.get(Task, data.target_parent_id)
    if not target_parent or target_parent.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target parent task not found")

    # Anti-circular parent check
    if task_id == data.target_parent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A task cannot be its own parent")

    curr_id = data.target_parent_id
    visited = set()
    depth = 1
    while curr_id:
        if curr_id == task_id or curr_id in visited:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot make task a subtask because it would create a circular parent hierarchy"
            )
        visited.add(curr_id)
        parent = db.get(Task, curr_id)
        if not parent:
            break
        depth += 1
        if depth > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exceeded maximum nesting depth of 5 levels"
            )
        curr_id = parent.parent_task_id

    old_parent_id = task.parent_task_id
    task.parent_task_id = data.target_parent_id
    task.updated_by = current_user.id
    db.add(task)
    _log_activity(db, task.id, current_user.id, "CONVERTED_TO_SUBTASK", new_val=target_parent.task_number)
    db.commit()
    db.refresh(task)

    if old_parent_id:
        _update_parent_progress(db, old_parent_id)
        _sync_parent_due_date(db, old_parent_id)
    _update_parent_progress(db, data.target_parent_id)
    _sync_parent_due_date(db, data.target_parent_id)
    db.commit()

    return _format_task_out(task, db)


@router.post("/reorder", status_code=status.HTTP_200_OK)
def reorder_tasks(
    data: TaskReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch reorder tasks among siblings (controls display sort_order only)"""
    for idx, tid in enumerate(data.sibling_ids):
        t = db.get(Task, tid)
        if t and not t.is_deleted:
            t.sort_order = idx
            db.add(t)
    db.commit()
    return {"message": "Tasks reordered successfully"}


@router.post("/{task_id}/reorder-subtasks", status_code=status.HTTP_200_OK)
def reorder_subtasks(
    task_id: int,
    data: TaskReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reorder subtasks within parent task_id"""
    for idx, sib_id in enumerate(data.sibling_ids):
        sub = db.get(Task, sib_id)
        if sub and sub.parent_task_id == task_id:
            sub.sort_order = idx
            db.add(sub)
    db.commit()
    return {"message": "Subtasks reordered successfully"}


@router.get("/{task_id}/cascade-preview", response_model=CascadePreviewOut)
def cascade_preview(
    task_id: int,
    days_shift: int = Query(0, description="Signed day offset to preview cascade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dry-run cascade reschedule — returns which tasks would move without committing."""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    if days_shift == 0:
        return CascadePreviewOut(total_affected=0, items=[])

    holiday_dates, weekly_off_days = _get_working_calendar(db)
    items: list[CascadePreviewItem] = []
    visited: set = set()

    def _preview_downstream(tid: int, shift: int):
        if tid in visited:
            return
        visited.add(tid)
        deps = db.query(TaskDependency).filter(TaskDependency.depends_on_task_id == tid).all()
        for d in deps:
            blocked_t = d.task
            if blocked_t and not blocked_t.is_deleted and blocked_t.id not in visited:
                new_start = None
                new_due = None
                if blocked_t.start_date:
                    new_start = _add_working_days(blocked_t.start_date, shift, holiday_dates, weekly_off_days)
                if blocked_t.due_date:
                    new_due = _add_working_days(blocked_t.due_date, shift, holiday_dates, weekly_off_days)
                items.append(CascadePreviewItem(
                    task_id=blocked_t.id,
                    task_number=blocked_t.task_number,
                    title=blocked_t.title,
                    old_start=blocked_t.start_date,
                    old_due=blocked_t.due_date,
                    new_start=new_start,
                    new_due=new_due,
                ))
                _preview_downstream(blocked_t.id, shift)

    _preview_downstream(task.id, days_shift)
    return CascadePreviewOut(total_affected=len(items), items=items)


@router.post("/{task_id}/reschedule-dependencies", response_model=TaskOut)
def reschedule_dependencies(
    task_id: int,
    data: Optional[RescheduleDependenciesRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cascade-reschedule downstream dependent tasks (working-day-aware)."""
    task = _get_task_or_404_with_auth(db, task_id, current_user)

    holiday_dates, weekly_off_days = _get_working_calendar(db)
    if data and data.days_shift:
        if task.start_date:
            task.start_date = _add_working_days(task.start_date, data.days_shift, holiday_dates, weekly_off_days)
        if task.due_date:
            task.due_date = _add_working_days(task.due_date, data.days_shift, holiday_dates, weekly_off_days)
        db.add(task)
    visited: set = set()

    def _shift_downstream(tid: int):
        if tid in visited:
            return
        visited.add(tid)
        deps = db.query(TaskDependency).filter(TaskDependency.depends_on_task_id == tid).all()
        for d in deps:
            blocked_t = d.task
            if blocked_t and not blocked_t.is_deleted:
                # Calculate max required start date across all predecessors
                pred_deps = db.query(TaskDependency).filter(TaskDependency.task_id == blocked_t.id).all()
                max_calc_start = None
                max_calc_due = None

                for pd in pred_deps:
                    p_task = db.get(Task, pd.depends_on_task_id)
                    if p_task:
                        p_dep_type = getattr(pd.pm_dep_type, 'value', str(pd.pm_dep_type)) if pd.pm_dep_type else "FS"
                        p_lag = pd.lag_days or 0
                        calc_s, calc_d = _compute_successor_dates(
                            p_task.start_date,
                            p_task.due_date,
                            p_dep_type,
                            p_lag,
                            blocked_t.duration_working_days or 0,
                            holiday_dates,
                            weekly_off_days,
                        )
                        if calc_s and (max_calc_start is None or calc_s > max_calc_start):
                            max_calc_start = calc_s
                            max_calc_due = calc_d

                if max_calc_start:
                    if not blocked_t.start_date or max_calc_start > blocked_t.start_date:
                        blocked_t.start_date = max_calc_start
                        blocked_t.due_date = max_calc_due
                        db.add(blocked_t)
                        _log_activity(db, blocked_t.id, current_user.id, "AUTO_RESCHEDULED", new_val=f"Cascade shifted to {max_calc_start}")

                _shift_downstream(blocked_t.id)

    _shift_downstream(task.id)
    db.commit()
    db.refresh(task)
    return _format_task_out(task, db)


# --- Project PM Settings API ---

@router.get("/pm-settings/{project_id}", response_model=ProjectPmSettingsOut, tags=["projects"])
def get_project_pm_settings(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get PM scheduling settings for a project"""
    from app.models.projects import ProjectPmSettings
    settings = db.query(ProjectPmSettings).filter(ProjectPmSettings.project_id == project_id).first()
    if not settings:
        # Return sensible defaults
        return ProjectPmSettingsOut(
            project_id=project_id,
            default_dep_type="FS",
            auto_shift_successors=True,
            prompt_on_reschedule=False,
        )
    return ProjectPmSettingsOut.model_validate(settings)


@router.put("/pm-settings/{project_id}", response_model=ProjectPmSettingsOut, tags=["projects"])
def update_project_pm_settings(
    project_id: int,
    data: ProjectPmSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert PM scheduling settings for a project"""
    from app.models.projects import ProjectPmSettings
    settings = db.query(ProjectPmSettings).filter(ProjectPmSettings.project_id == project_id).first()
    if not settings:
        settings = ProjectPmSettings(project_id=project_id)
        db.add(settings)

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(settings, field, val)

    db.commit()
    db.refresh(settings)
    return ProjectPmSettingsOut.model_validate(settings)


@router.get("/tags/list", response_model=List[TaskTagOut])
def get_task_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all available task tags for autocomplete"""
    tags = db.query(TaskTag).order_by(TaskTag.name).all()
    return tags

