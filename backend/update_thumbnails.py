import asyncio
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models import Course

async def update():
    urls = {
        "abacus-level-1-basic": "https://images.unsplash.com/photo-1596461404969-9ce20c71c471?q=80&w=800&auto=format&fit=crop",
        "live-english-speaking-class": "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=800&auto=format&fit=crop",
        "kids-islamic-education": "https://images.unsplash.com/photo-1584281722883-9b870e28f148?q=80&w=800&auto=format&fit=crop",
        "kids-coding-scratch": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop"
    }

    async with AsyncSessionLocal() as db:
        for slug, url in urls.items():
            result = await db.execute(select(Course).where(Course.slug == slug))
            course = result.scalar_one_or_none()
            if course:
                course.thumbnail_url = url
                print(f"Updated {slug}")
        await db.commit()

if __name__ == "__main__":
    asyncio.run(update())
