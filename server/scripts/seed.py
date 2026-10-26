"""Idempotent seed script. Ports every mockup value from
docs/reference/finance_pro_dashboard_ui.html into the database.

Run via: python -m scripts.seed   (safe to run repeatedly; skips if data exists)
"""
import random
from datetime import timedelta

from sqlalchemy import func

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    Activity,
    ActivityType,
    Application,
    ApplicationStatus,
    CrmTab,
    CrmTabField,
    CrmTabStageMapping,
    Delivery,
    DeliveryStatus,
    Disbursement,
    DisbursementStatus,
    DocStatus,
    Document,
    FinanceCompany,
    FinanceStatus,
    FinanceSubmission,
    Notification,
    PipelineStage,
    Sanction,
    User,
    UserRole,
    VehicleModel,
    Verification,
    VerificationStatus,
)
from app.services.aging import utcnow

NAME_POOL = [
    "Amit S.", "Bhavna R.", "Chandan P.", "Dinesh K.", "Eswar V.", "Farhan A.",
    "Ganesh M.", "Harini T.", "Ishwar L.", "Jaya N.", "Kavya B.", "Logesh W.",
    "Meena D.", "Naveen G.", "Omar J.", "Pooja H.", "Qadir F.", "Ravi C.",
    "Sandhya E.", "Tharun I.", "Uma B.", "Vignesh S.", "Yasmin R.", "Zoya M.",
    "Arvind N.", "Bharat P.", "Chitra V.", "Deepak J.", "Elango S.", "Giri K.",
]
PHONE_BASE = ["9812000000", "9823000000", "9834000000", "9845000000", "9856000000",
              "9867000000", "9878000000", "9899000000", "9900100000", "9911200000",
              "9922300000", "9933400000", "9944500000", "9955600000", "9966700000",
              "9977800000", "9988900000", "9710000000", "9721100000", "9732200000",
              "9743300000", "9754400000", "9765500000", "9776600000", "9787700000",
              "9798800000", "9620000000", "9631100000", "9642200000", "9653300000"]
# (app_no, name, phone, amount, status, updated_ago, extra)
FEATURED = []

QUERY_NOTES = {}

QUERY_WAIT_HOURS = {}

STATUS_COUNTS = {
    ApplicationStatus.LEAD: 128,
}

TODAY_LEADS = 24
UNASSIGNED_LEADS = 8
SALES_ASSIGNED = set()

WAIT_WHO = {}

VERIF_WAIT = {}
DOC_WAIT = {}

DISB_PENDING = {}
DISB_PENDING_FILLER_HOURS = []

COMPANIES = [
    ("ABC Finance", 48, 39, 4, 1.4),
    ("XYZ Finance", 35, 27, 5, 1.8),
    ("PQR Finance", 22, 18, 2, 2.1),
]

# (name, vehicle_price, down_payment, loan_amount)
VEHICLE_MODELS = [
    ("Konwert EV Auto", 550000, 55000, 495000),
    ("Konwert EV Lite", 420000, 42000, 378000),
    ("Konwert EV Max", 680000, 68000, 612000),
]

# (key, label, status, order_index)
PIPELINE_STAGES = [
    ("leads", "Leads", ApplicationStatus.LEAD, 0),
    ("applications", "Applications", ApplicationStatus.APPLICATION, 1),
    ("verification", "Verification", ApplicationStatus.VERIFICATION, 2),
    ("finance", "Finance", ApplicationStatus.FINANCE, 3),
    ("query", "Query", ApplicationStatus.QUERY, 4),
    ("sanctioned", "Sanctioned", ApplicationStatus.SANCTIONED, 5),
    ("delivery", "Delivery", ApplicationStatus.DELIVERY, 6),
    ("disburse", "Disburse", ApplicationStatus.DISBURSEMENT, 7),
    ("completed", "Completed", ApplicationStatus.COMPLETED, 8),
]

DEFAULT_ACTIVITY_TYPES = [
    ("Phone Call", "Customer phone discussion / inquiry"),
    ("Follow-up", "Lead status or document follow-up"),
    ("Site Visit", "Customer location or dealership visit"),
    ("Document Collection", "Collecting physical KYC or financial proofs"),
    ("Meeting", "In-person or virtual meeting"),
]

