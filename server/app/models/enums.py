import enum


class UserRole(enum.StrEnum):
    SALES_EXECUTIVE = "SALES_EXECUTIVE"
    FINANCE_OFFICER = "FINANCE_OFFICER"
    DELIVERY_TEAM = "DELIVERY_TEAM"
    ADMIN = "ADMIN"


class ApplicationStatus(enum.StrEnum):
    LEAD = "LEAD"
    APPLICATION = "APPLICATION"
    VERIFICATION = "VERIFICATION"
    FINANCE = "FINANCE"
    QUERY = "QUERY"
    SANCTIONED = "SANCTIONED"
    DELIVERY = "DELIVERY"
    DISBURSEMENT = "DISBURSEMENT"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"


class StageModule(enum.StrEnum):
    LEAD = "LEAD"
    OPPORTUNITY = "OPPORTUNITY"


class DocStatus(enum.StrEnum):
    UPLOADED = "UPLOADED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class VerificationStatus(enum.StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class FinanceStatus(enum.StrEnum):
    PROCESSING = "PROCESSING"
    QUERY = "QUERY"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DeliveryStatus(enum.StrEnum):
    PENDING = "PENDING"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"


class DisbursementStatus(enum.StrEnum):
    PENDING_UTR = "PENDING_UTR"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class LeadSource(enum.StrEnum):
    WEBSITE = "WEBSITE"
    REFERRAL = "REFERRAL"
    EVENT = "EVENT"
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    COLD_CALL = "COLD_CALL"
    OTHER = "OTHER"


class VSComponentType(enum.StrEnum):
    BATTERY = "BATTERY"
    MOTOR = "MOTOR"
    CONTROLLER = "CONTROLLER"
    CHARGER = "CHARGER"
    WIRING_HARNESS = "WIRING_HARNESS"
    DC_CONVERTER = "DC_CONVERTER"
    THROTTLE = "THROTTLE"
    OTHER = "OTHER"


class ComplaintCategory(enum.StrEnum):
    BREAKDOWN = "BREAKDOWN"
    BATTERY = "BATTERY"
    MOTOR = "MOTOR"
    CONTROLLER = "CONTROLLER"
    CHARGING = "CHARGING"
    PERFORMANCE = "PERFORMANCE"
    WIRING = "WIRING"
    OTHER = "OTHER"


class ComplaintSeverity(enum.StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ComplaintStatus(enum.StrEnum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class RegisteredVia(enum.StrEnum):
    STAFF = "STAFF"
    QR = "QR"


class MaintenanceStatus(enum.StrEnum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

