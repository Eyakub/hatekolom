"""
Seed script — creates a realistic test course with all lesson types:
video lectures, smart notes, assignments, and quizzes.

Run:
    cd backend && python scripts/seed_quiz_course.py
"""

import asyncio
import uuid
import sys
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models import (
    Product, ProductType, Course, CourseType,
    Module, Lesson, LessonType,
)
from app.models.course import Video
from app.models.quiz import Quiz, QuizQuestion, QuizOption


# ── Quiz question bank ───────────────────────────────────────────────

QUESTION_BANK = [
    {
        "q": "What is 2 + 2?",
        "q_bn": "২ + ২ = কত?",
        "options": [("4", "৪", True), ("3", "৩", False), ("5", "৫", False), ("6", "৬", False)],
    },
    {
        "q": "Which planet is closest to the Sun?",
        "q_bn": "সূর্যের সবচেয়ে কাছের গ্রহ কোনটি?",
        "options": [("Mercury", "বুধ", True), ("Venus", "শুক্র", False), ("Earth", "পৃথিবী", False), ("Mars", "মঙ্গল", False)],
    },
    {
        "q": "What color do you get by mixing red and blue?",
        "q_bn": "লাল ও নীল মেশালে কী রং হয়?",
        "options": [("Purple", "বেগুনি", True), ("Green", "সবুজ", False), ("Orange", "কমলা", False), ("Yellow", "হলুদ", False)],
    },
    {
        "q": "How many legs does a spider have?",
        "q_bn": "মাকড়সার কয়টি পা আছে?",
        "options": [("8", "৮", True), ("6", "৬", False), ("10", "১০", False), ("4", "৪", False)],
    },
    {
        "q": "What is the capital of Bangladesh?",
        "q_bn": "বাংলাদেশের রাজধানী কোথায়?",
        "options": [("Dhaka", "ঢাকা", True), ("Chittagong", "চট্টগ্রাম", False), ("Sylhet", "সিলেট", False), ("Rajshahi", "রাজশাহী", False)],
    },
    {
        "q": "Which animal is known as the king of the jungle?",
        "q_bn": "জঙ্গলের রাজা কোন প্রাণীকে বলা হয়?",
        "options": [("Lion", "সিংহ", True), ("Tiger", "বাঘ", False), ("Elephant", "হাতি", False), ("Bear", "ভালুক", False)],
    },
    {
        "q": "What is 10 × 5?",
        "q_bn": "১০ × ৫ = কত?",
        "options": [("50", "৫০", True), ("15", "১৫", False), ("55", "৫৫", False), ("45", "৪৫", False)],
    },
    {
        "q": "How many days are in a week?",
        "q_bn": "এক সপ্তাহে কয়দিন?",
        "options": [("7", "৭", True), ("5", "৫", False), ("6", "৬", False), ("10", "১০", False)],
    },
    {
        "q": "What does a caterpillar turn into?",
        "q_bn": "শুঁয়োপোকা কিসে রূপান্তরিত হয়?",
        "options": [("Butterfly", "প্রজাপতি", True), ("Bee", "মৌমাছি", False), ("Spider", "মাকড়সা", False), ("Ant", "পিঁপড়া", False)],
    },
    {
        "q": "Which shape has 3 sides?",
        "q_bn": "কোন আকৃতির ৩টি বাহু আছে?",
        "options": [("Triangle", "ত্রিভুজ", True), ("Square", "বর্গক্ষেত্র", False), ("Circle", "বৃত্ত", False), ("Rectangle", "আয়তক্ষেত্র", False)],
    },
    {
        "q": "What is the largest ocean on Earth?",
        "q_bn": "পৃথিবীর সবচেয়ে বড় মহাসাগর কোনটি?",
        "options": [("Pacific", "প্রশান্ত মহাসাগর", True), ("Atlantic", "আটলান্টিক মহাসাগর", False), ("Indian", "ভারত মহাসাগর", False), ("Arctic", "উত্তর মহাসাগর", False)],
    },
    {
        "q": "Which gas do plants absorb from the air?",
        "q_bn": "গাছ বাতাস থেকে কোন গ্যাস গ্রহণ করে?",
        "options": [("Carbon Dioxide", "কার্বন ডাই-অক্সাইড", True), ("Oxygen", "অক্সিজেন", False), ("Nitrogen", "নাইট্রোজেন", False), ("Hydrogen", "হাইড্রোজেন", False)],
    },
    {
        "q": "What is 100 ÷ 4?",
        "q_bn": "১০০ ÷ ৪ = কত?",
        "options": [("25", "২৫", True), ("20", "২০", False), ("30", "৩০", False), ("50", "৫০", False)],
    },
    {
        "q": "How many months have 30 days?",
        "q_bn": "কয়টি মাসে ৩০ দিন থাকে?",
        "options": [("4", "৪", True), ("6", "৬", False), ("5", "৫", False), ("3", "৩", False)],
    },
    {
        "q": "Which sense organ do we use to smell?",
        "q_bn": "গন্ধ পেতে আমরা কোন ইন্দ্রিয় ব্যবহার করি?",
        "options": [("Nose", "নাক", True), ("Eyes", "চোখ", False), ("Ears", "কান", False), ("Tongue", "জিহ্বা", False)],
    },
    {
        "q": "What is the boiling point of water in °C?",
        "q_bn": "সেলসিয়াসে পানির স্ফুটনাঙ্ক কত?",
        "options": [("100°C", "১০০°C", True), ("50°C", "৫০°C", False), ("200°C", "২০০°C", False), ("0°C", "০°C", False)],
    },
    {
        "q": "Who wrote the national anthem of Bangladesh?",
        "q_bn": "বাংলাদেশের জাতীয় সঙ্গীত কে লিখেছেন?",
        "options": [("Rabindranath Tagore", "রবীন্দ্রনাথ ঠাকুর", True), ("Kazi Nazrul Islam", "কাজী নজরুল ইসলাম", False), ("Jasimuddin", "জসীমউদ্দীন", False), ("Michael Madhusudan", "মাইকেল মধুসূদন", False)],
    },
    {
        "q": "What fraction is equal to 50%?",
        "q_bn": "৫০% কোন ভগ্নাংশের সমান?",
        "options": [("1/2", "১/২", True), ("1/4", "১/৪", False), ("3/4", "৩/৪", False), ("1/3", "১/৩", False)],
    },
    {
        "q": "Which is the longest river in Bangladesh?",
        "q_bn": "বাংলাদেশের দীর্ঘতম নদী কোনটি?",
        "options": [("Padma", "পদ্মা", True), ("Meghna", "মেঘনা", False), ("Jamuna", "যমুনা", False), ("Surma", "সুরমা", False)],
    },
    {
        "q": "What comes after 99?",
        "q_bn": "৯৯-এর পরে কত আসে?",
        "options": [("100", "১০০", True), ("98", "৯৮", False), ("101", "১০১", False), ("999", "৯৯৯", False)],
    },
]


