from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from slugify import slugify

from app.db import get_db
from app.models import (
    User, Product, ProductType, Course, CourseType,
    Module, Lesson, LessonType, Video, Category,
    Enrollment, OrderItem, Order, Payment, PaymentStatus, Instructor,
)
from app.schemas import (
    CourseCreateRequest, CourseUpdateRequest, CourseResponse, CourseListItem,
    ModuleCreateRequest, ModuleUpdateRequest, ModuleResponse,
    LessonCreateRequest, LessonUpdateRequest, LessonResponse,
)
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission

router = APIRouter(prefix="/courses", tags=["Courses"])


# ============================================
# COURSE CRUD
# ============================================

@router.get("/")
async def list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    category_id: int = Query(None),
    course_type: str = Query(None),
    is_free: bool = Query(None),
    is_featured: bool = Query(None),
    search: str = Query(None),
    sort_by: str = Query(None),  # newest, price_low, price_high, popular
    db: AsyncSession = Depends(get_db),
):
    """List courses (public, filterable, sortable)."""
    query = (
        select(Course)
        .options(selectinload(Course.product))
        .join(Course.product)
        .where(Product.is_active == True)
    )

    if category_id:
        query = query.where(Course.category_id == category_id)
    if course_type:
        query = query.where(Course.course_type == CourseType(course_type))
    if is_free is not None:
        query = query.where(Product.is_free == is_free)
    if is_featured is not None:
        query = query.where(Course.is_featured == is_featured)
    if search:
        query = query.where(
            Product.title.ilike(f"%{search}%") |
            Product.title_bn.ilike(f"%{search}%")
        )

    # Sorting
    if sort_by == "price_low":
        query = query.order_by(Product.price.asc())
    elif sort_by == "price_high":
        query = query.order_by(Product.price.desc())
    elif sort_by == "newest":
        query = query.order_by(Product.created_at.desc())
    else:
        query = query.order_by(Course.is_featured.desc(), Product.created_at.desc())

    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    courses = result.scalars().all()

    # Check which courses have attached exams
    if courses:
        from app.models.exam import ProductExam
        product_ids = [c.product_id for c in courses]
        exam_links = await db.execute(
            select(ProductExam.product_id).where(ProductExam.product_id.in_(product_ids))
        )
        products_with_exams = {row[0] for row in exam_links.all()}
    else:
        products_with_exams = set()

    items = []
    for c in courses:
        data = CourseListItem.model_validate(c).model_dump()
        data["has_exam"] = c.product_id in products_with_exams
        items.append(data)
    return items


