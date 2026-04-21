"""
Quiz API — Admin CRUD + Student submit/grade.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional

from app.db import get_db
from app.models import User
from app.models.quiz import Quiz, QuizQuestion, QuizOption, QuizAttempt
from app.api.deps import get_current_user, PermissionChecker
from app.core.permissions import Permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


# ---- Schemas ----

class OptionCreate(BaseModel):
    option_text: str
    option_text_bn: Optional[str] = None
    is_correct: bool = False
    sort_order: int = 0

class QuestionCreate(BaseModel):
    question_text: str
    question_text_bn: Optional[str] = None
    question_type: str = "mcq"
    sort_order: int = 0
    points: int = 1
    options: list[OptionCreate] = []

class QuizCreate(BaseModel):
    lesson_id: str
    title: str
    title_bn: Optional[str] = None
    description: Optional[str] = None
    pass_percentage: int = 60
    time_limit_seconds: Optional[int] = None
    questions: list[QuestionCreate] = []

class SubmitAnswer(BaseModel):
    question_id: str
    selected_option_id: str

class QuizSubmit(BaseModel):
    answers: list[SubmitAnswer]


# ---- Admin Endpoints ----

@router.post("/", status_code=201)
async def create_quiz(
    data: QuizCreate,
    user: User = Depends(PermissionChecker([Permission.LESSON_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Create a quiz with questions and options (admin)."""
    # Check uniqueness per lesson
    existing = await db.execute(select(Quiz).where(Quiz.lesson_id == data.lesson_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This lesson already has a quiz")

    quiz = Quiz(
        lesson_id=UUID(data.lesson_id),
        title=data.title,
        title_bn=data.title_bn,
        description=data.description,
        pass_percentage=data.pass_percentage,
        time_limit_seconds=data.time_limit_seconds,
    )
    db.add(quiz)
    await db.flush()

    for q_data in data.questions:
        question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q_data.question_text,
            question_text_bn=q_data.question_text_bn,
            question_type=q_data.question_type,
            sort_order=q_data.sort_order,
            points=q_data.points,
        )
        db.add(question)
        await db.flush()

        for o_data in q_data.options:
            option = QuizOption(
                question_id=question.id,
                option_text=o_data.option_text,
                option_text_bn=o_data.option_text_bn,
                is_correct=o_data.is_correct,
                sort_order=o_data.sort_order,
            )
            db.add(option)

    await db.commit()

    return await _get_quiz_response(quiz.id, db, admin=True)


@router.put("/lesson/{lesson_id}", status_code=200)
async def update_quiz(
    lesson_id: UUID,
    data: QuizCreate,
    user: User = Depends(PermissionChecker([Permission.LESSON_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Update a quiz entirely (admin). Drops existing questions and recreates them."""
    existing = await db.execute(select(Quiz).where(Quiz.lesson_id == lesson_id))
    quiz = existing.scalar_one_or_none()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    quiz.title = data.title
    quiz.title_bn = data.title_bn
    quiz.description = data.description
    quiz.pass_percentage = data.pass_percentage
    quiz.time_limit_seconds = data.time_limit_seconds

    # Delete all existing questions (cascade deletes options)
    await db.execute(QuizQuestion.__table__.delete().where(QuizQuestion.quiz_id == quiz.id))
    await db.flush()

    for q_data in data.questions:
        question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q_data.question_text,
            question_text_bn=q_data.question_text_bn,
            question_type=q_data.question_type,
            sort_order=q_data.sort_order,
            points=q_data.points,
        )
        db.add(question)
        await db.flush()

        for o_data in q_data.options:
            option = QuizOption(
                question_id=question.id,
                option_text=o_data.option_text,
                option_text_bn=o_data.option_text_bn,
                is_correct=o_data.is_correct,
                sort_order=o_data.sort_order,
            )
            db.add(option)

    await db.commit()
    return await _get_quiz_response(quiz.id, db, admin=True)

@router.get("/lesson/{lesson_id}/admin")
async def get_quiz_for_lesson_admin(
    lesson_id: UUID,
    user: User = Depends(PermissionChecker([Permission.LESSON_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Get quiz for a lesson (admin view — includes correct answers)."""
    result = await db.execute(
        select(Quiz).where(Quiz.lesson_id == lesson_id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz found")

    return await _get_quiz_response(quiz.id, db, admin=True)
@router.get("/lesson/{lesson_id}")
async def get_quiz_for_lesson(
    lesson_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get quiz for a lesson (student view — no correct answers)."""
    result = await db.execute(
        select(Quiz)
        .options(
            selectinload(Quiz.questions).selectinload(QuizQuestion.options)
        )
        .where(Quiz.lesson_id == lesson_id, Quiz.is_active == True)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz found for this lesson")

    # Check previous attempts
    attempt_result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.completed_at.desc())
        .limit(1)
    )
    last_attempt = attempt_result.scalar_one_or_none()

    attempt_stats = None
    if last_attempt:
        correct_count = 0
        wrong_count = 0
        skipped_count = 0
        
        answers_dict = last_attempt.answers or {}

        for q in quiz.questions:
            selected_id = answers_dict.get(str(q.id))
            if not selected_id:
                skipped_count += 1
            else:
                correct_option = next((o for o in q.options if o.is_correct), None)
                if correct_option and str(correct_option.id) == selected_id:
                    correct_count += 1
                else:
                    wrong_count += 1

        attempt_stats = {
            "score": str(last_attempt.score),
            "passed": last_attempt.passed,
            "earned_points": last_attempt.earned_points,
            "total_points": last_attempt.total_points,
            "completed_at": str(last_attempt.completed_at) if last_attempt.completed_at else None,
            "correct_count": correct_count,
            "wrong_count": wrong_count,
            "skipped_count": skipped_count
        }

    return {
        "id": str(quiz.id),
        "title": quiz.title,
        "title_bn": quiz.title_bn,
        "description": quiz.description,
        "pass_percentage": quiz.pass_percentage,
        "time_limit_seconds": quiz.time_limit_seconds,
        "questions": [
            {
                "id": str(q.id),
                "question_text": q.question_text,
                "question_text_bn": q.question_text_bn,
                "question_type": q.question_type,
                "points": q.points,
                "options": [
                    {
                        "id": str(o.id),
                        "option_text": o.option_text,
                        "option_text_bn": o.option_text_bn,
                        # Don't expose is_correct to students
                    }
                    for o in sorted(q.options, key=lambda x: x.sort_order)
                ],
            }
            for q in sorted(quiz.questions, key=lambda x: x.sort_order)
        ],
        "last_attempt": attempt_stats,
    }


# ---- Student Submit ----

@router.post("/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: UUID,
    data: QuizSubmit,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit quiz answers and get graded result."""
    result = await db.execute(
        select(Quiz)
        .options(
            selectinload(Quiz.questions).selectinload(QuizQuestion.options)
        )
        .where(Quiz.id == quiz_id, Quiz.is_active == True)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check if user already submitted
    existing_attempt = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == user.id)
    )
    if existing_attempt.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already submitted this quiz.")

    # Build answer map
    answer_map = {a.question_id: a.selected_option_id for a in data.answers}

    total_points = 0
    earned_points = 0
    results = []

    for question in quiz.questions:
        total_points += question.points
        selected_id = answer_map.get(str(question.id))

        # Find correct option
        correct_option = next((o for o in question.options if o.is_correct), None)
        is_correct = selected_id and correct_option and selected_id == str(correct_option.id)

        if is_correct:
            earned_points += question.points

        results.append({
            "question_id": str(question.id),
            "question_text": question.question_text,
            "selected_option_id": selected_id,
            "correct_option_id": str(correct_option.id) if correct_option else None,
            "is_correct": bool(is_correct),
            "points": question.points,
            "options": [
                {
                    "id": str(o.id),
                    "option_text": o.option_text,
                    "is_correct": o.is_correct,
                }
                for o in question.options
            ],
        })

    score = Decimal(str((earned_points / total_points * 100) if total_points > 0 else 0))
    passed = score >= quiz.pass_percentage

    # Save attempt
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        score=score,
        total_points=total_points,
        earned_points=earned_points,
        passed=passed,
        answers=answer_map,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    await db.commit()

    return {
        "attempt_id": str(attempt.id),
        "score": str(score),
        "earned_points": earned_points,
        "total_points": total_points,
        "passed": passed,
        "pass_percentage": quiz.pass_percentage,
        "results": results,
    }


# ---- Admin: Add question to existing quiz ----

@router.post("/{quiz_id}/questions", status_code=201)
async def add_question(
    quiz_id: UUID,
    data: QuestionCreate,
    user: User = Depends(PermissionChecker([Permission.LESSON_CREATE])),
    db: AsyncSession = Depends(get_db),
):
    """Add a question to an existing quiz."""
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    question = QuizQuestion(
        quiz_id=quiz.id,
        question_text=data.question_text,
        question_text_bn=data.question_text_bn,
        question_type=data.question_type,
        sort_order=data.sort_order,
        points=data.points,
    )
    db.add(question)
    await db.flush()

    for o_data in data.options:
        option = QuizOption(
            question_id=question.id,
            option_text=o_data.option_text,
            option_text_bn=o_data.option_text_bn,
            is_correct=o_data.is_correct,
            sort_order=o_data.sort_order,
        )
        db.add(option)

    await db.commit()
    return {"id": str(question.id), "message": "Question added"}


@router.delete("/questions/{question_id}", status_code=204)
async def delete_question(
    question_id: UUID,
    user: User = Depends(PermissionChecker([Permission.COURSE_DELETE])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a quiz question."""
    q = await db.get(QuizQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(q)
    await db.commit()


# ---- Helper ----

async def _get_quiz_response(quiz_id: UUID, db: AsyncSession, admin: bool = False):
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalar_one()
    return {
        "id": str(quiz.id),
        "lesson_id": str(quiz.lesson_id),
        "title": quiz.title,
        "title_bn": quiz.title_bn,
        "description": quiz.description,
        "pass_percentage": quiz.pass_percentage,
        "time_limit_seconds": quiz.time_limit_seconds,
        "questions": [
            {
                "id": str(q.id),
                "question_text": q.question_text,
                "question_text_bn": q.question_text_bn,
                "question_type": q.question_type,
                "points": q.points,
                "options": [
                    {
                        "id": str(o.id),
                        "option_text": o.option_text,
                        "option_text_bn": o.option_text_bn,
                        "is_correct": o.is_correct if admin else None,
                    }
                    for o in sorted(q.options, key=lambda x: x.sort_order)
                ],
            }
            for q in sorted(quiz.questions, key=lambda x: x.sort_order)
        ],
    }