# ── Module definitions with mixed lesson types ───────────────────────

MODULES = [
    {
        "title": "Module 1: Introduction",
        "title_bn": "মডিউল ১: পরিচিতি",
        "lessons": [
            {
                "title": "Welcome to the Course",
                "title_bn": "কোর্সে স্বাগতম",
                "type": "video",
                "youtube_id": "dQw4w9WgXcQ",
                "duration": 120,
            },
            {
                "title": "What You Will Learn",
                "title_bn": "তুমি কী শিখবে",
                "type": "smart_note",
                "content_bn": "<h2>এই কোর্সে তুমি শিখবে</h2><ul><li>সংখ্যা ও গণিতের মৌলিক ধারণা</li><li>প্রকৃতি ও বিজ্ঞানের মজার তথ্য</li><li>বাংলাদেশের ভূগোল ও সংস্কৃতি</li><li>সমস্যা সমাধানের দক্ষতা</li></ul><p>প্রতিটি মডিউলে ভিডিও, নোট, এসাইনমেন্ট এবং কুইজ থাকবে। সব লেসন ধারাবাহিকভাবে সম্পন্ন করতে হবে।</p>",
            },
            {
                "title": "Intro Quiz",
                "title_bn": "প্রাথমিক কুইজ",
                "type": "quiz",
                "questions": [0, 7, 19],
            },
        ],
    },
    {
        "title": "Module 2: Numbers & Math",
        "title_bn": "মডিউল ২: সংখ্যা ও গণিত",
        "lessons": [
            {
                "title": "Understanding Numbers",
                "title_bn": "সংখ্যা বোঝা",
                "type": "video",
                "youtube_id": "Y7e_JuO0mpQ",
                "duration": 300,
            },
            {
                "title": "Number Systems Explained",
                "title_bn": "সংখ্যা পদ্ধতি বিশ্লেষণ",
                "type": "smart_note",
                "content_bn": "<h2>সংখ্যা পদ্ধতি</h2><p>আমরা দৈনন্দিন জীবনে <strong>দশমিক সংখ্যা পদ্ধতি</strong> ব্যবহার করি যেখানে ০ থেকে ৯ পর্যন্ত ১০টি অঙ্ক আছে।</p><h3>জোড় ও বিজোড় সংখ্যা</h3><ul><li><strong>জোড় সংখ্যা:</strong> ২, ৪, ৬, ৮, ১০ — যেগুলো ২ দিয়ে ভাগ করা যায়</li><li><strong>বিজোড় সংখ্যা:</strong> ১, ৩, ৫, ৭, ৯ — যেগুলো ২ দিয়ে ভাগ করা যায় না</li></ul><h3>মৌলিক সংখ্যা</h3><p>যে সংখ্যাকে শুধুমাত্র ১ এবং সেই সংখ্যা দিয়ে ভাগ করা যায় তাকে মৌলিক সংখ্যা বলে। যেমন: ২, ৩, ৫, ৭, ১১, ১৩।</p>",
            },
            {
                "title": "Practice: Solve 5 Problems",
                "title_bn": "অনুশীলন: ৫টি সমস্যা সমাধান করো",
                "type": "assignment",
                "content_bn": "<h3>নিচের সমস্যাগুলো সমাধান করো:</h3><ol><li>২৫ + ৩৭ = ?</li><li>১০০ - ৪৬ = ?</li><li>১২ × ৮ = ?</li><li>১৪৪ ÷ ১২ = ?</li><li>একটি বাগানে ৪৫টি গোলাপ ও ৩৮টি গাঁদা ফুল আছে। মোট কতটি ফুল আছে?</li></ol>",
            },
            {
                "title": "Math Quiz",
                "title_bn": "গণিত কুইজ",
                "type": "quiz",
                "questions": [0, 6, 7, 9, 12, 13, 17],
            },
        ],
    },
    {
        "title": "Module 3: Nature & Science",
        "title_bn": "মডিউল ৩: প্রকৃতি ও বিজ্ঞান",
        "lessons": [
            {
                "title": "The Animal Kingdom",
                "title_bn": "প্রাণী জগৎ",
                "type": "video",
                "youtube_id": "szNfTRHQmPc",
                "duration": 420,
            },
            {
                "title": "Plants and Photosynthesis",
                "title_bn": "গাছপালা ও সালোকসংশ্লেষণ",
                "type": "smart_note",
                "content_bn": "<h2>সালোকসংশ্লেষণ কী?</h2><p>গাছপালা সূর্যের আলো ব্যবহার করে খাদ্য তৈরি করে — এই প্রক্রিয়াকে <strong>সালোকসংশ্লেষণ</strong> বলে।</p><h3>সালোকসংশ্লেষণের উপাদান</h3><ul><li>সূর্যের আলো</li><li>কার্বন ডাই-অক্সাইড (বাতাস থেকে)</li><li>পানি (মাটি থেকে)</li></ul><h3>ফলাফল</h3><p>গাছ গ্লুকোজ (খাদ্য) তৈরি করে এবং <strong>অক্সিজেন</strong> ছেড়ে দেয় যা আমরা শ্বাস নিতে ব্যবহার করি।</p>",
            },
            {
                "title": "Draw Your Favorite Animal",
                "title_bn": "তোমার প্রিয় প্রাণীর ছবি আঁকো",
                "type": "assignment",
                "allow_image": True,
                "content_bn": "<h3>এসাইনমেন্ট</h3><p>তোমার সবচেয়ে প্রিয় প্রাণীর একটি ছবি আঁকো এবং নিচে আপলোড করো। ছবির সাথে ৩-৪ লাইনে লিখো কেন এই প্রাণীটি তোমার প্রিয়।</p>",
            },
            {
                "title": "Science Quiz",
                "title_bn": "বিজ্ঞান কুইজ",
                "type": "quiz",
                "questions": [1, 2, 3, 5, 8, 11, 14, 15],
            },
        ],
    },
    {
        "title": "Module 4: Our Country",
        "title_bn": "মডিউল ৪: আমাদের দেশ",
        "lessons": [
            {
                "title": "Bangladesh: Rivers & Geography",
                "title_bn": "বাংলাদেশ: নদী ও ভূগোল",
                "type": "video",
                "youtube_id": "7pMNsfWoMcg",
                "duration": 360,
            },
            {
                "title": "Culture and Heritage",
                "title_bn": "সংস্কৃতি ও ঐতিহ্য",
                "type": "smart_note",
                "content_bn": "<h2>বাংলাদেশের সংস্কৃতি</h2><p>বাংলাদেশ একটি সমৃদ্ধ সাংস্কৃতিক ঐতিহ্যের দেশ।</p><h3>প্রধান উৎসব</h3><ul><li><strong>পহেলা বৈশাখ:</strong> বাংলা নববর্ষ — ১ বৈশাখ (১৪ এপ্রিল)</li><li><strong>একুশে ফেব্রুয়ারি:</strong> আন্তর্জাতিক মাতৃভাষা দিবস</li><li><strong>বিজয় দিবস:</strong> ১৬ ডিসেম্বর</li></ul><h3>জাতীয় প্রতীক</h3><ul><li>জাতীয় ফুল: শাপলা</li><li>জাতীয় পাখি: দোয়েল</li><li>জাতীয় মাছ: ইলিশ</li><li>জাতীয় ফল: কাঁঠাল</li></ul>",
            },
            {
                "title": "Write About Your District",
                "title_bn": "তোমার জেলা সম্পর্কে লিখো",
                "type": "assignment",
                "content_bn": "<h3>এসাইনমেন্ট</h3><p>তোমার জেলা সম্পর্কে ৫-৬ বাক্যে লিখো। নিচের বিষয়গুলো উল্লেখ করো:</p><ul><li>জেলার নাম ও অবস্থান</li><li>বিখ্যাত কোনো স্থান বা খাবার</li><li>তোমার প্রিয় জিনিস কী সেখানে</li></ul>",
            },
            {
                "title": "Geography & Culture Quiz",
                "title_bn": "ভূগোল ও সংস্কৃতি কুইজ",
                "type": "quiz",
                "questions": [4, 10, 16, 18],
            },
        ],
    },
    {
        "title": "Module 5: Final Assessment",
        "title_bn": "মডিউল ৫: চূড়ান্ত মূল্যায়ন",
        "lessons": [
            {
                "title": "Course Summary",
                "title_bn": "কোর্স সারসংক্ষেপ",
                "type": "smart_note",
                "content_bn": "<h2>তুমি যা শিখেছো</h2><p>অভিনন্দন! তুমি এই কোর্সের প্রায় শেষে এসে পৌঁছেছো। এখন পর্যন্ত তুমি শিখেছো:</p><ul><li>সংখ্যা পদ্ধতি, গণিতের মৌলিক ক্রিয়া</li><li>প্রাণী জগৎ, সালোকসংশ্লেষণ, বিজ্ঞানের মূলকথা</li><li>বাংলাদেশের ভূগোল, নদী ও সংস্কৃতি</li></ul><p>এখন চূড়ান্ত কুইজে অংশ নাও এবং কোর্স সম্পন্ন করো!</p>",
            },
            {
                "title": "Final Mega Quiz",
                "title_bn": "চূড়ান্ত মেগা কুইজ",
                "type": "quiz",
                "questions": list(range(20)),
            },
        ],
    },
]