@router.get("/admin")
async def list_all_courses_admin(
    search: str = Query(None),
    category_id: int = Query(None),
    course_type: str = Query(None, pattern="^(recorded|live|hybrid)$"),
    status_filter: str = Query(None, alias="status", pattern="^(active|inactive|featured|free|paid)$"),
    sort: str = Query("newest", pattern="^(newest|oldest|price_asc|price_desc|enrollments_desc|revenue_desc|name_asc)$"),
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Admin listing — returns ALL courses (active + inactive) with aggregates."""

    # --- Aggregate stats (across all courses, ignores filters) ---
    total = (await db.execute(
        select(func.count(Course.id))
    )).scalar() or 0

    active = (await db.execute(
        select(func.count(Course.id))
        .join(Course.product)
        .where(Product.is_active == True)
    )).scalar() or 0

    featured = (await db.execute(
        select(func.count(Course.id)).where(Course.is_featured == True)
    )).scalar() or 0

    free_count = (await db.execute(
        select(func.count(Course.id))
        .join(Course.product)
        .where(Product.is_free == True)
    )).scalar() or 0

    total_enrollments = (await db.execute(
        select(func.count(Enrollment.id))
    )).scalar() or 0

    # Revenue from successful payments on course products
    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(OrderItem.total_price), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Payment, Payment.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Product.product_type == ProductType.COURSE,
            Payment.status == PaymentStatus.SUCCESS,
        )
    )).scalar() or 0

    # --- Per-course aggregates: enrollment count + revenue ---
    enrollment_counts_rows = (await db.execute(
        select(Enrollment.course_id, func.count(Enrollment.id))
        .group_by(Enrollment.course_id)
    )).all()
    enrollment_map: dict = {row[0]: row[1] for row in enrollment_counts_rows}

    revenue_rows = (await db.execute(
        select(OrderItem.product_id, func.coalesce(func.sum(OrderItem.total_price), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Payment, Payment.order_id == Order.id)
        .where(Payment.status == PaymentStatus.SUCCESS)
        .group_by(OrderItem.product_id)
    )).all()
    revenue_map: dict = {row[0]: float(row[1] or 0) for row in revenue_rows}

    # --- Filtered list ---
    query = (
        select(Course)
        .options(
            selectinload(Course.product),
            selectinload(Course.instructor),
        )
        .join(Course.product)
    )

    if search:
        term = f"%{search}%"
        query = query.where(
            Product.title.ilike(term) | Product.title_bn.ilike(term)
        )
    if category_id:
        query = query.where(Course.category_id == category_id)
    if course_type:
        query = query.where(Course.course_type == CourseType(course_type))

    if status_filter == "active":
        query = query.where(Product.is_active == True)
    elif status_filter == "inactive":
        query = query.where(Product.is_active == False)
    elif status_filter == "featured":
        query = query.where(Course.is_featured == True)
    elif status_filter == "free":
        query = query.where(Product.is_free == True)
    elif status_filter == "paid":
        query = query.where(Product.is_free == False)

    if sort == "newest":
        query = query.order_by(Product.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Product.created_at.asc())
    elif sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "name_asc":
        query = query.order_by(Product.title.asc())
    # enrollments_desc / revenue_desc sorted in Python after enrichment

    courses = (await db.execute(query)).scalars().unique().all()

    # Load category names
    category_ids = list({c.category_id for c in courses if c.category_id})
    categories: dict = {}
    if category_ids:
        cat_rows = (await db.execute(
            select(Category).where(Category.id.in_(category_ids))
        )).scalars().all()
        categories = {cat.id: cat for cat in cat_rows}

    items = []
    for c in courses:
        product = c.product
        instructor = c.instructor
        cat = categories.get(c.category_id) if c.category_id else None
        items.append({
            "id": str(c.id),
            "product_id": str(c.product_id),
            "course_type": c.course_type,
            "level": c.level,
            "total_lessons": c.total_lessons,
            "is_featured": c.is_featured,
            "category_id": c.category_id,
            "category_name": cat.name if cat else None,
            "category_name_bn": cat.name_bn if cat else None,
            "instructor_id": str(c.instructor_id) if c.instructor_id else None,
            "instructor_name": instructor.name if instructor else None,
            "instructor_name_bn": instructor.name_bn if instructor else None,
            "enrollment_count": enrollment_map.get(c.id, 0),
            "revenue": revenue_map.get(c.product_id, 0.0),
            "product": {
                "id": str(product.id),
                "title": product.title,
                "title_bn": product.title_bn,
                "slug": product.slug,
                "description": product.description,
                "description_bn": product.description_bn,
                "thumbnail_url": product.thumbnail_url,
                "price": float(product.price),
                "compare_price": float(product.compare_price) if product.compare_price else None,
                "is_free": product.is_free,
                "is_active": product.is_active,
                "created_at": product.created_at.isoformat() if product.created_at else None,
            },
        })

    # Sorts that need enriched data
    if sort == "enrollments_desc":
        items.sort(key=lambda x: x["enrollment_count"], reverse=True)
    elif sort == "revenue_desc":
        items.sort(key=lambda x: x["revenue"], reverse=True)

    return {
        "stats": {
            "total": total,
            "active": active,
            "inactive": total - active,
            "featured": featured,
            "free": free_count,
            "paid": total - free_count,
            "total_enrollments": total_enrollments,
            "total_revenue": float(total_revenue),
        },
        "items": items,
    }


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get course detail with modules and lessons (public)."""
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.product),
            selectinload(Course.modules).selectinload(Module.lessons).selectinload(Lesson.video),
        )
        .where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return CourseResponse.model_validate(course)


@router.get("/slug/{slug}", response_model=CourseResponse)
async def get_course_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Get course by product slug (public)."""
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.product),
            selectinload(Course.modules).selectinload(Module.lessons).selectinload(Lesson.video),
        )
        .join(Course.product)
        .where(Product.slug == slug)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return CourseResponse.model_validate(course)


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    data: CourseCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new course (admin/instructor)."""
    slug = data.slug or slugify(data.title)

    # Check slug uniqueness
    existing = await db.execute(select(Product).where(Product.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{slug}' already exists")

    # Create product
    product = Product(
        product_type=ProductType.COURSE,
        title=data.title,
        title_bn=data.title_bn,
        slug=slug,
        description=data.description,
        description_bn=data.description_bn,
        thumbnail_url=data.thumbnail_url,
        price=data.price,
        compare_price=data.compare_price,
        is_free=data.is_free,
    )
    db.add(product)
    await db.flush()

    # Create course
    course = Course(
        product_id=product.id,
        course_type=CourseType(data.course_type),
        instructor_id=data.instructor_id or user.id,
        category_id=data.category_id,
        level=data.level,
        duration_months=data.duration_months,
        age_min=data.age_min,
        age_max=data.age_max,
        preview_video_url=data.preview_video_url,
        is_featured=data.is_featured,
    )
    db.add(course)
    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.product),
            selectinload(Course.modules).selectinload(Module.lessons).selectinload(Lesson.video),
        )
        .where(Course.id == course.id)
    )
    course = result.scalar_one()
    return CourseResponse.model_validate(course)


