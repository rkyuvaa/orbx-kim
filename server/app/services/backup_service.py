import io
import json
import os
import shutil
import zipfile
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.models import (
    Action,
    Activity,
    ActivityLog,
    ActivityType,
    Application,
    ApplicationSequence,
    Attendance,
    AuditLog,
    Branch,
    Candidate,
    CandidateDocument,
    CandidateStageHistory,
    CostCenter,
    CrmLeadCustomFieldValue,
    CrmTab,
    CrmTabField,
    CrmTabFilter,
    CrmTabStageMapping,
    Delivery,
    Department,
    DepartmentUser,
    Disbursement,
    Document,
    FinanceCompany,
    FinanceSubmission,
    FinancierDocumentAccessLog,
    FinancierDocumentAccessToken,
    FinancierDocumentSendItem,
    JobRequisition,
    LeaveRequest,
    Module,
    Notification,
    PayrollRecord,
    PerformanceReview,
    Permission,
    PipelineStage,
    PlannedActivity,
    Project,
    ProjectCustomFieldDefinition,
    ProjectCustomFieldValue,
    ProjectMilestone,
    ProjectTaskList,
    ProjectPmSettings,
    ProjectPhase,
    ProjectSpace,
    ProjectStatusDef,
    ProjectType,
    ProjectWorkspace,
    WorkingCalendarHoliday,
    WorkingCalendarSetting,
    RbacUserRole,
    Resource,
    Role,
    RoleDataScope,
    RoleFieldPermission,
    RolePermission,
    Sanction,
    SmtpSetting,
    SmsSetting,
    StageAutomoveRule,
    Task,
    TaskActivity,
    TaskAssignee,
    TaskAttachment,
    TaskAutomationRule,
    TaskChecklist,
    TaskChecklistItem,
    TaskComment,
    TaskCustomFieldDefinition,
    TaskCustomFieldValue,
    TaskDependency,
    TaskFollower,
    TaskRelationship,
    TaskStatusDef,
    TaskSubtask,
    TaskTag,
    TaskTagMap,
    TaskTemplate,
    TaskTimeEntry,
    TaskTimeLog,
    TaskType,
    User,
    UserPermission,
    VehicleModel,
    Verification,
    WeeklyOffDay,
)

UPLOAD_DIR_PATH = Path("uploads")


def get_upload_dirs() -> List[Path]:
    """Finds all existing upload root paths across development and container layouts."""
    candidates = [
        Path("uploads"),
        Path("server/uploads"),
        Path("/app/uploads"),
        Path(__file__).resolve().parent.parent.parent.parent / "uploads",
        Path(__file__).resolve().parent.parent.parent / "uploads",
    ]
    seen = set()
    valid_dirs = []
    for p in candidates:
        try:
            resolved = p.resolve()
            if resolved not in seen and resolved.exists() and resolved.is_dir():
                seen.add(resolved)
                valid_dirs.append(p)
        except Exception:
            pass
    return valid_dirs or [Path("uploads")]


def get_primary_upload_dir() -> Path:
    dirs = get_upload_dirs()
    return dirs[0]

