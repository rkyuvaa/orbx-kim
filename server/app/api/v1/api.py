from fastapi import APIRouter

from app.api.v1 import (
    app_data,
    applications,
    auth,
    backup_admin,
    calendar,
    dashboard,
    document_numbering,
    final_submission,
    hr,
    masters,
    notifications,
    omnierp_webhook,
    personal_tasks,
    planned_activities,
    projects,
    public_financier,
    push_notifications,
    rbac_admin,
    recruitment,
    sms,
    smtp,
    stubs,
    tasks,
    vehicle_service,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(app_data.router)
api_router.include_router(dashboard.router)
api_router.include_router(applications.router)
api_router.include_router(final_submission.router)
api_router.include_router(public_financier.router)
api_router.include_router(smtp.router)
api_router.include_router(sms.router)
api_router.include_router(document_numbering.router)
api_router.include_router(planned_activities.router)
api_router.include_router(notifications.router)
api_router.include_router(push_notifications.router)
api_router.include_router(masters.router)
api_router.include_router(hr.router)
api_router.include_router(omnierp_webhook.router)
api_router.include_router(recruitment.router)
api_router.include_router(projects.router)
api_router.include_router(personal_tasks.router)
api_router.include_router(tasks.router)
api_router.include_router(calendar.router)
api_router.include_router(vehicle_service.router)
api_router.include_router(rbac_admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(backup_admin.router, prefix="/admin/backup", tags=["backup"])
api_router.include_router(stubs.router)
