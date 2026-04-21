"""Physical items (shop products) CRUD router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import User, Product, PhysicalBook, ProductImage, Category
from app.models.enums import ProductType
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from app.schemas.physical_item import (
    PhysicalItemCreateRequest, PhysicalItemUpdateRequest,
)
from slugify import slugify

router = APIRouter(prefix="/physical-items", tags=["Physical Items"])


def _build_item_response(product: Product, detail: bool = False) -> dict:
    """Build a response dict from a Product with its physical_book relation."""
    pb = product.physical_book
    category = pb.category if pb and hasattr(pb, "category") and pb.category else None

    data: dict = {
        "id": str(product.id),
        "title": product.title,
        "title_bn": product.title_bn,
        "slug": product.slug,
        "thumbnail_url": product.thumbnail_url,
        "price": float(product.price),
        "compare_price": float(product.compare_price) if product.compare_price else None,
        "is_free": product.is_free,
        "is_active": product.is_active,
        "stock_quantity": pb.stock_quantity if pb else 0,
        "category_name": category.name if category else None,
        "category_name_bn": category.name_bn if category else None,
        "images": [
            {
                "id": str(img.id),
                "image_url": img.image_url,
                "alt_text": img.alt_text,
                "alt_text_bn": img.alt_text_bn,
                "sort_order": img.sort_order,
            }
            for img in (product.images or [])
        ],
    }

    if detail:
        data.update({
            "description": product.description,
            "description_bn": product.description_bn,
            "currency": product.currency,
            "author": pb.author if pb else None,
            "isbn": pb.isbn if pb else None,
            "weight_grams": pb.weight_grams if pb else None,
            "sku": pb.sku if pb else None,
            "category_id": pb.category_id if pb else None,
            "created_at": product.created_at.isoformat() if product.created_at else None,
            "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        })

    return data


@router.get("/")
async def list_physical_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    search: str = Query(None),
    category_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all active physical items (public storefront)."""
    query = (
        select(Product)
        .where(Product.product_type == ProductType.PHYSICAL_BOOK, Product.is_active == True)
        .options(
            selectinload(Product.physical_book).selectinload(PhysicalBook.category),
            selectinload(Product.images),
        )
        .order_by(Product.created_at.desc())
    )

    if search:
        query = query.where(
            Product.title.ilike(f"%{search}%") |
            Product.title_bn.ilike(f"%{search}%")
        )

    if category_id:
        query = query.join(Product.physical_book).where(PhysicalBook.category_id == category_id)

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    products = result.scalars().all()

    return [_build_item_response(p, detail=True) for p in products]