# Baseline topological model ordering across all standard system domains
BASELINE_MODELS = [
    ("finance_companies", FinanceCompany),
    ("pipeline_stages", PipelineStage),
    ("vehicle_models", VehicleModel),
    ("users", User),
    ("branches", Branch),
    ("departments", Department),
    ("cost_centers", CostCenter),
    ("roles", Role),
    ("modules", Module),
    ("resources", Resource),
    ("actions", Action),
    ("permissions", Permission),
    ("role_permissions", RolePermission),
    ("role_data_scopes", RoleDataScope),
    ("role_field_permissions", RoleFieldPermission),
    ("department_users", DepartmentUser),
    ("user_roles", RbacUserRole),
    ("user_permissions", UserPermission),
    ("smtp_settings", SmtpSetting),
    ("sms_settings", SmsSetting),
    ("stage_automove_rules", StageAutomoveRule),
    ("crm_tabs", CrmTab),
    ("crm_tab_fields", CrmTabField),
    ("crm_tab_stage_mappings", CrmTabStageMapping),
    ("crm_tab_filters", CrmTabFilter),
    ("application_sequences", ApplicationSequence),
    ("applications", Application),
    ("crm_lead_custom_field_values", CrmLeadCustomFieldValue),
    ("documents", Document),
    ("verifications", Verification),
    ("finance_submissions", FinanceSubmission),
    ("sanctions", Sanction),
    ("deliveries", Delivery),
    ("disbursements", Disbursement),
    ("activity_types", ActivityType),
    ("activities", Activity),
    ("activity_logs", ActivityLog),
    ("planned_activities", PlannedActivity),
    ("notifications", Notification),
    ("financier_document_access_tokens", FinancierDocumentAccessToken),
    ("financier_document_send_items", FinancierDocumentSendItem),
    ("financier_document_access_logs", FinancierDocumentAccessLog),
    # HR & Employee Module
    ("hr_attendance", Attendance),
    ("hr_leave_requests", LeaveRequest),
    ("hr_payroll_records", PayrollRecord),
    ("hr_performance_reviews", PerformanceReview),
    ("hr_job_requisitions", JobRequisition),
    ("hr_candidates", Candidate),
    ("hr_candidate_stage_history", CandidateStageHistory),
    ("hr_candidate_documents", CandidateDocument),
    # Projects & Tasks Module
    ("project_types", ProjectType),
    ("project_statuses", ProjectStatusDef),
    ("task_types", TaskType),
    ("task_statuses", TaskStatusDef),
    ("project_workspaces", ProjectWorkspace),
    ("project_spaces", ProjectSpace),
    ("projects", Project),
    ("project_phases", ProjectPhase),
    ("project_milestones", ProjectMilestone),
    ("project_task_lists", ProjectTaskList),
    ("tasks", Task),
    ("task_assignees", TaskAssignee),
    ("task_followers", TaskFollower),
    ("task_tags", TaskTag),
    ("task_tag_mappings", TaskTagMap),
    ("task_checklists", TaskChecklist),
    ("task_checklist_items", TaskChecklistItem),
    ("task_time_entries", TaskTimeEntry),
    ("task_attachments", TaskAttachment),
    ("task_subtasks", TaskSubtask),
    ("task_time_logs", TaskTimeLog),
    ("task_comments", TaskComment),
    ("task_dependencies", TaskDependency),
    ("task_relationships", TaskRelationship),
    ("task_activities", TaskActivity),
    ("task_templates", TaskTemplate),
    ("task_automations", TaskAutomationRule),
    ("project_custom_field_definitions", ProjectCustomFieldDefinition),
    ("project_custom_field_values", ProjectCustomFieldValue),
    ("project_pm_settings", ProjectPmSettings),
    ("weekly_off_days", WeeklyOffDay),
    ("working_calendar_holidays", WorkingCalendarHoliday),
    ("working_calendar_settings", WorkingCalendarSetting),
    ("task_custom_field_definitions", TaskCustomFieldDefinition),
    ("task_custom_field_values", TaskCustomFieldValue),
]


def get_all_system_models() -> List[Tuple[str, Any]]:
    """Dynamically discovers all SQLAlchemy models inheriting from Base across all application modules,
    topologically ordered by foreign-key relationships.
    Automatically includes any newly created modules, tables, or models without manual registration.
    """
    import importlib
    import pkgutil
    import app.models
    from app.db.base import Base

    # 1. Dynamically import all submodules in app.models to ensure everything is registered on Base
    if hasattr(app.models, "__path__"):
        for _, module_name, _ in pkgutil.iter_modules(app.models.__path__):
            try:
                importlib.import_module(f"app.models.{module_name}")
            except Exception:
                pass

    # 2. Build mapping of table_name -> Model class
    table_to_model = {}
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        tbl_name = getattr(cls, "__tablename__", None)
        if tbl_name:
            table_to_model[tbl_name] = cls

    ordered = []
    seen = set()

    # 3. Add known baseline tables in tested topological order first
    for tname, model in BASELINE_MODELS:
        model_cls = table_to_model.get(tname, model)
        if tname not in seen:
            ordered.append((tname, model_cls))
            seen.add(tname)

    # 4. Automatically add ANY newly created tables in foreign-key dependency order
    for table in Base.metadata.sorted_tables:
        tname = table.name
        if tname == "audit_logs":
            continue
        if tname in table_to_model and tname not in seen:
            ordered.append((tname, table_to_model[tname]))
            seen.add(tname)

    # 5. Fallback for any model class registered on Base that wasn't in sorted_tables
    for tname, model_cls in table_to_model.items():
        if tname == "audit_logs":
            continue
        if tname not in seen:
            ordered.append((tname, model_cls))
            seen.add(tname)

    return ordered


