from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import User, Product, Ebook, OrderItem, Order, Payment, PaymentStatus
from app.models.enums import ProductType
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from app.services.ebook_service import EbookService
from slugify import slugify

router = APIRouter(prefix="/ebooks", tags=["E-books"])

ebook_service = EbookService()


@router.get("/")
async def list_public_ebooks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    search: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all active ebooks (public storefront)."""
    query = (
        select(Product)
        .where(Product.product_type == ProductType.EBOOK, Product.is_active == True)
        .options(selectinload(Product.ebook))
        .order_by(Product.created_at.desc())
    )
    if search:
        query = query.where(
            Product.title.ilike(f"%{search}%") |
            Product.title_bn.ilike(f"%{search}%")
        )
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    products = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "title_bn": p.title_bn,
            "slug": p.slug,
            "description": p.description,
            "description_bn": p.description_bn,
            "thumbnail_url": p.thumbnail_url,
            "price": float(p.price),
            "compare_price": float(p.compare_price) if p.compare_price else None,
            "is_free": p.is_free,
            "author": p.ebook.author if p.ebook else None,
            "pages": p.ebook.pages if p.ebook else None,
            "b2_key": p.ebook.b2_key if p.ebook else None,
        }
        for p in products
    ]


@router.get("/admin")
async def list_all_ebooks_admin(
    search: str = Query(None),
    status_filter: str = Query(None, alias="status", pattern="^(active|inactive|free|paid|has_file|no_file)$"),
    sort: str = Query("newest", pattern="^(newest|oldest|price_asc|price_desc|name_asc|sales_desc|revenue_desc)$"),
    user: User = Depends(PermissionChecker([Permission.EBOOK_UPLOAD])),
    db: AsyncSession = Depends(get_db),
):
    """Admin listing — returns ALL ebooks (active + inactive) plus stats."""

    # --- Aggregate stats (across all ebooks) ---
    total = (await db.execute(
        select(func.count(Product.id)).where(Product.product_type == ProductType.EBOOK)
    )).scalar() or 0

    active_count = (await db.execute(
        select(func.count(Product.id)).where(
            Product.product_type == ProductType.EBOOK,
            Product.is_active == True,
        )
    )).scalar() or 0

    free_count = (await db.execute(
        select(func.count(Product.id)).where(
            Product.product_type == ProductType.EBOOK,
            Product.is_free == True,
        )
    )).scalar() or 0

    no_file_count = (await db.execute(
        select(func.count(Product.id))
        .join(Ebook, Ebook.product_id == Product.id)
        .where(
            Product.product_type == ProductType.EBOOK,
            (Ebook.b2_key.is_(None)) | (Ebook.b2_key == ""),
        )
    )).scalar() or 0

    # Revenue from successful payments on ebook products
    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(OrderItem.total_price), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Payment, Payment.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Product.product_type == ProductType.EBOOK,
            Payment.status == PaymentStatus.SUCCESS,
        )
    )).scalar() or 0

    # Total sales (item count)
    total_sales = (await db.execute(
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Payment, Payment.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Product.product_type == ProductType.EBOOK,
            Payment.status == PaymentStatus.SUCCESS,
        )
    )).scalar() or 0

    # Per-ebook aggregates
    per_product_rows = (await db.execute(
        select(
            OrderItem.product_id,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("sales"),
            func.coalesce(func.sum(OrderItem.total_price), 0).label("revenue"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(Payment, Payment.order_id == Order.id)
        .where(Payment.status == PaymentStatus.SUCCESS)
        .group_by(OrderItem.product_id)
    )).all()
    sales_map = {row.product_id: int(row.sales or 0) for row in per_product_rows}
    revenue_map = {row.product_id: float(row.revenue or 0) for row in per_product_rows}

    # --- Filtered list ---
    query = (
        select(Product)
        .where(Product.product_type == ProductType.EBOOK)
        .options(selectinload(Product.ebook))
    )

    if search:
        term = f"%{search}%"
        query = query.where(Product.title.ilike(term) | Product.title_bn.ilike(term))

    if status_filter == "active":
        query = query.where(Product.is_active == True)
    elif status_filter == "inactive":
        query = query.where(Product.is_active == False)
    elif status_filter == "free":
        query = query.where(Product.is_free == True)
    elif status_filter == "paid":
        query = query.where(Product.is_free == False)
    elif status_filter in ("has_file", "no_file"):
        query = query.join(Ebook, Ebook.product_id == Product.id)
        if status_filter == "has_file":
            query = query.where(Ebook.b2_key.isnot(None), Ebook.b2_key != "")
        else:
            query = query.where((Ebook.b2_key.is_(None)) | (Ebook.b2_key == ""))

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
    # sales_desc / revenue_desc sorted in Python after enrichment

    products = (await db.execute(query)).scalars().unique().all()

    items = []
    for p in products:
        eb = p.ebook
        items.append({
            "id": str(p.id),
            "product_id": str(p.id),
            "title": p.title,
            "title_bn": p.title_bn,
            "slug": p.slug,
            "description": p.description,
            "description_bn": p.description_bn,
            "thumbnail_url": p.thumbnail_url,
            "price": float(p.price),
            "compare_price": float(p.compare_price) if p.compare_price else None,
            "is_free": p.is_free,
            "is_active": p.is_active,
            "author": eb.author if eb else None,
            "pages": eb.pages if eb else None,
            "b2_key": eb.b2_key if eb else None,
            "has_file": bool(eb and eb.b2_key),
            "sales_count": sales_map.get(p.id, 0),
            "revenue": revenue_map.get(p.id, 0.0),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    if sort == "sales_desc":
        items.sort(key=lambda x: x["sales_count"], reverse=True)
    elif sort == "revenue_desc":
        items.sort(key=lambda x: x["revenue"], reverse=True)

    return {
        "stats": {
            "total": total,
            "active": active_count,
            "inactive": total - active_count,
            "free": free_count,
            "paid": total - free_count,
            "no_file": no_file_count,
            "total_sales": int(total_sales),
            "total_revenue": float(total_revenue),
        },
        "items": items,
    }


@router.get("/my")
async def list_my_ebooks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all ebooks owned by the current user (parent dashboard)."""
    ebooks = await ebook_service.get_user_ebooks(user.id, db)
    return {"ebooks": ebooks, "total": len(ebooks)}


