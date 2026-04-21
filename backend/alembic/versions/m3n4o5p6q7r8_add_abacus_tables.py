"""Add abacus tables

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-04-15 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "m3n4o5p6q7r8"
down_revision: Union[str, None] = "l2m3n4o5p6q7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "abacus_courses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("total_levels", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "abacus_levels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("abacus_course_id", UUID(as_uuid=True), sa.ForeignKey("abacus_courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("title_bn", sa.String(500), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("description_bn", sa.Text, nullable=True),
        sa.Column("level_type", sa.String(20), server_default="test"),
        sa.Column("exercise_type", sa.String(20), server_default="bead_slide"),
        sa.Column("config", JSONB, server_default="{}"),
        sa.Column("content", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "abacus_attempts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("level_id", UUID(as_uuid=True), sa.ForeignKey("abacus_levels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_profile_id", UUID(as_uuid=True), sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer, server_default="0"),
        sa.Column("total_points", sa.Integer, server_default="0"),
        sa.Column("time_seconds", sa.Integer, server_default="0"),
        sa.Column("passed", sa.Boolean, server_default="false"),
        sa.Column("stars", sa.Integer, server_default="0"),
        sa.Column("attempt_data", JSONB, server_default="{}"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "product_abacus",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("abacus_course_id", UUID(as_uuid=True), sa.ForeignKey("abacus_courses.id", ondelete="CASCADE"), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("product_abacus")
    op.drop_table("abacus_attempts")
    op.drop_table("abacus_levels")
    op.drop_table("abacus_courses")