async def seed():
    async with AsyncSessionLocal() as db:
        print("🧪 Creating test course...")

        # ── Product + Course ──
        slug = f"fun-learning-adventure-{uuid.uuid4().hex[:6]}"
        product = Product(
            title="Fun Learning Adventure",
            title_bn="মজার শিক্ষা অভিযান",
            slug=slug,
            product_type=ProductType.COURSE,
            price=Decimal("0"),
            is_active=True,
            is_free=True,
        )
        db.add(product)
        await db.flush()

        total_lessons = sum(len(m["lessons"]) for m in MODULES)
        total_quizzes = sum(1 for m in MODULES for l in m["lessons"] if l["type"] == "quiz")

        course = Course(
            product_id=product.id,
            course_type=CourseType.RECORDED,
            level="beginner",
            total_lessons=total_lessons,
            total_quizzes=total_quizzes,
        )
        db.add(course)
        await db.flush()

        lesson_counter = 0
        stats = {"video": 0, "smart_note": 0, "assignment": 0, "quiz": 0}

        for m_idx, m_data in enumerate(MODULES):
            module = Module(
                course_id=course.id,
                title=m_data["title"],
                title_bn=m_data["title_bn"],
                sort_order=m_idx + 1,
            )
            db.add(module)
            await db.flush()

            for l_idx, l_data in enumerate(m_data["lessons"]):
                l_type = l_data["type"]
                is_first_lesson = (lesson_counter == 0)
                lesson_counter += 1

                # Map type string to LessonType enum
                lesson_type_map = {
                    "video": LessonType.VIDEO_LECTURE,
                    "smart_note": LessonType.SMART_NOTE,
                    "assignment": LessonType.ASSIGNMENT,
                    "quiz": LessonType.QUIZ,
                }

                lesson = Lesson(
                    module_id=module.id,
                    title=l_data["title"],
                    title_bn=l_data["title_bn"],
                    lesson_type=lesson_type_map[l_type],
                    sort_order=l_idx + 1,
                    duration_seconds=l_data.get("duration"),
                    is_free=is_first_lesson,
                    content_bn=l_data.get("content_bn"),
                    allow_submission=(l_type == "assignment"),
                    allow_image_upload=l_data.get("allow_image", False),
                    max_grade=10 if l_type == "assignment" else 0,
                )
                db.add(lesson)
                await db.flush()

                # Create Video record for video lessons
                if l_type == "video" and l_data.get("youtube_id"):
                    video = Video(
                        lesson_id=lesson.id,
                        youtube_id=l_data["youtube_id"],
                        duration_seconds=l_data.get("duration"),
                    )
                    db.add(video)
                    stats["video"] += 1
                    print(f"   🎬 Video: {l_data['title_bn']}")

                # Create Quiz for quiz lessons
                elif l_type == "quiz":
                    q_indices = l_data["questions"]
                    quiz = Quiz(
                        lesson_id=lesson.id,
                        title=l_data["title"],
                        title_bn=l_data["title_bn"],
                        pass_percentage=60,
                        time_limit_seconds=len(q_indices) * 30,
                        is_active=True,
                    )
                    db.add(quiz)
                    await db.flush()

                    for q_order, q_idx in enumerate(q_indices):
                        qb = QUESTION_BANK[q_idx]
                        question = QuizQuestion(
                            quiz_id=quiz.id,
                            question_text=qb["q"],
                            question_text_bn=qb["q_bn"],
                            question_type="mcq",
                            sort_order=q_order + 1,
                            points=1,
                        )
                        db.add(question)
                        await db.flush()

                        for o_order, (o_en, o_bn, is_correct) in enumerate(qb["options"]):
                            option = QuizOption(
                                question_id=question.id,
                                option_text=o_en,
                                option_text_bn=o_bn,
                                is_correct=is_correct,
                                sort_order=o_order + 1,
                            )
                            db.add(option)

                    stats["quiz"] += 1
                    print(f"   🧩 Quiz: {l_data['title_bn']} ({len(q_indices)} questions)")

                elif l_type == "smart_note":
                    stats["smart_note"] += 1
                    print(f"   📝 Note: {l_data['title_bn']}")

                elif l_type == "assignment":
                    stats["assignment"] += 1
                    print(f"   📋 Assignment: {l_data['title_bn']}")

        await db.commit()

        print(f"\n🎉 Done! Created course '{product.title_bn}' ({slug})")
        print(f"   📦 {len(MODULES)} modules, {lesson_counter} lessons")
        print(f"   🎬 {stats['video']} videos | 📝 {stats['smart_note']} notes | 📋 {stats['assignment']} assignments | 🧩 {stats['quiz']} quizzes")
        print(f"\n   Course ID: {course.id}")
        print(f"   👉 Enroll and visit: http://localhost:3001/learn/{course.id}")


if __name__ == "__main__":
    asyncio.run(seed())
