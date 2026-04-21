"""initial schema

Revision ID: 5d2054a6fe13
Revises: 
Create Date: 2026-04-01 03:09:21.889980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d2054a6fe13'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables were created directly via Base.metadata.create_all
    pass


def downgrade() -> None:
    pass
