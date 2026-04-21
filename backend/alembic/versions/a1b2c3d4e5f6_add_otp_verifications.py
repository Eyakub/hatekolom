"""add otp_verifications table

Revision ID: a1b2c3d4e5f6
Revises: 5d2054a6fe13
Create Date: 2026-04-01 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5d2054a6fe13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'otp_verifications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('phone', sa.String(length=15), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('purpose', sa.String(length=50), nullable=False, server_default='registration'),
        sa.Column('is_used', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('attempts', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_otp_verifications_phone', 'otp_verifications', ['phone'])


def downgrade() -> None:
    op.drop_index('ix_otp_verifications_phone', table_name='otp_verifications')
    op.drop_table('otp_verifications')