# Dynamic module-level alias for backward compatibility
TABLE_MODELS = get_all_system_models()


def serialize_value(val: Any) -> Any:
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Enum):
        return val.value
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, bool):
        return val
    return val


def sql_format_value(val: Any) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, str) and val.strip().lower() in ("true", "false"):
        return "TRUE" if val.strip().lower() == "true" else "FALSE"
    if isinstance(val, (int, float, Decimal)):
        return str(val)
    if isinstance(val, (datetime, date)):
        return f"'{val.isoformat()}'"
    if isinstance(val, Enum):
        escaped = str(val.value).replace("'", "''")
        return f"'{escaped}'"
    if isinstance(val, (dict, list)):
        escaped = json.dumps(val).replace("'", "''")
        return f"'{escaped}'"
    
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def deserialize_value(val: Any, col: Any) -> Any:
    """Deserializes raw JSON or string values into exact Python/SQLAlchemy types for column ingestion."""
    col_type = getattr(col, "type", col)
    type_str = str(col_type).upper()
    is_nullable = getattr(col, "nullable", True)

    if val is None:
        if not is_nullable:
            if "BOOL" in type_str:
                return False
            if "INT" in type_str and not ("POINT" in type_str):
                return 0
            if any(k in type_str for k in ("FLOAT", "NUMERIC", "DECIMAL", "REAL", "DOUBLE")):
                return 0.0
            if any(k in type_str for k in ("VARCHAR", "STRING", "TEXT")):
                return ""
        return None

    # 1. Booleans (crucial for PostgreSQL which rejects string 'true'/'false')
    if "BOOL" in type_str:
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            clean = val.strip().lower()
            return clean in ("true", "t", "1", "yes", "y")
        if isinstance(val, (int, float)):
            return bool(val)
        return bool(val)

    # 2. Datetime / Timestamp
    if "DATETIME" in type_str or "TIMESTAMP" in type_str:
        if isinstance(val, str):
            try:
                val_clean = val.replace("Z", "+00:00")
                return datetime.fromisoformat(val_clean)
            except Exception:
                return val
        return val

    # 3. Date
    elif "DATE" in type_str:
        if isinstance(val, str):
            try:
                return date.fromisoformat(val.split("T")[0])
            except Exception:
                return val
        return val

    # 4. JSON / Dict / List
    elif "JSON" in type_str:
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return val
        return val

    # 5. Integers
    elif "INT" in type_str and not ("POINT" in type_str):
        if isinstance(val, str):
            clean = val.strip()
            if clean.lstrip("-").isdigit():
                return int(clean)
        return val

    # 6. Float / Numeric / Decimal
    elif any(k in type_str for k in ("FLOAT", "NUMERIC", "DECIMAL", "REAL", "DOUBLE")):
        if isinstance(val, str):
            try:
                return float(val.strip())
            except ValueError:
                return val
        return val

    # 7. Enum
    if hasattr(col_type, "enum_class") and col_type.enum_class:
        if isinstance(val, str):
            try:
                return col_type.enum_class(val)
            except Exception:
                pass

    return val


def create_system_backup(db: Session, include_audit_logs: bool = False) -> Dict[str, Any]:
    """Serializes all database tables into a JSON-compatible dict payload."""
    tables_payload = {}
    record_counts = {}

    models_to_export = list(get_all_system_models())
    if include_audit_logs:
        models_to_export.append(("audit_logs", AuditLog))

    for key, model in models_to_export:
        mapper = inspect(model)
        columns = {col.key: col for col in mapper.columns}
        
        records = db.scalars(select(model)).unique().all()
        rows = []
        for rec in records:
            row_data = {}
            for col_name, col in columns.items():
                val = getattr(rec, col_name)
                if "BOOL" in str(col.type).upper() and val is not None:
                    if isinstance(val, str):
                        val = val.strip().lower() in ("true", "t", "1", "yes", "y")
                    elif isinstance(val, (int, float)):
                        val = bool(val)
                row_data[col_name] = serialize_value(val)
            rows.append(row_data)
        
        tables_payload[key] = rows
        record_counts[key] = len(rows)

    return {
        "metadata": {
            "version": "1.0",
            "app": "CRMFinance",
            "created_at": datetime.utcnow().isoformat(),
            "total_tables": len(tables_payload),
            "record_counts": record_counts,
        },
        "data": tables_payload,
    }


