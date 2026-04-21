"""
Seed script — creates a test exam with multiple sections.

Run:
    cd backend && python scripts/seed_exam.py
"""

import asyncio
import uuid
import sys
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import AsyncSessionLocal
from app.models import Product, ProductType
from app.models.exam import Exam, ExamSection, ExamQuestion, ExamOption


SECTIONS = [
    {
        "title": "Bangla",
        "title_bn": "বাংলা",
        "questions": [
            {
                "q": "Which is a vowel in Bangla?",
                "q_bn": "বাংলায় কোনটি স্বরবর্ণ?",
                "options": [("অ", True), ("ক", False), ("চ", False), ("ট", False)],
            },
            {
                "q": "'সূর্য' — how many letters?",
                "q_bn": "'সূর্য' শব্দে কয়টি বর্ণ?",
                "options": [("৪", True), ("৩", False), ("৫", False), ("২", False)],
            },
            {
                "q": "Which is a pronoun?",
                "q_bn": "কোনটি সর্বনাম?",
                "options": [("সে", True), ("ভালো", False), ("দ্রুত", False), ("গাছ", False)],
            },
            {
                "q": "Opposite of 'আলো'?",
                "q_bn": "'আলো'-এর বিপরীত শব্দ কী?",
                "options": [("অন্ধকার", True), ("আকাশ", False), ("সূর্য", False), ("চাঁদ", False)],
            },
            {
                "q": "Which is a verb?",
                "q_bn": "কোনটি ক্রিয়া?",
                "options": [("খায়", True), ("সুন্দর", False), ("বই", False), ("লাল", False)],
            },
        ],
    },
    {
        "title": "English",
        "title_bn": "ইংরেজি",
        "questions": [
            {
                "q": "Which is a noun?",
                "q_bn": "কোনটি noun?",
                "options": [("Cat", True), ("Run", False), ("Quick", False), ("Softly", False)],
            },
            {
                "q": "Past tense of 'go'?",
                "q_bn": "'go'-এর past tense কী?",
                "options": [("Went", True), ("Goed", False), ("Gone", False), ("Going", False)],
            },
            {
                "q": "Fill in: She ___ a teacher.",
                "q_bn": "শূন্যস্থান পূরণ করো: She ___ a teacher.",
                "options": [("is", True), ("am", False), ("are", False), ("be", False)],
            },
            {
                "q": "Plural of 'child'?",
                "q_bn": "'child'-এর plural কী?",
                "options": [("Children", True), ("Childs", False), ("Childes", False), ("Childrens", False)],
            },
            {
                "q": "Which is an adjective?",
                "q_bn": "কোনটি adjective?",
                "options": [("Beautiful", True), ("Quickly", False), ("Sing", False), ("Table", False)],
            },
        ],
    },
    {
        "title": "Math",
        "title_bn": "গণিত",
        "questions": [
            {
                "q": "15 + 27 = ?",
                "q_bn": "১৫ + ২৭ = ?",
                "options": [("42", True), ("40", False), ("43", False), ("52", False)],
            },
            {
                "q": "What is 8 × 7?",
                "q_bn": "৮ × ৭ = কত?",
                "options": [("56", True), ("54", False), ("48", False), ("63", False)],
            },
            {
                "q": "100 - 36 = ?",
                "q_bn": "১০০ - ৩৬ = ?",
                "options": [("64", True), ("74", False), ("54", False), ("66", False)],
            },
            {
                "q": "72 ÷ 9 = ?",
                "q_bn": "৭২ ÷ ৯ = ?",
                "options": [("8", True), ("7", False), ("9", False), ("6", False)],
            },
            {
                "q": "Which is the largest?",
                "q_bn": "কোনটি সবচেয়ে বড়?",
                "options": [("1000", True), ("999", False), ("100", False), ("909", False)],
            },
        ],
    },
    {
        "title": "General Knowledge",
        "title_bn": "সাধারণ জ্ঞান",
        "questions": [
            {
                "q": "Capital of Bangladesh?",
                "q_bn": "বাংলাদেশের রাজধানী কোথায়?",
                "options": [("ঢাকা", True), ("চট্টগ্রাম", False), ("রাজশাহী", False), ("খুলনা", False)],
            },
            {
                "q": "National flower of Bangladesh?",
                "q_bn": "বাংলাদেশের জাতীয় ফুল কী?",
                "options": [("শাপলা", True), ("গোলাপ", False), ("জুঁই", False), ("রজনীগন্ধা", False)],
            },
            {
                "q": "How many continents?",
                "q_bn": "পৃথিবীতে কয়টি মহাদেশ?",
                "options": [("৭", True), ("৫", False), ("৬", False), ("৮", False)],
            },
            {
                "q": "Which planet is nearest to the Sun?",
                "q_bn": "সূর্যের নিকটতম গ্রহ কোনটি?",
                "options": [("বুধ", True), ("শুক্র", False), ("পৃথিবী", False), ("মঙ্গল", False)],
            },
            {
                "q": "National bird of Bangladesh?",
                "q_bn": "বাংলাদেশের জাতীয় পাখি কী?",
                "options": [("দোয়েল", True), ("কোকিল", False), ("ময়না", False), ("শালিক", False)],
            },
        ],
    },
]


