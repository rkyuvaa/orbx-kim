import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging import get_logger, setup_logging

def _ensure_schema_migrations():
    try:
        import app.models  # Ensures all SQLAlchemy models register on Base.metadata
        from sqlalchemy import inspect, text
        from app.db.base import Base
        from app.db.session import engine

        # 1. Create missing tables
        Base.metadata.create_all(bind=engine)

        # 2. Inspect database and auto-add missing columns to existing tables
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        for table_name, table_obj in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue

            db_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col in table_obj.columns:
                if col.name not in db_cols:
                    col_name = col.name
                    # Determine column type DDL
                    col_type_sql = None
                    if hasattr(col.type, "name") and col.type.name:
                        enum_name = col.type.name
                        try:
                            with engine.begin() as conn:
                                enum_vals = "', '".join([str(getattr(e, 'value', e)) for e in col.type.enums])
                                conn.execute(text(f"CREATE TYPE {enum_name} AS ENUM ('{enum_vals}')"))
                        except Exception:
                            pass
                        col_type_sql = enum_name

                    if not col_type_sql:
                        try:
                            col_type_sql = str(col.type.compile(engine.dialect))
                        except Exception:
                            col_type_sql = "VARCHAR(255)"

                    # Build default SQL if present
                    default_sql = ""
                    if col.server_default is not None and hasattr(col.server_default, "arg"):
                        default_sql = f" DEFAULT {col.server_default.arg}"
                    elif col.default is not None and not callable(getattr(col.default, 'arg', None)):
                        default_sql = f" DEFAULT '{col.default.arg}'"

                    added = False
                    # Check dialect to use appropriate syntax
                    is_sqlite = engine.dialect.name == "sqlite"
                    alter_prefix = f'ALTER TABLE "{table_name}" ADD COLUMN'
                    if_not_exists = "" if is_sqlite else " IF NOT EXISTS"

                    try:
                        with engine.begin() as conn:
                            conn.execute(
                                text(
                                    f'{alter_prefix}{if_not_exists} "{col_name}" {col_type_sql}{default_sql}'
                                )
                            )
                        added = True
                    except Exception as first_err:
                        pass

                    if not added:
                        try:
                            with engine.begin() as conn:
                                conn.execute(
                                    text(
                                        f'{alter_prefix}{if_not_exists} "{col_name}" VARCHAR(255)'
                                    )
                                )
                        except Exception as col_err:
                            import logging
                            logging.error(f"Failed to auto-add column {table_name}.{col_name}: {col_err}")

        # Ensure auto_schedule column on tasks table
        if "tasks" in existing_tables:
            task_cols = {c["name"] for c in inspector.get_columns("tasks")}
            if "auto_schedule" not in task_cols:
                try:
                    with engine.begin() as conn:
                        is_sqlite = engine.dialect.name == "sqlite"
                        if_not_exists = "" if is_sqlite else " IF NOT EXISTS"
                        conn.execute(text(f'ALTER TABLE tasks ADD COLUMN{if_not_exists} auto_schedule BOOLEAN DEFAULT TRUE'))
                        conn.execute(text('UPDATE tasks SET auto_schedule = TRUE WHERE auto_schedule IS NULL'))
                except Exception:
                    pass

        # Ensure lead_source on applications is VARCHAR instead of ENUM on PostgreSQL
        if "applications" in existing_tables:
            try:
                with engine.begin() as conn:
                    if engine.dialect.name == "postgresql":
                        conn.execute(text('DROP INDEX IF EXISTS ix_applications_lead_source'))
                        conn.execute(text('ALTER TABLE applications ALTER COLUMN lead_source TYPE VARCHAR(100) USING lead_source::text'))
                        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_applications_lead_source ON applications (lead_source)'))
            except Exception as ls_err:
                import logging
                logging.error(f"Failed to convert lead_source to VARCHAR: {ls_err}")

        # 3. Seed default task statuses if empty
        if "task_statuses" in existing_tables:
            try:
                with engine.begin() as conn:
                    res = conn.execute(text("SELECT COUNT(*) FROM task_statuses")).scalar()
                    if res == 0:
                        conn.execute(
                            text(
                                "INSERT INTO task_statuses (id, name, color, display_order, is_terminal, category, is_active) VALUES "
                                "(1, 'To Do', '#64748B', 1, false, 'ACTIVE', true), "
                                "(2, 'In Progress', '#2563EB', 2, false, 'ACTIVE', true), "
                                "(3, 'In Review', '#D97706', 3, false, 'ACTIVE', true), "
                                "(4, 'Done', '#16A34A', 4, true, 'ACTIVE', true), "
                                "(5, 'Blocked', '#DC2626', 5, false, 'ACTIVE', true)"
                            )
                        )
                        try:
                            conn.execute(text("SELECT setval(pg_get_serial_sequence('task_statuses', 'id'), 5)"))
                        except Exception:
                            pass
            except Exception:
                pass

        # 4. Auto-seed RBAC permissions matrix
        try:
            from app.db.session import SessionLocal
            from app.db.seed_rbac import seed_rbac_data
            with SessionLocal() as db:
                seed_rbac_data(db)
        except Exception as seed_err:
            import logging
            logging.error(f"RBAC seed error: {seed_err}")

        # 5. Resequence existing project task numbers to match project prefix/code starting from 1
        try:
            from app.db.session import SessionLocal
            from app.models.projects import Project, Task
            with SessionLocal() as db:
                projects = db.query(Project).all()
                for proj in projects:
                    p_prefix = (proj.prefix or proj.code or "").strip().upper()
                    if not p_prefix:
                        continue
                    p_tasks = db.query(Task).filter(
                        Task.project_id == proj.id,
                        Task.is_deleted.is_(False)
                    ).order_by(Task.id.asc()).all()
                    for idx, t in enumerate(p_tasks, start=1):
                        expected_num = f"{p_prefix}-{idx}"
                        if t.task_number != expected_num:
                            t.task_number = expected_num
                            db.add(t)
                db.commit()
        except Exception as reseq_err:
            import logging
            logging.error(f"Task resequence error: {reseq_err}")

        # 6. Auto-clean legacy sample opportunity records
        try:
            with engine.begin() as conn:
                for tbl, col in [
                    ("activities", "application_id"),
                    ("deliveries", "application_id"),
                    ("disbursements", "application_id"),
                    ("documents", "application_id"),
                    ("finance_submissions", "application_id"),
                    ("sanctions", "application_id"),
                    ("verifications", "application_id"),
                    ("activity_logs", "application_id"),
                    ("planned_activities", "application_id"),
                    ("crm_lead_custom_field_values", "application_id"),
                    ("financier_document_access_tokens", "application_id"),
                    ("financier_document_access_logs", "application_id"),
                ]:
                    try:
                        conn.execute(
                            text(f'DELETE FROM "{tbl}" WHERE "{col}" IN (SELECT id FROM applications WHERE status != \'LEAD\' AND app_no LIKE \'APP-%\')')
                        )
                    except Exception:
                        pass
                try:
                    conn.execute(
                        text("DELETE FROM applications WHERE status != 'LEAD' AND app_no LIKE 'APP-%'")
                    )
                except Exception:
                    pass
        except Exception as clean_err:
            import logging
            logging.error(f"Opportunity sample cleanup error: {clean_err}")
    except Exception as err:
        import logging
        logging.error(f"Migration check error: {err}")


setup_logging()
logger = get_logger("app")
_ensure_schema_migrations()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

cors_origins = settings.cors_origin_list
allow_origin_regex = None

if "*" in cors_origins:
    cors_origins = []
    allow_origin_regex = r".*"
elif not any("192.168." in o or "10." in o or "172." in o for o in cors_origins):
    allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "request_failed",
            extra={"request_id": request_id, "path": request.url.path},
        )
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        "request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    response.headers["X-Request-Id"] = request_id
    return response


app.include_router(api_router, prefix=settings.api_v1_prefix)

@app.on_event("startup")
async def startup_event():
    from app.services.scheduler import start_scheduler
    start_scheduler()


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
