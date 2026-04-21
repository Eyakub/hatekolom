"""
Schemas package — re-exports all schemas for convenient imports.

Usage:
    from app.schemas import RegisterRequest, UserResponse, CourseResponse
"""

# Common
from app.schemas.common import MessageResponse, PaginatedResponse  # noqa: F401

# Auth
from app.schemas.auth import (  # noqa: F401
    RegisterRequest, LoginRequest, TokenResponse, RefreshTokenRequest,
)

# User
from app.schemas.user import UserResponse, UserUpdateRequest  # noqa: F401

# Child
from app.schemas.child import (  # noqa: F401
    ChildCreateRequest, ChildUpdateRequest, ChildResponse,
)

# Category
from app.schemas.category import (  # noqa: F401
    CategoryCreateRequest, CategoryUpdateRequest, CategoryResponse,
)

# Product
from app.schemas.product import (  # noqa: F401
    ProductCreateRequest, ProductUpdateRequest,
    ProductResponse, ProductListResponse,
)

# Physical Items
from app.schemas.physical_item import (  # noqa: F401
    PhysicalItemCreateRequest, PhysicalItemUpdateRequest,
    PhysicalItemResponse, PhysicalItemListResponse,
    ProductImageSchema, ProductImageCreateRequest,
)

# Course / Module / Lesson
from app.schemas.course import (  # noqa: F401
    CourseCreateRequest, CourseUpdateRequest,
    CourseResponse, CourseListItem,
    ModuleCreateRequest, ModuleUpdateRequest, ModuleResponse,
    ModuleBriefResponse, LessonBriefResponse,
    LessonCreateRequest, LessonUpdateRequest,
    LessonResponse, VideoResponse,
)

# Order / Payment / Shipment / Entitlement
from app.schemas.order import (  # noqa: F401
    OrderItemRequest, ShippingAddressRequest,
    OrderCreateRequest, OrderItemResponse,
    PaymentResponse, OrderResponse,
    ShipmentUpdateRequest, ShipmentEventResponse, ShipmentResponse,
    EntitlementResponse,
)

# Fraud
from app.schemas.fraud import (  # noqa: F401
    GuestOrderRequest, IpCheckResponse,
    FraudConfigResponse, FraudConfigUpdateRequest,
)

# Homepage Content
from app.schemas.homepage import (  # noqa: F401
    TestimonialCreateRequest, TestimonialUpdateRequest, TestimonialResponse,
    StatCreateRequest, StatUpdateRequest, StatResponse,
    GalleryCreateRequest, GalleryUpdateRequest, GalleryResponse,
    ActivityCreateRequest, ActivityUpdateRequest, ActivityResponse,
    HomepageContentResponse,
)
