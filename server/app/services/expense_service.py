import hashlib
import logging
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.branch import Branch
from app.models.document_sequence import DocumentSequence
from app.models.expenses import (
    AIProviderConfig,
    AIProviderType,
    Bill,
    Claim,
    ClaimCycle,
    ClaimStatus,
    ClaimStatusHistory,
    CycleFrequency,
    CycleStatus,
    EmployeeConfirmationStatus,
    ExpenseCategory,
    ExpensePolicy,
    ExtractionStatus,
    LimitPeriod,
    Payout,
    PayoutClaim,
    PayoutEmployeeStatus,
    PayoutStatus,
)
from app.models.notification import Notification
from app.models.user import User
from app.services.ai_vision_extractor import AIVisionExtractor, ExtractedBillData
from app.services.document_numbering import format_document_number, get_or_create_sequence

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join("uploads", "expenses")


def get_policy_value(db: Session, key: str, default: str) -> str:
    policy = db.scalar(select(ExpensePolicy).where(ExpensePolicy.policy_key == key))
    if policy and policy.policy_value is not None:
        return policy.policy_value
    return default


def set_policy_value(db: Session, key: str, value: str, description: Optional[str] = None, data_type: str = "STRING") -> ExpensePolicy:
    policy = db.scalar(select(ExpensePolicy).where(ExpensePolicy.policy_key == key))
    if not policy:
        policy = ExpensePolicy(
            policy_key=key,
            policy_value=str(value),
            description=description,
            data_type=data_type,
        )
        db.add(policy)
    else:
        policy.policy_value = str(value)
        if description:
            policy.description = description
    db.commit()
    db.refresh(policy)
    return policy


