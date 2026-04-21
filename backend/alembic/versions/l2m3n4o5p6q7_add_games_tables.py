"""Add games tables

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-04-15 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "l2m3n4o5p6q7"
down_revision: Union[str, None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "games",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("game_type", sa.String(30), nullable=False),
        sa.Column("difficulty", sa.String(20), server_default="easy"),
        sa.Column("background_image_url", sa.String(1000), nullable=True),
        sa.Column("time_limit_seconds", sa.Integer, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("config", JSONB, server_default="{}"),
        sa.Column("total_plays", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "game_attempts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("game_id", UUID(as_uuid=True), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_profile_id", UUID(as_uuid=True), sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer, server_default="0"),
        sa.Column("total_points", sa.Integer, server_default="0"),
        sa.Column("time_seconds", sa.Integer, server_default="0"),
        sa.Column("completed", sa.Boolean, server_default="false"),
        sa.Column("stars", sa.Integer, server_default="0"),
        sa.Column("attempt_data", JSONB, server_default="{}"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "product_games",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("game_id", UUID(as_uuid=True), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("product_games")
    op.drop_table("game_attempts")
    op.drop_table("games")
