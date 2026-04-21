import asyncio
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models import User, Role, RoleType, UserRole

async def check():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        for u in users:
            roles = (await db.execute(select(Role).join(UserRole).where(UserRole.user_id == u.id))).scalars().all()
            print(f"User: {u.phone}, Roles: {[r.name.value for r in roles]}")

if __name__ == "__main__":
    asyncio.run(check())
