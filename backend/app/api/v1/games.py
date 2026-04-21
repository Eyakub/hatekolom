"""
Game API — Admin CRUD + Student start/submit + public listing.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional

from app.db import get_db
from app.models import User, Product, ProductType
from app.models.game import Game, GameAttempt, ProductGame
from app.models.entitlement import Entitlement
from app.models.enums import EntitlementType
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission
from slugify import slugify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/games", tags=["Games"])


# ---- Default backgrounds ----

DEFAULT_BACKGROUNDS = {
    "memory": "/game-themes/memory-default.svg",
    "drag_drop": "/game-themes/dragdrop-default.svg",
    "crossword": "/game-themes/crossword-default.svg",
    "find_words": "/game-themes/findwords-default.svg",
    "image_sequence": "/game-themes/sequence-default.svg",
    "arithmetic": "/game-themes/arithmetic-default.svg",
}


# ---- Schemas ----

class GameCreateRequest(BaseModel):
    title: str
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Decimal = Decimal("0")
    compare_price: Optional[Decimal] = None
    is_free: bool = False
    game_type: str  # memory | drag_drop | crossword | find_words | image_sequence | arithmetic
    difficulty: str = "easy"
    background_image_url: Optional[str] = None
    time_limit_seconds: Optional[int] = None
    config: dict = {}


class GameUpdateRequest(BaseModel):
    title: Optional[str] = None
    title_bn: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    description_bn: Optional[str] = None
    thumbnail_url: Optional[str] = None
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    is_free: Optional[bool] = None
    is_active: Optional[bool] = None
    difficulty: Optional[str] = None
    background_image_url: Optional[str] = None
    time_limit_seconds: Optional[int] = None


class GameConfigUpdateRequest(BaseModel):
    config: dict


class GameSubmitRequest(BaseModel):
    child_profile_id: str
    score: int = 0
    total_points: int = 0
    time_seconds: int = 0
    completed: bool = False
    stars: int = 0
    attempt_data: dict = {}


# ---- Helper ----

async def _get_game_response(game_id: UUID, db: AsyncSession, admin: bool = False):
    """Serialize a game with its product fields."""
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.product))
        .where(Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    product = game.product
    bg_url = game.background_image_url or DEFAULT_BACKGROUNDS.get(game.game_type)

    resp = {
        "id": str(game.id),
        "product_id": str(game.product_id),
        "title": product.title,
        "title_bn": product.title_bn,
        "slug": product.slug,
        "description": product.description,
        "description_bn": product.description_bn,
        "thumbnail_url": product.thumbnail_url,
        "price": str(product.price) if product.price is not None else "0",
        "compare_price": str(product.compare_price) if product.compare_price else None,
        "is_free": product.is_free,
        "is_active": product.is_active,
        "game_type": game.game_type,
        "difficulty": game.difficulty,
        "background_image_url": bg_url,
        "time_limit_seconds": game.time_limit_seconds,
        "total_plays": game.total_plays,
        "created_at": str(game.created_at) if game.created_at else None,
    }

    if admin:
        resp["config"] = game.config

    return resp


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.post("/", status_code=201)
async def create_game(
    data: GameCreateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a game with product record (admin)."""
    slug = data.slug or slugify(data.title)

    # Check slug uniqueness
    existing = await db.execute(select(Product).where(Product.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{slug}' already exists")

    # Create product
    product = Product(
        product_type=ProductType.GAME,
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

    # Create game
    game = Game(
        product_id=product.id,
        game_type=data.game_type,
        difficulty=data.difficulty,
        background_image_url=data.background_image_url,
        time_limit_seconds=data.time_limit_seconds,
        config=data.config,
    )
    db.add(game)
    await db.commit()

    return await _get_game_response(game.id, db, admin=True)


@router.put("/{game_id}", status_code=200)
async def update_game(
    game_id: UUID,
    data: GameUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update game settings + product fields (admin)."""
    result = await db.execute(
        select(Game).options(selectinload(Game.product)).where(Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    update_data = data.model_dump(exclude_unset=True)

    # Product-level fields
    product_fields = {
        "title", "title_bn", "slug", "description", "description_bn",
        "thumbnail_url", "price", "compare_price", "is_free", "is_active",
    }
    for field in product_fields:
        if field in update_data:
            setattr(game.product, field, update_data.pop(field))

    # Game-level fields
    for field, value in update_data.items():
        setattr(game, field, value)

    await db.commit()
    return await _get_game_response(game.id, db, admin=True)


@router.put("/{game_id}/config", status_code=200)
async def update_game_config(
    game_id: UUID,
    data: GameConfigUpdateRequest,
    user: User = Depends(PermissionChecker([Permission.COURSE_EDIT])),
    db: AsyncSession = Depends(get_db),
):
    """Update game config JSONB only (admin)."""
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    game.config = data.config
    await db.commit()
    return await _get_game_response(game.id, db, admin=True)


@router.get("/{game_id}/admin")
async def get_game_admin(
    game_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Get full game with config (admin view)."""
    return await _get_game_response(game_id, db, admin=True)


@router.post("/{game_id}/attach/{product_id}", status_code=201)
async def attach_game_to_product(
    game_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Attach a game to another product (ProductGame link)."""
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if already attached
    existing = await db.execute(
        select(ProductGame).where(
            ProductGame.game_id == game_id,
            ProductGame.product_id == product_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Game already attached to this product")

    link = ProductGame(game_id=game_id, product_id=product_id)
    db.add(link)
    await db.commit()

    return {"message": "Game attached to product", "game_id": str(game_id), "product_id": str(product_id)}


@router.delete("/{game_id}/attach/{product_id}", status_code=204)
async def detach_game_from_product(
    game_id: UUID,
    product_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Detach a game from a product."""
    result = await db.execute(
        select(ProductGame).where(
            ProductGame.game_id == game_id,
            ProductGame.product_id == product_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Attachment not found")

    await db.delete(link)
    await db.commit()


@router.get("/{game_id}/attempts")
async def list_game_attempts(
    game_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """View all attempts for a game (admin)."""
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    from app.models.child import ChildProfile

    result = await db.execute(
        select(GameAttempt)
        .options(
            selectinload(GameAttempt.user),
            selectinload(GameAttempt.child),
        )
        .where(GameAttempt.game_id == game_id)
        .order_by(GameAttempt.completed_at.desc())
    )
    attempts = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "game_id": str(a.game_id),
            "user_id": str(a.user_id),
            "child_profile_id": str(a.child_profile_id),
            "child_name": a.child.full_name if a.child else None,
            "score": a.score,
            "stars": a.stars,
            "time_seconds": a.time_seconds,
            "completed": a.completed,
            "completed_at": str(a.completed_at) if a.completed_at else None,
        }
        for a in attempts
    ]


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@router.get("/")
async def list_games(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    game_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all active games with product info (public)."""
    query = (
        select(Game)
        .options(selectinload(Game.product))
        .join(Game.product)
        .where(Product.is_active == True, Game.is_active == True)
    )

    if game_type:
        query = query.where(Game.game_type == game_type)

    if difficulty:
        query = query.where(Game.difficulty == difficulty)

    if search:
        query = query.where(
            Product.title.ilike(f"%{search}%") |
            Product.title_bn.ilike(f"%{search}%")
        )

    query = query.order_by(Game.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    games = result.scalars().all()

    return [
        {
            "id": str(g.id),
            "product_id": str(g.product_id),
            "title": g.product.title,
            "title_bn": g.product.title_bn,
            "slug": g.product.slug,
            "description": g.product.description,
            "description_bn": g.product.description_bn,
            "thumbnail_url": g.product.thumbnail_url,
            "price": str(g.product.price) if g.product.price is not None else "0",
            "compare_price": str(g.product.compare_price) if g.product.compare_price else None,
            "is_free": g.product.is_free,
            "game_type": g.game_type,
            "difficulty": g.difficulty,
            "background_image_url": g.background_image_url or DEFAULT_BACKGROUNDS.get(g.game_type),
            "time_limit_seconds": g.time_limit_seconds,
            "total_plays": g.total_plays,
            "created_at": str(g.created_at) if g.created_at else None,
        }
        for g in games
    ]


@router.get("/slug/{slug}")
async def get_game_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get game detail by product slug (no config)."""
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.product))
        .join(Game.product)
        .where(Product.slug == slug)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    product = game.product
    return {
        "id": str(game.id),
        "product_id": str(game.product_id),
        "title": product.title,
        "title_bn": product.title_bn,
        "slug": product.slug,
        "description": product.description,
        "description_bn": product.description_bn,
        "thumbnail_url": product.thumbnail_url,
        "price": str(product.price) if product.price is not None else "0",
        "compare_price": str(product.compare_price) if product.compare_price else None,
        "is_free": product.is_free,
        "is_active": product.is_active,
        "game_type": game.game_type,
        "difficulty": game.difficulty,
        "background_image_url": game.background_image_url or DEFAULT_BACKGROUNDS.get(game.game_type),
        "time_limit_seconds": game.time_limit_seconds,
        "total_plays": game.total_plays,
        "created_at": str(game.created_at) if game.created_at else None,
    }


@router.get("/product/{product_id}/attached")
async def get_attached_games(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all games attached to a product (public)."""
    result = await db.execute(
        select(ProductGame)
        .where(ProductGame.product_id == product_id)
    )
    links = result.scalars().all()
    if not links:
        return []

    game_ids = [link.game_id for link in links]
    games_result = await db.execute(
        select(Game)
        .options(selectinload(Game.product))
        .where(Game.id.in_(game_ids))
    )
    games = games_result.scalars().all()

    return [
        {
            "id": str(link.id),
            "game_id": str(g.id),
            "product_id": str(g.product_id),
            "title": g.product.title,
            "title_bn": g.product.title_bn,
            "slug": g.product.slug,
            "thumbnail_url": g.product.thumbnail_url,
            "price": float(g.product.price),
            "is_free": g.product.is_free,
            "game_type": g.game_type,
            "difficulty": g.difficulty,
            "time_limit_seconds": g.time_limit_seconds,
            "total_plays": g.total_plays,
        }
        for link in links
        for g in games
        if g.id == link.game_id
    ]


# ============================================
# STUDENT ENDPOINTS
# ============================================

@router.get("/{game_id}/start")
async def start_game(
    game_id: UUID,
    child_profile_id: UUID = Query(None),
    preview: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get game config for a student.
    Checks: entitlement (or free), same pattern as exam start.
    preview=true skips access checks (admin only).
    """
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.product))
        .where(Game.id == game_id, Game.is_active == True)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Admin preview — skip all access checks
    if preview:
        # Verify user has admin permission
        from app.core.permissions import Permission
        user_permissions = set()
        for role in (user.roles or []):
            for perm in (role.permissions or []):
                user_permissions.add(perm.name)
        if Permission.COURSE_CREATE in user_permissions:
            return await _get_game_response(game.id, db, admin=True)

    # Check access: free game OR has entitlement
    if not game.product.is_free:
        has_access = False

        # Child-level entitlement
        if child_profile_id:
            ent_result = await db.execute(
                select(Entitlement).where(
                    Entitlement.child_profile_id == child_profile_id,
                    Entitlement.product_id == game.product_id,
                    Entitlement.entitlement_type == EntitlementType.GAME_ACCESS,
                    Entitlement.is_active == True,
                )
            )
            if ent_result.scalar_one_or_none():
                has_access = True

        # Parent-level entitlement fallback
        if not has_access:
            ent_result = await db.execute(
                select(Entitlement).where(
                    Entitlement.user_id == user.id,
                    Entitlement.product_id == game.product_id,
                    Entitlement.entitlement_type == EntitlementType.GAME_ACCESS,
                    Entitlement.is_active == True,
                )
            )
            if ent_result.scalar_one_or_none():
                has_access = True

        # Check via ProductGame attachments: if the child has access to any
        # product that this game is attached to
        if not has_access:
            attached_product_ids = await db.execute(
                select(ProductGame.product_id).where(ProductGame.game_id == game_id)
            )
            for (pid,) in attached_product_ids.all():
                ent_check = await db.execute(
                    select(Entitlement).where(
                        or_(
                            Entitlement.child_profile_id == child_profile_id,
                            Entitlement.user_id == user.id,
                        ),
                        Entitlement.product_id == pid,
                        Entitlement.is_active == True,
                    )
                )
                if ent_check.scalar_one_or_none():
                    has_access = True
                    break

        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this game. Please purchase it first.",
            )

    # Return full response including config
    return await _get_game_response(game.id, db, admin=True)


@router.post("/{game_id}/submit")
async def submit_game(
    game_id: UUID,
    data: GameSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit game attempt. Save GameAttempt. Increment total_plays."""
    child_profile_id = UUID(data.child_profile_id)

    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Save attempt
    attempt = GameAttempt(
        game_id=game.id,
        child_profile_id=child_profile_id,
        user_id=user.id,
        score=data.score,
        total_points=data.total_points,
        time_seconds=data.time_seconds,
        completed=data.completed,
        stars=data.stars,
        attempt_data=data.attempt_data,
        completed_at=datetime.now(timezone.utc) if data.completed else None,
    )
    db.add(attempt)

    # Increment total plays
    game.total_plays = (game.total_plays or 0) + 1

    await db.commit()

    return {
        "attempt_id": str(attempt.id),
        "game_id": str(attempt.game_id),
        "child_profile_id": str(attempt.child_profile_id),
        "score": attempt.score,
        "total_points": attempt.total_points,
        "time_seconds": attempt.time_seconds,
        "completed": attempt.completed,
        "stars": attempt.stars,
        "attempt_data": attempt.attempt_data,
        "started_at": str(attempt.started_at) if attempt.started_at else None,
        "completed_at": str(attempt.completed_at) if attempt.completed_at else None,
    }


@router.get("/my")
async def my_games(
    child_profile_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all games the child has access to:
    1. Direct game entitlements (GAME_ACCESS for this child/user)
    2. Games attached via ProductGame to any product the child has access to
    3. Free games (product.is_free = True)
    Include past attempts.
    """

    # 1. Direct entitlements: get product IDs with GAME_ACCESS
    direct_ent_result = await db.execute(
        select(Entitlement.product_id).where(
            or_(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.user_id == user.id,
            ),
            Entitlement.entitlement_type == EntitlementType.GAME_ACCESS,
            Entitlement.is_active == True,
        )
    )
    direct_product_ids = {row[0] for row in direct_ent_result.all()}

    # 2. Games attached via ProductGame to products the child has access to
    # First get all product IDs the child has any entitlement for
    all_ent_result = await db.execute(
        select(Entitlement.product_id).where(
            or_(
                Entitlement.child_profile_id == child_profile_id,
                Entitlement.user_id == user.id,
            ),
            Entitlement.is_active == True,
        )
    )
    all_entitled_product_ids = {row[0] for row in all_ent_result.all()}

    # Get game IDs attached to those products
    attached_game_ids = set()
    if all_entitled_product_ids:
        attached_result = await db.execute(
            select(ProductGame.game_id).where(
                ProductGame.product_id.in_(all_entitled_product_ids)
            )
        )
        attached_game_ids = {row[0] for row in attached_result.all()}

    # 3. Build query: games where product_id in direct_product_ids
    #    OR game.id in attached_game_ids
    #    OR product.is_free = True
    query = (
        select(Game)
        .options(selectinload(Game.product))
        .join(Game.product)
        .where(Game.is_active == True)
    )

    conditions = [Product.is_free == True]
    if direct_product_ids:
        conditions.append(Game.product_id.in_(direct_product_ids))
    if attached_game_ids:
        conditions.append(Game.id.in_(attached_game_ids))

    query = query.where(or_(*conditions))
    query = query.order_by(Game.created_at.desc())

    result = await db.execute(query)
    games = result.scalars().unique().all()

    # Get all attempts for this child across these games
    game_ids = [g.id for g in games]
    attempts_map: dict[UUID, list] = {}
    if game_ids:
        attempts_result = await db.execute(
            select(GameAttempt)
            .where(
                GameAttempt.game_id.in_(game_ids),
                GameAttempt.child_profile_id == child_profile_id,
            )
            .order_by(GameAttempt.completed_at.desc())
        )
        for attempt in attempts_result.scalars().all():
            attempts_map.setdefault(attempt.game_id, []).append({
                "id": str(attempt.id),
                "score": attempt.score,
                "total_points": attempt.total_points,
                "stars": attempt.stars,
                "time_seconds": attempt.time_seconds,
                "completed": attempt.completed,
                "completed_at": str(attempt.completed_at) if attempt.completed_at else None,
            })

    return [
        {
            "id": str(g.id),
            "product_id": str(g.product_id),
            "title": g.product.title,
            "title_bn": g.product.title_bn,
            "slug": g.product.slug,
            "thumbnail_url": g.product.thumbnail_url,
            "price": str(g.product.price) if g.product.price is not None else "0",
            "is_free": g.product.is_free,
            "game_type": g.game_type,
            "difficulty": g.difficulty,
            "background_image_url": g.background_image_url or DEFAULT_BACKGROUNDS.get(g.game_type),
            "time_limit_seconds": g.time_limit_seconds,
            "total_plays": g.total_plays,
            "attempts": attempts_map.get(g.id, []),
        }
        for g in games
    ]
