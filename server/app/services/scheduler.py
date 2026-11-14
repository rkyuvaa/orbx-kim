import asyncio
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.projects import Task
from app.models.notification import Notification
from app.models.personal_settings import PersonalReminder
from app.services.push_notification_service import send_push_to_user, is_push_category_enabled

async def _reminder_loop():
    while True:
        try:
            with SessionLocal() as db:
                now = datetime.now(timezone.utc)
                pending_tasks = db.query(Task).filter(
                    Task.reminder_at <= now,
                    Task.reminder_status == "PENDING",
                    Task.is_completed == False,
                    Task.is_deleted == False
                ).all()

                for task in pending_tasks:
                    # Dispatch notifications
                    msg = f"Reminder for Task {task.task_number}: {task.title}"
                    if task.assignee_id:
                        db.add(Notification(user_id=task.assignee_id, message=msg))
                        if is_push_category_enabled(db, task.assignee_id, "push_task_due_today"):
                            send_push_to_user(
                                db=db,
                                user_id=task.assignee_id,
                                title="Task Due / Reminder",
                                body=msg,
                                url=f"/my-tasks?taskId={task.id}" if task.is_personal else f"/projects/tasks?taskId={task.id}",
                            )
                    if task.created_by and task.created_by != task.assignee_id:
                        db.add(Notification(user_id=task.created_by, message=msg))
                        if is_push_category_enabled(db, task.created_by, "push_task_due_today"):
                            send_push_to_user(
                                db=db,
                                user_id=task.created_by,
                                title="Task Due / Reminder",
                                body=msg,
                                url=f"/my-tasks?taskId={task.id}" if task.is_personal else f"/projects/tasks?taskId={task.id}",
                            )
                    
                    task.reminder_status = "SENT"

                # Check PersonalReminders scheduled
                pending_reminders = db.query(PersonalReminder).filter(
                    PersonalReminder.scheduled_at <= now,
                    PersonalReminder.status.in_(["pending", "snoozed"])
                ).all()

                for r in pending_reminders:
                    task = db.get(Task, r.task_id)
                    if task and not task.is_completed and not task.is_deleted:
                        msg = f"Task Reminder: {task.task_number} - {task.title}"
                        db.add(Notification(user_id=r.user_id, message=msg))
                        if is_push_category_enabled(db, r.user_id, "push_task_due_today"):
                            send_push_to_user(
                                db=db,
                                user_id=r.user_id,
                                title="Task Due / Reminder",
                                body=msg,
                                url=f"/my-tasks?taskId={task.id}" if task.is_personal else f"/projects/tasks?taskId={task.id}",
                            )
                    r.status = "sent"
                
                db.commit()
        except Exception as e:
            print(f"Error in reminder loop: {e}")
        
        await asyncio.sleep(30) # check every 30 seconds for timely delivery

def start_scheduler():
    loop = asyncio.get_running_loop()
    loop.create_task(_reminder_loop())
    loop.create_task(_digest_loop())


async def _digest_loop():
    """
    Background worker running every 60s to check if any user is due for
    their daily task summary digest based on their configured digest_time and timezone.
    """
    while True:
        try:
            with SessionLocal() as db:
                from app.models.personal_settings import PersonalSettings
                from app.models.projects import Task, TaskAssignee
                from sqlalchemy import or_
                import zoneinfo

                settings_list = db.query(PersonalSettings).filter(
                    PersonalSettings.digest_time.isnot(None),
                    PersonalSettings.digest_time != "",
                ).all()

                for ps in settings_list:
                    try:
                        tz_str = ps.timezone or "Asia/Kolkata"
                        try:
                            tz = zoneinfo.ZoneInfo(tz_str)
                        except Exception:
                            tz = zoneinfo.ZoneInfo("Asia/Kolkata")

                        now_local = datetime.now(tz)
                        today_str = now_local.strftime("%Y-%m-%d")
                        current_hhmm = now_local.strftime("%H:%M")

                        # If already sent today, skip
                        if ps.last_digest_sent_date == today_str:
                            continue

                        # Check if scheduled digest time has arrived
                        if current_hhmm >= ps.digest_time.strip():
                            today_date = now_local.date()
                            tasks = db.query(Task).filter(
                                Task.is_personal.is_(True),
                                Task.is_deleted.is_(False),
                                Task.is_completed.is_(False),
                                or_(
                                    Task.assignee_id == ps.user_id,
                                    Task.created_by == ps.user_id,
                                    Task.assignees.any(TaskAssignee.user_id == ps.user_id),
                                )
                            ).all()

                            due_today_count = 0
                            overdue_count = 0
                            total_pending = len(tasks)

                            for t in tasks:
                                if t.due_date:
                                    d_date = t.due_date.date() if isinstance(t.due_date, datetime) else t.due_date
                                    if d_date == today_date:
                                        due_today_count += 1
                                    elif d_date < today_date:
                                        overdue_count += 1

                            if total_pending > 0:
                                digest_msg = (
                                    f"Daily Task Digest: You have {due_today_count} task(s) due today, "
                                    f"{overdue_count} overdue, and {total_pending} total pending."
                                )
                            else:
                                digest_msg = "Daily Task Digest: You have no pending tasks today. All caught up!"

                            # Add In-App Notification
                            db.add(Notification(
                                user_id=ps.user_id,
                                message=digest_msg,
                                link="/my-tasks",
                            ))

                            # Dispatch Web Push (explicit digest schedule ignores quiet hours)
                            send_push_to_user(
                                db=db,
                                user_id=ps.user_id,
                                title="Daily Task Digest",
                                body=digest_msg,
                                url="/my-tasks",
                                ignore_quiet_hours=True,
                            )

                            ps.last_digest_sent_date = today_str
                            db.commit()
                    except Exception as ps_err:
                        print(f"Error processing digest for user {ps.user_id}: {ps_err}")

        except Exception as e:
            print(f"Error in digest loop: {e}")

        await asyncio.sleep(60)