@router.get("/{slug}")
async def get_ebook_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single ebook by product slug (public)."""
    result = await db.execute(
        select(Product)
        .where(Product.slug == slug, Product.product_type == ProductType.EBOOK)
        .options(selectinload(Product.ebook))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Ebook not found")

    return {
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
        "author": product.ebook.author if product.ebook else None,
        "pages": product.ebook.pages if product.ebook else None,
        "ebook_id": str(product.ebook.id) if product.ebook else None,
    }


@router.post("/", status_code=201)
async def create_ebook(
    data: dict,
    user: User = Depends(PermissionChecker([Permission.EBOOK_UPLOAD])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new ebook product (admin)."""
    title = data.get("title", "")
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    final_slug = data.get("slug") or slugify(title)

    existing = await db.execute(select(Product).where(Product.slug == final_slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{final_slug}' already exists")

    product = Product(
        product_type=ProductType.EBOOK,
        title=title,
        title_bn=data.get("title_bn"),
        slug=final_slug,
        description=data.get("description"),
        description_bn=data.get("description_bn"),
        thumbnail_url=data.get("thumbnail_url"),
        price=data.get("price", 0),
        compare_price=data.get("compare_price"),
        is_free=data.get("is_free", False),
    )
    db.add(product)
    await db.flush()

    ebook = Ebook(
        product_id=product.id,
        author=data.get("author"),
        pages=data.get("pages"),
        b2_key=data.get("b2_key", ""),
        category_id=data.get("category_id"),
    )
    db.add(ebook)
    await db.commit()

    return {
        "id": str(product.id),
        "title": product.title,
        "title_bn": product.title_bn,
        "slug": product.slug,
        "price": float(product.price),
        "is_free": product.is_free,
        "author": ebook.author,
        "pages": ebook.pages,
    }


@router.patch("/{ebook_product_id}")
async def update_ebook(
    ebook_product_id: UUID,
    data: dict,
    user: User = Depends(PermissionChecker([Permission.EBOOK_UPLOAD])),
    db: AsyncSession = Depends(get_db),
):
    """Update an ebook product (admin)."""
    result = await db.execute(
        select(Product)
        .where(Product.id == ebook_product_id, Product.product_type == ProductType.EBOOK)
        .options(selectinload(Product.ebook))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Ebook not found")

    # Update product fields
    product_fields = ["title", "title_bn", "description", "description_bn", "thumbnail_url", "price", "compare_price", "is_free", "is_active"]
    for field in product_fields:
        if field in data:
            setattr(product, field, data[field])

    # Update ebook fields
    if product.ebook:
        ebook_fields = ["author", "pages", "b2_key", "category_id"]
        for field in ebook_fields:
            if field in data:
                setattr(product.ebook, field, data[field])

    await db.commit()
    await db.refresh(product)

    return {
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
        "author": product.ebook.author if product.ebook else None,
        "pages": product.ebook.pages if product.ebook else None,
    }

@router.delete("/{ebook_product_id}")
async def delete_ebook(
    ebook_product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.EBOOK_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete an ebook product (admin)."""
    result = await db.execute(
        select(Product).where(Product.id == ebook_product_id, Product.product_type == ProductType.EBOOK)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Ebook not found")

    await db.delete(product)
    await db.commit()
    return {"message": "Ebook deleted"}



@router.post("/{ebook_id}/download")
async def download_ebook(
    ebook_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a secure download URL for a purchased ebook.

    - Checks entitlement (must own the ebook)
    - Rate limited: 3 downloads per 24h
    - Returns a 5-minute presigned Backblaze B2 URL
    - Tracks download count for audit
    """
    from redis.asyncio import Redis
    from app.core.config import settings

    redis = Redis.from_url(settings.REDIS_URL)
    try:
        result = await ebook_service.generate_download_url(
            ebook_id=ebook_id,
            user_id=user.id,
            db=db,
            redis=redis,
        )
        return result
    finally:
        await redis.aclose()
