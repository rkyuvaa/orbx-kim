from datetime import date, datetime, timedelta, timezone
import pytest
from app.models import Branch, User, UserRole
from app.models.expenses import (
    Bill,
    Claim,
    ClaimCycle,
    ClaimStatus,
    CycleFrequency,
    CycleStatus,
    EmployeeConfirmationStatus,
    ExpenseCategory,
    ExtractionStatus,
    Payout,
    PayoutClaim,
    PayoutEmployeeStatus,
    PayoutStatus,
)
from app.services.ai_vision_extractor import AIVisionExtractor
from app.services.expense_service import ExpenseService, set_policy_value


def test_ai_vision_parser_direct_extraction():
    """Verify that values are extracted directly into fields without forced recalculation."""
    raw_json = """
    {
      "bill_number": "INV-9988",
      "bill_date": "2026-11-15",
      "supplier_name": "Empire Restaurant Bangalore",
      "taxable_amount": 1200.00,
      "cgst_pct": 2.5,
      "cgst_amount": 30.00,
      "sgst_pct": 2.5,
      "sgst_amount": 30.00,
      "igst_pct": 0.0,
      "igst_amount": 0.00,
      "total_amount": 1260.00,
      "category_hint": "Food"
    }
    """
    data = AIVisionExtractor._parse_json_result(raw_json, {"raw": "test"})
    assert data.bill_number == "INV-9988"
    assert data.bill_date == "2026-11-15"
    assert data.supplier_name == "Empire Restaurant Bangalore"
    assert data.taxable_amount == 1200.00
    assert data.cgst_amount == 30.00
    assert data.sgst_amount == 30.00
    assert data.total_amount == 1260.00
    assert data.status == "EXTRACTED"
    assert data.confidence >= 0.8


def test_duplicate_bill_detection(db):
    """Test SHA256 duplicate detection and bill_number + supplier duplication check."""
    user = User(email="testemp@kim.com", full_name="Test Emp", role=UserRole.SALES_EXECUTIVE, password_hash="dummy")
    db.add(user)
    db.commit()

    file_bytes = b"fake-receipt-image-content-for-test-hash"
    _, fhash = ExpenseService.save_bill_file(file_bytes, "test1.jpg")

    bill1 = Bill(
        uploaded_by_id=user.id,
        source_file_path="uploads/expenses/test1.jpg",
        source_mime="image/jpeg",
        source_hash=fhash,
        bill_number="BILL-1001",
        supplier_name="Shell Fuel Coimbatore",
        total_amount=500.00,
        extraction_status=ExtractionStatus.READY,
    )
    db.add(bill1)
    db.commit()

    # 1. Hash duplicate check
    is_dup_hash, dup_id_hash = ExpenseService.check_duplicate_bill(db, fhash, None, None)
    assert is_dup_hash is True
    assert dup_id_hash == bill1.id

    # 2. Bill number + supplier duplicate check
    is_dup_sec, dup_id_sec = ExpenseService.check_duplicate_bill(db, "different-hash", "BILL-1001", "Shell Fuel Coimbatore")
    assert is_dup_sec is True
    assert dup_id_sec == bill1.id

    # 3. Non duplicate
    is_dup_none, _ = ExpenseService.check_duplicate_bill(db, "unique-hash", "BILL-9999", "Other Vendor")
    assert is_dup_none is False


def test_3_step_approval_workflow(db):
    """Test Line Manager -> CFO -> Accountant approval workflow, and rejection flow."""
    manager = User(email="manager@kim.com", full_name="Manager Bob", role=UserRole.SALES_EXECUTIVE, password_hash="dummy")
    cfo = User(email="cfo@kim.com", full_name="CFO Alice", role=UserRole.ADMIN, password_hash="dummy")
    accountant = User(email="accountant@kim.com", full_name="Accountant Dan", role=UserRole.FINANCE_OFFICER, password_hash="dummy")
    emp = User(email="emp@kim.com", full_name="Employee Charlie", role=UserRole.SALES_EXECUTIVE, password_hash="dummy")
    db.add_all([manager, cfo, accountant, emp])
    db.commit()

    emp.reporting_manager_id = manager.id
    db.commit()

    bill = Bill(
        uploaded_by_id=emp.id,
        source_file_path="test.jpg",
        total_amount=1500.00,
        extraction_status=ExtractionStatus.READY,
    )
    db.add(bill)
    db.commit()

    # Submit claim
    claim = ExpenseService.submit_claim_for_bills(
        db=db,
        employee_user_id=emp.id,
        branch_id=None,
        cycle_id=None,
        bills=[bill],
    )
    assert claim.status == ClaimStatus.SUBMITTED
    assert bill.claim_id == claim.id

    # Step 1: Line Manager Approval
    claim = ExpenseService.approve_claim(db, claim, manager, note="LM ok")
    assert claim.status == ClaimStatus.LINE_MANAGER_APPROVED
    assert claim.line_manager_id == manager.id

    # Step 2: CFO Approval
    claim = ExpenseService.approve_claim(db, claim, cfo, note="CFO ok")
    assert claim.status == ClaimStatus.CFO_APPROVED
    assert claim.cfo_id == cfo.id

    # Step 3: Accountant Approval
    claim = ExpenseService.approve_claim(db, claim, accountant, note="Acc ready")
    assert claim.status == ClaimStatus.ACCOUNTANT_APPROVED
    assert claim.accountant_id == accountant.id

    # Verify audit history
    assert len(claim.status_history) == 4  # SUBMITTED, LM_APPROVED, CFO_APPROVED, ACC_APPROVED