@router.patch("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: UUID,
    data: CourseUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update a course."""
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.product))
        .where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    update_data = data.model_dump(exclude_unset=True)

    # Product-level fields
    product_fields = {
        "title", "title_bn", "description", "description_bn",
        "thumbnail_url", "price", "compare_price", "is_free", "is_active",
    }
    for field in product_fields:
        if field in update_data:
            setattr(course.product, field, update_data.pop(field))

    # Course-level fields
    for field, value in update_data.items():
        if field == "course_type":
            setattr(course, field, CourseType(value))
        else:
            setattr(course, field, value)

    await db.commit()

    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.product),
            selectinload(Course.modules).selectinload(Module.lessons).selectinload(Lesson.video),
        )
        .where(Course.id == course_id)
    )
    course = result.scalar_one()
    return CourseResponse.model_validate(course)


# ============================================
# MODULE CRUD
# ============================================

@router.post("/{course_id}/modules", response_model=ModuleResponse, status_code=201)
async def create_module(
    course_id: UUID,
    data: ModuleCreateRequest,
    user: User = Depends(PermissionChecker([Permission.LESSON_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Add a module to a course."""
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    module = Module(
        course_id=course_id,
        title=data.title,
        title_bn=data.title_bn,
        sort_order=data.sort_order,
        is_free=data.is_free,
    )
    db.add(module)
    await db.commit()
    await db.refresh(module, ["lessons"])
    return ModuleResponse.model_validate(module)


@router.patch("/modules/{module_id}", response_model=ModuleResponse)
async def update_module(
    module_id: UUID,
    data: ModuleUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.LESSON_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update a module."""
    result = await db.execute(
        select(Module).options(selectinload(Module.lessons)).where(Module.id == module_id)
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(module, field, value)

    await db.commit()
    await db.refresh(module, ["lessons"])
    return ModuleResponse.model_validate(module)


@router.delete("/modules/{module_id}", status_code=204)
async def delete_module(
    module_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a module."""
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    await db.delete(module)
    await db.commit()


# ============================================
# LESSON CRUD
# ============================================

@router.post("/modules/{module_id}/lessons", response_model=LessonResponse, status_code=201)
async def create_lesson(
    module_id: UUID,
    data: LessonCreateRequest,
    user: User = Depends(PermissionChecker([Permission.LESSON_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Add a lesson to a module."""
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    lesson = Lesson(
        module_id=module_id,
        title=data.title,
        title_bn=data.title_bn,
        lesson_type=LessonType(data.lesson_type),
        sort_order=data.sort_order,
        duration_seconds=data.duration_seconds,
        is_free=data.is_free,
        content=data.content,
        content_bn=data.content_bn,
    )
    db.add(lesson)
    await db.flush()

    # Create video record if this is a video lesson
    if data.youtube_id and data.lesson_type == "video_lecture":
        video = Video(
            lesson_id=lesson.id,
            youtube_id=data.youtube_id,
            duration_seconds=data.duration_seconds,
        )
        db.add(video)

    # Update course lesson count
    course = await db.get(Course, module.course_id)
    if course:
        count_result = await db.execute(
            select(func.count()).select_from(Lesson)
            .join(Module)
            .where(Module.course_id == course.id)
        )
        course.total_lessons = count_result.scalar() or 0

    await db.commit()
    await db.refresh(lesson, ["video"])
    return LessonResponse.model_validate(lesson)


@router.patch("/lessons/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: UUID,
    data: LessonUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.LESSON_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update a lesson."""
    result = await db.execute(
        select(Lesson).options(selectinload(Lesson.video)).where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    update_data = data.model_dump(exclude_unset=True)
    youtube_id = update_data.pop("youtube_id", None)

    for field, value in update_data.items():
        if field == "lesson_type":
            setattr(lesson, field, LessonType(value))
        else:
            setattr(lesson, field, value)

    # Update video if provided
    if youtube_id is not None:
        if lesson.video:
            lesson.video.youtube_id = youtube_id
        else:
            db.add(Video(lesson_id=lesson.id, youtube_id=youtube_id))

    await db.commit()
    await db.refresh(lesson, ["video"])
    return LessonResponse.model_validate(lesson)


@router.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a lesson."""
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await db.delete(lesson)
    await db.commit()
