"""
Seed script — populates homepage content with demo data.

Run:
    python seed_homepage.py

Or inside Docker:
    docker compose exec backend python seed_homepage.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models.homepage import (
    HomepageTestimonial, HomepageStat, HomepageGallery, HomepageActivity,
)


async def seed_homepage():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        existing = await db.execute(select(HomepageTestimonial).limit(1))
        if existing.scalar_one_or_none():
            print("⚠️  Homepage content already exists. Skipping.")
            return

        print("🌱 Seeding homepage content...")

        # ──────────────────────────────────────
        # 1. TESTIMONIALS (Voices)
        # ──────────────────────────────────────
        testimonials = [
            HomepageTestimonial(
                quote="My son's confidence in math has skyrocketed since joining NextGen. The abacus program is incredible!",
                quote_bn="নেক্সটজেনে যোগ দেওয়ার পর থেকে আমার ছেলের গণিতে আত্মবিশ্বাস অনেক বেড়ে গেছে। অ্যাবাকাস প্রোগ্রামটি অসাধারণ!",
                author_name="Farida Rahman",
                author_role="Parent",
                author_role_bn="অভিভাবক",
                photo_url="https://images.unsplash.com/photo-1544626053-8985dc34ae63?q=80&w=400&fit=crop",
                video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                video_type="youtube",
                gradient_color="from-primary-700",
                sort_order=1,
            ),
            HomepageTestimonial(
                quote="The creative art program unlocked my daughter's imagination. She now paints every day after school!",
                quote_bn="ক্রিয়েটিভ আর্ট প্রোগ্রামটি আমার মেয়ের কল্পনাশক্তি জাগিয়ে তুলেছে। সে এখন প্রতিদিন স্কুলের পর ছবি আঁকে!",
                author_name="Kamal Hossain",
                author_role="Parent",
                author_role_bn="অভিভাবক",
                photo_url="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=400&fit=crop",
                video_type="upload",
                gradient_color="from-orange-500",
                sort_order=2,
            ),
            HomepageTestimonial(
                quote="NextGen's guidance helped my child score 100 in mathematics. The teachers are so dedicated!",
                quote_bn="নেক্সটজেনের গাইডলাইনের কারণে আমার সন্তান গণিতে একশোতে একশো পেয়েছে। শিক্ষকরা অনেক ডেডিকেটেড!",
                author_name="Maria Parvin",
                author_role="Parent",
                author_role_bn="অভিভাবক",
                photo_url="https://images.unsplash.com/photo-1510034636830-4e5cb42a731d?q=80&w=400&fit=crop",
                video_type="upload",
                gradient_color="from-blue-600",
                sort_order=3,
            ),
            HomepageTestimonial(
                quote="Both my kids are enrolled in live classes. The interactive sessions keep them engaged and excited to learn!",
                quote_bn="আমার দুই সন্তানই লাইভ ক্লাসে ভর্তি। ইন্টারেক্টিভ সেশনগুলো তাদের শেখার প্রতি আগ্রহী রাখে!",
                author_name="Mostafa Kamal",
                author_role="Parent",
                author_role_bn="অভিভাবক",
                photo_url="https://images.unsplash.com/photo-1628157588553-5eeea00af15c?q=80&w=400&fit=crop",
                video_url="https://www.youtube.com/watch?v=jNQXAC9IVRw",
                video_type="youtube",
                gradient_color="from-primary-700",
                sort_order=4,
            ),
        ]
        db.add_all(testimonials)
        print(f"  ✅ {len(testimonials)} testimonials")

        # ──────────────────────────────────────
        # 2. STATS (Achievement Numbers)
        # ──────────────────────────────────────
        stats = [
            HomepageStat(
                label="Courses", label_bn="কোর্সসমূহ",
                value="৩০+", value_en="30+",
                auto_calculate=True, auto_source="courses",
                sort_order=1,
            ),
            HomepageStat(
                label="Batches", label_bn="ব্যাচ",
                value="৫০০+", value_en="500+",
                auto_calculate=False,
                sort_order=2,
            ),
            HomepageStat(
                label="Teachers", label_bn="প্রশিক্ষক",
                value="৩০০+", value_en="300+",
                auto_calculate=True, auto_source="instructors",
                sort_order=3,
            ),
            HomepageStat(
                label="Students", label_bn="শিক্ষার্থী",
                value="৪৯,৯৯৯+", value_en="49,999+",
                auto_calculate=True, auto_source="users",
                sort_order=4,
            ),
        ]
        db.add_all(stats)
        print(f"  ✅ {len(stats)} stats")

        # ──────────────────────────────────────
        # 3. GALLERY (Success Images)
        # ──────────────────────────────────────
        gallery = [
            # Column 1 (scrolls up)
            HomepageGallery(
                image_url="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=400&fit=crop",
                title="Math Champion", title_bn="গণিত চ্যাম্পিয়ন",
                label="Abacus · Level 10", label_bn="অ্যাবাকাস · লেভেল ১০",
                column_group=1, sort_order=1,
            ),
            HomepageGallery(
                image_url="https://images.unsplash.com/photo-1588072432836-e10032774350?q=80&w=400&fit=crop",
                title="Science Explorer", title_bn="বিজ্ঞান অনুসন্ধানী",
                label="Science · Level 8", label_bn="বিজ্ঞান · লেভেল ৮",
                column_group=1, sort_order=2,
            ),
            HomepageGallery(
                image_url="https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=400&fit=crop",
                title="Creative Writer", title_bn="সৃজনশীল লেখক",
                label="Bangla · Level 6", label_bn="বাংলা · লেভেল ৬",
                column_group=1, sort_order=3,
            ),
            # Column 2 (scrolls down)
            HomepageGallery(
                image_url="https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=400&fit=crop",
                title="Art Prodigy", title_bn="শিল্প প্রতিভা",
                label="Art Class · Level 12", label_bn="আর্ট ক্লাস · লেভেল ১২",
                column_group=2, sort_order=1,
            ),
            HomepageGallery(
                image_url="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=400&fit=crop",
                title="Space Explorer", title_bn="মহাকাশ অনুসন্ধানী",
                label="Science Lab · Level 15", label_bn="সায়েন্স ল্যাব · লেভেল ১৫",
                column_group=2, sort_order=2,
            ),
            HomepageGallery(
                image_url="https://images.unsplash.com/photo-1500829243541-74b676fecc20?q=80&w=400&fit=crop",
                title="Nature Study", title_bn="প্রকৃতি পাঠ",
                label="Outdoor · Level 4", label_bn="আউটডোর · লেভেল ৪",
                column_group=2, sort_order=3,
            ),
        ]
        db.add_all(gallery)
        print(f"  ✅ {len(gallery)} gallery images")

        # ──────────────────────────────────────
        # 4. ACTIVITIES (Promotional Cards)
        # ──────────────────────────────────────
        activities = [
            HomepageActivity(
                title="Creative Art Challenges",
                title_bn="ক্রিয়েটিভ আর্ট চ্যালেঞ্জ",
                description="Express yourself through weekly guided prompts using digital watercolors and 3D modeling tools.",
                description_bn="ডিজিটাল ওয়াটারকালার এবং 3D মডেলিং টুলস ব্যবহার করে সাপ্তাহিক গাইডেড প্রম্পটের মাধ্যমে নিজেকে প্রকাশ করো।",
                image_url="https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=400&fit=crop",
                icon_name="Palette",
                border_color="border-primary-500",
                time_label="15-20 Min",
                xp_label="500 XP",
                cta_text="Start Painting",
                cta_text_bn="আঁকা শুরু করো",
                sort_order=1,
            ),
            HomepageActivity(
                title="Interactive Logic Puzzles",
                title_bn="ইন্টারেক্টিভ লজিক পাজল",
                description="Sharpen your critical thinking with brain-teasing puzzles that unlock mysterious island secrets.",
                description_bn="রহস্যময় দ্বীপের গোপনীয়তা উন্মোচন করতে মস্তিষ্ক-উদ্দীপক পাজল দিয়ে তোমার বিচার-বিশ্লেষণ ক্ষমতা তীক্ষ্ণ করো।",
                image_url="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=400&fit=crop",
                icon_name="Brain",
                border_color="border-orange-500",
                time_label="10 Min",
                xp_label="300 XP",
                cta_text="Solve Puzzles",
                cta_text_bn="পাজল সমাধান করো",
                sort_order=2,
            ),
            HomepageActivity(
                title="Vocabulary Quests",
                title_bn="ভোকাবুলারি কোয়েস্ট",
                description="Journey through the Lexicon Woods and collect rare words while building storytelling skills.",
                description_bn="লেক্সিকন উডসের মধ্য দিয়ে যাত্রা করো এবং গল্প বলার দক্ষতা তৈরি করতে করতে বিরল শব্দ সংগ্রহ করো।",
                image_url="https://images.unsplash.com/photo-1500829243541-74b676fecc20?q=80&w=400&fit=crop",
                icon_name="Languages",
                border_color="border-blue-500",
                time_label="25 Min",
                xp_label="750 XP",
                cta_text="Start Quest",
                cta_text_bn="কোয়েস্ট শুরু করো",
                sort_order=3,
            ),
        ]
        db.add_all(activities)
        print(f"  ✅ {len(activities)} activities")

        await db.commit()
        print("\n🎉 Homepage content seeded successfully!")
        print("   → 4 testimonials (2 with YouTube videos)")
        print("   → 4 stats (3 auto-calculated, 1 manual)")
        print("   → 6 gallery images (3 per column)")
        print("   → 3 activity cards")


if __name__ == "__main__":
    asyncio.run(seed_homepage())