def test_claim_rejection_unlinks_bills(db):
    """Test that rejecting a claim unlinks bills back to READY status for revision."""
    manager = User(email="mgr2@kim.com", full_name="Manager Two", role=UserRole.SALES_EXECUTIVE, password_hash="dummy")
    emp = User(email="emp2@kim.com", full_name="Employee Two", role=UserRole.SALES_EXECUTIVE, password_hash="dummy")
    db.add_all([manager, emp])
    db.commit()

    bill = Bill(
        uploaded_by_id=emp.id,
        source_file_path="test2.jpg",
        total_amount=750.00,
        extraction_status=ExtractionStatus.READY,
    )
    db.add(bill)
    db.commit()

    claim = ExpenseService.submit_claim_for_bills(db, emp.id, None, None, [bill])
    assert bill.claim_id == claim.id

    # Reject
    claim = ExpenseService.reject_claim(db, claim, manager, reason="Missing tax invoice copy")
    assert claim.status == ClaimStatus.REJECTED
    assert claim.rejection_reason == "Missing tax invoice copy"

    # Bills should be unlinked and back to READY
    db.refresh(bill)
    assert bill.claim_id is None
    assert bill.extraction_status == ExtractionStatus.READY


def test_payout_batch_and_bank_transfer(db):
    """Test grouping approved claims into a Payout batch, logging UTR, and receipt confirmation."""
    accountant = User(email="acc2@kim.com", full_name="Acc Two", role=UserRole.FINANCE_OFFICER, password_hash="dummy")
    emp = User(email="emp3@kim.com", full_name="Emp Three", role=UserRole.SALES_EXECUTIVE, password_hash="dummy")
    db.add_all([accountant, emp])
    db.commit()

    bill = Bill(uploaded_by_id=emp.id, source_file_path="test3.jpg", total_amount=2400.00, extraction_status=ExtractionStatus.READY)
    db.add(bill)
    db.commit()

    claim = ExpenseService.submit_claim_for_bills(db, emp.id, None, None, [bill])
    claim.status = ClaimStatus.ACCOUNTANT_APPROVED
    db.commit()

    # 1. Create Payout Batch
    payout = ExpenseService.create_payout_batch(db, [claim.id], accountant, notes="Batch 1")
    assert payout.status == PayoutStatus.PENDING_TRANSFER
    assert payout.total_amount == 2400.00
    assert len(payout.payout_claims) == 1

    # 2. Record Bank Transfer
    payout = ExpenseService.record_bank_transfer(
        db, payout, accountant, utr_number="HDFC99887766", payment_date=date.today(), bank_ref="HDFC"
    )
    assert payout.status == PayoutStatus.TRANSFERRED
    assert payout.utr_number == "HDFC99887766"

    # Claims should be PAID
    db.refresh(claim)
    assert claim.status == ClaimStatus.PAID

    # PayoutEmployeeStatus should be PENDING_CONFIRMATION
    emp_status = db.scalar(
        PayoutEmployeeStatus.__table__.select().where(PayoutEmployeeStatus.payout_id == payout.id)
    )
    assert emp_status is not None

    # 3. Employee confirms receipt
    confirmed_row = ExpenseService.confirm_employee_receipt(db, payout.id, emp.id, "IN_APP")
    assert confirmed_row.status == EmployeeConfirmationStatus.CONFIRMED

    # Payout batch should be CONFIRMED
    db.refresh(payout)
    assert payout.status == PayoutStatus.CONFIRMED


def test_dual_followup_auto_reconcile(db):
    """Test dual follow-up: auto-reconciliation after policy days threshold."""
    accountant = User(email="acc3@kim.com", full_name="Acc Three", role=UserRole.FINANCE_OFFICER, password_hash="dummy")
    emp = User(email="emp4@kim.com", full_name="Emp Four", role=UserRole.SALES_EXECUTIVE, password_hash="dummy")
    db.add_all([accountant, emp])
    db.commit()

    # Set auto reconcile to 7 days
    set_policy_value(db, "auto_reconcile_days", "7")
    set_policy_value(db, "auto_reconcile_enabled", "true")

    # Create old payout transferred 8 days ago
    eight_days_ago = datetime.now(timezone.utc) - timedelta(days=8)
    payout = Payout(
        batch_no="PAY-OLD-01",
        created_by_id=accountant.id,
        status=PayoutStatus.TRANSFERRED,
        total_amount=1000.00,
        utr_number="UTR-OLD",
        transferred_at=eight_days_ago,
    )
    db.add(payout)
    db.flush()

    emp_status = PayoutEmployeeStatus(
        payout_id=payout.id,
        employee_user_id=emp.id,
        amount=1000.00,
        status=EmployeeConfirmationStatus.PENDING_CONFIRMATION,
    )
    db.add(emp_status)
    db.commit()

    # Run followup engine
    res = ExpenseService.process_payout_reminders_and_reconciliation(db)
    assert res["auto_reconciled"] >= 1

    db.refresh(emp_status)
    assert emp_status.status == EmployeeConfirmationStatus.AUTO_RECONCILED
