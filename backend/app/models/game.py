"""Game models — games, attempts, and product-game links."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


class Game(Base):
    __tablename__ = "games"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    game_type = Column(String(30), nullable=False)
    difficulty = Column(String(20), default="easy")
    background_image_url = Column(String(1000), nullable=True)
    time_limit_seconds = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    config = Column(JSONB, default=dict)
    total_plays = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="game")
    attempts = relationship("GameAttempt", back_populates="game", lazy="noload")


class GameAttempt(Base):
    __tablename__ = "game_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    child_profile_id = Column(UUID(as_uuid=True), ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, default=0)
    total_points = Column(Integer, default=0)
    time_seconds = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    stars = Column(Integer, default=0)
    attempt_data = Column(JSONB, default=dict)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    game = relationship("Game", back_populates="attempts")
    user = relationship("User")
    child = relationship("ChildProfile")


class ProductGame(Base):
    __tablename__ = "product_games"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
