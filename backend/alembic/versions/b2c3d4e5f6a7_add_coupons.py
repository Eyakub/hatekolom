"""add coupons table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'coupons',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('discount_type', sa.String(length=20), nullable=False, server_default='percentage'),
        sa.Column('discount_value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('min_order_amount', sa.Numeric(precision=10, scale=2), server_default='0'),
        sa.Column('max_discount_amount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('max_uses', sa.Integer(), server_default='100'),
        sa.Column('times_used', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coupons_code', 'coupons', ['code'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_coupons_code', table_name='coupons')
    op.drop_table('coupons')
