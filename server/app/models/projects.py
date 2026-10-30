from datetime import datetime, date
from typing import TYPE_CHECKING, List
import enum

from sqlalchemy import (
    DateTime, Enum, ForeignKey, String, func, Date, Float, Boolean, Integer, Text, UniqueConstraint, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.application import Application
    from app.models.finance_company import FinanceCompany
    from app.models.branch import Branch
    from app.models.cost_center import CostCenter
    from app.models.rbac import Department


class ProjectType(Base):
    """Configurable project types"""
    __tablename__ = "project_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ProjectStatusDef(Base):
    """Configurable project statuses"""
    __tablename__ = "project_statuses"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#E2E8F0", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class TaskType(Base):
    """Configurable task types"""
    __tablename__ = "task_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)


class TaskStatusCategory(enum.StrEnum):
    NOT_STARTED = "NOT_STARTED"
    ACTIVE = "ACTIVE"
    DONE = "DONE"
    CLOSED = "CLOSED"


class TaskStatusDef(Base):
    """Configurable task statuses with category support"""
    __tablename__ = "task_statuses"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[TaskStatusCategory] = mapped_column(
        Enum(TaskStatusCategory, name="task_status_category"), default=TaskStatusCategory.ACTIVE, nullable=False
    )
    color: Mapped[str] = mapped_column(String(20), default="#E2E8F0", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # KIM PM v1.1 — status behaviour flags
    is_completed_type: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # auto-stamps completion_date
    exclude_from_active_totals: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_default_on_create: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # exactly one may be True


class TaskPriority(enum.StrEnum):
    URGENT = "URGENT"
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


class DependencyType(enum.StrEnum):
    BLOCKS = "BLOCKS"
    BLOCKED_BY = "BLOCKED_BY"
    WAITING_ON = "WAITING_ON"


class PMDepType(enum.StrEnum):
    """Scheduling dependency types for date-driven calculation (FS/SS/FF/SF + lag)"""
    FS = "FS"  # Finish-to-Start: successor.start = predecessor.end + lag
    SS = "SS"  # Start-to-Start:  successor.start = predecessor.start + lag
    FF = "FF"  # Finish-to-Finish: successor.end = predecessor.end + lag
    SF = "SF"  # Start-to-Finish: successor.end = predecessor.start + lag


class RelationshipType(enum.StrEnum):
    RELATED = "RELATED"
    LINKED = "LINKED"
    DUPLICATE = "DUPLICATE"


class ProjectWorkspace(Base):
    """Top-level workspace container for projects and spaces"""
    __tablename__ = "project_workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    spaces: Mapped[List["ProjectSpace"]] = relationship("ProjectSpace", back_populates="workspace", cascade="all, delete-orphan")


class ProjectSpace(Base):
    """Space division within a workspace (e.g. Engineering, Operations)"""
    __tablename__ = "project_spaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("project_workspaces.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    workspace: Mapped["ProjectWorkspace"] = relationship("ProjectWorkspace", back_populates="spaces")
    projects: Mapped[List["Project"]] = relationship("Project", back_populates="space")


class ProjectPhase(Base):
    """Phase / Folder / Group within a project"""
    __tablename__ = "project_phases"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#64748B", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    project: Mapped["Project"] = relationship("Project", back_populates="phases")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="phase")


class Project(Base):
    """Project master entity linking CRM leads, tasks, and budgets"""
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    space_id: Mapped[int | None] = mapped_column(ForeignKey("project_spaces.id", ondelete="SET NULL"), nullable=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("applications.id", ondelete="SET NULL"), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(100), default="General", nullable=False)
    type_id: Mapped[int | None] = mapped_column(ForeignKey("project_types.id", ondelete="SET NULL"), nullable=True)
    status_id: Mapped[int | None] = mapped_column(ForeignKey("project_statuses.id", ondelete="SET NULL"), nullable=True, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0 to 100%
    budget: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actual_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    target_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    target_start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    target_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    target_end_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completion_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # KIM PM v1.1 — project ID prefix (3-char, immutable after first task created)
    prefix: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # KIM PM v1.1 — server-computed rollup dates from milestones
    rollup_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rollup_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    space: Mapped["ProjectSpace | None"] = relationship("ProjectSpace", back_populates="projects")
    project_type: Mapped["ProjectType | None"] = relationship("ProjectType")
    status_def: Mapped["ProjectStatusDef | None"] = relationship("ProjectStatusDef")
    lead: Mapped["Application | None"] = relationship("Application", foreign_keys=[lead_id], lazy="joined")
    owner: Mapped["User | None"] = relationship("User", foreign_keys=[owner_id], lazy="joined")
    phases: Mapped[List["ProjectPhase"]] = relationship("ProjectPhase", back_populates="project", cascade="all, delete-orphan")
    milestones: Mapped[List["ProjectMilestone"]] = relationship("ProjectMilestone", back_populates="project", cascade="all, delete-orphan")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class ProjectMilestone(Base):
    """Key milestones within a project"""
    __tablename__ = "project_milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Kept for backward compat but no longer user-editable — superseded by rollup fields
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # KIM PM v1.1 — server-computed rollup fields (populated by rollup_service)
    rollup_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rollup_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rollup_estimated_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rollup_actual_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rollup_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # calendar days
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    project: Mapped["Project"] = relationship("Project", back_populates="milestones")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="milestone", foreign_keys="Task.milestone_id")
    task_lists: Mapped[List["ProjectTaskList"]] = relationship("ProjectTaskList", back_populates="milestone", cascade="all, delete-orphan")


class ProjectTaskList(Base):
    """
    Project Task List grouping level between Milestone and Task:
    Milestone → Task List → Task
    A Task List exists purely to group related Tasks under a Milestone.
    Editable fields: Name only.
    Read-only automatically calculated fields: Start (MIN), End (MAX), Duration (End - Start).
    Restrictions: No Status, Cost, Dependencies, or Assigned To.
    """
    __tablename__ = "project_task_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    milestone_id: Mapped[int] = mapped_column(ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Server-computed read-only fields
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duration_working_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_working_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    project: Mapped["Project"] = relationship("Project")
    milestone: Mapped["ProjectMilestone"] = relationship("ProjectMilestone", back_populates="task_lists")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="task_list", foreign_keys="Task.task_list_id")


class Task(Base):
    """Complete Enterprise Work-Management Task Entity (ClickUp-Inspired)"""
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    phase_id: Mapped[int | None] = mapped_column(ForeignKey("project_phases.id", ondelete="SET NULL"), nullable=True, index=True)
    parent_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    # KIM PM v1.1 — milestone FK (groups task under Project → Milestone → Task hierarchy)
    milestone_id: Mapped[int | None] = mapped_column(ForeignKey("project_milestones.id", ondelete="SET NULL"), nullable=True, index=True)
    # Project Task List FK (groups task under Milestone → Task List → Task hierarchy)
    task_list_id: Mapped[int | None] = mapped_column(ForeignKey("project_task_lists.id", ondelete="SET NULL"), nullable=True, index=True)
    
    title: Mapped[str] = mapped_column(String(250), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type_id: Mapped[int | None] = mapped_column(ForeignKey("task_types.id", ondelete="SET NULL"), nullable=True)
    status_id: Mapped[int | None] = mapped_column(ForeignKey("task_statuses.id", ondelete="SET NULL"), nullable=True, index=True)
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority"), default=TaskPriority.NORMAL, nullable=False, index=True
    )

    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    due_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    estimated_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    actual_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    estimated_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actual_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    progress_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    # KIM PM v1.1 — scheduling & cost fields
    duration_working_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # leaf: user-entered working days
    duration_working_hours: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True, server_default="0")
    auto_schedule: Mapped[bool] = mapped_column(Boolean, default=True, nullable=True, server_default="true")
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # monetary
    actual_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)     # monetary
    completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)          # auto-stamped on completed-type status
    completion_time: Mapped[str | None] = mapped_column(String(10), nullable=True)

    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_personal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false", index=True)
    planned_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blocked_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    parent_due_follows_subtasks: Mapped[bool] = mapped_column(Boolean, default=True, nullable=True, server_default="true")

    company_id: Mapped[int | None] = mapped_column(ForeignKey("finance_companies.id", ondelete="SET NULL"), nullable=True, index=True)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    cost_center_id: Mapped[int | None] = mapped_column(ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True, index=True)

    recurrence_rule: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recurrence_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurring_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    
    reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_status: Mapped[str | None] = mapped_column(String(20), default="PENDING", nullable=True)

    tags: Mapped[str | None] = mapped_column(String(300), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    # Relationships
    project: Mapped["Project | None"] = relationship("Project", back_populates="tasks")
    phase: Mapped["ProjectPhase | None"] = relationship("ProjectPhase", back_populates="tasks")
    task_type: Mapped["TaskType | None"] = relationship("TaskType")
    status_def: Mapped["TaskStatusDef | None"] = relationship("TaskStatusDef")
    
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by], lazy="joined")
    updater: Mapped["User | None"] = relationship("User", foreign_keys=[updated_by], lazy="joined")
    completer: Mapped["User | None"] = relationship("User", foreign_keys=[completed_by], lazy="joined")
    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assignee_id], lazy="joined")

    company: Mapped["FinanceCompany | None"] = relationship("FinanceCompany", lazy="joined")
    branch: Mapped["Branch | None"] = relationship("Branch", lazy="joined")
    department: Mapped["Department | None"] = relationship("Department", lazy="joined")
    cost_center: Mapped["CostCenter | None"] = relationship("CostCenter", lazy="joined")

    parent_task: Mapped["Task | None"] = relationship("Task", foreign_keys=[parent_task_id], remote_side="[Task.id]", back_populates="subtask_items", lazy="joined")
    subtask_items: Mapped[List["Task"]] = relationship("Task", foreign_keys=[parent_task_id], back_populates="parent_task", cascade="all, delete-orphan")
    milestone: Mapped["ProjectMilestone | None"] = relationship("ProjectMilestone", back_populates="tasks", foreign_keys=[milestone_id])
    task_list: Mapped["ProjectTaskList | None"] = relationship("ProjectTaskList", back_populates="tasks", foreign_keys=[task_list_id])

    assignees: Mapped[List["TaskAssignee"]] = relationship("TaskAssignee", back_populates="task", cascade="all, delete-orphan")
    followers: Mapped[List["TaskFollower"]] = relationship("TaskFollower", back_populates="task", cascade="all, delete-orphan")
    checklists: Mapped[List["TaskChecklist"]] = relationship("TaskChecklist", back_populates="task", cascade="all, delete-orphan")
    time_entries: Mapped[List["TaskTimeEntry"]] = relationship("TaskTimeEntry", back_populates="task", cascade="all, delete-orphan")
    time_logs: Mapped[List["TaskTimeLog"]] = relationship("TaskTimeLog", back_populates="task", cascade="all, delete-orphan")
    comments: Mapped[List["TaskComment"]] = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    log_notes: Mapped[List["TaskLogNote"]] = relationship("TaskLogNote", back_populates="task", cascade="all, delete-orphan", order_by="desc(TaskLogNote.created_at)")
    attachments: Mapped[List["TaskAttachment"]] = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")
    subtasks: Mapped[List["TaskSubtask"]] = relationship("TaskSubtask", back_populates="task", cascade="all, delete-orphan")
    tag_mappings: Mapped[List["TaskTagMap"]] = relationship("TaskTagMap", back_populates="task", cascade="all, delete-orphan")
    activities: Mapped[List["TaskActivity"]] = relationship("TaskActivity", back_populates="task", cascade="all, delete-orphan")