def generate_sql_dump(db: Session, include_audit_logs: bool = False) -> str:
    """Generates standard SQL script containing DDL/INSERT statements for all system tables."""
    sql_lines = [
        "-- ========================================================",
        "-- CRMFinance System SQL Database Dump",
        f"-- Exported at: {datetime.utcnow().isoformat()} UTC",
        "-- ========================================================\n",
        "BEGIN;\n"
    ]

    models_to_export = list(get_all_system_models())
    if include_audit_logs:
        models_to_export.append(("audit_logs", AuditLog))

    for key, model in models_to_export:
        table_name = model.__tablename__
        mapper = inspect(model)
        columns = {col.key: col for col in mapper.columns}

        records = db.scalars(select(model)).unique().all()
        sql_lines.append(f"-- Table: {table_name}")

        if records:
            for rec in records:
                col_sql = ", ".join([f'"{col}"' for col in columns.keys()])
                vals = []
                for col_name, col in columns.items():
                    val = getattr(rec, col_name)
                    if "BOOL" in str(col.type).upper() and val is not None:
                        if isinstance(val, str):
                            val = val.strip().lower() in ("true", "t", "1", "yes", "y")
                        elif isinstance(val, (int, float)):
                            val = bool(val)
                    vals.append(sql_format_value(val))
                val_sql = ", ".join(vals)
                sql_lines.append(f'INSERT INTO "{table_name}" ({col_sql}) VALUES ({val_sql});')
        else:
            sql_lines.append(f"-- (0 records in {table_name})")

        sql_lines.append("")

    sql_lines.append("COMMIT;\n")
    return "\n".join(sql_lines)


def create_system_zip_backup(db: Session, target_upload_dir: Optional[Path] = None) -> bytes:
    """Generates a complete system backup ZIP containing SQL dump, JSON metadata, and uploaded images/files."""
    backup_payload = create_system_backup(db, include_audit_logs=True)
    sql_dump_str = generate_sql_dump(db, include_audit_logs=True)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # 1. Add SQL Dump
        zip_file.writestr("database_dump.sql", sql_dump_str.encode("utf-8"))

        # 2. Add JSON Backup
        zip_file.writestr("backup_data.json", json.dumps(backup_payload, indent=2, ensure_ascii=False).encode("utf-8"))

        # 3. Add Uploaded images / files directory (all attachment subdirectories)
        uploaded_files_count = 0
        added_rel_paths = set()
        scan_dirs = [target_upload_dir] if target_upload_dir is not None else get_upload_dirs()

        for base_dir in scan_dirs:
            if base_dir.exists() and base_dir.is_dir():
                for root, _, files in os.walk(base_dir):
                    for file in files:
                        file_path = Path(root) / file
                        rel_path = file_path.relative_to(base_dir)
                        if rel_path not in added_rel_paths:
                            arcname = Path("uploads") / rel_path
                            zip_file.write(file_path, arcname=str(arcname))
                            added_rel_paths.add(rel_path)
                            uploaded_files_count += 1

        # 4. Manifest
        manifest = {
            "app": "CRMFinance",
            "created_at": datetime.utcnow().isoformat(),
            "format": "zip_full_backup",
            "uploaded_files_count": uploaded_files_count,
            "database_tables": backup_payload["metadata"]["total_tables"],
        }
        zip_file.writestr("manifest.json", json.dumps(manifest, indent=2).encode("utf-8"))

    zip_buffer.seek(0)
    return zip_buffer.getvalue()


