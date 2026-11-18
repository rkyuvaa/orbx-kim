"""
Tests for requirement approval email workflow.
Tests the submit, approve, and reject endpoints with token-based authentication.
"""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import get_db
from app.models import (
    AppDataDocument,
    Notification,
    RequirementApprovalToken,
    RequirementApprovalAccessLog,
    User,
    UserRole,
)
from app.core.security import hash_password
from app.services.email_service import send_requirement_approval_email


# Test setup
DEFAULT_PASSWORD = "testpass123"
REQUIREMENT_ITEMS_KEY = "crm_requirements_items_data"


def make_user(db: Session, email: str, role: UserRole, name: str = "Test User") -> User:
    user = User(
        email=email,
        full_name=name,
        role=role,
        password_hash=hash_password(DEFAULT_PASSWORD),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(client: TestClient, email: str = "sales@kim.com") -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": DEFAULT_PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def create_requirement_record(db: Session, requirement_id: str, request_no: str, req_type: str = "MATERIAL") -> AppDataDocument:
    """Create or update the requirements app_data document with a test requirement."""
    req_item = {
        "id": requirement_id,
        "type": req_type,
        "title": request_no,
        "request_no": request_no,
        "status": "DRAFT",
        "department": "Operations",
        "requested_by": "Test User",
        "required_by_date": "2024-12-31",
        "justification": "Test requirement",
        "specifications": "",
        "priority": "MEDIUM",
        "quantity": 1,
        "unit": "Nos",
        "estimated_unit_cost": 1000,
        "total_cost": 1000,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    record = db.query(AppDataDocument).filter(AppDataDocument.key == REQUIREMENT_ITEMS_KEY).first()
    if record:
        record.value = [req_item]
        record.revision = 1
    else:
        record = AppDataDocument(
            key=REQUIREMENT_ITEMS_KEY,
            value=[req_item],
            revision=1,
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return record


class TestRequirementApprovalEmail:
    """Test the requirement approval email workflow."""

    def test_submit_material_requirement_creates_token_and_sends_email(
        self, client: TestClient, db: Session
    ):
        """Test submitting a material requirement creates token and queues email."""
        # Setup: Create users
        requester = make_user(db, "requester@kim.com", UserRole.SALES_EXECUTIVE, "John Requester")
        approver = make_user(db, "approver@kim.com", UserRole.ADMIN, "Jane Approver")
        requester.reporting_manager_id = approver.id
        db.commit()
        
        # Login as requester
        token = login(client, "requester@kim.com")
        headers = auth_headers(token)
        
        # Create requirement in app_data
        create_requirement_record(db, "REQ-MAT-1", "MR-2024-001", "MATERIAL")
        
        # Mock email dispatch to avoid actual SMTP
        with patch("app.services.email_service.dispatch_email_smtp") as mock_dispatch:
            mock_dispatch.return_value = (True, None)
            
            # Submit requirement for approval
            response = client.post(
                "/api/v1/public/approvals/material-requirements/submit",
                json={
                    "requirement": {
                        "id": "REQ-MAT-1",
                        "request_no": "MR-2024-001",
                        "type": "MATERIAL",
                        "title": "MR-2024-001",
                        "total_cost": 50000,
                    }
                },
                headers=headers,
            )
            
            assert response.status_code == 200, response.text
            data = response.json()
            assert data["ok"] is True
            assert data["approval_sent"] is True
            assert "MR-2024-001" in data["request_no"]
        
        # Verify token was created in database
        token_rec = db.query(RequirementApprovalToken).filter(
            RequirementApprovalToken.request_no == "MR-2024-001"
        ).first()
        assert token_rec is not None
        assert token_rec.status == "PENDING"
        assert token_rec.requirement_id == "REQ-MAT-1"
        assert token_rec.approver_id == approver.id
        assert token_rec.approver_email == "approver@kim.com"
        # expires_at is naive, make it aware for comparison
        assert token_rec.expires_at.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)
        
        # Verify requirement status updated to SUBMITTED
        record = db.query(AppDataDocument).filter(AppDataDocument.key == REQUIREMENT_ITEMS_KEY).first()
        req_item = next(r for r in record.value if r["id"] == "REQ-MAT-1")
        assert req_item["status"] == "SUBMITTED"
        assert "submitted_at" in req_item
        assert req_item["submitted_by"] == "John Requester"

        notification = db.query(Notification).filter(Notification.user_id == approver.id).one()
        assert "MR-2024-001" in notification.message
        assert notification.link == "/requirements/material?requestNo=MR-2024-001"

    def test_submit_it_requirement_creates_token_and_sends_email(
        self, client: TestClient, db: Session
    ):
        """Test submitting an IT requirement creates token and queues email."""
        requester = make_user(db, "itrequester@kim.com", UserRole.SALES_EXECUTIVE, "IT John")
        approver = make_user(db, "itapprover@kim.com", UserRole.ADMIN, "IT Jane")
        requester.reporting_manager_id = approver.id
        db.commit()
        
        token = login(client, "itrequester@kim.com")
        headers = auth_headers(token)
        
        create_requirement_record(db, "REQ-IT-1", "REQ-IT-001", "IT")
        
        with patch("app.services.email_service.dispatch_email_smtp") as mock_dispatch:
            mock_dispatch.return_value = (True, None)
            
            response = client.post(
                "/api/v1/public/approvals/material-requirements/submit",
                json={
                    "requirement": {
                        "id": "REQ-IT-1",
                        "request_no": "REQ-IT-001",
                        "type": "IT",
                        "title": "REQ-IT-001",
                        "total_cost": 0,
                    }
                },
                headers=headers,
            )
            
            assert response.status_code == 200, response.text
            data = response.json()
            assert data["ok"] is True
            assert data["approval_sent"] is True
        
        # Verify token created for IT requirement
        token_rec = db.query(RequirementApprovalToken).filter(
            RequirementApprovalToken.request_no == "REQ-IT-001"
        ).first()
        assert token_rec is not None
        assert token_rec.requirement_type == "IT"

    def test_submit_without_approver_fails(
        self, client: TestClient, db: Session
    ):
        """Test submit fails when requester has no reporting manager with email."""
        requester = make_user(db, "noapprover@kim.com", UserRole.SALES_EXECUTIVE, "No Approver")
        # No reporting manager set
        db.commit()
        
        token = login(client, "noapprover@kim.com")
        headers = auth_headers(token)
        
        create_requirement_record(db, "REQ-MAT-2", "MR-2024-002", "MATERIAL")
        
        response = client.post(
            "/api/v1/public/approvals/material-requirements/submit",
            json={
                "requirement": {
                    "id": "REQ-MAT-2",
                    "request_no": "MR-2024-002",
                    "type": "MATERIAL",
                    "title": "MR-2024-002",
                }
            },
            headers=headers,
        )
        
        assert response.status_code == 400
        assert "approver" in response.json()["detail"].lower()

    @pytest.mark.parametrize("store_exists", [False, True])
    def test_submit_creates_requirement_missing_from_app_data(
        self, client: TestClient, db: Session, store_exists: bool
    ):
        """A browser-only requirement is persisted before its approval is created."""
        requester = make_user(db, "finder@kim.com", UserRole.SALES_EXECUTIVE, "Finder")
        approver = make_user(db, "finderapprover@kim.com", UserRole.ADMIN, "Finder Approver")
        requester.reporting_manager_id = approver.id
        db.commit()

        token = login(client, "finder@kim.com")
        headers = auth_headers(token)

        if store_exists:
            create_requirement_record(db, "REQ-MAT-3", "MR-2024-003", "MATERIAL")

        with patch("app.services.email_service.dispatch_email_smtp") as mock_dispatch:
            mock_dispatch.return_value = (True, None)
            response = client.post(
                "/api/v1/public/approvals/material-requirements/submit",
                json={
                    "requirement": {
                        "id": "REQ-MAT-999",
                        "request_no": "MR-00034/26-27",
                        "type": "MATERIAL",
                        "title": "MR-00034/26-27",
                        "total_cost": 2500,
                        "material_items": [
                            {"item_description": "Printer", "qty": 1, "uom": "Nos", "rate": 2500, "amount": 2500}
                        ],
                    }
                },
                headers=headers,
            )

        assert response.status_code == 200, response.text
        record = db.query(AppDataDocument).filter(AppDataDocument.key == REQUIREMENT_ITEMS_KEY).first()
        created = next(item for item in record.value if item["id"] == "REQ-MAT-999")
        assert created["status"] == "SUBMITTED"
        assert created["total_cost"] == 2500
        assert created["material_items"][0]["item_description"] == "Printer"

        token_rec = db.query(RequirementApprovalToken).filter(
            RequirementApprovalToken.requirement_id == "REQ-MAT-999"
        ).one()
        assert token_rec.status == "PENDING"
        notification = db.query(Notification).filter(Notification.user_id == approver.id).one()
        assert "MR-00034/26-27" in notification.message
        assert notification.link.endswith("requestNo=MR-00034%2F26-27")


class TestPublicApprovalEndpoints:
    """Test the public approval page and approve/reject endpoints."""

    def create_token_for_test(
        self, db: Session, requirement_id: str, request_no: str, approver: User, requester: User
    ) -> str:
        """Helper to create a token and return the raw token."""
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        token_rec = RequirementApprovalToken(
            token_hash=token_hash,
            requirement_id=requirement_id,
            request_no=request_no,
            requirement_type="MATERIAL",
            approver_id=approver.id,
            approver_name=approver.full_name,
            approver_email=approver.email,
            submitted_by_user_id=requester.id,
            submitted_by_name=requester.full_name,
            expires_at=expires_at,
            status="PENDING",
        )
        db.add(token_rec)
        db.commit()
        db.refresh(token_rec)
        return raw_token

    def test_public_approval_page_loads(
        self, client: TestClient, db: Session
    ):
        """Test the public approval page loads with approve/reject buttons."""
        requester = make_user(db, "page@kim.com", UserRole.SALES_EXECUTIVE, "Page Requester")
        approver = make_user(db, "pageapprover@kim.com", UserRole.ADMIN, "Page Approver")
        db.commit()
        
        create_requirement_record(db, "REQ-MAT-4", "MR-2024-004", "MATERIAL")
        raw_token = self.create_token_for_test(db, "REQ-MAT-4", "MR-2024-004", approver, requester)
        
        response = client.get(f"/api/v1/public/approvals/{raw_token}")
        
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "MR-2024-004" in response.text
        assert "Approve" in response.text
        assert "Reject" in response.text
        assert "Page Requester" in response.text
        assert "Page Approver" in response.text

    def test_public_approval_page_invalid_token_returns_404(
        self, client: TestClient, db: Session
    ):
        """Test invalid token returns 404 (not 401/403 to prevent enumeration)."""
        response = client.get("/api/v1/public/approvals/invalid-token-123")
        assert response.status_code == 404
        assert "invalid" in response.json()["detail"].lower()

    def test_public_approval_page_expired_token_returns_404(
        self, client: TestClient, db: Session
    ):
        """Test expired token returns 404."""
        requester = make_user(db, "expired@kim.com", UserRole.SALES_EXECUTIVE, "Expired Requester")
        approver = make_user(db, "expiredapprover@kim.com", UserRole.ADMIN, "Expired Approver")
        db.commit()
        
        create_requirement_record(db, "REQ-MAT-5", "MR-2024-005", "MATERIAL")
        
        # Create expired token
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        
        token_rec = RequirementApprovalToken(
            token_hash=token_hash,
            requirement_id="REQ-MAT-5",
            request_no="MR-2024-005",
            requirement_type="MATERIAL",
            approver_id=approver.id,
            approver_name=approver.full_name,
            approver_email=approver.email,
            submitted_by_user_id=requester.id,
            submitted_by_name=requester.full_name,
            expires_at=expires_at,
            status="PENDING",
        )
        db.add(token_rec)
        db.commit()
        
        response = client.get(f"/api/v1/public/approvals/{raw_token}")
        assert response.status_code == 404

    def test_public_approval_page_used_token_returns_404(
        self, client: TestClient, db: Session
    ):
        """Test already used (approved/rejected) token returns 404."""
        requester = make_user(db, "used@kim.com", UserRole.SALES_EXECUTIVE, "Used Requester")
        approver = make_user(db, "usedapprover@kim.com", UserRole.ADMIN, "Used Approver")
        db.commit()
        
        create_requirement_record(db, "REQ-MAT-6", "MR-2024-006", "MATERIAL")
        raw_token = self.create_token_for_test(db, "REQ-MAT-6", "MR-2024-006", approver, requester)
        
        # Mark token as used
        token_rec = db.query(RequirementApprovalToken).filter(
            RequirementApprovalToken.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
        ).first()
        token_rec.status = "APPROVED"
        token_rec.decided_at = datetime.now(timezone.utc)
        db.commit()
        
        response = client.get(f"/api/v1/public/approvals/{raw_token}")
        assert response.status_code == 404

    def test_approve_requirement_updates_status(
        self, client: TestClient, db: Session
    ):
        """Test approving via token updates requirement status to APPROVED."""
        requester = make_user(db, "approve@kim.com", UserRole.SALES_EXECUTIVE, "Approve Requester")
        approver = make_user(db, "approveapprover@kim.com", UserRole.ADMIN, "Approve Approver")
        db.commit()
        
        create_requirement_record(db, "REQ-MAT-7", "MR-2024-007", "MATERIAL")
        raw_token = self.create_token_for_test(db, "REQ-MAT-7", "MR-2024-007", approver, requester)
        
        response = client.post(
            f"/api/v1/public/approvals/{raw_token}/approve",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "Approved Successfully" in response.text
        assert "MR-2024-007" in response.text
        
        # Verify token status updated
        token_rec = db.query(RequirementApprovalToken).filter(
            RequirementApprovalToken.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
        ).first()
        assert token_rec.status == "APPROVED"
        assert token_rec.decided_at is not None
        assert token_rec.decided_via == "email_link"
        
        # Verify requirement status updated in app_data
        record = db.query(AppDataDocument).filter(AppDataDocument.key == REQUIREMENT_ITEMS_KEY).first()
        req_item = next(r for r in record.value if r["id"] == "REQ-MAT-7")
        assert req_item["status"] == "APPROVED"
        assert "approved_at" in req_item
        assert req_item["approved_by"] == "Approve Approver"

    def test_reject_requirement_updates_status(
        self, client: TestClient, db: Session
    ):
        """Test rejecting via token updates requirement status to REJECTED."""
        requester = make_user(db, "reject@kim.com", UserRole.SALES_EXECUTIVE, "Reject Requester")
        approver = make_user(db, "rejectapprover@kim.com", UserRole.ADMIN, "Reject Approver")
        db.commit()
        
        create_requirement_record(db, "REQ-MAT-8", "MR-2024-008", "MATERIAL")
        raw_token = self.create_token_for_test(db, "REQ-MAT-8", "MR-2024-008", approver, requester)
        
        response = client.post(
            f"/api/v1/public/approvals/{raw_token}/reject",
            data={"reason": "Budget not approved"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "Rejected" in response.text
        assert "MR-2024-008" in response.text
        assert "Budget not approved" in response.text
        
        # Verify token status updated
        token_rec = db.query(RequirementApprovalToken).filter(
            RequirementApprovalToken.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
        ).first()
        assert token_rec.status == "REJECTED"
        assert token_rec.decided_at is not None
        assert token_rec.decision_reason == "Budget not approved"
        assert token_rec.decided_via == "email_link"
        
        # Verify requirement status updated in app_data
        record = db.query(AppDataDocument).filter(AppDataDocument.key == REQUIREMENT_ITEMS_KEY).first()
        req_item = next(r for r in record.value if r["id"] == "REQ-MAT-8")
        assert req_item["status"] == "REJECTED"
        assert "rejected_at" in req_item
        assert req_item["rejected_by"] == "Reject Approver"
        assert req_item["rejection_reason"] == "Budget not approved"

    def test_reject_without_reason_uses_default(
        self, client: TestClient, db: Session
    ):
        """Test reject without reason uses default message."""
        requester = make_user(db, "reject2@kim.com", UserRole.SALES_EXECUTIVE, "Reject2 Requester")
        approver = make_user(db, "reject2approver@kim.com", UserRole.ADMIN, "Reject2 Approver")
        db.commit()
        
        create_requirement_record(db, "REQ-MAT-9", "MR-2024-009", "MATERIAL")
        raw_token = self.create_token_for_test(db, "REQ-MAT-9", "MR-2024-009", approver, requester)
        
        response = client.post(
            f"/api/v1/public/approvals/{raw_token}/reject",
            data={"reason": ""},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        
        assert response.status_code == 200
        
        token_rec = db.query(RequirementApprovalToken).filter(
            RequirementApprovalToken.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
        ).first()
        assert token_rec.decision_reason == "No reason provided"

    def test_access_log_created_on_page_view(
        self, client: TestClient, db: Session
    ):
        """Test access log is created when viewing approval page."""
        requester = make_user(db, "log@kim.com", UserRole.SALES_EXECUTIVE, "Log Requester")
        approver = make_user(db, "logapprover@kim.com", UserRole.ADMIN, "Log Approver")
        db.commit()
        
        create_requirement_record(db, "REQ-MAT-10", "MR-2024-010", "MATERIAL")
        raw_token = self.create_token_for_test(db, "REQ-MAT-10", "MR-2024-010", approver, requester)
        
        client.get(f"/api/v1/public/approvals/{raw_token}")
        
        log = db.query(RequirementApprovalAccessLog).filter(
            RequirementApprovalAccessLog.token_id.isnot(None)
        ).first()
        assert log is not None
        assert log.action == "page_view"
        assert log.success is True

    def test_access_log_created_on_rejected_attempt(
        self, client: TestClient, db: Session
    ):
        """Test access log is created for invalid/expired tokens."""
        client.get("/api/v1/public/approvals/bad-token-123")
        
        log = db.query(RequirementApprovalAccessLog).filter(
            RequirementApprovalAccessLog.success == False
        ).first()
        assert log is not None
        assert log.action == "rejected"
        assert log.success is False
        assert "invalid" in (log.failure_reason or "").lower()


class TestEmailTemplate:
    """Test the email template generation."""

    def test_send_requirement_approval_email_contains_urls(
        self, db: Session
    ):
        """Test email links to the response page without direct-action URLs."""
        with patch("app.services.email_service.dispatch_email_smtp") as mock_dispatch:
            mock_dispatch.return_value = (True, None)
            
            approve_url = "https://example.com/api/v1/public/approvals/token123/approve"
            reject_url = "https://example.com/api/v1/public/approvals/token123/reject"
            view_url = "https://example.com/api/v1/public/approvals/token123"
            
            ok, err = send_requirement_approval_email(
                to_email="approver@test.com",
                approver_name="Test Approver",
                requester_name="Test Requester",
                request_no="MR-2024-999",
                requirement_type="MATERIAL",
                title="Test Requirement",
                total_cost=50000.0,
                items_summary="Item 1 - Qty: 5 Nos @ ₹10,000.00 = ₹50,000.00",
                approve_url=approve_url,
                reject_url=reject_url,
                view_url=view_url,
                expires_at_str="01 Jan 2025 at 10:00 AM",
                db=db,
            )
            
            assert ok is True
            assert err is None
            assert mock_dispatch.called
            
            # Check email content
            call_args = mock_dispatch.call_args
            html_content = call_args.kwargs.get("html_content", "") or call_args.args[3]
            
            # Only the working response page is linked from the email.
            assert view_url in html_content
            assert "Respond" in html_content
            assert approve_url not in html_content
            assert reject_url not in html_content
            plain_text = call_args.args[2]
            assert view_url in plain_text
            assert approve_url not in plain_text
            assert reject_url not in plain_text
            
            # Verify key content
            assert "MR-2024-999" in html_content
            assert "Test Requester" in html_content
            assert "Test Approver" in html_content
            assert "₹50,000.00" in html_content
            assert "01 Jan 2025 at 10:00 AM" in html_content

    def test_send_requirement_approval_email_it_requirement(
        self, db: Session
    ):
        """Test email template for IT requirement."""
        with patch("app.services.email_service.dispatch_email_smtp") as mock_dispatch:
            mock_dispatch.return_value = (True, None)
            
            ok, err = send_requirement_approval_email(
                to_email="itapprover@test.com",
                approver_name="IT Approver",
                requester_name="IT Requester",
                request_no="REQ-IT-999",
                requirement_type="IT",
                title="New CRM Module",
                total_cost=None,
                items_summary="Category: New Feature / Module\nUrgency: ASAP\nProblem: Need new module...",
                approve_url="https://example.com/approve",
                reject_url="https://example.com/reject",
                view_url="https://example.com/view",
                expires_at_str="01 Jan 2025 at 10:00 AM",
                db=db,
            )
            
            assert ok is True
            call_args = mock_dispatch.call_args
            html_content = call_args.kwargs.get("html_content", "") or call_args.args[3]
            
            assert "REQ-IT-999" in html_content
            assert "IT Approver" in html_content
            assert "IT Requester" in html_content
            assert "Not specified" in html_content  # No cost for IT


class TestConcurrentSubmission:
    """Test optimistic locking for concurrent submissions."""

    def test_concurrent_submit_fails_gracefully(
        self, client: TestClient, db: Session
    ):
        """Test concurrent submit on same requirement fails with 409."""
        requester = make_user(db, "concurrent@kim.com", UserRole.SALES_EXECUTIVE, "Concurrent Requester")
        approver = make_user(db, "concurrentapprover@kim.com", UserRole.ADMIN, "Concurrent Approver")
        requester.reporting_manager_id = approver.id
        db.commit()
        
        token = login(client, "concurrent@kim.com")
        headers = auth_headers(token)
        
        create_requirement_record(db, "REQ-MAT-11", "MR-2024-011", "MATERIAL")
        
        with patch("app.services.email_service.dispatch_email_smtp") as mock_dispatch:
            mock_dispatch.return_value = (True, None)
            
            # First submit should succeed
            response1 = client.post(
                "/api/v1/public/approvals/material-requirements/submit",
                json={
                    "requirement": {
                        "id": "REQ-MAT-11",
                        "request_no": "MR-2024-011",
                        "type": "MATERIAL",
                        "title": "MR-2024-011",
                    }
                },
                headers=headers,
            )
            assert response1.status_code == 200
            
            # Second submit on same requirement should fail with 409
            response2 = client.post(
                "/api/v1/public/approvals/material-requirements/submit",
                json={
                    "requirement": {
                        "id": "REQ-MAT-11",
                        "request_no": "MR-2024-011",
                        "type": "MATERIAL",
                        "title": "MR-2024-011",
                    }
                },
                headers=headers,
            )
            assert response2.status_code == 409
            assert "concurrent" in response2.json()["detail"].lower()


class TestRequirementApprovalTokenModel:
    """Test the RequirementApprovalToken model directly."""

    def test_token_hash_generation(self, db: Session):
        """Test token hash is SHA256 of raw token."""
        raw = "test-token-123"
        expected_hash = hashlib.sha256(raw.encode()).hexdigest()
        
        token_rec = RequirementApprovalToken(
            token_hash=expected_hash,
            requirement_id="TEST-1",
            request_no="TEST-001",
            requirement_type="MATERIAL",
            approver_id=1,
            approver_name="Approver",
            approver_email="approver@test.com",
            submitted_by_user_id=2,
            submitted_by_name="Requester",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            status="PENDING",
        )
        db.add(token_rec)
        db.commit()
        
        assert token_rec.token_hash == expected_hash

    def test_token_expiry_default_7_days(self, db: Session):
        """Test token expires in 7 days by default."""
        now = datetime.now(timezone.utc)
        token_rec = RequirementApprovalToken(
            token_hash="test",
            requirement_id="TEST-1",
            request_no="TEST-001",
            requirement_type="MATERIAL",
            approver_id=1,
            approver_name="Approver",
            approver_email="approver@test.com",
            submitted_by_user_id=2,
            submitted_by_name="Requester",
            expires_at=now + timedelta(days=7),
            status="PENDING",
        )
        db.add(token_rec)
        db.commit()

        # Compare timezone-aware datetimes
        assert token_rec.expires_at.replace(tzinfo=timezone.utc) > now + timedelta(days=6)
        assert token_rec.expires_at.replace(tzinfo=timezone.utc) <= now + timedelta(days=8)

    def test_access_log_foreign_key(self, db: Session):
        """Test access log references token correctly."""
        token_rec = RequirementApprovalToken(
            token_hash="test",
            requirement_id="TEST-1",
            request_no="TEST-001",
            requirement_type="MATERIAL",
            approver_id=1,
            approver_name="Approver",
            approver_email="approver@test.com",
            submitted_by_user_id=2,
            submitted_by_name="Requester",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            status="PENDING",
        )
        db.add(token_rec)
        db.commit()
        db.refresh(token_rec)
        
        log = RequirementApprovalAccessLog(
            token_id=token_rec.id,
            requirement_id="TEST-1",
            action="approve",
            ip_address="127.0.0.1",
            user_agent="test-agent",
            accessed_at=datetime.now(timezone.utc),
            success=True,
        )
        db.add(log)
        db.commit()
        
        assert log.token_id == token_rec.id
        assert log.requirement_id == "TEST-1"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])