class TaskAssignee(Base):
    """Many-to-many relationship for task assignees"""
    __tablename__ = "task_assignees"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", back_populates="assignees")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")
    assigner: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_by], lazy="joined")

    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_task_user_assignee"),)


class TaskFollower(Base):
    """Many-to-many relationship for task followers / watchers"""
    __tablename__ = "task_followers"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", back_populates="followers")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")

    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_task_user_follower"),)


class TaskTag(Base):
    """Tag entity for categorizing tasks"""
    __tablename__ = "task_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    color: Mapped[str] = mapped_column(String(20), default="#3B82F6", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class TaskTagMap(Base):
    """Mapping between tasks and tags"""
    __tablename__ = "task_tag_mappings"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("task_tags.id", ondelete="CASCADE"), nullable=False, index=True)

    task: Mapped["Task"] = relationship("Task", back_populates="tag_mappings")
    tag: Mapped["TaskTag"] = relationship("TaskTag", lazy="joined")

    __table_args__ = (UniqueConstraint("task_id", "tag_id", name="uq_task_tag_map"),)


class TaskChecklist(Base):
    """Checklist within a task"""
    __tablename__ = "task_checklists"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", back_populates="checklists")
    items: Mapped[List["TaskChecklistItem"]] = relationship("TaskChecklistItem", back_populates="checklist", cascade="all, delete-orphan")


