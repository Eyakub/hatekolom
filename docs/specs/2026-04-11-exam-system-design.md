# Exam System Design

## Overview

A flexible exam/quiz system for kids that can be:
- **Standalone** — sold independently as a product
- **Attached to products** — bundled with courses, ebooks, or physical books
- **Free or paid** — goes through existing payment/cart/entitlement system
- **Anytime or scheduled** — admin chooses per exam

## Data Model

### Exam (exams table)
- `id` UUID PK
- `product_id` FK to products (one-to-one, like Course)
- `exam_type` enum: `anytime`, `scheduled`
- `scheduled_start` datetime nullable (for scheduled)
- `scheduled_end` datetime nullable (for scheduled)
- `pass_percentage` int default 60
- `max_attempts` int nullable (null = unlimited)
- `time_limit_seconds` int nullable (overall exam timer)
- `is_active` bool default true
- `created_at` datetime

### ExamSection (exam_sections table)
- `id` UUID PK
- `exam_id` FK to exams (cascade)
- `title` string
- `title_bn` string nullable
- `sort_order` int
- `time_limit_seconds` int nullable (per-section timer, optional)

### ExamQuestion (exam_questions table)
- `id` UUID PK
- `section_id` FK to exam_sections (cascade)
- `question_text` text
- `question_text_bn` text nullable
- `question_type` string default "mcq"
- `sort_order` int
- `points` int default 1

### ExamOption (exam_options table)
- `id` UUID PK
- `question_id` FK to exam_questions (cascade)
- `option_text` string
- `option_text_bn` string nullable
- `is_correct` bool default false
- `sort_order` int

### ExamAttempt (exam_attempts table)
- `id` UUID PK
- `exam_id` FK to exams (cascade)
- `child_profile_id` FK to child_profiles (cascade)
- `user_id` FK to users (cascade) — the guardian
- `score` decimal(5,2) — percentage
- `total_points` int
- `earned_points` int
- `passed` bool
- `answers` JSONB — `{question_id: selected_option_id}`
- `section_scores` JSONB — `[{section_id, title, earned, total}]`
- `started_at` datetime
- `completed_at` datetime nullable

### ProductExam (product_exams join table)
- `id` UUID PK
- `product_id` FK to products
- `exam_id` FK to exams
- Links any product (course, ebook, physical book) to an exam

## API Endpoints

### Public
- `GET /exams/` — list all active exams (for browse/catalog)
- `GET /exams/{slug}` — exam detail page (public landing)
- `GET /exams/{exam_id}/sections` — section titles + question counts (no answers)

### Student (auth required)
- `GET /exams/{exam_id}/start` — get full exam with questions (checks entitlement, schedule, attempts)
- `POST /exams/{exam_id}/submit` — submit answers, get graded result
- `GET /exams/my` — dashboard: list all exams the child has access to (purchased + bundled)
- `GET /exams/attempts/{attempt_id}` — view past attempt result

### Admin
- `POST /exams/` — create exam (creates product + exam + sections + questions)
- `PUT /exams/{exam_id}` — update exam
- `POST /exams/{exam_id}/sections` — add section
- `PUT /exams/sections/{section_id}` — update section
- `POST /exams/sections/{section_id}/questions` — add question
- `DELETE /exams/questions/{question_id}` — delete question
- `POST /exams/{exam_id}/attach/{product_id}` — attach exam to a product
- `DELETE /exams/{exam_id}/attach/{product_id}` — detach
- `GET /exams/{exam_id}/attempts` — view all attempts (admin)

## Frontend Pages

### Public
- `/exams` — exam catalog/listing page
- `/exams/[slug]` — exam detail (sections preview, price, schedule info, buy/start button)

### Student Dashboard
- "আমার পরীক্ষাসমূহ" section on dashboard
  - Upcoming scheduled exams with countdown
  - Available anytime exams
  - Past attempts with scores
- Product detail pages show "এই প্রোডাক্টের সাথে পরীক্ষা আছে" badge

### Exam Player
- `/exams/[id]/take` — full-screen exam experience
  - Section tabs at top
  - Question navigation within section
  - Timer (exam-level or section-level)
  - Auto-submit on timeout
  - Result screen: overall score + section breakdown + certificate if passed

### Admin
- "পরীক্ষা" tab in admin dashboard
  - List all exams
  - Create/edit exam with sections and questions
  - Manage pricing, schedule, attempts
  - Attach/detach from products
  - View attempts and results

## Implementation Order

### Phase 1: Backend Models + Migration
1. Create `Exam`, `ExamSection`, `ExamQuestion`, `ExamOption`, `ExamAttempt`, `ProductExam` models
2. Add `exam` to `ProductType` enum
3. Run migration

### Phase 2: Backend API
4. Admin CRUD endpoints (create exam, sections, questions)
5. Public endpoints (list, detail, sections preview)
6. Student endpoints (start, submit, my exams, attempt result)
7. Product attachment endpoints

### Phase 3: Admin Frontend
8. "পরীক্ষা" tab in admin dashboard — list + create/edit
9. Exam editor: sections + questions management
10. Attach exam to products UI
11. View attempts/results

### Phase 4: Student Frontend
12. Exam catalog page (`/exams`)
13. Exam detail page (`/exams/[slug]`)
14. Exam player (`/exams/[id]/take`) — section-based quiz experience
15. Result screen with section breakdown + certificate
16. Dashboard "আমার পরীক্ষাসমূহ" section
17. Product detail page exam badge

## Notes
- Reuse existing payment/cart/entitlement system for paid exams
- Reuse certificate generation system for exam certificates
- Scheduled exams: check `now() BETWEEN scheduled_start AND scheduled_end` before allowing start
- Max attempts: count existing attempts before allowing new one
- Section-wise scoring stored in JSONB for fast retrieval on result pages
