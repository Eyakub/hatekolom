"""add allow_image_upload to lesson

Revision ID: f6g7h8i9j0k1
Revises: 63ecaec99948
Create Date: 2026-04-10 01:52:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f6g7h8i9j0k1'
down_revision = '63ecaec99948'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Use inspector to safely add column if it doesn't exist
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("lessons")]
    if "allow_image_upload" not in columns:
        op.add_column("lessons", sa.Column("allow_image_upload", sa.Boolean(), server_default="false"))

def downgrade() -> None:
    op.execute("ALTER TABLE lessons DROP COLUMN IF EXISTS allow_image_upload")
