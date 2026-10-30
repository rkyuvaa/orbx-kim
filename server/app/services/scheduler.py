import asyncio
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.projects import Task
from app.models.notification import Notification
from app.models.personal_settings import PersonalReminder

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
                    if task.created_by and task.created_by != task.assignee_id:
                        db.add(Notification(user_id=task.created_by, message=msg))
                    
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
                    r.status = "sent"
                
                db.commit()
        except Exception as e:
            print(f"Error in reminder loop: {e}")
        
        await asyncio.sleep(30) # check every 30 seconds for timely delivery

def start_scheduler():
    loop = asyncio.get_running_loop()
    loop.create_task(_reminder_loop())
