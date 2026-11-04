import pytest
from unittest.mock import patch, MagicMock
from app.db.session import SessionLocal
from app.models.user import User, UserRole, UserStatus
from app.models.personal_settings import PersonalSettings
from app.models.projects import Task, TaskPriority
from app.services.email_service import (
    send_task_assignment_email,
    notify_task_assignment_background,
    schedule_task_assignment_notification,
    resolve_client_app_url,
)


def test_send_task_assignment_email_content():
    """Verify HTML and plain text structure for task assignment emails"""
    with patch("app.services.email_service.dispatch_email_smtp") as mock_dispatch:
        mock_dispatch.return_value = (True, None)

        ok, err = send_task_assignment_email(
            to_email="employee@example.com",
            assignee_name="Jane Doe",
            assignor_name="John Manager",
            task_number="TSK-1001",
            task_title="Review Financial Documents",
            task_type_label="Project Task",
            project_name="EV Financing 2026",
            priority="HIGH",
            due_date_str="15 Nov 2026",
            description="Please review all KYC and salary proofs for this loan applicant.",
            task_url="http://localhost:5173/tasks?taskId=1001",
            company_name="KIM Work Management",
        )

        assert ok is True
        assert err is None
        assert mock_dispatch.called

        args, kwargs = mock_dispatch.call_args
        to_email = args[0]
        subject = args[1]
        plain = args[2]
        html = args[3]

        assert to_email == "employee@example.com"
        assert "TSK-1001" in subject
        assert "Review Financial Documents" in subject

        # Check plain text content
        assert "Jane Doe" in plain
        assert "John Manager" in plain
        assert "EV Financing 2026" in plain
        assert "HIGH" in plain
        assert "15 Nov 2026" in plain
        assert "http://localhost:5173/tasks?taskId=1001" in plain

        # Check HTML content
        assert "TSK-1001" in html
        assert "Review Financial Documents" in html
        assert "John Manager" in html
        assert "HIGH PRIORITY" in html
        assert "View Task in KIM" in html
        assert "http://localhost:5173/tasks?taskId=1001" in html


def test_notify_task_assignment_self_assignment_skipped():
    """Self-assigned tasks must not trigger email notifications"""
    with patch("app.services.email_service.send_task_assignment_email") as mock_send:
        # Same user as assignee and assignor
        notify_task_assignment_background(task_id=1, assignee_id=42, assignor_id=42)
        assert not mock_send.called


def test_notify_task_assignment_opt_out_respected():
    """Users with email_notifications_enabled=False must not receive assignment emails"""
    db = SessionLocal()
    try:
        # Create test assignee with email_notifications_enabled = False
        user = db.query(User).filter(User.email == "optout_user@example.com").first()
        if not user:
            user = User(
                email="optout_user@example.com",
                password_hash="testpass",
                full_name="Opted Out User",
                role=UserRole.SALES_EXECUTIVE,
                status=UserStatus.ACTIVE,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        ps = db.query(PersonalSettings).filter(PersonalSettings.user_id == user.id).first()
        if not ps:
            ps = PersonalSettings(user_id=user.id, email_notifications_enabled=False)
            db.add(ps)
        else:
            ps.email_notifications_enabled = False
        db.commit()

        with patch("app.services.email_service.send_task_assignment_email") as mock_send:
            notify_task_assignment_background(task_id=1, assignee_id=user.id, assignor_id=9999)
            assert not mock_send.called
    finally:
        db.close()


def test_notify_task_assignment_success():
    """Active user with notifications enabled receives assignment email"""
    db = SessionLocal()
    try:
        assignor = db.query(User).filter(User.email == "assignor_boss@example.com").first()
        if not assignor:
            assignor = User(
                email="assignor_boss@example.com",
                password_hash="testpass",
                full_name="Boss Lead",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
            )
            db.add(assignor)
            db.commit()
            db.refresh(assignor)

        assignee = db.query(User).filter(User.email == "assignee_active@example.com").first()
        if not assignee:
            assignee = User(
                email="assignee_active@example.com",
                password_hash="testpass",
                full_name="Active Worker",
                role=UserRole.SALES_EXECUTIVE,
                status=UserStatus.ACTIVE,
            )
            db.add(assignee)
            db.commit()
            db.refresh(assignee)

        ps = db.query(PersonalSettings).filter(PersonalSettings.user_id == assignee.id).first()
        if not ps:
            ps = PersonalSettings(user_id=assignee.id, email_notifications_enabled=True)
            db.add(ps)
        else:
            ps.email_notifications_enabled = True
        db.commit()

        task = Task(
            task_number="TSK-TEST-99",
            title="Perform Audit Verification",
            description="Audit compliance checklist required.",
            priority=TaskPriority.HIGH,
            assignee_id=assignee.id,
            created_by=assignor.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        with patch("app.services.email_service.send_task_assignment_email") as mock_send:
            mock_send.return_value = (True, None)

            notify_task_assignment_background(
                task_id=task.id,
                assignee_id=assignee.id,
                assignor_id=assignor.id,
                client_base_url="http://localhost:5173",
            )

            assert mock_send.called
            _, kwargs = mock_send.call_args
            assert kwargs["to_email"] == "assignee_active@example.com"
            assert kwargs["assignee_name"] == "Active Worker"
            assert kwargs["assignor_name"] == "Boss Lead"
            assert kwargs["task_number"] == "TSK-TEST-99"
            assert kwargs["task_title"] == "Perform Audit Verification"
            assert "taskId=" in kwargs["task_url"]
    finally:
        db.close()


def test_assign_personal_task_creates_in_app_notification():
    """Verify assign_personal_task creates an in-app Notification with deep link"""
    from app.api.v1.personal_tasks import assign_personal_task
    from app.schemas.projects import PersonalTaskAssignCreate
    from app.models.notification import Notification

    db = SessionLocal()
    try:
        assignor = db.query(User).filter(User.email == "assignor_boss@example.com").first()
        assignee = db.query(User).filter(User.email == "assignee_active@example.com").first()

        data = PersonalTaskAssignCreate(
            title="Deploy New Server Instance",
            description="Setup production server on cloud",
            assignee_id=assignee.id,
            priority=TaskPriority.HIGH,
        )

        with patch("app.services.email_service.schedule_task_assignment_notification"):
            res = assign_personal_task(data=data, db=db, current_user=assignor)

            # Check in-app notification in DB
            notif = db.query(Notification).filter(
                Notification.user_id == assignee.id,
                Notification.message.like("%Deploy New Server Instance%"),
            ).order_by(Notification.id.desc()).first()

            assert notif is not None
            assert "Boss Lead assigned task" in notif.message
            assert f"/my-tasks?taskId={res.id}" == notif.link
            assert notif.read_at is None
    finally:
        db.close()