NOTIFICATIONS = []

ACTIVITIES = []


def _gen_filler(status: ApplicationStatus, idx: int, app_no: str, models: list[VehicleModel]) -> Application:
    name = NAME_POOL[idx % len(NAME_POOL)]
    model = models[idx % len(models)]
    return Application(
        app_no=app_no,
        customer_name=name,
        customer_phone=PHONE_BASE[idx % len(PHONE_BASE)],
        vehicle=model.name,
        vehicle_model_id=model.id,
        vehicle_price=model.vehicle_price,
        down_payment=model.down_payment,
        amount=model.loan_amount,
        status=status,
    )


def _ensure_masters(db) -> dict[str, FinanceCompany]:
    companies: dict[str, FinanceCompany] = {}
    for name, total, approved, rejected, avg in COMPANIES:
        c = db.query(FinanceCompany).filter_by(name=name).first()
        if not c:
            c = FinanceCompany(
                name=name, total_apps=total, approved=approved,
                rejected=rejected, avg_time_days=avg,
            )
            db.add(c)
        companies[name] = c
    db.flush()

    now = utcnow()
    for name, price, down, loan in VEHICLE_MODELS:
        existing = db.query(VehicleModel).filter_by(name=name).first()
        if existing:
            existing.vehicle_price = price
            existing.down_payment = down
            existing.loan_amount = loan
            existing.updated_at = now
        else:
            db.add(VehicleModel(
                name=name, vehicle_price=price, down_payment=down, loan_amount=loan,
                created_at=now, updated_at=now,
            ))
    db.flush()

    for key, label, status, order in PIPELINE_STAGES:
        stg_module = "LEAD" if status == ApplicationStatus.LEAD else "OPPORTUNITY"
        existing = db.query(PipelineStage).filter_by(key=key).first()
        if existing:
            existing.label = label
            existing.status = status
            existing.module = stg_module
            existing.order_index = order
            existing.enabled = True
            existing.updated_at = now
        else:
            db.add(PipelineStage(
                key=key, label=label, status=status, module=stg_module, order_index=order, enabled=True,
                created_at=now, updated_at=now,
            ))
    db.flush()

    for name, desc in DEFAULT_ACTIVITY_TYPES:
        existing = db.query(ActivityType).filter_by(name=name).first()
        if not existing:
            db.add(ActivityType(
                name=name, description=desc, icon="Calendar",
                created_at=now, updated_at=now,
            ))
    db.flush()

    DEFAULT_TABS = [
        ("LEAD", "Lead Details", "lead_details", "Default lead capture and qualification fields", "UserCheck", 1, True, "EVERYONE", []),
        ("OPPORTUNITY", "All Opportunities", "all_opportunities", "All active opportunities across stages", "Target", 1, True, "EVERYONE", []),
        ("OPPORTUNITY", "Document Upload", "document_upload", "Manage KYC, PAN, Bank Statements and income proofs", "FileText", 2, False, "EVERYONE", []),
        ("OPPORTUNITY", "Document Verification", "document_verification", "Synchronized document quality score analysis & manual verification", "CheckSquare", 3, False, "EVERYONE", ["verification"]),
        ("OPPORTUNITY", "Final Submission", "final_submission", "Review document readiness and send secure link to financier", "Send", 4, False, "EVERYONE", []),
        ("OPPORTUNITY", "Finance Approval", "finance_approval", "Finance applications under review by financier", "Building2", 5, False, "EVERYONE", ["finance", "query"]),
        ("OPPORTUNITY", "Loan Sanctioned", "loan_sanctioned", "Approved and sanctioned loan applications", "CheckCircle2", 6, False, "EVERYONE", ["sanctioned"]),
        ("OPPORTUNITY", "Disbursement", "disbursement", "Disbursement in progress and bank payout", "DollarSign", 7, False, "EVERYONE", ["disburse"]),
        ("OPPORTUNITY", "Completed", "completed", "Completed and delivered deals", "Truck", 8, False, "EVERYONE", ["completed"]),
    ]

    for module_id, name, code, desc, icon, order, is_def, vis, stage_keys in DEFAULT_TABS:
        tab = db.query(CrmTab).filter_by(code=code).first()
        if not tab:
            tab = CrmTab(
                module_id=module_id,
                name=name, code=code, description=desc, icon=icon,
                display_order=order, is_default=is_def, visibility_type=vis,
                created_at=now, updated_at=now,
            )
            db.add(tab)
            db.flush()
            for s_key in stage_keys:
                st = db.query(PipelineStage).filter_by(key=s_key).first()
                if st:
                    db.add(CrmTabStageMapping(tab_id=tab.id, stage_id=st.id))
        else:
            tab.module_id = module_id
            tab.is_default = is_def

    # Ensure Lead Details tab has standard fields
    lead_tab = db.query(CrmTab).filter_by(code="lead_details").first()
    if lead_tab and not lead_tab.fields:
        default_fields = [
            {"name": "customer_name", "label": "Customer Name", "field_type": "text", "is_required": True, "display_order": 1, "placeholder": "Enter full customer name"},
            {"name": "customer_phone", "label": "Mobile Number", "field_type": "text", "is_required": True, "display_order": 2, "placeholder": "Enter 10-digit mobile number"},
            {"name": "vehicle_model_id", "label": "Vehicle Model", "field_type": "dropdown", "is_required": False, "display_order": 3, "placeholder": "Select vehicle model"},
            {"name": "vehicle_price", "label": "Vehicle Price (INR)", "field_type": "numeric", "is_required": False, "display_order": 4, "placeholder": "Enter vehicle price"},
            {"name": "down_payment", "label": "Down Payment (INR)", "field_type": "numeric", "is_required": False, "display_order": 5, "placeholder": "Enter down payment"},
            {"name": "amount", "label": "Loan Amount (INR)", "field_type": "numeric", "is_required": True, "display_order": 6, "placeholder": "Enter requested loan amount"},
            {"name": "finance_company_id", "label": "Finance Company", "field_type": "dropdown", "is_required": False, "display_order": 7, "placeholder": "Select financier"},
            {"name": "lead_source", "label": "Lead Source", "field_type": "dropdown", "is_required": False, "display_order": 8, "options": [{"label": "Walk-in", "value": "walk_in"}, {"label": "Website", "value": "website"}, {"label": "Referral", "value": "referral"}, {"label": "Dealer", "value": "dealer"}]},
            {"name": "notes", "label": "Lead Notes", "field_type": "text", "is_required": False, "display_order": 9, "placeholder": "Enter lead remarks"},
        ]
        for df in default_fields:
            db.add(CrmTabField(tab_id=lead_tab.id, **df))

    db.flush()

    return companies


