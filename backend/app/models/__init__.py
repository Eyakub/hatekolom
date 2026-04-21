"""
Models package — re-exports all models for convenient imports.

Usage:
    from app.models import User, Course, Order
    from app.models.enums import RoleType, OrderStatus
"""

# Enums
from app.models.enums import (  # noqa: F401
    RoleType, ProductType, CourseType, LessonType,
    OrderStatus, PaymentStatus, PaymentMethod,
    EntitlementType, ShipmentStatus, ShippingZone,
    SubmissionStatus, ResourceType,
)

# Users & RBAC
from app.models.user import (  # noqa: F401
    User, Role, Permission_ , UserRole, RolePermission,
)

# Child Profiles
from app.models.child import ChildProfile  # noqa: F401

# Products & Catalog
from app.models.product import (  # noqa: F401
    Product, Category, Bundle, BundleItem,
)

# Courses
from app.models.course import (  # noqa: F401
    Course, Module, Lesson, Video,
)

# Books
from app.models.book import Ebook, PhysicalBook  # noqa: F401

# Product Images
from app.models.product_image import ProductImage  # noqa: F401

# Orders & Payments
from app.models.order import Order, OrderItem, Payment  # noqa: F401

# Entitlements
from app.models.entitlement import Entitlement  # noqa: F401

# Enrollments & Progress
from app.models.enrollment import Enrollment, LessonProgress  # noqa: F401

# Shipping
from app.models.shipping import (  # noqa: F401
    ShippingRate, Shipment, ShipmentEvent,
)

# OTP Verification
from app.models.otp import OTPVerification  # noqa: F401

# Coupons
from app.models.coupon import Coupon  # noqa: F401

# Fraud Config
from app.models.fraud import FraudConfig  # noqa: F401

# Quizzes
from app.models.quiz import Quiz, QuizQuestion, QuizOption, QuizAttempt  # noqa: F401

# Certificates
from app.models.certificate import Certificate  # noqa: F401

# Reviews
from app.models.review import Review  # noqa: F401

# Site Settings
from app.models.site_settings import SiteSettings  # noqa: F401
from app.models.instructor import Instructor  # noqa: F401

# Homepage Content
from app.models.homepage import (  # noqa: F401
    HomepageTestimonial, HomepageStat, HomepageGallery, HomepageActivity,
)

# Assignments
from app.models.assignment import AssignmentSubmission  # noqa: F401

# Resources
from app.models.resource import Resource  # noqa: F401

# Course Feedback
from app.models.feedback import CourseFeedback  # noqa: F401

# Exams
from app.models.exam import (  # noqa: F401
    Exam, ExamSection, ExamQuestion, ExamOption, ExamAttempt, ProductExam,
)

# Games
from app.models.game import Game, GameAttempt, ProductGame  # noqa: F401

# Abacus
from app.models.abacus import AbacusCourse, AbacusLevel, AbacusAttempt, ProductAbacus  # noqa: F401

# Badges
from app.models.badge import Badge, ChildBadge  # noqa: F401

# Drawings
from app.models.drawing import Drawing, DrawingLike  # noqa: F401

# Challenges
from app.models.challenge import Challenge  # noqa: F401
