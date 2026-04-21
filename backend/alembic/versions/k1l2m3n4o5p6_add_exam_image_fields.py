"""Add image_url to exam questions and options

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, None] = "ea808583fe6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Question image (16:9 landscape)
    op.add_column("exam_questions", sa.Column("image_url", sa.String(1000), nullable=True))
    # Make question_text nullable (image-only questions)
    op.alter_column("exam_questions", "question_text", existing_type=sa.Text(), nullable=True)

    # Option image (1:1 square)
    op.add_column("exam_options", sa.Column("image_url", sa.String(1000), nullable=True))
    # Make option_text nullable (image-only options)
    op.alter_column("exam_options", "option_text", existing_type=sa.String(1000), nullable=True)


def downgrade() -> None:
    op.alter_column("exam_options", "option_text", existing_type=sa.String(1000), nullable=False)
    op.drop_column("exam_options", "image_url")
    op.alter_column("exam_questions", "question_text", existing_type=sa.Text(), nullable=False)
    op.drop_column("exam_questions", "image_url")