from app.db.seed_rbac import seed_rbac_data


def seed() -> None:
    db = SessionLocal()
    try:
        seed_rbac_data(db)
        company_map = _ensure_masters(db)
        models = db.query(VehicleModel).order_by(VehicleModel.id).all()

        if db.query(User).count() > 0:
            print("[seed] database already seeded — skipping")
            return

        now = utcnow()
        password = settings.seed_default_password
        sales = User(
            email="sales@kim.com", password_hash=hash_password(password),
            full_name="Ramesh", role=UserRole.SALES_EXECUTIVE,
        )
        finance = User(
            email="finance@kim.com", password_hash=hash_password(password),
            full_name="Sneha K", role=UserRole.FINANCE_OFFICER,
        )
        delivery = User(
            email="delivery@kim.com", password_hash=hash_password(password),
            full_name="Vijay T", role=UserRole.DELIVERY_TEAM,
        )
        admin = User(
            email="admin@kim.com", password_hash=hash_password(password),
            full_name="Admin", role=UserRole.ADMIN,
        )
        db.add_all([sales, finance, delivery, admin])
        db.flush()

        companies = company_map

        featured_apps: dict[str, Application] = {}
        konwert = next((m for m in models if m.name == "Konwert EV Auto"), models[0] if models else None)
        for offset, (app_no, name, phone, amount, status, updated_ago) in enumerate(FEATURED):
            created = now - timedelta(days=40) - timedelta(hours=offset * 2)
            app = Application(
                app_no=app_no, customer_name=name, customer_phone=phone,
                vehicle="Konwert EV Auto", amount=amount, status=status,
                vehicle_model_id=konwert.id if konwert else None,
                vehicle_price=konwert.vehicle_price if konwert else None,
                down_payment=konwert.down_payment if konwert else None,
                created_at=created, updated_at=now - updated_ago,
                assigned_to=sales.id if app_no in SALES_ASSIGNED else None,
            )
            db.add(app)
            featured_apps[app_no] = app
        db.flush()

        next_number = 126
        lead_created_times = sorted(
            [
                now - timedelta(days=random.uniform(0, 30))
                for _ in range(STATUS_COUNTS[ApplicationStatus.LEAD])
            ]
        )
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        latest = now - timedelta(minutes=1)
        for i in range(STATUS_COUNTS[ApplicationStatus.LEAD]):
            app_no = f"APP-{next_number}"
            next_number += 1
            app = _gen_filler(ApplicationStatus.LEAD, i, app_no, models)
            created = lead_created_times[i]
            if i >= len(lead_created_times) - TODAY_LEADS:
                created = min(max(now - timedelta(hours=5), today_start + timedelta(minutes=10)), latest)
            app.created_at = created
            app.updated_at = min(created + timedelta(hours=random.uniform(1, 20)), latest)
            if i >= UNASSIGNED_LEADS:
                app.assigned_to = sales.id
            db.add(app)

        for status, count in STATUS_COUNTS.items():
            if status == ApplicationStatus.LEAD:
                continue
            for i in range(count):
                app_no = f"APP-{next_number}"
                next_number += 1
                app = _gen_filler(status, i, app_no, models)
                created = now - timedelta(days=random.uniform(60, 150))
                app.created_at = created
                app.updated_at = created + timedelta(hours=random.uniform(2, 30))
                if status in (
                    ApplicationStatus.FINANCE,
                    ApplicationStatus.QUERY,
                    ApplicationStatus.SANCTIONED,
                ):
                    app.finance_company_id = companies[list(companies.keys())[i % 3]].id
                db.add(app)
        db.flush()

        all_apps = db.query(Application).all()
        apps_by_no = {a.app_no: a for a in all_apps}
        verification_fillers = [
            a for a in all_apps if a.status == ApplicationStatus.VERIFICATION
            and a.app_no not in VERIF_WAIT and a.app_no not in DOC_WAIT
        ]
        application_fillers = [
            a for a in all_apps if a.status == ApplicationStatus.APPLICATION
        ]
        finance_apps = [a for a in all_apps if a.status == ApplicationStatus.FINANCE]
        query_apps = [a for a in all_apps if a.status == ApplicationStatus.QUERY]
        sanction_apps = [a for a in all_apps if a.status == ApplicationStatus.SANCTIONED]
        delivery_apps = [a for a in all_apps if a.status == ApplicationStatus.DELIVERY]
        disbursement_apps = [a for a in all_apps if a.status == ApplicationStatus.DISBURSEMENT]

        # ---- Documents: 37 pending (2 featured + 35 application-stage fillers) ----
        doc_fillers = application_fillers[:35]
        for app in doc_fillers:
            db.add(Document(
                application_id=app.id, doc_type="Bank Statement", status=DocStatus.PENDING,
                created_at=now - timedelta(days=random.uniform(2, 20)),
            ))
        for app_no, hours in DOC_WAIT.items():
            db.add(Document(
                application_id=apps_by_no[app_no].id, doc_type="Bank Statement",
                status=DocStatus.PENDING, created_at=now - timedelta(hours=hours),
            ))
        for app in verification_fillers:
            db.add(Document(
                application_id=app.id, doc_type="Salary Slip", status=DocStatus.APPROVED,
                created_at=now - timedelta(days=random.uniform(30, 80)),
                uploaded_at=now - timedelta(days=random.uniform(28, 75)),
            ))
        for app_no in VERIF_WAIT:
            db.add(Document(
                application_id=apps_by_no[app_no].id, doc_type="Salary Slip",
                status=DocStatus.APPROVED,
                created_at=now - timedelta(days=40), uploaded_at=now - timedelta(days=35),
            ))

        # ---- Verifications: 18 pending (2 featured + 16 application-stage fillers) ----
        verif_fillers = application_fillers[35:51]
        for app in verif_fillers:
            db.add(Verification(
                application_id=app.id, status=VerificationStatus.PENDING,
                notes="Awaiting review", created_at=now - timedelta(days=random.uniform(1, 5)),
            ))
        for app_no, hours in VERIF_WAIT.items():
            db.add(Verification(
                application_id=apps_by_no[app_no].id, status=VerificationStatus.PENDING,
                notes="Customer documents under review",
                created_at=now - timedelta(hours=hours),
            ))
        for app in verification_fillers:
            db.add(Verification(
                application_id=app.id, status=VerificationStatus.APPROVED,
                notes="All documents verified", verified_by=finance.id,
                created_at=now - timedelta(days=random.uniform(20, 80)),
                verified_at=now - timedelta(days=random.uniform(19, 79)),
            ))

        # ---- Finance submissions ----
        processing = dict(WAIT_WHO)
        for app_no, (company, hours) in processing.items():
            db.add(FinanceSubmission(
                application_id=apps_by_no[app_no].id,
                company_id=companies[company].id,
                status=FinanceStatus.PROCESSING,
                submitted_at=now - timedelta(hours=hours),
                created_at=now - timedelta(hours=hours),
            ))
        finance_fillers = [a for a in finance_apps if a.app_no not in processing]
        for i, app in enumerate(finance_fillers):
            db.add(FinanceSubmission(
                application_id=app.id,
                company_id=companies[list(companies.keys())[i % 3]].id,
                status=FinanceStatus.APPROVED,
                submitted_at=now - timedelta(days=random.uniform(20, 90)),
                created_at=now - timedelta(days=random.uniform(20, 90)),
            ))
        for app_no, hours in QUERY_WAIT_HOURS.items():
            db.add(FinanceSubmission(
                application_id=apps_by_no[app_no].id,
                company_id=companies[list(companies.keys())[len(app_no) % 3]].id,
                status=FinanceStatus.QUERY,
                query_note=QUERY_NOTES[app_no],
                submitted_at=now - timedelta(hours=hours),
                created_at=now - timedelta(hours=hours),
            ))
        query_fillers = [a for a in query_apps if a.app_no not in QUERY_WAIT_HOURS]
        for i, app in enumerate(query_fillers):
            db.add(FinanceSubmission(
                application_id=app.id,
                company_id=companies[list(companies.keys())[i % 3]].id,
                status=FinanceStatus.APPROVED,
                submitted_at=now - timedelta(days=random.uniform(30, 100)),
                created_at=now - timedelta(days=random.uniform(30, 100)),
            ))

        # ---- Sanctions (one per sanctioned app) ----
        for app in sanction_apps:
            db.add(Sanction(
                application_id=app.id, status="SANCTIONED",
                created_at=now - timedelta(days=random.uniform(3, 60)),
                sanctioned_at=now - timedelta(days=random.uniform(2, 59)),
            ))

        # ---- Deliveries: 3 pending, rest delivered/in-transit ----
        pending_delivery = delivery_apps[:3]
        for app in pending_delivery:
            db.add(Delivery(
                application_id=app.id, status=DeliveryStatus.PENDING,
                created_at=now - timedelta(hours=random.uniform(2, 30)),
            ))
        for app in delivery_apps[3:]:
            db.add(Delivery(
                application_id=app.id, status=DeliveryStatus.DELIVERED,
                created_at=now - timedelta(days=random.uniform(10, 80)),
                delivered_at=now - timedelta(days=random.uniform(5, 75)),
            ))

        # ---- Disbursements: 6 pending UTR (2 old enough to be flagged), rest completed ----
        for app_no, hours in DISB_PENDING.items():
            db.add(Disbursement(
                application_id=apps_by_no[app_no].id,
                status=DisbursementStatus.PENDING_UTR,
                notes="Disbursement pending — delivered 1d ago" if app_no == "APP-114" else None,
                created_at=now - timedelta(hours=hours),
            ))
        for i, hours in enumerate(DISB_PENDING_FILLER_HOURS):
            app = disbursement_apps[i]
            db.add(Disbursement(
                application_id=app.id, status=DisbursementStatus.PENDING_UTR,
                created_at=now - timedelta(hours=hours),
            ))
        for _, app in enumerate(disbursement_apps[4:]):
            db.add(Disbursement(
                application_id=app.id, status=DisbursementStatus.COMPLETED,
                utr_no=f"UTR2026{1000000 + app.id * 7}",
                created_at=now - timedelta(days=random.uniform(5, 90)),
                disbursed_at=now - timedelta(days=random.uniform(4, 89)),
            ))

        # ---- Notifications (5 unread for the sales user) ----
        for _, message in enumerate(NOTIFICATIONS):
            db.add(Notification(
                user_id=sales.id, message=message,
                created_at=now - timedelta(hours=random.uniform(1, 40)),
            ))

        # ---- Activities (5, dated ~yesterday) ----
        for _, (app_no, action) in enumerate(ACTIVITIES):
            app = apps_by_no.get(app_no)
            db.add(Activity(
                application_id=app.id if app else None,
                actor_id=sales.id,
                action=action,
                created_at=now - timedelta(days=1, hours=random.uniform(0, 22)),
            ))

        # ---- Dynamic Tabs & Custom Fields Seed ----
        from app.models.crm_tab import CrmTab, CrmTabStageMapping
        from app.models.crm_tab_field import CrmTabField

        if db.query(func.count(CrmTab.id)).scalar() == 0:
            doc_tab = CrmTab(
                name="Document Upload",
                code="document_upload",
                description="Manage KYC, PAN, Bank Statements and income proofs",
                display_order=1,
                is_active=True,
                is_default=True,
                visibility_type="EVERYONE",
            )
            verif_tab = CrmTab(
                name="Document Verification",
                code="document_verification",
                description="Synchronized document quality score analysis & manual verification",
                display_order=2,
                is_active=True,
                is_default=False,
                visibility_type="EVERYONE",
            )
            final_sub_tab = CrmTab(
                name="Final Submission",
                code="final_submission",
                description="Review document readiness and send secure no-login link to financier",
                display_order=3,
                is_active=True,
                is_default=False,
                visibility_type="EVERYONE",
            )
            db.add(doc_tab)
            db.add(verif_tab)
            db.add(final_sub_tab)
            db.flush()

            # Seed default custom fields for Document Upload tab
            fields_seed = [
                CrmTabField(
                    tab_id=doc_tab.id,
                    name="aadhaar_card",
                    label="Aadhaar Card / ID Proof",
                    field_type="file",
                    is_required=True,
                    display_order=0,
                    help_text="Upload front & back side of customer Aadhaar ID proof",
                    file_config={"allowed_extensions": [".pdf", ".png", ".jpg", ".jpeg"], "max_size_mb": 10},
                    stage_rules={"VERIFICATION": {"visible": True, "required": True}},
                ),
                CrmTabField(
                    tab_id=doc_tab.id,
                    name="pan_card",
                    label="PAN Card",
                    field_type="file",
                    is_required=True,
                    display_order=1,
                    help_text="Upload customer PAN card copy for CIBIL check",
                    file_config={"allowed_extensions": [".pdf", ".png", ".jpg", ".jpeg"], "max_size_mb": 10},
                    stage_rules={"VERIFICATION": {"visible": True, "required": True}},
                ),
                CrmTabField(
                    tab_id=doc_tab.id,
                    name="income_proof",
                    label="Income Proof / Bank Statement",
                    field_type="file",
                    is_required=False,
                    display_order=2,
                    help_text="Upload last 6 months bank statement or payslips",
                    file_config={"allowed_extensions": [".pdf", ".doc", ".png"], "max_size_mb": 15},
                ),
                CrmTabField(
                    tab_id=doc_tab.id,
                    name="cibil_score",
                    label="CIBIL Credit Score",
                    field_type="numeric",
                    is_required=False,
                    display_order=3,
                    placeholder="750",
                    help_text="Credit score evaluated during finance approval",
                ),
                CrmTabField(
                    tab_id=doc_tab.id,
                    name="kyc_verified",
                    label="KYC Status Verified",
                    field_type="boolean",
                    is_required=False,
                    display_order=4,
                    default_value="Yes",
                ),
            ]
            db.add_all(fields_seed)

        db.commit()
        print(f"[seed] seeded {db.query(func.count(Application.id)).scalar()} applications and dynamic tabs/fields")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
