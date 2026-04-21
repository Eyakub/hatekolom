from enum import Enum


class Permission(str, Enum):
    # Course management
    COURSE_CREATE = "course.create"
    COURSE_EDIT = "course.edit"
    COURSE_DELETE = "course.delete"
    COURSE_PUBLISH = "course.publish"
    COURSE_VIEW_ALL = "course.view_all"

    # Content
    LESSON_CREATE = "lesson.create"
    LESSON_EDIT = "lesson.edit"

    # User management
    USER_VIEW = "user.view"
    USER_EDIT = "user.edit"
    USER_BAN = "user.ban"
    USER_ASSIGN_ROLE = "user.assign_role"

    # Parent-specific
    CHILD_CREATE = "child.create"
    CHILD_EDIT = "child.edit"
    CHILD_VIEW_PROGRESS = "child.view_progress"
    CHILD_PURCHASE = "child.purchase"

    # Orders
    ORDER_VIEW_OWN = "order.view_own"
    ORDER_VIEW_ALL = "order.view_all"
    ORDER_REFUND = "order.refund"
    ORDER_EXPORT = "order.export"

    # Shipping
    SHIPMENT_MANAGE = "shipment.manage"
    SHIPMENT_VIEW_OWN = "shipment.view_own"

    # E-books
    EBOOK_UPLOAD = "ebook.upload"
    EBOOK_DELETE = "ebook.delete"
    EBOOK_DOWNLOAD = "ebook.download"

    # Physical Items
    PHYSICAL_ITEM_CREATE = "physical_item.create"
    PHYSICAL_ITEM_EDIT = "physical_item.edit"
    PHYSICAL_ITEM_DELETE = "physical_item.delete"

    # System
    SYSTEM_SETTINGS = "system.settings"
    ANALYTICS_VIEW = "analytics.view"
    AUDIT_LOG_VIEW = "audit.view"


# Role → Permissions mapping
ROLE_PERMISSIONS: dict[str, list[Permission]] = {
    "super_admin": list(Permission),  # All permissions

    "admin": [
        Permission.COURSE_CREATE, Permission.COURSE_EDIT, Permission.COURSE_DELETE,
        Permission.COURSE_PUBLISH, Permission.COURSE_VIEW_ALL,
        Permission.LESSON_CREATE, Permission.LESSON_EDIT,
        Permission.USER_VIEW, Permission.USER_EDIT, Permission.USER_BAN,
        Permission.USER_ASSIGN_ROLE,
        Permission.CHILD_CREATE, Permission.CHILD_EDIT, Permission.CHILD_VIEW_PROGRESS,
        Permission.CHILD_PURCHASE,
        Permission.ORDER_VIEW_OWN, Permission.ORDER_VIEW_ALL,
        Permission.ORDER_REFUND, Permission.ORDER_EXPORT,
        Permission.SHIPMENT_MANAGE, Permission.SHIPMENT_VIEW_OWN,
        Permission.EBOOK_UPLOAD, Permission.EBOOK_DELETE, Permission.EBOOK_DOWNLOAD,
        Permission.PHYSICAL_ITEM_CREATE, Permission.PHYSICAL_ITEM_EDIT, Permission.PHYSICAL_ITEM_DELETE,
        Permission.ANALYTICS_VIEW, Permission.AUDIT_LOG_VIEW,
    ],

    "instructor": [
        Permission.COURSE_CREATE, Permission.COURSE_EDIT, Permission.COURSE_VIEW_ALL,
        Permission.LESSON_CREATE, Permission.LESSON_EDIT,
        Permission.CHILD_VIEW_PROGRESS,
    ],

    "parent": [
        Permission.CHILD_CREATE, Permission.CHILD_EDIT, Permission.CHILD_VIEW_PROGRESS,
        Permission.CHILD_PURCHASE,
        Permission.ORDER_VIEW_OWN,
        Permission.SHIPMENT_VIEW_OWN,
        Permission.EBOOK_DOWNLOAD,
    ],

    "student": [
        Permission.EBOOK_DOWNLOAD,
    ],

    "moderator": [
        Permission.USER_VIEW, Permission.USER_BAN,
        Permission.COURSE_VIEW_ALL,
    ],
}
