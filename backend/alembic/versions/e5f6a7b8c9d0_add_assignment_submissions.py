"""Add assignment submissions

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use inspector to check if things exist
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check lessons columns
    columns = [c["name"] for c in inspector.get_columns("lessons")]
    
    if "allow_submission" not in columns:
        op.add_column("lessons", sa.Column("allow_submission", sa.Boolean(), server_default="false"))
    if "max_grade" not in columns:
        op.add_column("lessons", sa.Column("max_grade", sa.Integer(), server_default="10"))

    # Safely create submission status ENUM if it doesn't already exist in Postgres natively
    has_enum = bind.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'submissionstatus'")).scalar()
    if not has_enum:
        op.execute("CREATE TYPE submissionstatus AS ENUM ('draft', 'submitted', 'graded', 'resubmit')")

    # Check and create assignment_submissions table
    if not inspector.has_table("assignment_submissions"):
        op.create_table(
            "assignment_submissions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("lesson_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
            sa.Column("child_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("answer_text", sa.Text(), nullable=True),
            sa.Column("file_urls", postgresql.JSONB(), server_default="[]"),
            sa.Column("status", sa.Enum("draft", "submitted", "graded", "resubmit", name="submissionstatus", create_type=False), server_default="draft", nullable=False),
            sa.Column("grade", sa.Integer(), nullable=True),
            sa.Column("feedback", sa.Text(), nullable=True),
            sa.Column("graded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

        # Index for fast lookups
        op.create_index(
            "ix_assignment_submissions_lesson_child",
            "assignment_submissions",
            ["lesson_id", "child_profile_id"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_index("ix_assignment_submissions_lesson_child", table_name="assignment_submissions", if_exists=True)
    op.drop_table("assignment_submissions")
    op.execute("DROP TYPE IF EXISTS submissionstatus")
    op.execute("ALTER TABLE lessons DROP COLUMN IF EXISTS max_grade")
    op.execute("ALTER TABLE lessons DROP COLUMN IF EXISTS allow_submission")
