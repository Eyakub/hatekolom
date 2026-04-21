"""add category_type to categories

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-04-10 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('categories', sa.Column('category_type', sa.String(20), nullable=False, server_default='course'))


def downgrade() -> None:
    op.drop_column('categories', 'category_type')
