"""Badge Service — checks and awards badges to children."""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.badge import Badge, ChildBadge
from app.models.drawing import Drawing

logger = logging.getLogger(__name__)


class BadgeService:

    @staticmethod
    async def check_and_award(
        child_profile_id: UUID,
        trigger: str,
        db: AsyncSession,
    ) -> list[Badge]:
        """
        Check all active badges matching the trigger.
        Award any the child newly qualifies for.
        Returns list of newly awarded badges.
        """
        awarded = []

        # Get all active badges with this trigger
        result = await db.execute(
            select(Badge).where(
                Badge.is_active == True,
            )
        )
        badges = result.scalars().all()

        for badge in badges:
            criteria = badge.criteria or {}
            if criteria.get("trigger") != trigger:
                continue

            threshold = criteria.get("threshold", 1)

            # Check if already earned
            existing = await db.execute(
                select(ChildBadge).where(
                    ChildBadge.child_profile_id == child_profile_id,
                    ChildBadge.badge_id == badge.id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Count the child's stat for this trigger
            count = await BadgeService._get_count(child_profile_id, trigger, db)

            if count >= threshold:
                child_badge = ChildBadge(
                    child_profile_id=child_profile_id,
                    badge_id=badge.id,
                )
                db.add(child_badge)
                awarded.append(badge)
                logger.info(f"Awarded badge '{badge.name}' to child {child_profile_id}")

        if awarded:
            await db.commit()

        return awarded

    @staticmethod
    async def _get_count(
        child_profile_id: UUID,
        trigger: str,
        db: AsyncSession,
    ) -> int:
        """Get the count for a specific trigger type."""
        if trigger == "drawing_count":
            result = await db.execute(
                select(func.count()).select_from(Drawing).where(
                    Drawing.child_profile_id == child_profile_id,
                    Drawing.status == "approved",
                )
            )
            return result.scalar() or 0

        if trigger == "featured_count":
            result = await db.execute(
                select(func.count()).select_from(Drawing).where(
                    Drawing.child_profile_id == child_profile_id,
                    Drawing.is_featured == True,
                )
            )
            return result.scalar() or 0

        if trigger == "like_count":
            result = await db.execute(
                select(func.coalesce(func.sum(Drawing.like_count), 0)).where(
                    Drawing.child_profile_id == child_profile_id,
                    Drawing.status == "approved",
                )
            )
            return result.scalar() or 0

        if trigger == "challenge_streak":
            from datetime import date, timedelta
            from sqlalchemy import cast, Date as SADate

            result = await db.execute(
                select(func.distinct(cast(Drawing.created_at, SADate)))
                .where(
                    Drawing.child_profile_id == child_profile_id,
                    Drawing.challenge_id.isnot(None),
                    Drawing.status == "approved",
                )
                .order_by(cast(Drawing.created_at, SADate).desc())
            )
            dates = [row[0] for row in result.all()]

            if not dates:
                return 0

            streak = 1
            for i in range(1, len(dates)):
                if dates[i - 1] - dates[i] == timedelta(days=1):
                    streak += 1
                else:
                    break
            return streak

        # Future triggers (game_completed, exam_passed, etc.) return 0 for now
        return 0

    @staticmethod
    async def get_child_badges(
        child_profile_id: UUID,
        db: AsyncSession,
    ) -> list[dict]:
        """Get all earned badges for a child."""
        result = await db.execute(
            select(ChildBadge)
            .options()
            .where(ChildBadge.child_profile_id == child_profile_id)
            .order_by(ChildBadge.earned_at.desc())
        )
        child_badges = result.scalars().all()

        badge_ids = [cb.badge_id for cb in child_badges]
        if not badge_ids:
            return []

        badges_result = await db.execute(
            select(Badge).where(Badge.id.in_(badge_ids))
        )
        badges_map = {b.id: b for b in badges_result.scalars().all()}

        return [
            {
                "badge_id": str(cb.badge_id),
                "name": badges_map[cb.badge_id].name if cb.badge_id in badges_map else "",
                "name_bn": badges_map[cb.badge_id].name_bn if cb.badge_id in badges_map else None,
                "icon_url": badges_map[cb.badge_id].icon_url if cb.badge_id in badges_map else None,
                "category": badges_map[cb.badge_id].category if cb.badge_id in badges_map else "general",
                "earned_at": str(cb.earned_at),
            }
            for cb in child_badges
            if cb.badge_id in badges_map
        ]

    @staticmethod
    async def get_badge_wall(
        child_profile_id: UUID,
        db: AsyncSession,
    ) -> list[dict]:
        """Get all badges (earned + locked) for the badge wall UI."""
        # All active badges
        all_badges_result = await db.execute(
            select(Badge).where(Badge.is_active == True).order_by(Badge.sort_order)
        )
        all_badges = all_badges_result.scalars().all()

        # Child's earned badge IDs
        earned_result = await db.execute(
            select(ChildBadge.badge_id, ChildBadge.earned_at).where(
                ChildBadge.child_profile_id == child_profile_id,
            )
        )
        earned_map = {row[0]: row[1] for row in earned_result.all()}

        wall = []
        for badge in all_badges:
            criteria = badge.criteria or {}
            trigger = criteria.get("trigger", "")
            threshold = criteria.get("threshold", 1)
            earned = badge.id in earned_map

            # Get current progress if not earned
            progress = 0
            if not earned and trigger:
                progress = await BadgeService._get_count(child_profile_id, trigger, db)

            wall.append({
                "badge_id": str(badge.id),
                "name": badge.name,
                "name_bn": badge.name_bn,
                "description": badge.description,
                "description_bn": badge.description_bn,
                "icon_url": badge.icon_url,
                "category": badge.category,
                "earned": earned,
                "earned_at": str(earned_map[badge.id]) if earned else None,
                "progress": min(progress, threshold),
                "threshold": threshold,
            })

        return wall