class ExpenseService:
    @staticmethod
    def compute_sha256(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def save_bill_file(file_bytes: bytes, filename: str) -> tuple[str, str]:
        """Save bill file locally under uploads/expenses/YYYY/MM/ and return (relative_path, sha256)."""
        now = datetime.now(timezone.utc)
        year_str = str(now.year)
        month_str = f"{now.month:02d}"
        dir_path = os.path.join(UPLOAD_DIR, year_str, month_str)
        os.makedirs(dir_path, exist_ok=True)

        ext = os.path.splitext(filename)[1].lower() or ".jpg"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        full_path = os.path.join(dir_path, unique_name)

        with open(full_path, "wb") as f:
            f.write(file_bytes)

        file_hash = ExpenseService.compute_sha256(file_bytes)
        relative_path = os.path.join("uploads", "expenses", year_str, month_str, unique_name).replace("\\", "/")
        return relative_path, file_hash

    @staticmethod
    def check_duplicate_bill(
        db: Session,
        source_hash: Optional[str],
        bill_number: Optional[str],
        supplier_name: Optional[str],
        exclude_bill_id: Optional[int] = None,
    ) -> tuple[bool, Optional[int]]:
        """Check for duplicate bills by file hash or by (bill_number, supplier_name)."""
        if source_hash:
            query = select(Bill).where(Bill.source_hash == source_hash)
            if exclude_bill_id:
                query = query.where(Bill.id != exclude_bill_id)
            existing = db.scalar(query.limit(1))
            if existing:
                return True, existing.id

        if bill_number and supplier_name and bill_number.strip() and supplier_name.strip():
            query = select(Bill).where(
                and_(
                    Bill.bill_number.ilike(bill_number.strip()),
                    Bill.supplier_name.ilike(supplier_name.strip()),
                )
            )
            if exclude_bill_id:
                query = query.where(Bill.id != exclude_bill_id)
            existing = db.scalar(query.limit(1))
            if existing:
                return True, existing.id

        return False, None

    @staticmethod
    async def create_bill_and_extract(
        db: Session,
        uploaded_by_id: int,
        branch_id: Optional[int],
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        category_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> Bill:
        """Stores file, checks duplicates, creates bill record, and triggers AI vision extraction."""
        relative_path, file_hash = ExpenseService.save_bill_file(file_bytes, filename)
        is_dup, dup_id = ExpenseService.check_duplicate_bill(db, file_hash, None, None)

        bill = Bill(
            uploaded_by_id=uploaded_by_id,
            branch_id=branch_id,
            category_id=category_id,
            source_file_path=relative_path,
            source_mime=mime_type,
            source_hash=file_hash,
            is_duplicate=is_dup,
            duplicate_of_bill_id=dup_id,
            notes=notes,
            extraction_status=ExtractionStatus.PROCESSING,
        )
        db.add(bill)
        db.commit()
        db.refresh(bill)

        # Get active AI Provider
        active_provider = db.scalar(
            select(AIProviderConfig).where(
                and_(AIProviderConfig.is_active == True, AIProviderConfig.is_default == True)
            )
        )
        if not active_provider:
            active_provider = db.scalar(
                select(AIProviderConfig).where(AIProviderConfig.is_active == True).order_by(AIProviderConfig.id.asc())
            )

        provider_type = active_provider.provider.value if active_provider else "GOOGLE"
        model_name = active_provider.model_name if active_provider else "gemini-1.5-flash"
        api_endpoint = active_provider.api_endpoint if active_provider else None
        api_key = active_provider.api_key_override if active_provider else None

        extracted = await AIVisionExtractor.extract_from_file(
            file_bytes=file_bytes,
            mime_type=mime_type,
            provider_type=provider_type,
            model_name=model_name,
            api_endpoint=api_endpoint,
            api_key=api_key,
        )

        bill.bill_number = extracted.bill_number
        if extracted.bill_date:
            try:
                bill.bill_date = datetime.strptime(extracted.bill_date, "%Y-%m-%d").date()
            except Exception:
                bill.bill_date = None
        bill.supplier_name = extracted.supplier_name
        bill.taxable_amount = extracted.taxable_amount
        bill.cgst_pct = extracted.cgst_pct
        bill.cgst_amount = extracted.cgst_amount
        bill.sgst_pct = extracted.sgst_pct
        bill.sgst_amount = extracted.sgst_amount
        bill.igst_pct = extracted.igst_pct
        bill.igst_amount = extracted.igst_amount
        bill.gst_total = extracted.gst_total
        bill.total_amount = extracted.total_amount
        bill.extraction_confidence = extracted.confidence
        bill.extraction_raw = extracted.raw_response
        bill.extraction_status = ExtractionStatus(extracted.status)

        # Check secondary duplicate by bill_number + supplier
        is_dup_sec, dup_sec_id = ExpenseService.check_duplicate_bill(
            db, None, bill.bill_number, bill.supplier_name, exclude_bill_id=bill.id
        )
        if is_dup_sec:
            bill.is_duplicate = True
            bill.duplicate_of_bill_id = dup_sec_id

        # Try auto-matching category if category_id not provided
        if not bill.category_id and extracted.category_hint:
            cat = db.scalar(
                select(ExpenseCategory).where(
                    and_(
                        ExpenseCategory.is_active == True,
                        ExpenseCategory.name.ilike(f"%{extracted.category_hint}%"),
                    )
                )
            )
            if cat:
                bill.category_id = cat.id

        db.commit()
        db.refresh(bill)
        return bill

    @staticmethod
    def get_next_sequence_number(db: Session, doc_type: str, default_prefix: str) -> str:
        seq = get_or_create_sequence(db, document_type=doc_type, default_prefix=default_prefix, default_padding=4)
        formatted = format_document_number(
            prefix=seq.prefix,
            padding=seq.padding,
            number=seq.next_number,
            suffix=seq.suffix,
        )
        seq.next_number += 1
        db.commit()
        return formatted

    @staticmethod
    def submit_claim_for_bills(
        db: Session,
        employee_user_id: int,
        branch_id: Optional[int],
        cycle_id: Optional[int],
        bills: list[Bill],
        actor_user_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> Claim:
        """Groups ready bills into a Claim, computes total, and submits to Step 1 (Line Manager)."""
        if not bills:
            raise ValueError("Cannot create a claim with no bills.")

        claim_no = ExpenseService.get_next_sequence_number(db, "EXPENSE_CLAIM", "CLM-{YYYY}-")
        total_sum = sum(b.total_amount for b in bills)

        claim = Claim(
            claim_no=claim_no,
            employee_user_id=employee_user_id,
            branch_id=branch_id,
            claim_cycle_id=cycle_id,
            status=ClaimStatus.SUBMITTED,
            total_amount=round(total_sum, 2),
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(claim)
        db.flush()

        for bill in bills:
            bill.claim_id = claim.id

        # Record audit trail
        history = ClaimStatusHistory(
            claim_id=claim.id,
            from_status="DRAFT",
            to_status=ClaimStatus.SUBMITTED.value,
            actor_user_id=actor_user_id or employee_user_id,
            note=notes or f"Auto-submitted {len(bills)} bill(s) totalling ₹{total_sum:.2f}",
        )
        db.add(history)

        # Send notification to Line Manager if configured
        emp = db.scalar(select(User).where(User.id == employee_user_id))
        if emp and emp.reporting_manager_id:
            notif = Notification(
                user_id=emp.reporting_manager_id,
                message=f"New Expense Claim {claim.claim_no} submitted by {emp.full_name} for ₹{total_sum:.2f}.",
                link="/expenses",
            )
            db.add(notif)

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def auto_bundle_cycle_claims(db: Session) -> list[Claim]:
        """
        Automatic Claim Submission Engine:
        Finds all READY bills unassigned to any claim.
        If manual_claim_submission_enabled is 'false', groups them by employee + cycle and creates submitted claims.
        """
        manual_mode = get_policy_value(db, "manual_claim_submission_enabled", "false").lower() == "true"
        if manual_mode:
            logger.info("Automatic claim submission is disabled in policy. Skipping auto-bundle.")
            return []

        # Find open cycles
        open_cycles = db.scalars(select(ClaimCycle).where(ClaimCycle.status == CycleStatus.OPEN)).all()
        created_claims = []

        # Find all ready bills with no claim_id
        ready_bills = db.scalars(
            select(Bill).where(
                and_(
                    Bill.extraction_status == ExtractionStatus.READY,
                    Bill.claim_id.is_(None),
                )
            )
        ).all()

        if not ready_bills:
            return []

        # Group by employee_user_id
        bills_by_emp: dict[int, list[Bill]] = {}
        for b in ready_bills:
            bills_by_emp.setdefault(b.uploaded_by_id, []).append(b)

        active_cycle = open_cycles[0] if open_cycles else None

        for emp_id, emp_bills in bills_by_emp.items():
            emp = db.scalar(select(User).where(User.id == emp_id))
            branch_id = emp.branch_id if emp else None
            try:
                claim = ExpenseService.submit_claim_for_bills(
                    db=db,
                    employee_user_id=emp_id,
                    branch_id=branch_id,
                    cycle_id=active_cycle.id if active_cycle else None,
                    bills=emp_bills,
                    notes="Auto-bundled by claim cycle engine",
                )
                created_claims.append(claim)
            except Exception as e:
                logger.exception(f"Failed to auto-bundle claim for user {emp_id}: {e}")

        return created_claims

    @staticmethod
    def approve_claim(db: Session, claim: Claim, approver: User, note: Optional[str] = None) -> Claim:
        """Advance approval workflow through Line Manager -> CFO -> Accountant."""
        now = datetime.now(timezone.utc)
        from_st = claim.status.value

        if claim.status == ClaimStatus.SUBMITTED:
            # Step 1: Line Manager Approval
            claim.status = ClaimStatus.LINE_MANAGER_APPROVED
            claim.line_manager_id = approver.id
            claim.line_manager_action_at = now
            # Notify CFO / Admin
            cfos = db.scalars(select(User).where(User.role.in_(["ADMIN", "FINANCE_OFFICER"]))).all()
            for cfo in cfos:
                db.add(Notification(
                    user_id=cfo.id,
                    message=f"Claim {claim.claim_no} approved by Line Manager {approver.full_name}. Awaiting CFO approval.",
                    link="/expenses",
                ))

        elif claim.status == ClaimStatus.LINE_MANAGER_APPROVED:
            # Step 2: CFO Approval
            claim.status = ClaimStatus.CFO_APPROVED
            claim.cfo_id = approver.id
            claim.cfo_action_at = now
            # Notify Accountant
            accountants = db.scalars(select(User).where(User.role.in_(["FINANCE_OFFICER", "ADMIN"]))).all()
            for acc in accountants:
                db.add(Notification(
                    user_id=acc.id,
                    message=f"Claim {claim.claim_no} approved by CFO {approver.full_name}. Ready for Accountant payout batch.",
                    link="/expenses",
                ))

        elif claim.status == ClaimStatus.CFO_APPROVED:
            # Step 3: Accountant Approval (Ready for batch)
            claim.status = ClaimStatus.ACCOUNTANT_APPROVED
            claim.accountant_id = approver.id
            claim.accountant_action_at = now

        else:
            raise ValueError(f"Claim is in status {claim.status.value} and cannot be approved further.")

        # Record history
        db.add(ClaimStatusHistory(
            claim_id=claim.id,
            from_status=from_st,
            to_status=claim.status.value,
            actor_user_id=approver.id,
            note=note or f"Approved by {approver.full_name}",
        ))
        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def reject_claim(db: Session, claim: Claim, approver: User, reason: str) -> Claim:
        """Rejects claim, unlocks all associated bills back to READY, and notifies claimant."""
        if not reason or not reason.strip():
            raise ValueError("A reason must be provided when rejecting a claim.")

        from_st = claim.status.value
        claim.status = ClaimStatus.REJECTED
        claim.rejection_reason = reason.strip()

        # Unlink bills back to READY
        for bill in claim.bills:
            bill.claim_id = None
            bill.extraction_status = ExtractionStatus.READY

        # Record history
        db.add(ClaimStatusHistory(
            claim_id=claim.id,
            from_status=from_st,
            to_status=ClaimStatus.REJECTED.value,
            actor_user_id=approver.id,
            note=f"Rejected by {approver.full_name}: {reason}",
        ))

        # Notify claimant
        db.add(Notification(
            user_id=claim.employee_user_id,
            message=f"Your claim {claim.claim_no} was rejected by {approver.full_name}. Reason: {reason}. Bills returned for revision.",
            link="/expenses",
        ))

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def create_payout_batch(db: Session, claim_ids: list[int], accountant: User, notes: Optional[str] = None) -> Payout:
        """Accountant generates a payout batch for selected ACCOUNTANT_APPROVED claims."""
        if not claim_ids:
            raise ValueError("Select at least one claim for payout batch.")

        claims = db.scalars(
            select(Claim).where(and_(Claim.id.in_(claim_ids), Claim.status == ClaimStatus.ACCOUNTANT_APPROVED))
        ).all()

        if len(claims) != len(claim_ids):
            raise ValueError("One or more selected claims are not in Accountant Approved status.")

        batch_no = ExpenseService.get_next_sequence_number(db, "EXPENSE_PAYOUT", "PAY-{YYYY}-")
        total_amount = sum(c.total_amount for c in claims)

        payout = Payout(
            batch_no=batch_no,
            created_by_id=accountant.id,
            status=PayoutStatus.PENDING_TRANSFER,
            total_amount=round(total_amount, 2),
            claim_count=len(claims),
            notes=notes,
        )
        db.add(payout)
        db.flush()

        for c in claims:
            payout_claim = PayoutClaim(
                payout_id=payout.id,
                claim_id=c.id,
                amount=c.total_amount,
            )
            db.add(payout_claim)

        db.commit()
        db.refresh(payout)
        return payout

    @staticmethod
    def record_bank_transfer(
        db: Session,
        payout: Payout,
        accountant: User,
        utr_number: str,
        payment_date: date,
        bank_ref: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Payout:
        """
        Records the bank transfer (UTR), transitions batch to TRANSFERRED,
        marks claims PAID, creates per-employee confirmation rows, and notifies employees.
        """
        if not utr_number or not utr_number.strip():
            raise ValueError("Bank UTR number is required.")

        now = datetime.now(timezone.utc)
        payout.status = PayoutStatus.TRANSFERRED
        payout.utr_number = utr_number.strip()
        payout.payment_date = payment_date
        payout.bank_ref = bank_ref
        payout.transferred_at = now
        if notes:
            payout.notes = f"{payout.notes}\n{notes}".strip() if payout.notes else notes

        # Group amounts per employee in this payout
        emp_amounts: dict[int, float] = {}
        for pc in payout.payout_claims:
            claim = pc.claim
            claim.status = ClaimStatus.PAID
            emp_amounts[claim.employee_user_id] = emp_amounts.get(claim.employee_user_id, 0.0) + float(pc.amount)

            db.add(ClaimStatusHistory(
                claim_id=claim.id,
                from_status=ClaimStatus.ACCOUNTANT_APPROVED.value,
                to_status=ClaimStatus.PAID.value,
                actor_user_id=accountant.id,
                note=f"Paid via Payout {payout.batch_no}, UTR: {utr_number}",
            ))

        # Create PayoutEmployeeStatus rows & notify each employee
        for emp_id, amt in emp_amounts.items():
            emp_status = PayoutEmployeeStatus(
                payout_id=payout.id,
                employee_user_id=emp_id,
                amount=round(amt, 2),
                status=EmployeeConfirmationStatus.PENDING_CONFIRMATION,
            )
            db.add(emp_status)

            db.add(Notification(
                user_id=emp_id,
                message=f"Reimbursement of ₹{amt:.2f} transferred via UTR {utr_number}. Please confirm receipt in Expenses.",
                link="/expenses",
            ))

        db.commit()
        db.refresh(payout)
        return payout

    @staticmethod
    def confirm_employee_receipt(
        db: Session,
        payout_id: int,
        employee_user_id: int,
        confirmation_method: str = "IN_APP",
        notes: Optional[str] = None,
    ) -> PayoutEmployeeStatus:
        """Employee confirms receipt of transferred funds."""
        status_row = db.scalar(
            select(PayoutEmployeeStatus).where(
                and_(
                    PayoutEmployeeStatus.payout_id == payout_id,
                    PayoutEmployeeStatus.employee_user_id == employee_user_id,
                )
            )
        )
        if not status_row:
            raise ValueError("No pending payout confirmation found for this employee and batch.")

        status_row.status = EmployeeConfirmationStatus.CONFIRMED
        status_row.confirmed_at = datetime.now(timezone.utc)
        status_row.confirmation_method = confirmation_method
        if notes:
            status_row.notes = notes

        # Check if all employees in batch have confirmed
        all_emp_statuses = db.scalars(
            select(PayoutEmployeeStatus).where(PayoutEmployeeStatus.payout_id == payout_id)
        ).all()

        payout = db.scalar(select(Payout).where(Payout.id == payout_id))
        if payout and all(s.status in (EmployeeConfirmationStatus.CONFIRMED, EmployeeConfirmationStatus.AUTO_RECONCILED) for s in all_emp_statuses):
            payout.status = PayoutStatus.CONFIRMED

        db.commit()
        db.refresh(status_row)
        return status_row

    @staticmethod
    def process_payout_reminders_and_reconciliation(db: Session) -> dict[str, int]:
        """
        Dual Follow-Up Worker:
        1. Escalates unconfirmed transfers past accountant_escalation_hours to accountant reminder queue.
        2. Auto-reconciles unconfirmed transfers past auto_reconcile_days if enabled in policy.
        """
        now = datetime.now(timezone.utc)
        escalation_hours = int(get_policy_value(db, "accountant_escalation_hours", "72"))
        auto_reconcile_days = int(get_policy_value(db, "auto_reconcile_days", "7"))
        auto_reconcile_enabled = get_policy_value(db, "auto_reconcile_enabled", "true").lower() == "true"

        escalated_count = 0
        auto_reconciled_count = 0

        pending_statuses = db.scalars(
            select(PayoutEmployeeStatus).where(
                PayoutEmployeeStatus.status == EmployeeConfirmationStatus.PENDING_CONFIRMATION
            )
        ).all()

        accountants = db.scalars(select(User).where(User.role.in_(["FINANCE_OFFICER", "ADMIN"]))).all()

        for st in pending_statuses:
            payout = st.payout
            if not payout or not payout.transferred_at:
                continue

            transferred_time = payout.transferred_at
            if transferred_time.tzinfo is None:
                transferred_time = transferred_time.replace(tzinfo=timezone.utc)

            age_hours = (now - transferred_time).total_seconds() / 3600.0
            age_days = age_hours / 24.0

            # 1. Auto-Reconcile if past N days
            if auto_reconcile_enabled and age_days >= auto_reconcile_days:
                st.status = EmployeeConfirmationStatus.AUTO_RECONCILED
                st.confirmed_at = now
                st.confirmation_method = "AUTO_RECONCILED"
                st.notes = f"Auto-reconciled after {age_days:.1f} days without dispute."
                auto_reconciled_count += 1
                continue

            # 2. Escalate to accountant if past escalation window
            if age_hours >= escalation_hours:
                # Check if reminder was already sent within the last 24 hours
                last_reminder = st.last_reminder_at
                if last_reminder and last_reminder.tzinfo is None:
                    last_reminder = last_reminder.replace(tzinfo=timezone.utc)

                if not last_reminder or (now - last_reminder).total_seconds() >= 86400:
                    st.reminder_count += 1
                    st.last_reminder_at = now
                    escalated_count += 1
                    for acc in accountants:
                        db.add(Notification(
                            user_id=acc.id,
                            message=f"Reminder: Employee {st.employee.full_name} has not confirmed payout {payout.batch_no} (₹{st.amount:.2f}, UTR {payout.utr_number}) after {int(age_hours)} hours.",
                            link="/expenses",
                        ))

        db.commit()
        return {"escalated_reminders": escalated_count, "auto_reconciled": auto_reconciled_count}