@router.get("/admin")
async def list_all_physical_items_admin(
    search: str = Query(None),
    category_id: int = Query(None),
    status_filter: str = Query(None, alias="status", pattern="^(active|inactive|low_stock|out_of_stock)$"),
    sort: str = Query("newest", pattern="^(newest|oldest|price_asc|price_desc|stock_asc|stock_desc|name_asc)$"),
    low_stock_threshold: int = Query(5, ge=1, le=100),
    user: User = Depends(PermissionChecker([Permission.PHYSICAL_ITEM_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Admin listing — returns ALL physical items (active + inactive) plus aggregate stats."""

    # --- Aggregate stats across ALL physical items (ignore filters) ---
    total_q = await db.execute(
        select(func.count(Product.id)).where(Product.product_type == ProductType.PHYSICAL_BOOK)
    )
    total = total_q.scalar() or 0

    active_q = await db.execute(
        select(func.count(Product.id)).where(
            Product.product_type == ProductType.PHYSICAL_BOOK,
            Product.is_active == True,
        )
    )
    active_count = active_q.scalar() or 0

    out_of_stock_q = await db.execute(
        select(func.count(Product.id))
        .join(PhysicalBook, PhysicalBook.product_id == Product.id)
        .where(
            Product.product_type == ProductType.PHYSICAL_BOOK,
            PhysicalBook.stock_quantity == 0,
        )
    )
    out_of_stock_count = out_of_stock_q.scalar() or 0

    low_stock_q = await db.execute(
        select(func.count(Product.id))
        .join(PhysicalBook, PhysicalBook.product_id == Product.id)
        .where(
            Product.product_type == ProductType.PHYSICAL_BOOK,
            PhysicalBook.stock_quantity > 0,
            PhysicalBook.stock_quantity < low_stock_threshold,
        )
    )
    low_stock_count = low_stock_q.scalar() or 0

    inventory_value_q = await db.execute(
        select(func.coalesce(func.sum(Product.price * PhysicalBook.stock_quantity), 0))
        .join(PhysicalBook, PhysicalBook.product_id == Product.id)
        .where(
            Product.product_type == ProductType.PHYSICAL_BOOK,
            Product.is_active == True,
        )
    )
    inventory_value = float(inventory_value_q.scalar() or 0)

    # --- Filtered item list ---
    query = (
        select(Product)
        .where(Product.product_type == ProductType.PHYSICAL_BOOK)
        .options(
            selectinload(Product.physical_book).selectinload(PhysicalBook.category),
            selectinload(Product.images),
        )
    )

    if search:
        term = f"%{search}%"
        query = query.where(
            Product.title.ilike(term)
            | Product.title_bn.ilike(term)
        )

    if category_id or status_filter in ("low_stock", "out_of_stock"):
        query = query.join(Product.physical_book)

    if category_id:
        query = query.where(PhysicalBook.category_id == category_id)

    if status_filter == "active":
        query = query.where(Product.is_active == True)
    elif status_filter == "inactive":
        query = query.where(Product.is_active == False)
    elif status_filter == "out_of_stock":
        query = query.where(PhysicalBook.stock_quantity == 0)
    elif status_filter == "low_stock":
        query = query.where(
            PhysicalBook.stock_quantity > 0,
            PhysicalBook.stock_quantity < low_stock_threshold,
        )

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
    elif sort in ("stock_asc", "stock_desc"):
        if "physical_book" not in str(query):
            query = query.join(Product.physical_book, isouter=True)
        query = query.order_by(
            PhysicalBook.stock_quantity.asc() if sort == "stock_asc"
            else PhysicalBook.stock_quantity.desc()
        )

    result = await db.execute(query)
    products = result.scalars().unique().all()

    return {
        "stats": {
            "total": total,
            "active": active_count,
            "inactive": total - active_count,
            "out_of_stock": out_of_stock_count,
            "low_stock": low_stock_count,
            "in_stock": total - out_of_stock_count,
            "inventory_value": inventory_value,
            "low_stock_threshold": low_stock_threshold,
        },
        "items": [_build_item_response(p, detail=True) for p in products],
    }


@router.get("/{slug}")
async def get_physical_item(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single physical item by slug (public)."""
    result = await db.execute(
        select(Product)
        .where(Product.slug == slug, Product.product_type == ProductType.PHYSICAL_BOOK)
        .options(
            selectinload(Product.physical_book).selectinload(PhysicalBook.category),
            selectinload(Product.images),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Physical item not found")

    return _build_item_response(product, detail=True)


@router.post("/", status_code=201)
async def create_physical_item(
    data: PhysicalItemCreateRequest,
    user: User = Depends(PermissionChecker([Permission.PHYSICAL_ITEM_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new physical item product (admin)."""
    final_slug = data.slug or slugify(data.title)

    existing = await db.execute(select(Product).where(Product.slug == final_slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{final_slug}' already exists")

    product = Product(
        product_type=ProductType.PHYSICAL_BOOK,
        title=data.title,
        title_bn=data.title_bn,
        slug=final_slug,
        description=data.description,
        description_bn=data.description_bn,
        thumbnail_url=data.thumbnail_url,
        price=data.price,
        compare_price=data.compare_price,
        is_free=data.is_free,
    )
    db.add(product)
    await db.flush()

    physical_book = PhysicalBook(
        product_id=product.id,
        author=data.author,
        isbn=data.isbn,
        weight_grams=data.weight_grams,
        stock_quantity=data.stock_quantity,
        sku=data.sku,
        category_id=data.category_id,
    )
    db.add(physical_book)

    for img_data in data.images:
        db.add(ProductImage(
            product_id=product.id,
            image_url=img_data.image_url,
            alt_text=img_data.alt_text,
            alt_text_bn=img_data.alt_text_bn,
            sort_order=img_data.sort_order,
        ))

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(
            selectinload(Product.physical_book).selectinload(PhysicalBook.category),
            selectinload(Product.images),
        )
    )
    product = result.scalar_one()
    return _build_item_response(product, detail=True)


@router.patch("/{item_id}")
async def update_physical_item(
    item_id: UUID,
    data: PhysicalItemUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.PHYSICAL_ITEM_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update a physical item product (admin)."""
    result = await db.execute(
        select(Product)
        .where(Product.id == item_id, Product.product_type == ProductType.PHYSICAL_BOOK)
        .options(
            selectinload(Product.physical_book),
            selectinload(Product.images),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Physical item not found")

    # Update product fields
    product_fields = ["title", "title_bn", "description", "description_bn",
                      "thumbnail_url", "price", "compare_price", "is_active", "is_free"]
    update_data = data.model_dump(exclude_unset=True)
    for field in product_fields:
        if field in update_data:
            setattr(product, field, update_data[field])

    # Update physical book fields
    if product.physical_book:
        pb_fields = ["author", "isbn", "weight_grams", "stock_quantity", "sku", "category_id"]
        for field in pb_fields:
            if field in update_data:
                setattr(product.physical_book, field, update_data[field])

    # Replace images if provided
    if data.images is not None:
        # Delete existing images
        for img in product.images:
            await db.delete(img)
        await db.flush()

        # Add new images
        for img_data in data.images:
            db.add(ProductImage(
                product_id=product.id,
                image_url=img_data.image_url,
                alt_text=img_data.alt_text,
                alt_text_bn=img_data.alt_text_bn,
                sort_order=img_data.sort_order,
            ))

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(
            selectinload(Product.physical_book).selectinload(PhysicalBook.category),
            selectinload(Product.images),
        )
    )
    product = result.scalar_one()
    return _build_item_response(product, detail=True)


@router.delete("/{item_id}")
async def delete_physical_item(
    item_id: UUID,
    user: User = Depends(PermissionChecker([Permission.PHYSICAL_ITEM_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a physical item product (admin). Cascade deletes physical_book + images."""
    result = await db.execute(
        select(Product).where(Product.id == item_id, Product.product_type == ProductType.PHYSICAL_BOOK)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Physical item not found")

    await db.delete(product)
    await db.commit()
    return {"message": "Physical item deleted"}
