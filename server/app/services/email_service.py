import html
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.smtp_setting import SmtpSetting

logger = logging.getLogger(__name__)


def dispatch_email_smtp(
    to_email: str,
    subject: str,
    plain_text: str,
    html_content: str,
    db: Session | None = None,
    smtp_override: dict | None = None,
) -> tuple[bool, str | None]:
    """
    Dispatches email via database SmtpSetting (or config fallback).
    Supports optional smtp_override dict for testing unsaved form values.
    Returns (success, error_message).
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        smtp_rec = db.query(SmtpSetting).first()
        override = smtp_override or {}

        host = override.get("smtp_host") or (smtp_rec.smtp_host if (smtp_rec and smtp_rec.smtp_host) else getattr(settings, "SMTP_HOST", None))
        port = override.get("smtp_port") or (smtp_rec.smtp_port if smtp_rec else getattr(settings, "SMTP_PORT", 587))
        security = (override.get("smtp_security") or (smtp_rec.smtp_security if smtp_rec else "TLS")).upper()
        user = override.get("smtp_user") or (smtp_rec.smtp_user if (smtp_rec and smtp_rec.smtp_user) else getattr(settings, "SMTP_USER", None))

        # Check override password first; if None, fall back to DB password if not blank
        pwd_input = override.get("smtp_password")
        if pwd_input is not None and pwd_input.strip() != "":
            password = pwd_input.strip()
        else:
            password = smtp_rec.smtp_password if (smtp_rec and smtp_rec.smtp_password) else getattr(settings, "SMTP_PASSWORD", None)

        from_email = (
            override.get("smtp_from_email")
            or (smtp_rec.smtp_from_email if (smtp_rec and smtp_rec.smtp_from_email) else None)
            or getattr(settings, "SMTP_FROM", f"noreply@{host or 'crmfinance.com'}")
        )
        from_name = override.get("smtp_from_name") or (smtp_rec.smtp_from_name if smtp_rec else "CRMFinance")
        is_enabled = override.get("is_enabled", smtp_rec.is_enabled if smtp_rec else True)

        if not is_enabled:
            logger.info(f"Email service disabled. Simulated dispatch to {to_email}")
            return True, None

        if not host:
            return False, "SMTP Host is not configured. Please enter your SMTP server host (e.g. smtp.zoho.com)."

        if user and not password:
            return False, f"SMTP Password is missing for user '{user}'. Please enter your SMTP App Password and save settings before sending."

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
        msg["To"] = to_email

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if security == "SSL":
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)

        with server:
            if security == "TLS":
                server.starttls()

            if user and password:
                server.login(user, password)

            server.sendmail(from_email, [to_email], msg.as_string())

        logger.info(f"Email sent successfully via SMTP to {to_email}")
        return True, None

    except smtplib.SMTPAuthenticationError as e:
        err_str = str(e)
        logger.error(f"SMTP Auth Error on {host}: {err_str}")
        h = (host or "").lower()
        if "gmail" in h:
            return False, f"Google Gmail Authentication Failed (535): Google rejected your password for '{user}'. Google does NOT accept regular account passwords. You MUST turn on 2-Step Verification and generate a 16-character App Password at myaccount.google.com/apppasswords."
        elif "zoho" in h:
            return False, f"Zoho Authentication Failed (535): Invalid username or password for '{user}'. Verify host (smtp.zoho.in for India, smtp.zoho.com for Global) and ensure SMTP Access is enabled in Zoho Admin."
        elif "office365" in h or "outlook" in h or "microsoft" in h:
            return False, f"Microsoft Authentication Failed (535): Invalid credentials or Authenticated SMTP is disabled for mailbox '{user}' in Microsoft 365 Admin Center."
        return False, f"Authentication Failed (535): Invalid Username or Password for '{user}' on host '{host}'."
    except smtplib.SMTPResponseException as e:
        err_code = e.smtp_code
        err_msg = e.smtp_error.decode("utf-8", errors="ignore") if isinstance(e.smtp_error, bytes) else str(e.smtp_error)
        logger.error(f"SMTP Response Exception {err_code}: {err_msg}")
        h = (host or "").lower()
        if err_code in (530, 535):
            if "gmail" in h:
                return False, f"Google Gmail Authentication Error ({err_code}): Google rejected the login. Generate a 16-character App Password at myaccount.google.com/apppasswords."
            elif "zoho" in h:
                return False, f"Zoho Authentication Error ({err_code}): {err_msg}. Verify your SMTP Username, Password, and host (smtp.zoho.in vs smtp.zoho.com)."
            return False, f"Authentication Error ({err_code}): {err_msg}. Check your username and password for {host}."
        elif err_code in (550, 553):
            return False, f"Sender Address Error ({err_code}): {err_msg}. Ensure 'Sender Email' matches your SMTP user or authorized alias."
        return False, f"SMTP Error ({err_code}): {err_msg}"
    except (smtplib.SMTPConnectError, ConnectionRefusedError, OSError) as e:
        err_str = str(e)
        logger.error(f"SMTP Connection Error: {err_str}")
        return False, f"Could not connect to {host}:{port} ({security}). Check your SMTP Host, Port, and network/firewall settings."
    except Exception as e:
        err_msg = str(e)
        logger.error(f"SMTP Email send failed to {to_email}: {err_msg}")
        return False, f"SMTP Delivery Failed: {err_msg}"
    finally:
        if close_db:
            db.close()


def send_financier_documents_email(
    to_email: str,
    financier_name: str,
    lead_ref: str,
    secure_link: str,
    expiry_datetime_str: str,
    company_name: str = "CRMFinance / KIM Vehicle Finance",
    db: Session | None = None,
) -> tuple[bool, str | None]:
    """
    Sends a secure no-login document link email to the financier.
    """
    subject = f"Documents submitted for review - Lead {lead_ref}"

    plain_text = f"""Hello {financier_name},

