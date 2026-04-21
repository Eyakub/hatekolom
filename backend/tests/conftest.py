"""
Pytest configuration — shared fixtures for all tests.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import create_app
from app.db import Base, get_db
from app.core.security import hash_password
from app.models import User, Role, RoleType, UserRole


# ─── Use same event loop for whole test session ────────────
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ─── In-memory SQLite for tests ────────────────────────────
TEST_DB_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Fresh database for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def app(db_session: AsyncSession):
    """Create FastAPI app with test DB override."""
    application = create_app()

    async def override_get_db():
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    return application


@pytest_asyncio.fixture(scope="function")
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def guardian_user(db_session: AsyncSession) -> User:
    """Create a test guardian user."""
    user = User(
        id=uuid.uuid4(),
        phone="01700000001",
        full_name="Test Guardian",
        hashed_password=hash_password("testpass123"),
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)

    # Add guardian role
    role = Role(id=uuid.uuid4(), name=RoleType.GUARDIAN)
    db_session.add(role)
    await db_session.flush()

    user_role = UserRole(user_id=user.id, role_id=role.id)
    db_session.add(user_role)
    await db_session.commit()

    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create a test admin user."""
    user = User(
        id=uuid.uuid4(),
        phone="01700000099",
        full_name="Test Admin",
        hashed_password=hash_password("adminpass123"),
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)

    for role_type in [RoleType.SUPER_ADMIN, RoleType.ADMIN]:
        role = Role(id=uuid.uuid4(), name=role_type)
        db_session.add(role)
        await db_session.flush()
        db_session.add(UserRole(user_id=user.id, role_id=role.id))

    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def guardian_token(client: AsyncClient, guardian_user: User) -> str:
    """Get JWT token for guardian user."""
    resp = await client.post("/api/v1/auth/login", json={
        "phone": "01700000001",
        "password": "testpass123",
    })
    if resp.status_code == 200:
        return resp.json()["access_token"]
    # Fallback: generate token directly
    from app.core.security import create_access_token
    return create_access_token({"sub": str(guardian_user.id)})


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient, admin_user: User) -> str:
    """Get JWT token for admin user."""
    from app.core.security import create_access_token
    return create_access_token({"sub": str(admin_user.id)})
