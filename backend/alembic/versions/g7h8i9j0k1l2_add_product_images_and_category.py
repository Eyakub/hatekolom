"""add product_images table and physical_books category_id

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-04-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'g7h8i9j0k1l2'
down_revision = 'f6g7h8i9j0k1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create product_images table
    op.create_table(
        'product_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=False),
        sa.Column('alt_text', sa.String(255), nullable=True),
        sa.Column('alt_text_bn', sa.String(255), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_images_product_id', 'product_images', ['product_id'])

    # Add category_id to physical_books
    op.add_column('physical_books', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_physical_books_category_id',
        'physical_books', 'categories',
        ['category_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_physical_books_category_id', 'physical_books', type_='foreignkey')
    op.drop_column('physical_books', 'category_id')
    op.drop_index('ix_product_images_product_id', 'product_images')
    op.drop_table('product_images')