class TaskChecklistItem(Base):
    """Individual item in a task checklist"""
    __tablename__ = "task_checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("task_checklists.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    checklist: Mapped["TaskChecklist"] = relationship("TaskChecklist", back_populates="items")
    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assignee_id], lazy="joined")
    completer: Mapped["User | None"] = relationship("User", foreign_keys=[completed_by], lazy="joined")


class TaskTimeEntry(Base):
    """Time tracking entry for work performed on a task"""
    __tablename__ = "task_time_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="manual", nullable=True, server_default="manual")
    flagged_for_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", back_populates="time_entries")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")


class TaskAttachment(Base):
    """File attachments linked to tasks"""
    __tablename__ = "task_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", back_populates="attachments")
    uploader: Mapped["User | None"] = relationship("User", foreign_keys=[uploaded_by], lazy="joined")


class TaskSubtask(Base):
    """Legacy Subtask table for backwards compatibility"""
    __tablename__ = "task_subtasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", back_populates="subtasks")


class TaskTimeLog(Base):
    """Legacy Timesheet log entries for backwards compatibility"""
    __tablename__ = "task_time_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", back_populates="time_logs")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")


class TaskComment(Base):
    """Discussion comments on tasks with soft delete support"""
    __tablename__ = "task_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    task: Mapped["Task"] = relationship("Task", back_populates="comments")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")


