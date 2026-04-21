"""
Seed script — populates the LMS database with realistic demo data.

Run inside Docker:
    docker compose exec backend python seed.py
"""

import asyncio
import uuid
import sys
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from slugify import slugify

from app.db import AsyncSessionLocal
from app.models import (
    Category, Product, ProductType, Course, CourseType,
    Module, Lesson, LessonType, Video,
    Ebook, PhysicalBook, ShippingRate, ShippingZone, Instructor,
)


async def seed():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        existing = await db.execute(select(Category).limit(1))
        if existing.scalar_one_or_none():
            print("⚠️  Database already has data. Skipping seed.")
            return

        print("🌱 Seeding database...")

        # ============================================
        # CATEGORIES
        # ============================================
        categories_data = [
            {"name": "অ্যাবাকাস মেন্টাল ম্যাথ", "name_bn": "অ্যাবাকাস মেন্টাল ম্যাথ", "slug": "abacus-mental-math", "sort_order": 1},
            {"name": "ক্রিয়েটিভ আর্ট", "name_bn": "ক্রিয়েটিভ আর্ট", "slug": "creative-art", "sort_order": 2},
            {"name": "বাংলা ভাষা ও সাহিত্য", "name_bn": "বাংলা ভাষা ও সাহিত্য", "slug": "bangla-language", "sort_order": 3},
            {"name": "ইংরেজি ভাষা", "name_bn": "ইংরেজি ভাষা", "slug": "english-language", "sort_order": 4},
            {"name": "বিজ্ঞান ও প্রযুক্তি", "name_bn": "বিজ্ঞান ও প্রযুক্তি", "slug": "science-technology", "sort_order": 5},
            {"name": "কুরআন শিক্ষা", "name_bn": "কুরআন শিক্ষা", "slug": "quran-education", "sort_order": 6},
            {"name": "জীবন দক্ষতা", "name_bn": "জীবন দক্ষতা", "slug": "life-skills", "sort_order": 7},
        ]

        categories = {}
        for cat_data in categories_data:
            cat = Category(**cat_data)
            db.add(cat)
            await db.flush()
            categories[cat.slug] = cat
            print(f"  ✅ Category: {cat.name}")

        # ============================================
        # INSTRUCTORS
        # ============================================
        print("👤 Creating Default Instructor...")
        instructor = Instructor(
            name="Eyakub Sorkar",
            name_bn="ইয়াকুব সরকার",
            designation="Senior Instructor",
            designation_bn="সিনিয়র ইন্সট্রাক্টর",
            bio="Passionate educator with 10 years of experience.",
            profile_image_url="https://ui-avatars.com/api/?name=Eyakub+Sorkar&background=0D8ABC&color=fff",
        )
        db.add(instructor)
        await db.flush()
        print(f"  ✅ Instructor Created: {instructor.name}")

        # ============================================
        # COURSES
        # ============================================
        courses_data = [
            {
                "title": "অ্যাবাকাস লেভেল ১ - বেসিক",
                "title_bn": "অ্যাবাকাস লেভেল ১ - বেসিক",
                "slug": "abacus-level-1-basic",
                "description": "অ্যাবাকাসের মাধ্যমে মানসিক গণিতের প্রথম ধাপ। ৫-৮ বছর বয়সী শিশুদের জন্য বিশেষভাবে ডিজাইন করা।",
                "description_bn": "অ্যাবাকাসের মাধ্যমে মানসিক গণিতের প্রথম ধাপ। ৫-৮ বছর বয়সী শিশুদের জন্য বিশেষভাবে ডিজাইন করা।",
                "price": Decimal("2500"),
                "compare_price": Decimal("3500"),
                "course_type": CourseType.RECORDED,
                "category_slug": "abacus-mental-math",
                "level": "beginner",
                "age_min": 5, "age_max": 8,
                "duration_months": 3,
                "is_featured": True,
                "modules": [
                    {
                        "title": "পরিচিতি ও প্রস্তুতি", "title_bn": "পরিচিতি ও প্রস্তুতি", "sort_order": 1,
                        "lessons": [
                            {"title": "অ্যাবাকাস কী?", "title_bn": "অ্যাবাকাস কী?", "type": "video_lecture", "duration": 600, "youtube_id": "dQw4w9WgXcQ", "is_free": True},
                            {"title": "অ্যাবাকাসের অংশগুলো চেনা", "title_bn": "অ্যাবাকাসের অংশগুলো চেনা", "type": "video_lecture", "duration": 480, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "হাতের ব্যবহার শেখা", "title_bn": "হাতের ব্যবহার শেখা", "type": "video_lecture", "duration": 540, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "প্রথম অনুশীলন", "title_bn": "প্রথম অনুশীলন", "type": "assignment", "duration": None},
                        ]
                    },
                    {
                        "title": "সংখ্যা চেনা (১-৯)", "title_bn": "সংখ্যা চেনা (১-৯)", "sort_order": 2,
                        "lessons": [
                            {"title": "১ থেকে ৪ পর্যন্ত", "title_bn": "১ থেকে ৪ পর্যন্ত", "type": "video_lecture", "duration": 720, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "৫ থেকে ৯ পর্যন্ত", "title_bn": "৫ থেকে ৯ পর্যন্ত", "type": "video_lecture", "duration": 660, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "সংখ্যা চেনা কুইজ", "title_bn": "সংখ্যা চেনা কুইজ", "type": "quiz", "duration": None},
                        ]
                    },
                    {
                        "title": "যোগ ও বিয়োগ (বেসিক)", "title_bn": "যোগ ও বিয়োগ (বেসিক)", "sort_order": 3,
                        "lessons": [
                            {"title": "সরল যোগ (১+১ থেকে ৪+৪)", "title_bn": "সরল যোগ (১+১ থেকে ৪+৪)", "type": "video_lecture", "duration": 900, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "সরল বিয়োগ", "title_bn": "সরল বিয়োগ", "type": "video_lecture", "duration": 840, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "মিশ্র অনুশীলন", "title_bn": "মিশ্র অনুশীলন", "type": "assignment", "duration": None},
                            {"title": "লেভেল ১ ফাইনাল টেস্ট", "title_bn": "লেভেল ১ ফাইনাল টেস্ট", "type": "quiz", "duration": None},
                        ]
                    },
                ]
            },
            {
                "title": "অ্যাবাকাস লেভেল ২ - ইন্টারমিডিয়েট",
                "title_bn": "অ্যাবাকাস লেভেল ২ - ইন্টারমিডিয়েট",
                "slug": "abacus-level-2-intermediate",
                "description": "দুই ও তিন ডিজিটের যোগ-বিয়োগ, গুণ ও ভাগের ভিত্তি। লেভেল ১ সম্পন্নকারীদের জন্য।",
                "description_bn": "দুই ও তিন ডিজিটের যোগ-বিয়োগ, গুণ ও ভাগের ভিত্তি। লেভেল ১ সম্পন্নকারীদের জন্য।",
                "price": Decimal("3000"),
                "compare_price": Decimal("4000"),
                "course_type": CourseType.RECORDED,
                "category_slug": "abacus-mental-math",
                "level": "intermediate",
                "age_min": 6, "age_max": 10,
                "duration_months": 4,
                "is_featured": True,
                "modules": [
                    {
                        "title": "দুই ডিজিটের যোগ", "title_bn": "দুই ডিজিটের যোগ", "sort_order": 1,
                        "lessons": [
                            {"title": "১০-৫০ পর্যন্ত যোগ", "title_bn": "১০-৫০ পর্যন্ত যোগ", "type": "video_lecture", "duration": 780, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "৫০-৯৯ পর্যন্ত যোগ", "title_bn": "৫০-৯৯ পর্যন্ত যোগ", "type": "video_lecture", "duration": 840, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "অনুশীলন সেট ১", "title_bn": "অনুশীলন সেট ১", "type": "assignment", "duration": None},
                        ]
                    },
                    {
                        "title": "গুণের ভিত্তি", "title_bn": "গুণের ভিত্তি", "sort_order": 2,
                        "lessons": [
                            {"title": "একক ডিজিট গুণ", "title_bn": "একক ডিজিট গুণ", "type": "video_lecture", "duration": 900, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "গুণ টেবিল মুখস্থ কৌশল", "title_bn": "গুণ টেবিল মুখস্থ কৌশল", "type": "video_lecture", "duration": 720, "youtube_id": "dQw4w9WgXcQ"},
                        ]
                    },
                ]
            },
            {
                "title": "ক্রিয়েটিভ ড্রয়িং ফর কিডস",
                "title_bn": "ক্রিয়েটিভ ড্রয়িং ফর কিডস",
                "slug": "creative-drawing-for-kids",
                "description": "ছবি আঁকার মাধ্যমে শিশুদের সৃজনশীলতা বিকাশ। রং, আকৃতি ও কল্পনার জগতে প্রবেশ।",
                "description_bn": "ছবি আঁকার মাধ্যমে শিশুদের সৃজনশীলতা বিকাশ। রং, আকৃতি ও কল্পনার জগতে প্রবেশ।",
                "price": Decimal("1800"),
                "compare_price": Decimal("2500"),
                "course_type": CourseType.RECORDED,
                "category_slug": "creative-art",
                "level": "beginner",
                "age_min": 4, "age_max": 10,
                "duration_months": 2,
                "is_featured": True,
                "modules": [
                    {
                        "title": "আঁকার প্রাথমিক ধারণা", "title_bn": "আঁকার প্রাথমিক ধারণা", "sort_order": 1,
                        "lessons": [
                            {"title": "পেন্সিল ধরার সঠিক নিয়ম", "title_bn": "পেন্সিল ধরার সঠিক নিয়ম", "type": "video_lecture", "duration": 420, "youtube_id": "dQw4w9WgXcQ", "is_free": True},
                            {"title": "বেসিক শেপ আঁকা", "title_bn": "বেসিক শেপ আঁকা", "type": "video_lecture", "duration": 540, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "রং চেনা ও ব্যবহার", "title_bn": "রং চেনা ও ব্যবহার", "type": "video_lecture", "duration": 600, "youtube_id": "dQw4w9WgXcQ"},
                        ]
                    },
                    {
                        "title": "প্রাণী আঁকা শেখা", "title_bn": "প্রাণী আঁকা শেখা", "sort_order": 2,
                        "lessons": [
                            {"title": "বিড়াল আঁকা", "title_bn": "বিড়াল আঁকা", "type": "video_lecture", "duration": 660, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "পাখি আঁকা", "title_bn": "পাখি আঁকা", "type": "video_lecture", "duration": 600, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "মাছ আঁকা", "title_bn": "মাছ আঁকা", "type": "video_lecture", "duration": 480, "youtube_id": "dQw4w9WgXcQ"},
                        ]
                    },
                ]
            },
            {
                "title": "লাইভ ইংলিশ স্পিকিং ক্লাস",
                "title_bn": "লাইভ ইংলিশ স্পিকিং ক্লাস",
                "slug": "live-english-speaking-class",
                "description": "সরাসরি শিক্ষকের সাথে ইংরেজি বলার অনুশীলন। সপ্তাহে ৩ দিন লাইভ ক্লাস।",
                "description_bn": "সরাসরি শিক্ষকের সাথে ইংরেজি বলার অনুশীলন। সপ্তাহে ৩ দিন লাইভ ক্লাস।",
                "price": Decimal("3500"),
                "compare_price": Decimal("5000"),
                "course_type": CourseType.LIVE,
                "category_slug": "english-language",
                "level": "beginner",
                "age_min": 7, "age_max": 14,
                "duration_months": 3,
                "is_featured": True,
                "modules": [
                    {
                        "title": "সপ্তাহ ১-৪: ভিত্তি", "title_bn": "সপ্তাহ ১-৪: ভিত্তি", "sort_order": 1,
                        "lessons": [
                            {"title": "Greetings & Introduction", "title_bn": "পরিচয় ও অভিবাদন", "type": "live_session", "duration": 2700, "youtube_id": "dQw4w9WgXcQ", "is_free": True},
                            {"title": "My Family", "title_bn": "আমার পরিবার", "type": "live_session", "duration": 2700, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "Daily Routine", "title_bn": "দৈনন্দিন কাজ", "type": "live_session", "duration": 2700, "youtube_id": "dQw4w9WgXcQ"},
                        ]
                    },
                ]
            },
            {
                "title": "নূরানী কায়দা - কুরআন শিক্ষা",
                "title_bn": "নূরানী কায়দা - কুরআন শিক্ষা",
                "slug": "nurani-kayda-quran",
                "description": "সহজ পদ্ধতিতে কুরআন পড়া শেখা। আরবি হরফ থেকে শুরু করে সূরা পর্যন্ত।",
                "description_bn": "সহজ পদ্ধতিতে কুরআন পড়া শেখা। আরবি হরফ থেকে শুরু করে সূরা পর্যন্ত।",
                "price": Decimal("0"),
                "course_type": CourseType.RECORDED,
                "category_slug": "quran-education",
                "level": "beginner",
                "age_min": 5, "age_max": 99,
                "duration_months": 6,
                "is_free": True,
                "is_featured": False,
                "modules": [
                    {
                        "title": "আরবি হরফ পরিচিতি", "title_bn": "আরবি হরফ পরিচিতি", "sort_order": 1,
                        "lessons": [
                            {"title": "আলিফ থেকে যা পর্যন্ত", "title_bn": "আলিফ থেকে যা পর্যন্ত", "type": "video_lecture", "duration": 900, "youtube_id": "dQw4w9WgXcQ", "is_free": True},
                            {"title": "হরফ জোড়া লাগানো", "title_bn": "হরফ জোড়া লাগানো", "type": "video_lecture", "duration": 780, "youtube_id": "dQw4w9WgXcQ", "is_free": True},
                        ]
                    },
                ]
            },
            {
                "title": "মজার বিজ্ঞান পরীক্ষা",
                "title_bn": "মজার বিজ্ঞান পরীক্ষা",
                "slug": "fun-science-experiments",
                "description": "ঘরে বসেই সহজ উপকরণ দিয়ে বিজ্ঞান পরীক্ষা। প্রতিটি পরীক্ষা ভিডিওসহ ব্যাখ্যা।",
                "description_bn": "ঘরে বসেই সহজ উপকরণ দিয়ে বিজ্ঞান পরীক্ষা। প্রতিটি পরীক্ষা ভিডিওসহ ব্যাখ্যা।",
                "price": Decimal("1500"),
                "compare_price": Decimal("2000"),
                "course_type": CourseType.RECORDED,
                "category_slug": "science-technology",
                "level": "beginner",
                "age_min": 6, "age_max": 12,
                "duration_months": 2,
                "is_featured": False,
                "modules": [
                    {
                        "title": "পানি ও বায়ু", "title_bn": "পানি ও বায়ু", "sort_order": 1,
                        "lessons": [
                            {"title": "পানির তিন রূপ", "title_bn": "পানির তিন রূপ", "type": "video_lecture", "duration": 600, "youtube_id": "dQw4w9WgXcQ", "is_free": True},
                            {"title": "বায়ুর চাপ পরীক্ষা", "title_bn": "বায়ুর চাপ পরীক্ষা", "type": "video_lecture", "duration": 540, "youtube_id": "dQw4w9WgXcQ"},
                            {"title": "আগ্নেয়গিরি বানাও!", "title_bn": "আগ্নেয়গিরি বানাও!", "type": "video_lecture", "duration": 720, "youtube_id": "dQw4w9WgXcQ"},
                        ]
                    },
                ]
            },
        ]

        total_lessons = 0
        for course_data in courses_data:
            # Create product
            is_free = course_data.get("is_free", False)
            product = Product(
                product_type=ProductType.COURSE,
                title=course_data["title"],
                title_bn=course_data["title_bn"],
                slug=course_data["slug"],
                description=course_data.get("description"),
                description_bn=course_data.get("description_bn"),
                price=course_data["price"],
                compare_price=course_data.get("compare_price"),
                is_free=is_free,
            )
            db.add(product)
            await db.flush()

            # Create course
            cat = categories.get(course_data["category_slug"])
            course = Course(
                product_id=product.id,
                course_type=course_data["course_type"],
                category_id=cat.id if cat else None,
                instructor_id=instructor.id,  # Link seeded instructor
                level=course_data.get("level"),
                duration_months=course_data.get("duration_months"),
                age_min=course_data.get("age_min"),
                age_max=course_data.get("age_max"),
                is_featured=course_data.get("is_featured", False),
            )
            db.add(course)
            await db.flush()

            # Create modules & lessons
            course_lesson_count = 0
            for mod_data in course_data.get("modules", []):
                module = Module(
                    course_id=course.id,
                    title=mod_data["title"],
                    title_bn=mod_data.get("title_bn"),
                    sort_order=mod_data["sort_order"],
                )
                db.add(module)
                await db.flush()

                for idx, lesson_data in enumerate(mod_data.get("lessons", [])):
                    lesson = Lesson(
                        module_id=module.id,
                        title=lesson_data["title"],
                        title_bn=lesson_data.get("title_bn"),
                        lesson_type=LessonType(lesson_data["type"]),
                        sort_order=idx + 1,
                        duration_seconds=lesson_data.get("duration"),
                        is_free=lesson_data.get("is_free", is_free),
                    )
                    db.add(lesson)
                    await db.flush()
                    course_lesson_count += 1

                    # Create video record for video lessons
                    if lesson_data.get("youtube_id"):
                        video = Video(
                            lesson_id=lesson.id,
                            youtube_id=lesson_data["youtube_id"],
                            duration_seconds=lesson_data.get("duration"),
                        )
                        db.add(video)

            course.total_lessons = course_lesson_count
            total_lessons += course_lesson_count
            print(f"  ✅ Course: {course_data['title']} ({course_lesson_count} lessons)")

        # ============================================
        # EBOOKS
        # ============================================
        ebooks_data = [
            {
                "title": "অ্যাবাকাস অনুশীলন বই - লেভেল ১",
                "title_bn": "অ্যাবাকাস অনুশীলন বই - লেভেল ১",
                "slug": "abacus-practice-book-level-1",
                "description": "অ্যাবাকাস লেভেল ১ কোর্সের সাথে ব্যবহারযোগ্য অনুশীলন বই। ১০০+ সমস্যা।",
                "price": Decimal("150"),
                "compare_price": Decimal("250"),
                "author": "নেক্সটজেন এলএমএস",
                "pages": 85,
                "b2_key": "ebooks/abacus-practice-level1.pdf",
            },
            {
                "title": "শিশুদের রঙিন ছড়া সংকলন",
                "title_bn": "শিশুদের রঙিন ছড়া সংকলন",
                "slug": "kids-colorful-rhymes",
                "description": "বাংলা ছড়া ও কবিতার সুন্দর সংকলন। রঙিন ছবি সহ।",
                "price": Decimal("0"),
                "is_free": True,
                "author": "নেক্সটজেন এলএমএস",
                "pages": 40,
                "b2_key": "ebooks/kids-rhymes-collection.pdf",
            },
            {
                "title": "ইংরেজি শব্দ শেখার মজার বই",
                "title_bn": "ইংরেজি শব্দ শেখার মজার বই",
                "slug": "fun-english-vocab-book",
                "description": "ছবি ও গল্পের মাধ্যমে ইংরেজি শব্দ শেখা। ৫০০+ শব্দ।",
                "price": Decimal("200"),
                "compare_price": Decimal("350"),
                "author": "নেক্সটজেন এলএমএস",
                "pages": 120,
                "b2_key": "ebooks/english-vocab-fun.pdf",
            },
        ]

        for ebook_data in ebooks_data:
            product = Product(
                product_type=ProductType.EBOOK,
                title=ebook_data["title"],
                title_bn=ebook_data["title_bn"],
                slug=ebook_data["slug"],
                description=ebook_data.get("description"),
                price=ebook_data["price"],
                compare_price=ebook_data.get("compare_price"),
                is_free=ebook_data.get("is_free", False),
            )
            db.add(product)
            await db.flush()

            ebook = Ebook(
                product_id=product.id,
                author=ebook_data["author"],
                pages=ebook_data["pages"],
                b2_key=ebook_data["b2_key"],
            )
            db.add(ebook)
            print(f"  ✅ Ebook: {ebook_data['title']}")

        # ============================================
        # PHYSICAL BOOKS
        # ============================================
        physical_books_data = [
            {
                "title": "অ্যাবাকাস যন্ত্র + গাইড বই",
                "title_bn": "অ্যাবাকাস যন্ত্র + গাইড বই",
                "slug": "abacus-device-guide-book",
                "description": "১৩ রড অ্যাবাকাস যন্ত্র ও বাংলায় লেখা সম্পূর্ণ গাইড বই।",
                "price": Decimal("650"),
                "compare_price": Decimal("850"),
                "author": "নেক্সটজেন এলএমএস",
                "weight_grams": 450,
                "stock_quantity": 100,
                "sku": "PHY-ABACUS-001",
            },
            {
                "title": "ক্রিয়েটিভ আর্ট কিট",
                "title_bn": "ক্রিয়েটিভ আর্ট কিট",
                "slug": "creative-art-kit",
                "description": "রং, পেন্সিল, ব্রাশ ও স্কেচবুক সহ সম্পূর্ণ আর্ট কিট।",
                "price": Decimal("950"),
                "compare_price": Decimal("1200"),
                "weight_grams": 800,
                "stock_quantity": 50,
                "sku": "PHY-ARTKIT-001",
            },
        ]

        for book_data in physical_books_data:
            product = Product(
                product_type=ProductType.PHYSICAL_BOOK,
                title=book_data["title"],
                title_bn=book_data["title_bn"],
                slug=book_data["slug"],
                description=book_data.get("description"),
                price=book_data["price"],
                compare_price=book_data.get("compare_price"),
            )
            db.add(product)
            await db.flush()

            physical = PhysicalBook(
                product_id=product.id,
                author=book_data.get("author"),
                weight_grams=book_data.get("weight_grams"),
                stock_quantity=book_data.get("stock_quantity", 0),
                sku=book_data.get("sku"),
            )
            db.add(physical)
            print(f"  ✅ Physical Book: {book_data['title']}")

        # ============================================
        # SHIPPING RATES
        # ============================================
        shipping_rates = [
            {"zone": ShippingZone.INSIDE_DHAKA, "rate": Decimal("60"), "label": "Inside Dhaka", "label_bn": "ঢাকার ভেতরে"},
            {"zone": ShippingZone.OUTSIDE_DHAKA, "rate": Decimal("120"), "label": "Outside Dhaka", "label_bn": "ঢাকার বাইরে"},
        ]

        for rate_data in shipping_rates:
            existing_rate = await db.execute(
                select(ShippingRate).where(ShippingRate.zone == rate_data["zone"])
            )
            if not existing_rate.scalar_one_or_none():
                db.add(ShippingRate(**rate_data))
                print(f"  ✅ Shipping Rate: {rate_data['label']} — ৳{rate_data['rate']}")

        await db.commit()

        print(f"\n🎉 Seed complete!")
        print(f"   📂 {len(categories_data)} categories")
        print(f"   📚 {len(courses_data)} courses ({total_lessons} lessons)")
        print(f"   📖 {len(ebooks_data)} ebooks")
        print(f"   📦 {len(physical_books_data)} physical books")
        print(f"   🚚 {len(shipping_rates)} shipping rates")


if __name__ == "__main__":
    asyncio.run(seed())