def restore_system_backup(db: Session, backup_payload: Dict[str, Any], mode: str = "overwrite") -> Dict[str, Any]:
    """Restores database tables from a backup payload dict."""
    if "data" not in backup_payload:
        raise ValueError("Invalid backup file format: missing 'data' key.")

    tables_data = backup_payload["data"]
    restored_summary = {}

    is_postgres = False
    try:
        is_postgres = db.bind is not None and db.bind.dialect.name == "postgresql"
    except Exception:
        pass

    try:
        if is_postgres:
            db.execute(text("SET session_replication_role = 'replica';"))
        elif db.bind and db.bind.dialect.name == "sqlite":
            db.execute(text("PRAGMA foreign_keys = OFF;"))

        models_to_restore = get_all_system_models()

        if mode == "overwrite":
            for key, model in reversed(models_to_restore):
                db.query(model).delete(synchronize_session=False)
            db.flush()
            db.expire_all()

        for key, model in models_to_restore:
            if key not in tables_data:
                continue

            mapper = inspect(model)
            columns = {col.key: col for col in mapper.columns}
            rows = tables_data[key]
            inserted_count = 0

            for row_dict in rows:
                processed_row = {}
                for col_name, val in row_dict.items():
                    if col_name in columns:
                        processed_row[col_name] = deserialize_value(val, columns[col_name])
                
                if mode == "merge":
                    pk_cols = [pk.key for pk in mapper.primary_key]
                    pk_filter = {pk: processed_row[pk] for pk in pk_cols if pk in processed_row}
                    existing = None
                    if pk_filter and len(pk_filter) == len(pk_cols):
                        existing = db.query(model).filter_by(**pk_filter).first()
                    
                    if existing:
                        for k, v in processed_row.items():
                            setattr(existing, k, v)
                    else:
                        obj = model(**processed_row)
                        db.add(obj)
                else:
                    obj = model(**processed_row)
                    db.add(obj)

                inserted_count += 1

            db.flush()
            restored_summary[key] = inserted_count

        if is_postgres:
            for key, model in models_to_restore:
                table_name = model.__tablename__
                try:
                    db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name};"))
                except Exception:
                    pass
            db.execute(text("SET session_replication_role = 'origin';"))
        elif db.bind and db.bind.dialect.name == "sqlite":
            db.execute(text("PRAGMA foreign_keys = ON;"))

        db.commit()
    except Exception as e:
        db.rollback()
        if is_postgres:
            try:
                db.execute(text("SET session_replication_role = 'origin';"))
            except Exception:
                pass
        raise RuntimeError(f"Backup restoration failed: {str(e)}") from e

    return {
        "status": "success",
        "message": "System data successfully restored.",
        "restored_tables": restored_summary,
    }


def restore_system_zip_backup(
    db: Session,
    zip_bytes: bytes,
    mode: str = "overwrite",
    target_upload_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Restores database AND uploaded images/files from a complete ZIP backup archive."""
    try:
        zip_buffer = io.BytesIO(zip_bytes)
        with zipfile.ZipFile(zip_buffer, "r") as zip_file:
            filenames = zip_file.namelist()

            # 1. Restore Database
            backup_payload = None
            if "backup_data.json" in filenames:
                json_bytes = zip_file.read("backup_data.json")
                backup_payload = json.loads(json_bytes.decode("utf-8"))
            
            if not backup_payload:
                raise ValueError("ZIP package missing 'backup_data.json' database archive.")

            db_result = restore_system_backup(db, backup_payload, mode=mode)

            # 2. Restore Uploaded files/images
            dest_dir = target_upload_dir if target_upload_dir is not None else get_primary_upload_dir()
            dest_dir.mkdir(parents=True, exist_ok=True)
            restored_files_count = 0

            for member in zip_file.infolist():
                if member.filename.startswith("uploads/") and not member.is_dir():
                    rel_path = Path(member.filename).relative_to("uploads")
                    dest_file = dest_dir / rel_path
                    dest_file.parent.mkdir(parents=True, exist_ok=True)

                    with zip_file.open(member) as source, open(dest_file, "wb") as target:
                        shutil.copyfileobj(source, target)
                    restored_files_count += 1

            return {
                "status": "success",
                "message": f"Successfully restored database and {restored_files_count} uploaded files/images.",
                "restored_tables": db_result.get("restored_tables", {}),
                "restored_files_count": restored_files_count,
            }
    except Exception as e:
        raise RuntimeError(f"ZIP Backup restoration failed: {str(e)}") from e


def get_system_summary(db: Session) -> Dict[str, Any]:
    """Returns database record counts for summary inspection."""
    summary = {}
    for key, model in get_all_system_models():
        count = db.query(model).count()
        summary[key] = count
    return summary
