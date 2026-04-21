"""Common/shared schemas used across the app."""

from typing import Optional
from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    pages: int
