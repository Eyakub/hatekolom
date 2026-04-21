# Exam Image Options & Results Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image upload support to exam questions and options (6 question modes: text/image/both × text/image/both), and redesign the results screen with a 30/70 split layout showing wrong-answer corrections with correct answers.

**Architecture:** Add nullable `image_url` columns to `exam_questions` and `exam_options` tables. Make `question_text` and `option_text` nullable (at least one of text/image required — validated in API). Frontend reuses existing `POST /uploads/image` endpoint with `folder=exam-images`. Student exam-taking page renders image options as a 2×2 grid of square (1:1) clickable cards. Results page becomes a 30/70 sidebar layout — sticky summary on left, wrong-answer corrections on right.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, PostgreSQL, Next.js/React, Tailwind CSS, Backblaze B2 (existing upload infra)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/alembic/versions/k1l2m3n4o5p6_add_exam_image_fields.py` | Create | DB migration — add `image_url` to questions & options, make text nullable |
| `backend/app/models/exam.py` | Modify | Add `image_url` column to `ExamQuestion` and `ExamOption` |
| `backend/app/api/v1/exams.py` | Modify | Update schemas, serialization, creation, update logic for image fields |
| `frontend/src/app/admin/exams/[id]/page.tsx` | Modify | Add image upload UI to question form modal + option cards |
| `frontend/src/app/exams/[slug]/take/page.tsx` | Modify | Render image questions/options in exam-taking UI + redesign results |

---

### Task 1: Database Migration — Add Image Fields

**Files:**
- Create: `backend/alembic/versions/k1l2m3n4o5p6_add_exam_image_fields.py`

- [ ] **Step 1: Create the migration file**

```python
"""Add image_url to exam questions and options

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Question image (16:9 landscape)
    op.add_column("exam_questions", sa.Column("image_url", sa.String(1000), nullable=True))
    # Make question_text nullable (image-only questions)
    op.alter_column("exam_questions", "question_text", existing_type=sa.Text(), nullable=True)

    # Option image (1:1 square)
    op.add_column("exam_options", sa.Column("image_url", sa.String(1000), nullable=True))
    # Make option_text nullable (image-only options)
    op.alter_column("exam_options", "option_text", existing_type=sa.String(1000), nullable=True)


def downgrade() -> None:
    op.alter_column("exam_options", "option_text", existing_type=sa.String(1000), nullable=False)
    op.drop_column("exam_options", "image_url")
    op.alter_column("exam_questions", "question_text", existing_type=sa.Text(), nullable=False)
    op.drop_column("exam_questions", "image_url")
```

- [ ] **Step 2: Run the migration**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && alembic upgrade head`
Expected: Migration applies successfully, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/k1l2m3n4o5p6_add_exam_image_fields.py
git commit -m "feat(exam): add image_url columns to exam_questions and exam_options"
```

---

### Task 2: Update SQLAlchemy Models

**Files:**
- Modify: `backend/app/models/exam.py:53-78`

- [ ] **Step 1: Add image_url to ExamQuestion model**

In `backend/app/models/exam.py`, update the `ExamQuestion` class. Change:

```python
class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey("exam_sections.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_text_bn = Column(Text, nullable=True)
    question_type = Column(String(20), default="mcq")
    sort_order = Column(Integer, default=0)
    points = Column(Integer, default=1)
```

To:

```python
class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey("exam_sections.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=True)
    question_text_bn = Column(Text, nullable=True)
    question_type = Column(String(20), default="mcq")
    sort_order = Column(Integer, default=0)
    points = Column(Integer, default=1)
    image_url = Column(String(1000), nullable=True)
```

- [ ] **Step 2: Add image_url to ExamOption model**

In the same file, update the `ExamOption` class. Change:

```python
class ExamOption(Base):
    __tablename__ = "exam_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(String(1000), nullable=False)
    option_text_bn = Column(String(1000), nullable=True)
    is_correct = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
```

To:

```python
class ExamOption(Base):
    __tablename__ = "exam_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(String(1000), nullable=True)
    option_text_bn = Column(String(1000), nullable=True)
    is_correct = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    image_url = Column(String(1000), nullable=True)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/exam.py
git commit -m "feat(exam): add image_url field to ExamQuestion and ExamOption models"
```

---

### Task 3: Update Backend API Schemas & Serialization

**Files:**
- Modify: `backend/app/api/v1/exams.py:34-48` (schemas)
- Modify: `backend/app/api/v1/exams.py:109-178` (`_get_exam_response` helper)
- Modify: `backend/app/api/v1/exams.py:247-279` (create exam — question/option creation)
- Modify: `backend/app/api/v1/exams.py:353-374` (add section — question/option creation)
- Modify: `backend/app/api/v1/exams.py:510-542` (update question)
- Modify: `backend/app/api/v1/exams.py:870-911` (submit results serialization)

- [ ] **Step 1: Update OptionSchema to include image_url**

In `backend/app/api/v1/exams.py`, change OptionSchema from:

```python
class OptionSchema(BaseModel):
    option_text: str
    option_text_bn: Optional[str] = None
    is_correct: bool = False
    sort_order: int = 0
```

To:

```python
class OptionSchema(BaseModel):
    option_text: Optional[str] = None
    option_text_bn: Optional[str] = None
    image_url: Optional[str] = None
    is_correct: bool = False
    sort_order: int = 0
```

- [ ] **Step 2: Update QuestionSchema to include image_url**

Change QuestionSchema from:

```python
class QuestionSchema(BaseModel):
    question_text: str
    question_text_bn: Optional[str] = None
    question_type: str = "mcq"
    sort_order: int = 0
    points: int = 1
    options: list[OptionSchema] = []
```

To:

```python
class QuestionSchema(BaseModel):
    question_text: Optional[str] = None
    question_text_bn: Optional[str] = None
    image_url: Optional[str] = None
    question_type: str = "mcq"
    sort_order: int = 0
    points: int = 1
    options: list[OptionSchema] = []
```

- [ ] **Step 3: Update _get_exam_response to include image_url fields**

In the `_get_exam_response` function, update the question and option serialization. Change the questions list comprehension from:

```python
"questions": [
    {
        "id": str(q.id),
        "question_text": q.question_text,
        "question_text_bn": q.question_text_bn,
        "question_type": q.question_type,
        "sort_order": q.sort_order,
        "points": q.points,
        "options": [
            {
                "id": str(o.id),
                "option_text": o.option_text,
                "option_text_bn": o.option_text_bn,
                **({"is_correct": o.is_correct} if admin else {}),
            }
            for o in sorted(q.options, key=lambda x: x.sort_order)
        ],
    }
    for q in sorted(s.questions, key=lambda x: x.sort_order)
],
```

To:

```python
"questions": [
    {
        "id": str(q.id),
        "question_text": q.question_text,
        "question_text_bn": q.question_text_bn,
        "question_type": q.question_type,
        "sort_order": q.sort_order,
        "points": q.points,
        "image_url": q.image_url,
        "options": [
            {
                "id": str(o.id),
                "option_text": o.option_text,
                "option_text_bn": o.option_text_bn,
                "image_url": o.image_url,
                **({"is_correct": o.is_correct} if admin else {}),
            }
            for o in sorted(q.options, key=lambda x: x.sort_order)
        ],
    }
    for q in sorted(s.questions, key=lambda x: x.sort_order)
],
```

- [ ] **Step 4: Update create_exam to pass image_url when creating questions and options**

In the `create_exam` endpoint (around line 259), change question creation from:

```python
question = ExamQuestion(
    section_id=section.id,
    question_text=q_data.question_text,
    question_text_bn=q_data.question_text_bn,
    question_type=q_data.question_type,
    sort_order=q_data.sort_order,
    points=q_data.points,
)
```

To:

```python
question = ExamQuestion(
    section_id=section.id,
    question_text=q_data.question_text,
    question_text_bn=q_data.question_text_bn,
    question_type=q_data.question_type,
    sort_order=q_data.sort_order,
    points=q_data.points,
    image_url=q_data.image_url,
)
```

And change option creation from:

```python
option = ExamOption(
    question_id=question.id,
    option_text=o_data.option_text,
    option_text_bn=o_data.option_text_bn,
    is_correct=o_data.is_correct,
    sort_order=o_data.sort_order,
)
```

To:

```python
option = ExamOption(
    question_id=question.id,
    option_text=o_data.option_text,
    option_text_bn=o_data.option_text_bn,
    image_url=o_data.image_url,
    is_correct=o_data.is_correct,
    sort_order=o_data.sort_order,
)
```

- [ ] **Step 5: Update add_section to pass image_url (same pattern)**

In the `add_section` endpoint (around line 353), apply the same change as Step 4 — add `image_url=q_data.image_url` to `ExamQuestion(...)` and `image_url=o_data.image_url` to `ExamOption(...)`.

- [ ] **Step 6: Update update_question to pass image_url**

In the `update_question` endpoint (around line 522), change from:

```python
question.question_text = data.question_text
question.question_text_bn = data.question_text_bn
question.points = data.points
question.sort_order = data.sort_order
```

To:

```python
question.question_text = data.question_text
question.question_text_bn = data.question_text_bn
question.points = data.points
question.sort_order = data.sort_order
question.image_url = data.image_url
```

And in the option recreation loop, change from:

```python
option = ExamOption(
    question_id=question.id,
    option_text=o_data.option_text,
    option_text_bn=o_data.option_text_bn,
    is_correct=o_data.is_correct,
    sort_order=o_data.sort_order,
)
```

To:

```python
option = ExamOption(
    question_id=question.id,
    option_text=o_data.option_text,
    option_text_bn=o_data.option_text_bn,
    image_url=o_data.image_url,
    is_correct=o_data.is_correct,
    sort_order=o_data.sort_order,
)
```

- [ ] **Step 7: Update submit_exam results to include image_url fields**

In the `submit_exam` endpoint (around line 894), change the results append from:

```python
results.append({
    "question_id": str(question.id),
    "section_id": str(section.id),
    "question_text": question.question_text,
    "selected_option_id": selected_id,
    "correct_option_id": str(correct_option.id) if correct_option else None,
    "is_correct": bool(is_correct),
    "points": question.points,
    "options": [
        {
            "id": str(o.id),
            "option_text": o.option_text,
            "option_text_bn": o.option_text_bn,
            "is_correct": o.is_correct,
        }
        for o in sorted(question.options, key=lambda x: x.sort_order)
    ],
})
```

To:

```python
results.append({
    "question_id": str(question.id),
    "section_id": str(section.id),
    "question_text": question.question_text,
    "question_text_bn": question.question_text_bn,
    "image_url": question.image_url,
    "selected_option_id": selected_id,
    "correct_option_id": str(correct_option.id) if correct_option else None,
    "is_correct": bool(is_correct),
    "points": question.points,
    "options": [
        {
            "id": str(o.id),
            "option_text": o.option_text,
            "option_text_bn": o.option_text_bn,
            "image_url": o.image_url,
            "is_correct": o.is_correct,
        }
        for o in sorted(question.options, key=lambda x: x.sort_order)
    ],
})
```

- [ ] **Step 8: Verify backend starts**

Run: `cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && python -c "from app.api.v1.exams import router; print('OK')"`
Expected: "OK"

- [ ] **Step 9: Commit**

```bash
git add backend/app/api/v1/exams.py
git commit -m "feat(exam): update API schemas and serialization for question/option images"
```

---

### Task 4: Admin Form — Image Upload for Questions & Options

**Files:**
- Modify: `frontend/src/app/admin/exams/[id]/page.tsx`

This task adds image upload capability to the question form modal. The admin can optionally upload a 16:9 image for the question and 1:1 square images for each option. Uses the existing `POST /uploads/image` endpoint with `folder=exam-images`.

- [ ] **Step 1: Update TypeScript interfaces to include image_url**

At the top of the file (around line 16), change the interfaces:

```typescript
interface ExamOption {
  id: string;
  option_text: string;
  option_text_bn?: string;
  is_correct?: boolean;
  sort_order: number;
}

interface ExamQuestion {
  id: string;
  question_text: string;
  question_text_bn?: string;
  question_type: string;
  sort_order: number;
  points: number;
  options: ExamOption[];
}
```

To:

```typescript
interface ExamOption {
  id: string;
  option_text?: string;
  option_text_bn?: string;
  image_url?: string;
  is_correct?: boolean;
  sort_order: number;
}

interface ExamQuestion {
  id: string;
  question_text?: string;
  question_text_bn?: string;
  image_url?: string;
  question_type: string;
  sort_order: number;
  points: number;
  options: ExamOption[];
}
```

- [ ] **Step 2: Add image_url to questionForm state and image upload states**

Add `image_url` to the question form state and add uploading state. Change:

```typescript
const [questionForm, setQuestionForm] = useState({
  question_text: "",
  question_text_bn: "",
  points: "1",
  options: [
    { option_text: "", option_text_bn: "", is_correct: true },
    { option_text: "", option_text_bn: "", is_correct: false },
    { option_text: "", option_text_bn: "", is_correct: false },
    { option_text: "", option_text_bn: "", is_correct: false },
  ],
});
```

To:

```typescript
const [questionForm, setQuestionForm] = useState({
  question_text: "",
  question_text_bn: "",
  image_url: "",
  points: "1",
  options: [
    { option_text: "", option_text_bn: "", image_url: "", is_correct: true },
    { option_text: "", option_text_bn: "", image_url: "", is_correct: false },
    { option_text: "", option_text_bn: "", image_url: "", is_correct: false },
    { option_text: "", option_text_bn: "", image_url: "", is_correct: false },
  ],
});
const [uploadingQuestionImage, setUploadingQuestionImage] = useState(false);
const [uploadingOptionImage, setUploadingOptionImage] = useState<number | null>(null);
```

- [ ] **Step 3: Add image upload helper function**

Add this function after the existing state declarations (around line 120):

```typescript
const uploadImage = async (file: File): Promise<string | null> => {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "exam-images");
    const res: any = await api.postFormData("/uploads/image", fd, accessToken!);
    return res.url;
  } catch {
    const { toast } = await import("@/stores/toast-store");
    toast.error(t("ছবি আপলোড ব্যর্থ", "Image upload failed"));
    return null;
  }
};
```

- [ ] **Step 4: Update openQuestionForm to reset image fields**

In `openQuestionForm` (around line 246), change the form reset:

```typescript
const openQuestionForm = (sectionId: string) => {
  setQuestionForSection(sectionId);
  setEditingQuestion(null);
  setQuestionForm({
    question_text: "",
    question_text_bn: "",
    points: "1",
    options: [
      { option_text: "", option_text_bn: "", is_correct: true },
      { option_text: "", option_text_bn: "", is_correct: false },
      { option_text: "", option_text_bn: "", is_correct: false },
      { option_text: "", option_text_bn: "", is_correct: false },
    ],
  });
  setShowQuestionForm(true);
};
```

To:

```typescript
const openQuestionForm = (sectionId: string) => {
  setQuestionForSection(sectionId);
  setEditingQuestion(null);
  setQuestionForm({
    question_text: "",
    question_text_bn: "",
    image_url: "",
    points: "1",
    options: [
      { option_text: "", option_text_bn: "", image_url: "", is_correct: true },
      { option_text: "", option_text_bn: "", image_url: "", is_correct: false },
      { option_text: "", option_text_bn: "", image_url: "", is_correct: false },
      { option_text: "", option_text_bn: "", image_url: "", is_correct: false },
    ],
  });
  setShowQuestionForm(true);
};
```

- [ ] **Step 5: Update openEditQuestion to load image fields**

In `openEditQuestion` (around line 263), update the option mapping and form initialization:

```typescript
const openEditQuestion = (sectionId: string, question: ExamQuestion) => {
  setQuestionForSection(sectionId);
  setEditingQuestion(question);
  const opts = question.options
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(o => ({
      option_text: o.option_text || "",
      option_text_bn: o.option_text_bn || "",
      image_url: o.image_url || "",
      is_correct: o.is_correct || false,
    }));
  while (opts.length < 4) {
    opts.push({ option_text: "", option_text_bn: "", image_url: "", is_correct: false });
  }
  setQuestionForm({
    question_text: question.question_text || "",
    question_text_bn: question.question_text_bn || "",
    image_url: question.image_url || "",
    points: String(question.points),
    options: opts.slice(0, 4),
  });
  setShowQuestionForm(true);
};
```

- [ ] **Step 6: Update saveQuestion — pass image_url in payloads**

In `saveQuestion` (around line 297), update the UPDATE payload:

```typescript
// ---- UPDATE existing question via PUT ----
const payload = {
  question_text: questionForm.question_text || undefined,
  question_text_bn: questionForm.question_text_bn || undefined,
  image_url: questionForm.image_url || undefined,
  points: parseInt(questionForm.points) || 1,
  sort_order: editingQuestion.sort_order,
  options: questionForm.options.map((o, i) => ({
    option_text: o.option_text || undefined,
    option_text_bn: o.option_text_bn || undefined,
    image_url: o.image_url || undefined,
    is_correct: o.is_correct,
    sort_order: i,
  })),
};
```

And update the ADD new question section — the `existingQuestions` mapping:

```typescript
const existingQuestions = section.questions.map(q => ({
  question_text: q.question_text || undefined,
  question_text_bn: q.question_text_bn || undefined,
  image_url: q.image_url || undefined,
  question_type: q.question_type || "mcq",
  sort_order: q.sort_order,
  points: q.points,
  options: q.options.map(o => ({
    option_text: o.option_text || undefined,
    option_text_bn: o.option_text_bn || undefined,
    image_url: o.image_url || undefined,
    is_correct: o.is_correct || false,
    sort_order: o.sort_order,
  })),
}));
```

And the `newQuestion`:

```typescript
const newQuestion = {
  question_text: questionForm.question_text || undefined,
  question_text_bn: questionForm.question_text_bn || undefined,
  image_url: questionForm.image_url || undefined,
  question_type: "mcq",
  sort_order: existingQuestions.length,
  points: parseInt(questionForm.points) || 1,
  options: questionForm.options.map((o, i) => ({
    option_text: o.option_text || undefined,
    option_text_bn: o.option_text_bn || undefined,
    image_url: o.image_url || undefined,
    is_correct: o.is_correct,
    sort_order: i,
  })),
};
```

- [ ] **Step 7: Update the question form modal — add question image upload**

In the question form modal (around line 986), after the "Question (Bengali)" textarea and before the Points input, add the question image upload section:

```tsx
{/* Question Image (16:9) */}
<div>
  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">
    {t("প্রশ্নের ছবি (ঐচ্ছিক)", "Question Image (optional)")}
    <span className="text-gray-400 font-normal ml-1">16:9</span>
  </label>
  {questionForm.image_url ? (
    <div className="relative group">
      <img
        src={questionForm.image_url}
        alt="Question"
        className="w-full aspect-video object-cover rounded-lg border border-gray-200"
      />
      <button
        type="button"
        onClick={() => setQuestionForm(p => ({ ...p, image_url: "" }))}
        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  ) : (
    <label className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-primary-400 transition-colors">
      {uploadingQuestionImage ? (
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      ) : (
        <span className="text-xs text-gray-400 font-bn">{t("ক্লিক করে ছবি আপলোড করো", "Click to upload image")}</span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploadingQuestionImage(true);
          const url = await uploadImage(file);
          if (url) setQuestionForm(p => ({ ...p, image_url: url }));
          setUploadingQuestionImage(false);
          e.target.value = "";
        }}
      />
    </label>
  )}
</div>
```

- [ ] **Step 8: Update each option card in the form — add option image upload**

In the options section of the question form modal (around line 1019), update each option card. Replace the existing option card content (the `<div key={idx}>` block) with:

```tsx
<div key={idx} className={`p-3 rounded-lg border ${opt.is_correct ? "border-green-300 bg-green-50/50" : "border-gray-200 bg-gray-50/30"}`}>
  <div className="flex items-center gap-2 mb-2">
    <input
      type="radio"
      name="correct_option"
      checked={opt.is_correct}
      onChange={() => {
        setQuestionForm(p => ({
          ...p,
          options: p.options.map((o, i) => ({ ...o, is_correct: i === idx })),
        }));
      }}
      className="text-green-600"
    />
    <span className="text-xs font-bold text-gray-500">{String.fromCharCode(65 + idx)})</span>
    {opt.is_correct && (
      <span className="text-[10px] font-bold text-green-600 font-bn">{t("সঠিক উত্তর", "Correct")}</span>
    )}
  </div>

  {/* Option Image (1:1 square) */}
  <div className="mb-2">
    {opt.image_url ? (
      <div className="relative group inline-block">
        <img
          src={opt.image_url}
          alt={`Option ${String.fromCharCode(65 + idx)}`}
          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
        />
        <button
          type="button"
          onClick={() => {
            setQuestionForm(p => ({
              ...p,
              options: p.options.map((o, i) => i === idx ? { ...o, image_url: "" } : o),
            }));
          }}
          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
    ) : (
      <label className="inline-flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-primary-400 transition-colors">
        {uploadingOptionImage === idx ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        ) : (
          <Plus className="w-4 h-4 text-gray-300" />
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploadingOptionImage(idx);
            const url = await uploadImage(file);
            if (url) {
              setQuestionForm(p => ({
                ...p,
                options: p.options.map((o, i) => i === idx ? { ...o, image_url: url } : o),
              }));
            }
            setUploadingOptionImage(null);
            e.target.value = "";
          }}
        />
      </label>
    )}
  </div>

  <div className="grid grid-cols-2 gap-2">
    <input
      value={opt.option_text}
      onChange={e => {
        const val = e.target.value;
        setQuestionForm(p => ({
          ...p,
          options: p.options.map((o, i) => i === idx ? { ...o, option_text: val } : o),
        }));
      }}
      placeholder="English"
      className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
    />
    <input
      value={opt.option_text_bn}
      onChange={e => {
        const val = e.target.value;
        setQuestionForm(p => ({
          ...p,
          options: p.options.map((o, i) => i === idx ? { ...o, option_text_bn: val } : o),
        }));
      }}
      placeholder={t("বাংলা", "Bengali")}
      className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
    />
  </div>
</div>
```

- [ ] **Step 9: Update the question card preview in the section list**

In the question card (around line 614-616), update the question text display to also show the image. Change:

```tsx
{/* Question text (truncated) */}
<p className="text-sm text-gray-800 font-bn line-clamp-2 mb-2">
  {locale === "bn" ? (question.question_text_bn || question.question_text) : (question.question_text || question.question_text_bn)}
</p>
```

To:

```tsx
{/* Question image + text */}
{question.image_url && (
  <img src={question.image_url} alt="" className="w-full aspect-video object-cover rounded-lg mb-2" />
)}
<p className="text-sm text-gray-800 font-bn line-clamp-2 mb-2">
  {locale === "bn" ? (question.question_text_bn || question.question_text) : (question.question_text || question.question_text_bn)}
</p>
```

And update the option display (around line 620-637) to show option images. Change:

```tsx
<span className="font-bn truncate">
  {String.fromCharCode(2453 + oi)}) {locale === "bn" ? (opt.option_text_bn || opt.option_text) : (opt.option_text || opt.option_text_bn)}
</span>
```

To:

```tsx
<span className="font-bn truncate flex items-center gap-1.5">
  {String.fromCharCode(2453 + oi)})
  {opt.image_url && <img src={opt.image_url} alt="" className="w-5 h-5 rounded object-cover inline-block" />}
  {(opt.option_text || opt.option_text_bn) && (
    <span>{locale === "bn" ? (opt.option_text_bn || opt.option_text) : (opt.option_text || opt.option_text_bn)}</span>
  )}
</span>
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/admin/exams/[id]/page.tsx
git commit -m "feat(exam): add image upload UI for questions and options in admin form"
```

---

### Task 5: Student Exam-Taking UI — Render Image Questions & Options

**Files:**
- Modify: `frontend/src/app/exams/[slug]/take/page.tsx`

- [ ] **Step 1: Update the question card to show images**

In the exam-taking page (around line 626-631), update the question card section. Change:

```tsx
<section className="w-full bg-white rounded-2xl p-5 sm:p-8 shadow-[0_10px_30px_rgba(27,28,28,0.04)] relative overflow-hidden border border-gray-100">
  <div className="absolute top-0 left-0 w-1.5 shrink-0 h-full bg-[#6c5ce7]" />
  <h2 className="text-xl sm:text-2xl font-extrabold text-[#1b1c1c] text-center leading-snug pl-2 sm:pl-0">
    {currentQuestion.question_text_bn || currentQuestion.question_text}
  </h2>
</section>
```

To:

```tsx
<section className="w-full bg-white rounded-2xl p-5 sm:p-8 shadow-[0_10px_30px_rgba(27,28,28,0.04)] relative overflow-hidden border border-gray-100">
  <div className="absolute top-0 left-0 w-1.5 shrink-0 h-full bg-[#6c5ce7]" />
  {currentQuestion.image_url && (
    <img
      src={currentQuestion.image_url}
      alt=""
      className="w-full max-w-lg mx-auto aspect-video object-cover rounded-xl mb-4"
    />
  )}
  {(currentQuestion.question_text || currentQuestion.question_text_bn) && (
    <h2 className="text-xl sm:text-2xl font-extrabold text-[#1b1c1c] text-center leading-snug pl-2 sm:pl-0">
      {currentQuestion.question_text_bn || currentQuestion.question_text}
    </h2>
  )}
</section>
```

- [ ] **Step 2: Update the options grid to support image options**

Replace the entire options section (around line 634-676) with a version that detects whether options have images and renders accordingly:

```tsx
{/* Options grid */}
<section className={`grid gap-3 w-full ${
  currentQuestion.options.some((o: any) => o.image_url)
    ? "grid-cols-2"
    : "grid-cols-1 md:grid-cols-2"
}`}>
  {currentQuestion.options.map((opt: any, index: number) => {
    const isSelected = answers[currentQuestion.id] === opt.id;
    const style = optionStyles[index % 4];
    const hasImage = !!opt.image_url;

    return (
      <button
        key={opt.id}
        onClick={() => selectAnswer(currentQuestion.id, opt.id)}
        className={`group relative rounded-xl flex ${hasImage ? "flex-col items-center p-3" : "items-center p-4"} text-left transition-all duration-300 active:scale-[0.98] border-2 shadow-sm ${
          isSelected
            ? style.activeBorder
            : `border-transparent ${style.hoverBorder} ${style.bg}`
        }`}
      >
        {hasImage ? (
          <>
            {/* Square image option */}
            <div className="w-full aspect-square rounded-lg overflow-hidden mb-2">
              <img
                src={opt.image_url}
                alt={opt.option_text || `Option ${String.fromCharCode(65 + index)}`}
                className="w-full h-full object-cover"
              />
            </div>
            {(opt.option_text || opt.option_text_bn) && (
              <span className={`text-sm font-bold font-bn text-center ${style.text}`}>
                {opt.option_text_bn || opt.option_text}
              </span>
            )}
          </>
        ) : (
          <>
            {/* Text-only option (existing layout) */}
            <div
              className={`w-10 h-10 rounded-full ${style.iconBg} flex items-center justify-center transition-transform group-hover:rotate-12 shrink-0`}
            >
              <style.icon
                className={`w-5 h-5 ${style.iconText} ${isSelected ? "fill-current" : ""}`}
              />
            </div>
            <div className="flex-1 ml-3">
              <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 font-sans">
                {style.label}
              </span>
              <span className={`text-base sm:text-lg font-bold font-bn ${style.text}`}>
                {opt.option_text_bn || opt.option_text}
              </span>
            </div>
          </>
        )}
        {isSelected && (
          <div className={`absolute top-3 right-3 animate-in zoom-in spin-in-180 duration-300`}>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
        )}
      </button>
    );
  })}
</section>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/exams/[slug]/take/page.tsx
git commit -m "feat(exam): render image questions and options in student exam-taking UI"
```

---

### Task 6: Redesign Results Screen — 30/70 Split with Wrong Answer Review

**Files:**
- Modify: `frontend/src/app/exams/[slug]/take/page.tsx`

This replaces the entire result screen section (lines 263-467) with a new 30/70 split layout:
- **Left 30% (sticky):** Score donut, pass/fail status, correct/wrong/skipped counts, section breakdown
- **Right 70%:** Only wrong + skipped questions, each showing: the question (text/image), the student's wrong answer (red), and the correct answer (green)

- [ ] **Step 1: Replace the result screen section**

Replace the entire result block (from `if (result) {` around line 263 to the closing `}` before `/* Active exam screen */` around line 468) with:

```tsx
if (result) {
  const correctCount = result.results
    ? result.results.filter((r: any) => r.is_correct).length
    : 0;
  const skippedCount = result.results
    ? result.results.filter((r: any) => !r.selected_option_id).length
    : 0;
  const totalCount = result.results ? result.results.length : 0;
  const wrongCount = totalCount - correctCount - skippedCount;
  const scorePct = parseFloat(result.score);
  const circumference = 2 * Math.PI * 40;

  const wrongAndSkipped = result.results
    ? result.results.filter((r: any) => !r.is_correct)
    : [];

  return (
    <div className="min-h-screen bg-[#fbf9f8] relative overflow-hidden flex flex-col font-bn text-gray-900">
      {/* Background dots */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(#5341cd 0.6px, transparent 0.6px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl w-full z-20 flex justify-between items-center px-6 sm:px-10 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border-b border-gray-100/50">
        <div className="text-xl sm:text-2xl font-extrabold text-[#5341CD] tracking-wide">
          ফলাফল বিশ্লেষণ
        </div>
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 hover:scale-105 transition-all outline-none"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </header>

      {/* Main — 30/70 split */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 relative z-10 overflow-y-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT: Summary sidebar (30%) — sticky */}
          <div className="w-full lg:w-[30%] lg:sticky lg:top-6 lg:self-start space-y-4">
            {/* Score card */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
              className={`relative rounded-2xl w-full p-6 shadow-[0_20px_40px_rgba(27,28,28,0.06)] overflow-hidden border-2 ${
                result.passed ? "bg-white border-green-200" : "bg-white border-red-100"
              }`}
            >
              {result.passed ? <HappyParticles /> : <SadParticles />}

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`text-xl font-extrabold relative z-10 tracking-tight text-center mb-5 ${
                  result.passed ? "text-green-600" : "text-gray-900"
                }`}
              >
                {result.passed
                  ? "অসাধারণ! 🎉"
                  : "উত্তীর্ণ হতে পারোনি 😞"}
              </motion.h2>

              {/* Donut */}
              <div className="flex flex-col items-center relative z-10">
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", bounce: 0.5, duration: 0.8, delay: 0.3 }}
                  className="relative w-36 h-36 mb-5"
                >
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" className="stroke-gray-100" strokeWidth="10" fill="none" />
                    <motion.circle
                      cx="50" cy="50" r="40"
                      className={result.passed ? "stroke-[#5341CD]" : "stroke-red-400"}
                      strokeWidth="10" fill="none" strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - scorePct / 100) }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black font-mono ${result.passed ? "text-[#5341CD]" : "text-red-500"}`}>
                      {scorePct.toFixed(0)}%
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Score</span>
                  </div>
                </motion.div>

                {/* Metrics */}
                <div className="w-full space-y-2">
                  <div className="bg-green-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-green-100/80">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs font-bold text-green-700">সঠিক উত্তর</span>
                    </div>
                    <span className="font-black text-green-700 tabular-nums">{correctCount}</span>
                  </div>
                  <div className="bg-red-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-red-100/80">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs font-bold text-red-700">ভুল উত্তর</span>
                    </div>
                    <span className="font-black text-red-700 tabular-nums">{wrongCount}</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-gray-200/80">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-xs font-bold text-gray-600">এড়িয়ে যাওয়া</span>
                    </div>
                    <span className="font-black text-gray-700 tabular-nums">{skippedCount}</span>
                  </div>
                  <div className="bg-[#f3f0ff] rounded-xl px-4 py-2.5 flex items-center justify-between border border-[#5341CD]/10">
                    <div className="flex items-center gap-2">
                      <Trophy className={`w-3.5 h-3.5 ${result.passed ? "text-[#ffb787]" : "text-gray-400"}`} />
                      <span className="text-xs font-bold text-[#5341CD]">পয়েন্ট</span>
                    </div>
                    <span className="font-black text-[#5341CD] tabular-nums">
                      {result.earned_points}/{result.total_points}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Section breakdown */}
            {result.section_scores && result.section_scores.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <h3 className="text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#5341CD]" />
                  সেকশন অনুযায়ী
                </h3>
                <div className="space-y-2.5">
                  {result.section_scores.map((ss: any) => {
                    const pct = ss.total > 0 ? (ss.earned / ss.total) * 100 : 0;
                    return (
                      <div key={ss.section_id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-700">
                            {ss.title_bn || ss.title}
                          </span>
                          <span className="text-xs font-black text-[#5341CD] tabular-nums">
                            {ss.earned}/{ss.total}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#5341CD] rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* RIGHT: Wrong answers review (70%) */}
          <div className="w-full lg:w-[70%]">
            {wrongAndSkipped.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-2xl border border-green-200 p-10 text-center shadow-sm"
              >
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-extrabold text-green-700 mb-1">সব উত্তর সঠিক!</h3>
                <p className="text-sm text-gray-500">তুমি সব প্রশ্নের সঠিক উত্তর দিয়েছো। অসাধারণ!</p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <h3 className="text-lg font-extrabold text-gray-800 mb-1 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    ভুল ও এড়িয়ে যাওয়া উত্তরসমূহ
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    নিচে তোমার ভুল উত্তর এবং সঠিক উত্তর দেখানো হলো
                  </p>
                </motion.div>

                {wrongAndSkipped.map((r: any, ri: number) => {
                  const selectedOption = r.options.find((o: any) => o.id === r.selected_option_id);
                  const correctOption = r.options.find((o: any) => o.is_correct);

                  return (
                    <motion.div
                      key={r.question_id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + ri * 0.05 }}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                      {/* Question */}
                      <div className="p-5 border-b border-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-xs font-bold">{ri + 1}</span>
                          </div>
                          <div className="flex-1">
                            {r.image_url && (
                              <img
                                src={r.image_url}
                                alt=""
                                className="w-full max-w-md aspect-video object-cover rounded-xl mb-3"
                              />
                            )}
                            {(r.question_text || r.question_text_bn) && (
                              <p className="text-base font-bold text-gray-900">
                                {r.question_text_bn || r.question_text}
                              </p>
                            )}
                            <span className="text-[10px] font-bold text-gray-400 mt-1 block">
                              {r.points} পয়েন্ট
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Answer comparison */}
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Student's wrong answer */}
                        <div className={`rounded-xl border-2 p-3 ${
                          r.selected_option_id
                            ? "border-red-200 bg-red-50/50"
                            : "border-gray-200 bg-gray-50/50"
                        }`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider block mb-2 ${
                            r.selected_option_id ? "text-red-400" : "text-gray-400"
                          }`}>
                            {r.selected_option_id ? "তোমার উত্তর ✗" : "এড়িয়ে গেছো"}
                          </span>
                          {selectedOption ? (
                            <div className="flex items-center gap-2">
                              {selectedOption.image_url && (
                                <img src={selectedOption.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                              )}
                              {(selectedOption.option_text || selectedOption.option_text_bn) && (
                                <span className="text-sm font-bold text-red-700">
                                  {selectedOption.option_text_bn || selectedOption.option_text}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">উত্তর দেওয়া হয়নি</span>
                          )}
                        </div>

                        {/* Correct answer */}
                        <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-3">
                          <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider block mb-2">
                            সঠিক উত্তর ✓
                          </span>
                          {correctOption ? (
                            <div className="flex items-center gap-2">
                              {correctOption.image_url && (
                                <img src={correctOption.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                              )}
                              {(correctOption.option_text || correctOption.option_text_bn) && (
                                <span className="text-sm font-bold text-green-700">
                                  {correctOption.option_text_bn || correctOption.option_text}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white/90 backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-center border-t border-gray-100 z-20 shadow-[0_-15px_40px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => {
            router.push(
              exam.product?.slug
                ? `/exams/${exam.product.slug}`
                : "/dashboard",
            );
          }}
          className="group px-8 sm:px-10 py-3.5 sm:py-4 rounded-full font-bold text-lg sm:text-xl flex items-center justify-center gap-3 transition-all bg-[#5341CD] text-white shadow-xl shadow-primary-600/30 hover:shadow-primary-600/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
        >
          ফলাফল দেখা শেষ
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/exams/[slug]/take/page.tsx
git commit -m "feat(exam): redesign results screen with 30/70 split and wrong answer review"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Start backend and run migration**

```bash
cd /Users/eyakubsorkar/Desktop/FastAPI/lms/backend && alembic upgrade head
```

- [ ] **Step 2: Start frontend dev server and test admin form**

Go to `http://localhost:3001/admin/exams/<exam-id>`:
1. Click "Add Question" on a section
2. Verify question image upload appears (16:9 dropzone)
3. Verify each option has a square image upload (1:1 dropzone)
4. Upload images and verify they appear as previews
5. Save the question and verify images persist
6. Edit the question and verify images load back

- [ ] **Step 3: Test student exam-taking with image questions**

Go to the exam as a student:
1. Verify questions with images show the image above the text
2. Verify image options render as a 2×2 grid of square clickable cards
3. Verify text-only questions still render normally (no regression)
4. Verify mixed mode works (image question + text options, text question + image options)

- [ ] **Step 4: Test the new results screen**

Submit the exam and verify:
1. Left sidebar (30%) shows: score donut, pass/fail, metric pills, section breakdown
2. Right area (70%) shows only wrong/skipped answers
3. Each wrong answer card shows: question (with image if present), student's answer (red), correct answer (green)
4. If all answers correct, shows "সব উত্তর সঠিক!" message
5. On mobile, layout stacks vertically (summary on top, corrections below)
6. Sticky sidebar works on desktop when scrolling through many wrong answers

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(exam): complete image-based questions and results review feature"
```
