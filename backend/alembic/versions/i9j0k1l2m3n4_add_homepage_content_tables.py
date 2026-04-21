"""add homepage content tables

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-04-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'homepage_testimonials',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('photo_url', sa.String(500), nullable=True),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('video_type', sa.String(20), server_default='upload'),
        sa.Column('quote', sa.Text(), nullable=False),
        sa.Column('quote_bn', sa.Text(), nullable=True),
        sa.Column('author_name', sa.String(255), nullable=False),
        sa.Column('author_role', sa.String(255), nullable=True),
        sa.Column('author_role_bn', sa.String(255), nullable=True),
        sa.Column('gradient_color', sa.String(50), server_default='from-primary-700'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'homepage_stats',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('label_bn', sa.String(100), nullable=True),
        sa.Column('value', sa.String(50), nullable=False),
        sa.Column('value_en', sa.String(50), nullable=True),
        sa.Column('auto_calculate', sa.Boolean(), server_default='false'),
        sa.Column('auto_source', sa.String(50), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'homepage_gallery',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('title_bn', sa.String(255), nullable=True),
        sa.Column('label', sa.String(255), nullable=True),
        sa.Column('label_bn', sa.String(255), nullable=True),
        sa.Column('column_group', sa.Integer(), server_default='1'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'homepage_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('title_bn', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_bn', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('icon_name', sa.String(50), server_default='Palette'),
        sa.Column('border_color', sa.String(50), server_default='border-primary-500'),
        sa.Column('time_label', sa.String(50), nullable=True),
        sa.Column('xp_label', sa.String(50), nullable=True),
        sa.Column('cta_text', sa.String(100), nullable=True),
        sa.Column('cta_text_bn', sa.String(100), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('homepage_activities')
    op.drop_table('homepage_gallery')
    op.drop_table('homepage_stats')
    op.drop_table('homepage_testimonials')
