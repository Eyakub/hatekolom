"""convert all enum columns to varchar

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-04-11 01:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j0k1l2m3n4o5'
down_revision: Union[str, None] = 'i9j0k1l2m3n4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# All enum columns to convert: (table, column, pg_enum_type, max_length)
ENUM_COLUMNS = [
    ("orders", "status", "orderstatus", 30),
    ("orders", "shipping_zone", "shippingzone", 30),
    ("payments", "status", "paymentstatus", 30),
    ("payments", "method", "paymentmethod", 30),
    ("products", "product_type", "producttype", 30),
    ("courses", "course_type", "coursetype", 30),
    ("lessons", "lesson_type", "lessontype", 30),
    ("entitlements", "entitlement_type", "entitlementtype", 30),
    ("shipments", "status", "shipmentstatus", 30),
    ("shipments", "zone", "shippingzone", 30),
    ("shipment_events", "status", "shipmentstatus", 30),
    ("shipping_rates", "zone", "shippingzone", 30),
    ("roles", "name", "roletype", 30),
    ("assignment_submissions", "status", "submissionstatus", 30),
]


def upgrade() -> None:
    for table, column, pg_type, length in ENUM_COLUMNS:
        # 1. Convert enum column to varchar (cast enum → text → varchar)
        op.execute(f"""
            ALTER TABLE {table}
            ALTER COLUMN {column} TYPE VARCHAR({length})
            USING {column}::text;
        """)
        # 2. Normalize existing data to lowercase
        op.execute(f"""
            UPDATE {table} SET {column} = LOWER({column})
            WHERE {column} IS NOT NULL AND {column} != LOWER({column});
        """)

    # 3. Drop all unused PostgreSQL enum types
    enum_types = set(col[2] for col in ENUM_COLUMNS)
    for enum_type in enum_types:
        op.execute(f"DROP TYPE IF EXISTS {enum_type} CASCADE;")


def downgrade() -> None:
    # Not reversible cleanly — would need to recreate all enum types
    pass