The required documents for Lead {lead_ref} have been uploaded and verified.

Please click the secure link below to view the documents:

{secure_link}

This link allows you to view only the uploaded documents related to this lead. No login is required.

Do not share this link. It expires on {expiry_datetime_str}.

Regards,
{company_name}
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #f7f9f5; margin: 0; padding: 20px; color: #16231b; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e4ebe1; border-radius: 12px; padding: 32px; box-shadow: 0 4px 16px rgba(2,48,32,0.06); }}
    .header {{ font-size: 20px; font-weight: 800; color: #023020; margin-bottom: 16px; border-bottom: 2px solid #eaf6e8; padding-bottom: 12px; }}
    .lead-ref {{ font-family: monospace; background: #eaf6e8; color: #087a3d; padding: 3px 8px; border-radius: 4px; font-weight: 700; }}
    .btn {{ display: inline-block; background-color: #087a3d; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 20px 0; }}
    .notice {{ font-size: 12.5px; color: #7a8b80; background: #f8faf8; border-left: 3px solid #087a3d; padding: 10px 14px; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">{company_name}</div>
    <p>Hello <strong>{financier_name}</strong>,</p>
    <p>The required documents for Lead <span class="lead-ref">{lead_ref}</span> have been uploaded and verified.</p>
    <p>Please click the secure button below to view the uploaded documents:</p>
    <p style="text-align: center;">
      <a href="{secure_link}" class="btn" target="_blank">View Shared Documents</a>
    </p>
    <p style="font-size: 13px; color: #44584c;">
      Direct link URL:<br>
      <a href="{secure_link}" style="color: #087a3d; word-break: break-all;">{secure_link}</a>
    </p>
    <div class="notice">
      🔒 <strong>Security Notice:</strong> This link grants read-only access to uploaded documents for Lead {lead_ref} only. No login is required. It expires on <strong>{expiry_datetime_str}</strong>.
    </div>
    <p style="margin-top: 28px; font-size: 13px; color: #7a8b80;">Regards,<br><strong>{company_name}</strong></p>
  </div>
</body>
</html>
"""

    ok, err_msg = dispatch_email_smtp(to_email, subject, plain_text, html_content, db=db)
    return ok, err_msg


def resolve_client_app_url(request: Any = None) -> str:
    """
    Resolves client frontend base URL for deep links.
    """
    if request:
        origin = request.headers.get("origin")
        if origin:
            return origin.rstrip("/")
        referer = request.headers.get("referer")
        if referer:
            try:
                from urllib.parse import urlparse
                p = urlparse(referer)
                if p.scheme and p.netloc:
                    return f"{p.scheme}://{p.netloc}".rstrip("/")
            except Exception:
                pass
        host_header = request.headers.get("host")
        if host_header:
            scheme = request.url.scheme or "http"
            return f"{scheme}://{host_header}".rstrip("/")
    # Config / fallback
    origins = getattr(settings, "cors_origins", "")
    for o in origins.split(","):
        o = o.strip()
        if o:
            return o.rstrip("/")
    return "http://localhost:5173"


def send_task_assignment_email(
    to_email: str,
    assignee_name: str,
    assignor_name: str,
    task_number: str,
    task_title: str,
    task_type_label: str = "Task",
    project_name: Optional[str] = None,
    priority: str = "NORMAL",
    due_date_str: Optional[str] = None,
    description: Optional[str] = None,
    task_url: str = "",
    checklist_item_text: Optional[str] = None,
    company_name: str = "KIM Work Management",
    db: Optional[Session] = None,
) -> tuple[bool, Optional[str]]:
    """
    Sends an immediate HTML + Plaintext email notification when a task is assigned.
    """
    subject = f"[{company_name}] Task Assigned: {task_number} - {task_title}"

    # Priority badge colors
    p_upper = (priority or "NORMAL").upper()
    priority_colors = {
        "URGENT": {"bg": "#fee2e2", "color": "#dc2626", "border": "#fca5a5"},
        "HIGH": {"bg": "#ffedd5", "color": "#ea580c", "border": "#fdba74"},
        "NORMAL": {"bg": "#ecfdf5", "color": "#059669", "border": "#a7f3d0"},
        "LOW": {"bg": "#f1f5f9", "color": "#64748b", "border": "#cbd5e1"},
    }
    badge = priority_colors.get(p_upper, priority_colors["NORMAL"])

    safe_title = html.escape(task_title or "Untitled Task")
    safe_assignee = html.escape(assignee_name or "Team Member")
    safe_assignor = html.escape(assignor_name or "A colleague")
    safe_number = html.escape(task_number or "")
    safe_project = html.escape(project_name) if project_name else None
    safe_due = html.escape(due_date_str) if due_date_str else "No due date specified"
    safe_item = html.escape(checklist_item_text) if checklist_item_text else None

    # Snippet for description (max 350 chars)
    desc_html = ""
    desc_text = ""
    if description and description.strip():
        clean_desc = description.strip()
        if len(clean_desc) > 350:
            clean_desc = clean_desc[:347] + "..."
        desc_text = f"\nDescription / Details:\n{clean_desc}\n"
        desc_html = f"""
        <div style="margin-top: 16px; padding: 12px 16px; background-color: #f8faf8; border-left: 3px solid #087a3d; border-radius: 4px; font-size: 13.5px; color: #374151; line-height: 1.5;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; margin-bottom: 4px; letter-spacing: 0.5px;">Task Details</div>
            {html.escape(clean_desc)}
        </div>
        """

    checklist_html = ""
    checklist_text = ""
    if safe_item:
        checklist_text = f"\nChecklist Item: {checklist_item_text}\n"
        checklist_html = f"""
        <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 120px;">Checklist Item:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13.5px; font-weight: 600;">{safe_item}</td>
        </tr>
        """

    project_row_html = ""
    project_row_text = ""
    if safe_project:
        project_row_text = f"Project: {project_name}\n"
        project_row_html = f"""
        <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 120px;">Project:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13.5px; font-weight: 600;">{safe_project}</td>
        </tr>
        """

    plain_text = f"""Hello {safe_assignee},

{safe_assignor} has assigned a {task_type_label.lower()} to you in {company_name}:

Task: [{task_number}] {task_title}
{project_row_text}Priority: {p_upper}
Due Date: {safe_due}
{checklist_text}{desc_text}
You can view and update this task directly using the link below:
{task_url}

Regards,
{company_name} Notification Service
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Assigned</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f4f6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05);">
    
    <!-- Header Banner -->
    <div style="background-color: #023020; padding: 22px 28px; border-bottom: 3px solid #087a3d;">
      <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">{company_name}</div>
      <div style="font-size: 12px; color: #a7f3d0; margin-top: 3px;">Work Management &amp; Collaboration</div>
    </div>

    <div style="padding: 28px;">
      <p style="font-size: 15px; margin: 0 0 16px 0; color: #111827;">
        Hello <strong>{safe_assignee}</strong>,
      </p>
      
      <!-- Notice Alert -->
      <div style="background-color: #ecfdf5; border-left: 4px solid #087a3d; padding: 12px 16px; border-radius: 4px; margin-bottom: 22px;">
        <span style="font-size: 14px; color: #065f46; font-weight: 600;">
          <strong>{safe_assignor}</strong> assigned a {task_type_label.lower()} to you.
        </span>
      </div>

      <!-- Task Card -->
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px 20px; background-color: #fafafa;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="background-color: #023020; color: #ffffff; font-family: monospace; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; margin-right: 8px;">
            {safe_number}
          </span>
          <span style="background-color: {badge['bg']}; color: {badge['color']}; border: 1px solid {badge['border']}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">
            {p_upper} PRIORITY
          </span>
        </div>

        <h3 style="margin: 0 0 14px 0; font-size: 16px; font-weight: 700; color: #111827; line-height: 1.4;">
          {safe_title}
        </h3>

        <table style="width: 100%; border-collapse: collapse;">
          {project_row_html}
          {checklist_html}
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 120px;">Due Date:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13.5px; font-weight: 600;">{safe_due}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 120px;">Assigned By:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13.5px; font-weight: 600;">{safe_assignor}</td>
          </tr>
        </table>

        {desc_html}
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-top: 26px; margin-bottom: 24px;">
        <a href="{task_url}" target="_blank" style="background-color: #087a3d; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 700; font-size: 14.5px; display: inline-block; box-shadow: 0 2px 6px rgba(8,122,61,0.25);">
          View Task in KIM &rarr;
        </a>
      </div>

      <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0 0 4px 0;">
        Or open directly: <a href="{task_url}" style="color: #087a3d; word-break: break-all;">{task_url}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;" />

      <p style="font-size: 11.5px; color: #9ca3af; margin: 0; line-height: 1.5; text-align: center;">
        You received this automated notification because a task was assigned to you and notifications are enabled in your personal settings.<br>
        To manage your task alerts, visit My Tasks &gt; Settings in KIM.
      </p>
    </div>
  </div>
</body>
</html>
"""
    return dispatch_email_smtp(to_email, subject, plain_text, html_content, db=db)


def notify_task_assignment_background(
    task_id: int,
    assignee_id: int,
    assignor_id: int,
    client_base_url: str = "",
    item_text: Optional[str] = None,
    is_checklist_item: bool = False,
    is_subtask: bool = False,
):
    """
    Background worker executed after DB commit to dispatch assignment email safely.
    Uses its own SessionLocal to query models, verify preferences, and dispatch email.
    """
    if not assignee_id or assignee_id == assignor_id:
        return

    from app.db.session import SessionLocal
    from app.models.projects import Task
    from app.models.user import User
    from app.models.personal_settings import PersonalSettings

    db = SessionLocal()
    try:
        # Check personal settings for assignee
        ps = db.query(PersonalSettings).filter(PersonalSettings.user_id == assignee_id).first()
        if ps and not ps.email_notifications_enabled:
            logger.info(f"Task assignment email skipped: user {assignee_id} has disabled assignment email notifications.")
            return

        assignee = db.get(User, assignee_id)
        if not assignee or not assignee.email or "@" not in assignee.email:
            logger.info(f"Task assignment email skipped: user {assignee_id} has no valid email.")
            return

        assignor = db.get(User, assignor_id) if assignor_id else None
        assignor_name = assignor.full_name if (assignor and assignor.full_name) else (assignor.username if assignor else "A colleague")

        task = db.get(Task, task_id)
        if not task or task.is_deleted:
            return

        # Format due date
        due_str = None
        if task.due_date:
            try:
                due_str = task.due_date.strftime("%d %b %Y")
                if task.due_time:
                    due_str += f" at {task.due_time}"
            except Exception:
                due_str = str(task.due_date)

        # Task type label
        if is_checklist_item:
            task_type_label = "Checklist Item"
        elif is_subtask or task.parent_task_id:
            task_type_label = "Subtask"
        elif task.is_personal:
            task_type_label = "Personal Task"
        else:
            task_type_label = "Project Task"

        # Project name
        project_name = task.project.name if (task.project and hasattr(task.project, "name")) else None

        # Build deep link
        base = (client_base_url or "").rstrip("/")
        if not base:
            base = resolve_client_app_url()

        if task.is_personal:
            task_url = f"{base}/my-tasks?taskId={task.id}"
        elif task.project_id:
            task_url = f"{base}/projects/{task.project_id}?taskId={task.id}"
        else:
            task_url = f"{base}/tasks?taskId={task.id}"

        ok, err = send_task_assignment_email(
            to_email=assignee.email.strip(),
            assignee_name=assignee.full_name or assignee.username or "Colleague",
            assignor_name=assignor_name,
            task_number=task.task_number or f"#{task.id}",
            task_title=task.title,
            task_type_label=task_type_label,
            project_name=project_name,
            priority=getattr(task.priority, "value", str(task.priority or "NORMAL")),
            due_date_str=due_str,
            description=task.description,
            task_url=task_url,
            checklist_item_text=item_text,
            db=db,
        )
        if not ok:
            logger.warning(f"Could not dispatch task assignment email to {assignee.email}: {err}")
    except Exception as e:
        logger.error(f"Error in notify_task_assignment_background for task {task_id}, assignee {assignee_id}: {e}", exc_info=True)
    finally:
        db.close()


def schedule_task_assignment_notification(
    task_id: int,
    assignee_id: int,
    assignor_id: int,
    background_tasks: Any = None,
    client_base_url: str = "",
    item_text: Optional[str] = None,
    is_checklist_item: bool = False,
    is_subtask: bool = False,
):
    """
    Schedules task assignment notification using FastAPI BackgroundTasks if provided,
    or falls back to an asynchronous daemon thread.
    """
    if not assignee_id or assignee_id == assignor_id:
        return

    if background_tasks is not None and hasattr(background_tasks, "add_task"):
        background_tasks.add_task(
            notify_task_assignment_background,
            task_id=task_id,
            assignee_id=assignee_id,
            assignor_id=assignor_id,
            client_base_url=client_base_url,
            item_text=item_text,
            is_checklist_item=is_checklist_item,
            is_subtask=is_subtask,
        )
    else:
        import threading
        t = threading.Thread(
            target=notify_task_assignment_background,
            args=(task_id, assignee_id, assignor_id, client_base_url, item_text, is_checklist_item, is_subtask),
            daemon=True,
        )
        t.start()

