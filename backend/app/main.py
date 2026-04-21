import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.db import engine, Base, AsyncSessionLocal
from app.models import User, UserRole, Role, RoleType, Permission_ as PermissionModel, RolePermission, ShippingRate, ShippingZone
from app.core.security import hash_password
from app.core.permissions import Permission, ROLE_PERMISSIONS

logger = logging.getLogger(__name__)


async def bootstrap_db():
    """Create roles, permissions, shipping rates, and superadmin on first run."""
    async with AsyncSessionLocal() as db:
        # --- Roles ---
        for role_type in RoleType:
            existing = await db.execute(select(Role).where(Role.name == role_type))
            if not existing.scalar_one_or_none():
                db.add(Role(name=role_type, description=f"{role_type.value} role"))
                logger.info(f"Created role: {role_type.value}")

        await db.commit()

        # --- Permissions ---
        for perm in Permission:
            existing = await db.execute(
                select(PermissionModel).where(PermissionModel.codename == perm.value)
            )
            if not existing.scalar_one_or_none():
                db.add(PermissionModel(codename=perm.value, description=perm.value))

        await db.commit()

        # --- Role-Permission links ---
        for role_name, perms in ROLE_PERMISSIONS.items():
            role_result = await db.execute(
                select(Role).where(Role.name == RoleType(role_name))
            )
            role = role_result.scalar_one_or_none()
            if not role:
                continue

            for perm in perms:
                perm_result = await db.execute(
                    select(PermissionModel).where(PermissionModel.codename == perm.value)
                )
                perm_obj = perm_result.scalar_one_or_none()
                if not perm_obj:
                    continue

                existing_link = await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm_obj.id,
                    )
                )
                if not existing_link.scalar_one_or_none():
                    db.add(RolePermission(role_id=role.id, permission_id=perm_obj.id))

        await db.commit()

        # --- Shipping rates ---
        for zone, rate, label, label_bn in [
            (ShippingZone.INSIDE_DHAKA, 60, "Inside Dhaka", "ঢাকার ভিতরে"),
            (ShippingZone.OUTSIDE_DHAKA, 120, "Outside Dhaka", "ঢাকার বাইরে"),
        ]:
            existing = await db.execute(
                select(ShippingRate).where(ShippingRate.zone == zone)
            )
            if not existing.scalar_one_or_none():
                db.add(ShippingRate(zone=zone, rate=rate, label=label, label_bn=label_bn))
                logger.info(f"Created shipping rate: {label} = ৳{rate}")

        await db.commit()

        # --- Superadmin ---
        existing_admin = await db.execute(
            select(User).where(User.phone == settings.SUPERADMIN_PHONE)
        )
        if not existing_admin.scalar_one_or_none():
            admin = User(
                phone=settings.SUPERADMIN_PHONE,
                password_hash=hash_password(settings.SUPERADMIN_PASSWORD),
                full_name="Super Admin",
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            await db.flush()

            # Assign super_admin role via direct insert (avoids relationship lazy-load)
            sa_role = await db.execute(
                select(Role).where(Role.name == RoleType.SUPER_ADMIN)
            )
            role = sa_role.scalar_one_or_none()
            if role:
                db.add(UserRole(user_id=admin.id, role_id=role.id))

            await db.commit()
            logger.info(f"Created superadmin: {settings.SUPERADMIN_PHONE}")

        logger.info("Database bootstrap complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: bootstrap roles, permissions, superadmin
    # Tables are managed by Alembic migrations
    await bootstrap_db()
    logger.info("Happy Baby started successfully")

    yield

    # Shutdown
    await engine.dispose()
    logger.info("Happy Baby shut down")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routes
    from app.api.v1.auth import router as auth_router
    from app.api.v1.users import router as users_router
    from app.api.v1.children import router as children_router
    from app.api.v1.categories import router as categories_router
    from app.api.v1.courses import router as courses_router
    from app.api.v1.orders import router as orders_router
    from app.api.v1.payments import router as payments_router
    from app.api.v1.shipments import router as shipments_router
    from app.api.v1.video import router as video_router
    from app.api.v1.ebooks import router as ebooks_router
    from app.api.v1.progress import router as progress_router
    from app.api.v1.admin import router as admin_router
    from app.api.v1.coupons import router as coupons_router
    from app.api.v1.quizzes import router as quizzes_router
    from app.api.v1.certificates import router as certificates_router
    from app.api.v1.uploads import router as uploads_router
    from app.api.v1.reviews import router as reviews_router
    from app.api.v1.site_settings import router as site_settings_router
    from app.api.v1.instructors import router as instructors_router
    from app.api.v1.assignments import router as assignments_router
    from app.api.v1.physical_items import router as physical_items_router
    from app.api.v1.homepage_content import router as homepage_content_router
    from app.api.v1.resources import router as resources_router
    from app.api.v1.feedback import router as feedback_router
    from app.api.v1.exams import router as exams_router
    from app.api.v1.games import router as games_router
    from app.api.v1.abacus import router as abacus_router
    from app.api.v1.badges import router as badges_router
    from app.api.v1.drawings import router as drawings_router
    from app.api.v1.challenges import router as challenges_router

    app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
    app.include_router(users_router, prefix=settings.API_V1_PREFIX)
    app.include_router(children_router, prefix=settings.API_V1_PREFIX)
    app.include_router(categories_router, prefix=settings.API_V1_PREFIX)
    app.include_router(courses_router, prefix=settings.API_V1_PREFIX)
    app.include_router(orders_router, prefix=settings.API_V1_PREFIX)
    app.include_router(payments_router, prefix=settings.API_V1_PREFIX)
    app.include_router(shipments_router, prefix=settings.API_V1_PREFIX)
    app.include_router(video_router, prefix=settings.API_V1_PREFIX)
    app.include_router(ebooks_router, prefix=settings.API_V1_PREFIX)
    app.include_router(progress_router, prefix=settings.API_V1_PREFIX)
    app.include_router(admin_router, prefix=settings.API_V1_PREFIX)
    app.include_router(coupons_router, prefix=settings.API_V1_PREFIX)
    app.include_router(quizzes_router, prefix=settings.API_V1_PREFIX)
    app.include_router(certificates_router, prefix=settings.API_V1_PREFIX)
    app.include_router(reviews_router, prefix=settings.API_V1_PREFIX)
    app.include_router(uploads_router, prefix=settings.API_V1_PREFIX)
    app.include_router(site_settings_router, prefix=settings.API_V1_PREFIX)
    app.include_router(instructors_router, prefix=f"{settings.API_V1_PREFIX}/instructors", tags=["instructors"])
    app.include_router(assignments_router, prefix=settings.API_V1_PREFIX)
    app.include_router(physical_items_router, prefix=settings.API_V1_PREFIX)
    app.include_router(homepage_content_router, prefix=settings.API_V1_PREFIX)
    app.include_router(resources_router, prefix=settings.API_V1_PREFIX)
    app.include_router(feedback_router, prefix=settings.API_V1_PREFIX)
    app.include_router(exams_router, prefix=settings.API_V1_PREFIX)
    app.include_router(games_router, prefix=settings.API_V1_PREFIX)
    app.include_router(abacus_router, prefix=settings.API_V1_PREFIX)
    app.include_router(badges_router, prefix=settings.API_V1_PREFIX)
    app.include_router(drawings_router, prefix=settings.API_V1_PREFIX)
    app.include_router(challenges_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health")
    async def health_check():
        """Health check — verifies DB and Redis connectivity."""
        import time
        from datetime import datetime, timezone

        checks = {"db": "unknown", "redis": "unknown"}

        # DB check
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(select(User).limit(1))
            checks["db"] = "healthy"
        except Exception as e:
            checks["db"] = f"unhealthy: {str(e)[:80]}"

        # Redis check
        try:
            from redis.asyncio import Redis as ARedis
            redis = ARedis.from_url(settings.REDIS_URL)
            await redis.ping()
            await redis.aclose()
            checks["redis"] = "healthy"
        except Exception as e:
            checks["redis"] = f"unhealthy: {str(e)[:80]}"

        overall = "healthy" if all(v == "healthy" for v in checks.values()) else "degraded"

        from fastapi.responses import JSONResponse
        status_code = 200 if overall == "healthy" else 503
        return JSONResponse(
            status_code=status_code,
            content={
                "status": overall,
                "version": settings.APP_VERSION,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "checks": checks,
            },
        )

    # Global exception handler — ensures CORS headers on 500s
    from fastapi.responses import JSONResponse
    from starlette.requests import Request

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc) if settings.DEBUG else "Internal server error"},
        )

    # Mount static files for local uploads (when B2 not configured)
    import os
    from fastapi.staticfiles import StaticFiles
    static_dir = os.getenv("STATIC_DIR", "static")
    os.makedirs(f"{static_dir}/uploads/ebooks", exist_ok=True)
    os.makedirs(f"{static_dir}/uploads/images", exist_ok=True)
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    return app


app = create_app()
