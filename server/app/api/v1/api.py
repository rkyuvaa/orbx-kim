from fastapi import APIRouter

from app.api.v1 import (
    applications,
    auth,
    backup_admin,
    dashboard,
    final_submission,
    hr,
    recruitment,
    masters,
    notifications,
    planned_activities,
    projects,
    public_financier,
    rbac_admin,
    smtp,
    stubs,
    personal_tasks,
    tasks,
    calendar,
    vehicle_service,
    document_numbering,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(applications.router)
api_router.include_router(final_submission.router)
api_router.include_router(public_financier.router)
api_router.include_router(smtp.router)
api_router.include_router(document_numbering.router)
api_router.include_router(planned_activities.router)
api_router.include_router(notifications.router)
api_router.include_router(masters.router)
api_router.include_router(hr.router)
api_router.include_router(recruitment.router)
api_router.include_router(projects.router)
api_router.include_router(personal_tasks.router)
api_router.include_router(tasks.router)
api_router.include_router(calendar.router)
api_router.include_router(vehicle_service.router)
api_router.include_router(rbac_admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(backup_admin.router, prefix="/admin/backup", tags=["backup"])
api_router.include_router(stubs.router)