async def seed():
    async with AsyncSessionLocal() as db:
        print("🧪 Creating test exam...")

        slug = f"kids-scholarship-exam-{uuid.uuid4().hex[:6]}"
        product = Product(
            title="Kids Scholarship Exam 2026",
            title_bn="কিডস স্কলারশিপ পরীক্ষা ২০২৬",
            slug=slug,
            product_type=ProductType.EXAM,
            description="A fun scholarship exam for kids covering Bangla, English, Math, and General Knowledge.",
            description_bn="বাংলা, ইংরেজি, গণিত ও সাধারণ জ্ঞান নিয়ে শিশুদের জন্য একটি মজার স্কলারশিপ পরীক্ষা।",
            price=Decimal("0"),
            is_active=True,
            is_free=True,
        )
        db.add(product)
        await db.flush()

        total_questions = sum(len(s["questions"]) for s in SECTIONS)
        exam = Exam(
            product_id=product.id,
            exam_type="anytime",
            pass_percentage=50,
            max_attempts=3,
            time_limit_seconds=total_questions * 30,
            total_sections=len(SECTIONS),
            total_questions=total_questions,
        )
        db.add(exam)
        await db.flush()

        for s_idx, s_data in enumerate(SECTIONS):
            section = ExamSection(
                exam_id=exam.id,
                title=s_data["title"],
                title_bn=s_data["title_bn"],
                sort_order=s_idx + 1,
            )
            db.add(section)
            await db.flush()

            for q_idx, q_data in enumerate(s_data["questions"]):
                question = ExamQuestion(
                    section_id=section.id,
                    question_text=q_data["q"],
                    question_text_bn=q_data["q_bn"],
                    question_type="mcq",
                    sort_order=q_idx + 1,
                    points=1,
                )
                db.add(question)
                await db.flush()

                for o_idx, (o_text, is_correct) in enumerate(q_data["options"]):
                    option = ExamOption(
                        question_id=question.id,
                        option_text=o_text,
                        option_text_bn=o_text,
                        is_correct=is_correct,
                        sort_order=o_idx + 1,
                    )
                    db.add(option)

            print(f"   ✅ {s_data['title_bn']} ({len(s_data['questions'])} questions)")

        await db.commit()

        print(f"\n🎉 Done! Created exam '{product.title_bn}' ({slug})")
        print(f"   📦 {len(SECTIONS)} sections, {total_questions} questions")
        print(f"   ⏱️  {total_questions * 30}s time limit, 50% pass, 3 max attempts")
        print(f"\n   Exam ID: {exam.id}")
        print(f"   👉 View: http://localhost:3001/exams/{slug}")


if __name__ == "__main__":
    asyncio.run(seed())
