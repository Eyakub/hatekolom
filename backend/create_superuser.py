import asyncio
import getpass
import sys
import logging

# Set up logging so we only see our own console output
logging.basicConfig(level=logging.ERROR)

from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models import User, Role, RoleType, UserRole
from app.core.security import hash_password

async def create_superuser():
    print("===========================================")
    print("       Hate Kolom — Create Superuser       ")
    print("===========================================")
    
    phone = input("Phone Number: ").strip()
    if not phone:
        print("❌ Error: Phone number is required.")
        sys.exit(1)

    full_name = input("Full Name [Super Admin]: ").strip()
    if not full_name:
        full_name = "Super Admin"

    password = getpass.getpass("Password: ")
    if len(password) < 6:
        print("❌ Error: Password must be at least 6 characters.")
        sys.exit(1)

    password_confirm = getpass.getpass("Confirm Password: ")
    if password != password_confirm:
        print("❌ Error: Passwords do not match.")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        # Check if user exists
        existing = await db.execute(select(User).where(User.phone == phone))
        if existing.scalar_one_or_none():
            print(f"❌ Error: A user with phone number '{phone}' already exists.")
            sys.exit(1)

        # Ensure Role exists
        role_result = await db.execute(select(Role).where(Role.name == RoleType.SUPER_ADMIN))
        role = role_result.scalar_one_or_none()
        
        if not role:
            # Create the role dynamically if it doesn't exist for some reason
            print("⚙️  'SUPER_ADMIN' role not found. Creating it...")
            role = Role(name=RoleType.SUPER_ADMIN, description="Super Administrator")
            db.add(role)
            await db.flush()

        # Create user
        admin = User(
            phone=phone,
            password_hash=hash_password(password),
            full_name=full_name,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        await db.flush()

        # Assign role
        db.add(UserRole(user_id=admin.id, role_id=role.id))
        await db.commit()
        
        print(f"\n✅ Superuser '{full_name}' ({phone}) created successfully!")

if __name__ == "__main__":
    asyncio.run(create_superuser())
