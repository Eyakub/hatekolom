"""Shared enums used across all models."""

import enum


class RoleType(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    INSTRUCTOR = "instructor"
    PARENT = "parent"
    STUDENT = "student"
    MODERATOR = "moderator"


class ProductType(str, enum.Enum):
    COURSE = "course"
    EBOOK = "ebook"
    PHYSICAL_BOOK = "physical_book"
    BUNDLE = "bundle"
    EXAM = "exam"
    GAME = "game"
    ABACUS = "abacus"


class CourseType(str, enum.Enum):
    LIVE = "live"
    RECORDED = "recorded"
    HYBRID = "hybrid"


class LessonType(str, enum.Enum):
    VIDEO_LECTURE = "video_lecture"
    SMART_NOTE = "smart_note"
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    LIVE_SESSION = "live_session"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    PARTIALLY_FULFILLED = "partially_fulfilled"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentStatus(str, enum.Enum):
    INITIATED = "initiated"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    MOCK_SUCCESS = "mock_success"
    MOCK_FAIL = "mock_fail"
    BKASH = "bkash"
    NAGAD = "nagad"
    CARD = "card"
    BANK = "bank"
    FREE = "free"
    COD = "cod"


class EntitlementType(str, enum.Enum):
    COURSE_ACCESS = "course_access"
    EBOOK_DOWNLOAD = "ebook_download"
    PHYSICAL_SHIPMENT = "physical_shipment"
    EXAM_ACCESS = "exam_access"
    GAME_ACCESS = "game_access"
    ABACUS_ACCESS = "abacus_access"


class ShipmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class ShippingZone(str, enum.Enum):
    INSIDE_DHAKA = "inside_dhaka"
    OUTSIDE_DHAKA = "outside_dhaka"


class SubmissionStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    GRADED = "graded"
    RESUBMIT = "resubmit"


class ResourceType(str, enum.Enum):
    FILE = "file"
    LINK = "link"
