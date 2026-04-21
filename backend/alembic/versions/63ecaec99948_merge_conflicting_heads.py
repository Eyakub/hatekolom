"""merge conflicting heads

Revision ID: 63ecaec99948
Revises: 429a531b0558, e5f6a7b8c9d0
Create Date: 2026-04-10 01:47:04.434714

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63ecaec99948'
down_revision: Union[str, None] = ('429a531b0558', 'e5f6a7b8c9d0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
