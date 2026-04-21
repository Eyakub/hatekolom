"""add quizzes and certificates tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-01 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Quizzes
    op.create_table(
        'quizzes',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('lesson_id', UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('title_bn', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('pass_percentage', sa.Integer(), server_default='60'),
        sa.Column('time_limit_seconds', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lesson_id'),
    )

    op.create_table(
        'quiz_questions',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('quiz_id', UUID(as_uuid=True), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_text_bn', sa.Text(), nullable=True),
        sa.Column('question_type', sa.String(20), server_default='mcq'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('points', sa.Integer(), server_default='1'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'quiz_options',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('question_id', UUID(as_uuid=True), sa.ForeignKey('quiz_questions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('option_text', sa.String(500), nullable=False),
        sa.Column('option_text_bn', sa.String(500), nullable=True),
        sa.Column('is_correct', sa.Boolean(), server_default='false'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'quiz_attempts',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('quiz_id', UUID(as_uuid=True), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('score', sa.Numeric(5, 2), server_default='0'),
        sa.Column('total_points', sa.Integer(), server_default='0'),
        sa.Column('earned_points', sa.Integer(), server_default='0'),
        sa.Column('passed', sa.Boolean(), server_default='false'),
        sa.Column('answers', JSONB(), server_default='{}'),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Certificates
    op.create_table(
        'certificates',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('certificate_number', sa.String(50), nullable=False),
        sa.Column('student_name', sa.String(255), nullable=False),
        sa.Column('course_title', sa.String(500), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('pdf_url', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_certificates_number', 'certificates', ['certificate_number'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_certificates_number', table_name='certificates')
    op.drop_table('certificates')
    op.drop_table('quiz_attempts')
    op.drop_table('quiz_options')
    op.drop_table('quiz_questions')
    op.drop_table('quizzes')
