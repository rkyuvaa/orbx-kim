import pytest
from unittest.mock import patch
from app.db.session import SessionLocal
from app.models.user import User, UserStatus
from app.models.projects import Task, TaskPriority
from app.models.notification import Notification
from app.schemas.projects import TaskCreate, TaskUpdate
from app.api.v1.personal_tasks import create_personal_task, update_personal_task


def test_create_personal_task_with_assignee_dispatches_notification():
    """When a task is created and assigned to another user, notification and email must be scheduled"""
    db = SessionLocal()
    try:
        user_creator = db.query(User).filter(User.email == "assignor_boss@example.com").first()
        user_assignee = db.query(User).filter(User.email == "assignee_active@example.com").first()
        assert user_creator is not None
        assert user_assignee is not None

        data = TaskCreate(
            title="Assigned on Creation Test",
            description="Testing creation assignment notifications",
            assignee_id=user_assignee.id,
            priority=TaskPriority.HIGH,
        )

        with patch("app.api.v1.personal_tasks.schedule_task_assignment_notification") as mock_email:
            task_out = create_personal_task(data=data, db=db, current_user=user_creator)

            # Check that task was assigned to the assignee
            assert task_out.assignee_id == user_assignee.id

            # Verify in-app notification exists in database
            notif = db.query(Notification).filter(
                Notification.user_id == user_assignee.id,
                Notification.message.like("%Assigned on Creation Test%"),
            ).order_by(Notification.id.desc()).first()
            assert notif is not None
            assert f"/my-tasks?taskId={task_out.id}" in notif.link

            # Verify email scheduler was invoked
            assert mock_email.called
            _, kwargs = mock_email.call_args
            assert kwargs["task_id"] == task_out.id
            assert kwargs["assignee_id"] == user_assignee.id
            assert kwargs["assignor_id"] == user_creator.id

            # Cleanup
            db.delete(notif)
            task_obj = db.get(Task, task_out.id)
            if task_obj:
                db.delete(task_obj)
            db.commit()
    finally:
        db.close()


def test_update_personal_task_reassign_dispatches_notification():
    """When an existing task is reassigned to another user, notification and email must be scheduled"""
    db = SessionLocal()
    try:
        user_creator = db.query(User).filter(User.email == "assignor_boss@example.com").first()
        user_assignee = db.query(User).filter(User.email == "assignee_active@example.com").first()

        # Create task initially assigned to user_creator (own task)
        task = Task(
            task_number="PT-REASSIGN-01",
            is_personal=True,
            title="Own Task To Reassign",
            assignee_id=user_creator.id,
            created_by=user_creator.id,
            is_completed=False,
            is_deleted=False,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        # Reassign to user_assignee
        update_data = TaskUpdate(assignee_id=user_assignee.id)

        with patch("app.api.v1.personal_tasks.schedule_task_assignment_notification") as mock_email:
            task_out = update_personal_task(
                task_id=task.id,
                data=update_data,
                db=db,
                current_user=user_creator,
            )

            assert task_out.assignee_id == user_assignee.id

            # Verify in-app notification exists
            notif = db.query(Notification).filter(
                Notification.user_id == user_assignee.id,
                Notification.message.like("%Own Task To Reassign%"),
            ).first()
            assert notif is not None
            assert "reassigned task" in notif.message

            # Verify email scheduler was invoked
            assert mock_email.called
            _, kwargs = mock_email.call_args
            assert kwargs["task_id"] == task.id
            assert kwargs["assignee_id"] == user_assignee.id
            assert kwargs["assignor_id"] == user_creator.id

            # Cleanup
            db.delete(notif)
            task_obj = db.get(Task, task.id)
            if task_obj:
                db.delete(task_obj)
            db.commit()
    finally:
        db.close()


def test_update_personal_task_assignee_ids_list_supported():
    """When update passes assignee_ids list, the first user is assigned and notified"""
    db = SessionLocal()
    try:
        user_creator = db.query(User).filter(User.email == "assignor_boss@example.com").first()
        user_assignee = db.query(User).filter(User.email == "assignee_active@example.com").first()

        task = Task(
            task_number="PT-REASSIGN-02",
            is_personal=True,
            title="Own Task With Assignee IDs",
            assignee_id=user_creator.id,
            created_by=user_creator.id,
            is_completed=False,
            is_deleted=False,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        # Reassign via assignee_ids list
        update_data = TaskUpdate(assignee_ids=[user_assignee.id])

        with patch("app.api.v1.personal_tasks.schedule_task_assignment_notification") as mock_email:
            task_out = update_personal_task(
                task_id=task.id,
                data=update_data,
                db=db,
                current_user=user_creator,
            )

            assert task_out.assignee_id == user_assignee.id

            notif = db.query(Notification).filter(
                Notification.user_id == user_assignee.id,
                Notification.message.like("%Own Task With Assignee IDs%"),
            ).first()
            assert notif is not None
            assert mock_email.called

            # Cleanup
            db.delete(notif)
            task_obj = db.get(Task, task.id)
            if task_obj:
                db.delete(task_obj)
            db.commit()
    finally:
        db.close()