class TaskLogNote(Base):
    """Timestamped log note captured for a task by an employee"""
    __tablename__ = "task_log_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), nullable=False, index=True)

    task: Mapped["Task"] = relationship("Task", back_populates="log_notes")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")


class TaskDependency(Base):
    """Dependency relations between tasks (Blocks, Blocked By, Waiting On)"""
    __tablename__ = "task_dependencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    depends_on_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_type: Mapped[DependencyType] = mapped_column(
        Enum(DependencyType, name="task_dependency_type"), default=DependencyType.BLOCKS, nullable=False
    )
    # KIM PM v1.1 — scheduling dependency fields (FS/SS/FF/SF + lag)
    pm_dep_type: Mapped[PMDepType | None] = mapped_column(
        Enum(PMDepType, name="pm_dep_type"), nullable=True
    )
    lag_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # working days; can be negative
    lag_hours: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", foreign_keys=[task_id])
    depends_on_task: Mapped["Task"] = relationship("Task", foreign_keys=[depends_on_task_id])

    __table_args__ = (UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dependency"),)


class TaskRelationship(Base):
    """Bidirectional relationships between tasks (Related, Linked, Duplicate)"""
    __tablename__ = "task_relationships"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    related_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type: Mapped[RelationshipType] = mapped_column(
        Enum(RelationshipType, name="task_relationship_type"), default=RelationshipType.RELATED, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    task: Mapped["Task"] = relationship("Task", foreign_keys=[task_id])
    related_task: Mapped["Task"] = relationship("Task", foreign_keys=[related_task_id])

    __table_args__ = (UniqueConstraint("task_id", "related_task_id", name="uq_task_relationship"),)


class TaskActivity(Base):
    """Immutable task activity log for auditing all changes"""
    __tablename__ = "task_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), index=True)

    task: Mapped["Task"] = relationship("Task", back_populates="activities")
    actor: Mapped["User | None"] = relationship("User", foreign_keys=[actor_id], lazy="joined")


class TaskTemplate(Base):
    """Reusable task templates"""
    __tablename__ = "task_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())

    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by], lazy="joined")


class TaskAutomationRule(Base):
    """Configurable automation rules for task workflows"""
    __tablename__ = "task_automations"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    trigger_event: Mapped[str] = mapped_column(String(50), nullable=False)  # STATUS_CHANGE, TASK_OVERDUE, TASK_CREATED
    conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    actions: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class ProjectCustomFieldDefinition(Base):
    """Definition of custom fields for projects"""
    __tablename__ = "project_custom_field_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    field_type: Mapped[str] = mapped_column(String(30), default="text", nullable=False)  # text, number, select, date, currency
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"choices": ["A", "B"]}
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class ProjectCustomFieldValue(Base):
    """Values for project custom fields"""
    __tablename__ = "project_custom_field_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    field_id: Mapped[int] = mapped_column(ForeignKey("project_custom_field_definitions.id", ondelete="CASCADE"), index=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)


class TaskCustomFieldDefinition(Base):
    """Definition of custom fields for tasks"""
    __tablename__ = "task_custom_field_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    field_type: Mapped[str] = mapped_column(String(30), default="text", nullable=False)  # text, number, select, date, currency
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class TaskCustomFieldValue(Base):
    """Values for task custom fields"""
    __tablename__ = "task_custom_field_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False)
    field_id: Mapped[int] = mapped_column(ForeignKey("task_custom_field_definitions.id", ondelete="CASCADE"), index=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)

class WorkingCalendarHoliday(Base):
    __tablename__ = "working_calendar_holidays"
    id: Mapped[int] = mapped_column(primary_key=True)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    recurs_yearly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

class WeeklyOffDay(Base):
    __tablename__ = "weekly_off_days"
    id: Mapped[int] = mapped_column(primary_key=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False, unique=True) # 0=Sunday, 1=Monday...


class WorkingCalendarSetting(Base):
    """Working calendar daily working hours (start and end times, e.g. 09:00 - 18:00)"""
    __tablename__ = "working_calendar_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    work_start_time: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False, server_default="09:00")
    work_end_time: Mapped[str] = mapped_column(String(5), default="18:00", nullable=False, server_default="18:00")


class ProjectPmSettings(Base):
    """Per-project Project Management scheduling preferences"""
    __tablename__ = "project_pm_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    default_dep_type: Mapped[str] = mapped_column(String(2), default="FS", nullable=False)  # FS/SS/FF/SF
    auto_shift_successors: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    prompt_on_reschedule: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    project: Mapped["Project"] = relationship("Project")
