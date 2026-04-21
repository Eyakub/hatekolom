# Exam-Course Checkout Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a course/physical book has an attached exam (via ProductExam), auto-add the exam to cart at checkout. Student can remove the exam if they don't want it. If they skip the exam, show a "buy exam" prompt in their course dashboard.

**Architecture:** Extend `CartItem` with an `attachedTo` field to link exam items to their parent product. On "Add to Cart" / "Enroll Now", fetch attached exams and add them alongside the parent. In checkout, render attached exams nested under their parent with a remove option. On the learn page, check if the student has exam access — if not but the course has an attached exam, show a purchase prompt.

**Tech Stack:** Next.js (frontend), Zustand cart store, FastAPI (backend — minimal changes)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/stores/cart-store.ts` | Modify | Add `attachedTo` field to CartItem |
| `frontend/src/app/courses/[slug]/page.tsx` | Modify | Fetch attached exams, add to cart with course |
| `frontend/src/app/checkout/page.tsx` | Modify | Render attached exam items nested, with remove option |
| `frontend/src/app/learn/[courseId]/page.tsx` | Modify | Show "buy exam" prompt when student skipped exam |
| `backend/app/api/v1/exams.py` | Modify | Add `price`, `is_free`, `product_id` to attached exams endpoint |
| `backend/app/api/v1/progress.py` | Modify | Return attached exam details (not just `has_exam` boolean) |

---

### Task 1: Backend — Enrich the Attached Exams Endpoint

The `GET /exams/product/{product_id}/attached` endpoint currently returns exam metadata but no pricing info. We need `price`, `is_free`, `product_id`, and `thumbnail_url` for cart integration.

**Files:**
- Modify: `backend/app/api/v1/exams.py:488-503`

- [ ] **Step 1: Add pricing fields to response**

In `get_attached_exams()` (line 488), add `price`, `is_free`, `product_id`, and `thumbnail_url` to the returned dict:

```python
    return [
        {
            "id": str(link.id),
            "exam_id": str(e.id),
            "product_id": str(e.product_id),
            "title": e.product.title,
            "title_bn": e.product.title_bn,
            "slug": e.product.slug,
            "thumbnail_url": e.product.thumbnail_url,
            "price": float(e.product.price),
            "is_free": e.product.is_free,
            "exam_type": e.exam_type,
            "total_sections": e.total_sections,
            "total_questions": e.total_questions,
            "time_limit_seconds": e.time_limit_seconds,
        }
        for link in links
        for e in exams
        if e.id == link.exam_id
    ]
```

- [ ] **Step 2: Verify endpoint works**

Run: `curl http://localhost:8001/api/v1/exams/product/<a-course-product-id>/attached`
Expected: JSON array with `price`, `is_free`, `product_id`, `thumbnail_url` fields present

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/exams.py
git commit -m "feat: add pricing fields to attached exams endpoint"
```

---

### Task 2: Backend — Return Exam Details in Progress Endpoint

The progress endpoint currently returns `has_exam: true/false`. We need the actual exam details so the learn page can show a "buy exam" prompt with price and a link.

**Files:**
- Modify: `backend/app/api/v1/progress.py:169-183`

- [ ] **Step 1: Return attached exam info instead of just a boolean**

Replace the `has_exam` logic (lines 169-183). Query the full exam data when an attachment exists:

```python
    # Check if course has attached exams
    exam_links = await db.execute(
        select(ProductExam).where(ProductExam.product_id == course.product_id)
    )
    links = exam_links.scalars().all()
    attached_exams = []
    if links:
        exam_ids = [link.exam_id for link in links]
        from sqlalchemy.orm import selectinload
        exams_result = await db.execute(
            select(Exam)
            .options(selectinload(Exam.product))
            .where(Exam.id.in_(exam_ids))
        )
        exams = exams_result.scalars().all()
        
        # Check if student has exam access for each
        for e in exams:
            ent = await db.execute(
                select(Entitlement).where(
                    or_(
                        Entitlement.child_profile_id == child_profile_id,
                        Entitlement.user_id == user.id,
                    ),
                    Entitlement.product_id == e.product_id,
                    Entitlement.is_active == True,
                )
            )
            has_access = ent.scalar_one_or_none() is not None
            # Also check course-level entitlement (ProductExam passthrough)
            if not has_access:
                course_ent = await db.execute(
                    select(Entitlement).where(
                        or_(
                            Entitlement.child_profile_id == child_profile_id,
                            Entitlement.user_id == user.id,
                        ),
                        Entitlement.product_id == course.product_id,
                        Entitlement.is_active == True,
                    )
                )
                # If they have course access, the start_exam endpoint already grants exam access
                # via ProductExam check — so mark as accessible
                has_access = course_ent.scalar_one_or_none() is not None

            attached_exams.append({
                "exam_id": str(e.id),
                "product_id": str(e.product_id),
                "title": e.product.title,
                "title_bn": e.product.title_bn,
                "slug": e.product.slug,
                "price": float(e.product.price),
                "is_free": e.product.is_free,
                "has_access": has_access,
            })

    return {
        "course": {
            ...
            "has_exam": len(attached_exams) > 0,
            "attached_exams": attached_exams,
        },
        ...
    }
```

Keep `has_exam` boolean for backward compat (the purple badge on learn page uses it). Add `attached_exams` array alongside it.

- [ ] **Step 2: Add missing imports if needed**

Ensure `Entitlement`, `or_`, `Exam`, `ProductExam`, `selectinload` are imported at the top of `progress.py`.

- [ ] **Step 3: Verify**

Test the progress endpoint with a course that has an attached exam. Confirm `attached_exams` array contains exam details with `has_access` flag.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/progress.py
git commit -m "feat: return attached exam details in progress endpoint"
```

---

### Task 3: Frontend — Extend Cart Store with `attachedTo` Field

Add an optional `attachedTo` field to `CartItem` so exam items can reference their parent course/book product.

**Files:**
- Modify: `frontend/src/stores/cart-store.ts`

- [ ] **Step 1: Add `attachedTo` to CartItem interface**

Add one optional field to the `CartItem` interface (line 14, before closing brace):

```typescript
export interface CartItem {
  productId: string;
  productType: "physical_book" | "ebook" | "course" | "exam";
  title: string;
  title_bn: string | null;
  thumbnail_url: string | null;
  price: number;
  compare_price: number | null;
  quantity: number;
  maxQuantity: number;
  slug: string;
  attachedTo?: string; // parent product ID (e.g. course) this exam is bundled with
}
```

No changes to store methods needed — `addItem`, `removeItem`, `totalPrice` all work as-is because exam items are regular cart items with a price.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/cart-store.ts
git commit -m "feat: add attachedTo field to CartItem for exam-course linking"
```

---

### Task 4: Frontend — Auto-Add Attached Exams on Course Detail Page

When a student clicks "Add to Cart" or "Enroll Now" on a paid course, fetch attached exams and add them to the cart.

**Files:**
- Modify: `frontend/src/app/courses/[slug]/page.tsx`

- [ ] **Step 1: Fetch attached exams when course loads**

After the course data loads (around line 94-106), add a second fetch for attached exams:

```typescript
const [attachedExams, setAttachedExams] = useState<any[]>([]);

useEffect(() => {
  const load = async () => {
    try {
      const data = await api.get(`/courses/slug/${slug}`);
      setCourse(data);
      // Fetch attached exams
      if (data?.product?.id) {
        try {
          const exams = await api.get(`/exams/product/${data.product.id}/attached`);
          setAttachedExams(exams || []);
        } catch {}
      }
    } catch {
      setCourse(null);
    }
  };
  load();
}, [slug]);
```

- [ ] **Step 2: Add exam to cart alongside course in "Add to Cart" handler**

In the `addItem` onClick handler (lines 323-337), after adding the course, also add any paid attached exams:

```typescript
onClick={() => {
  addItem({
    productId: course.product.id,
    productType: "course",
    title: course.product.title,
    title_bn: course.product.title_bn,
    thumbnail_url: course.product.thumbnail_url,
    price: course.product.price,
    compare_price: course.product.compare_price,
    maxQuantity: 1,
    slug: course.product.slug,
  });
  // Auto-add attached paid exams
  attachedExams.forEach((exam: any) => {
    if (!exam.is_free) {
      addItem({
        productId: exam.product_id,
        productType: "exam",
        title: exam.title,
        title_bn: exam.title_bn,
        thumbnail_url: exam.thumbnail_url,
        price: exam.price,
        compare_price: null,
        maxQuantity: 1,
        slug: exam.slug,
        attachedTo: course.product.id,
      });
    }
  });
  setCartAdded(true);
  toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"));
  setTimeout(() => setCartAdded(false), 2000);
}}
```

- [ ] **Step 3: Handle "Enroll Now" (direct checkout) with attached exams**

For the "Enroll Now" Link (lines 312-318), if there are paid attached exams, switch from direct checkout to cart-based checkout so the exam shows up:

```typescript
<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
  {!course.product.is_free && attachedExams.some((e: any) => !e.is_free) ? (
    <button
      onClick={() => {
        // Add course to cart
        addItem({
          productId: course.product.id,
          productType: "course",
          title: course.product.title,
          title_bn: course.product.title_bn,
          thumbnail_url: course.product.thumbnail_url,
          price: course.product.price,
          compare_price: course.product.compare_price,
          maxQuantity: 1,
          slug: course.product.slug,
        });
        // Add attached paid exams
        attachedExams.forEach((exam: any) => {
          if (!exam.is_free) {
            addItem({
              productId: exam.product_id,
              productType: "exam",
              title: exam.title,
              title_bn: exam.title_bn,
              thumbnail_url: exam.thumbnail_url,
              price: exam.price,
              compare_price: null,
              maxQuantity: 1,
              slug: exam.slug,
              attachedTo: course.product.id,
            });
          }
        });
        router.push("/checkout?source=cart");
      }}
      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 font-bn text-base"
    >
      {t("এখনই ভর্তি হও", "Enroll Now")}
    </button>
  ) : (
    <Link
      href={course.product.is_free
        ? `/checkout?product=${course.product.id}`
        : `/checkout?product=${course.product.id}`}
      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 font-bn text-base"
    >
      {course.product.is_free ? t("ফ্রি ভর্তি হও", "Enroll Free") : t("এখনই ভর্তি হও", "Enroll Now")}
    </Link>
  )}
</motion.div>
```

For **free courses** with attached free exams: the direct `/checkout?product=` flow works fine — the student gets course_access entitlement, and `start_exam` already grants access via ProductExam check. No cart needed.

- [ ] **Step 4: Show "Includes Exam" in the includes list**

In the includes list (lines 350-356), conditionally add an exam line:

```typescript
{[
  t(`${course.total_lessons} টি রেকর্ডেড ক্লাস`, `${course.total_lessons} Recorded Classes`),
  t("২৪/৭ লাইফটাইম অ্যাক্সেস", "Lifetime Access 24/7"),
  t("কুইজ ও অনুশীলন সামগ্রী", "Quizzes & Practice Materials"),
  t("প্রফেশনাল সার্টিফিকেশন", "Professional Certification"),
  ...(attachedExams.length > 0 ? [t("পরীক্ষা অন্তর্ভুক্ত", "Includes Exam")] : []),
].map((item) => (
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/courses/[slug]/page.tsx
git commit -m "feat: auto-add attached exams to cart from course detail page"
```

---

### Task 5: Frontend — Render Attached Exams in Checkout with Remove Option

Show exam items nested under their parent course in the checkout order summary, with a remove button.

**Files:**
- Modify: `frontend/src/app/checkout/page.tsx`

- [ ] **Step 1: Add exam type badge**

In the `typeBadge` logic (lines 536-540), add the exam case:

```typescript
const typeBadge = item.productType === "course"
  ? { label: t("কোর্স", "Course"), color: "bg-blue-100 text-blue-700" }
  : item.productType === "ebook"
    ? { label: t("ই-বুক", "Ebook"), color: "bg-amber-100 text-amber-700" }
    : item.productType === "exam"
      ? { label: t("পরীক্ষা", "Exam"), color: "bg-purple-100 text-purple-700" }
      : { label: t("প্রোডাক্ট", "Product"), color: "bg-violet-100 text-violet-700" };
```

- [ ] **Step 2: Group and render attached exams under parent**

Replace the flat `cartItems.map(...)` block (lines 534-583) to group attached items visually. The key change: render attached exam items indented under their parent course, with a simplified layout (no quantity controls, just a remove button):

```typescript
{isCartCheckout ? (
  cartItems.filter((item) => !item.attachedTo).map((item) => {
    const typeBadge = item.productType === "course"
      ? { label: t("কোর্স", "Course"), color: "bg-blue-100 text-blue-700" }
      : item.productType === "ebook"
        ? { label: t("ই-বুক", "Ebook"), color: "bg-amber-100 text-amber-700" }
        : item.productType === "exam"
          ? { label: t("পরীক্ষা", "Exam"), color: "bg-purple-100 text-purple-700" }
          : { label: t("প্রোডাক্ট", "Product"), color: "bg-violet-100 text-violet-700" };
    // Find attached exams for this product
    const attachedItems = cartItems.filter((ai) => ai.attachedTo === item.productId);
    return (
      <div key={item.productId}>
        {/* Parent product (existing rendering — keep as-is) */}
        <div className="flex gap-3 p-2.5 rounded-xl bg-gray-50/70">
          {/* ... existing item rendering unchanged ... */}
        </div>

        {/* Attached exam items */}
        {attachedItems.map((ai) => (
          <div key={ai.productId} className="flex gap-3 p-2 ml-6 mt-1 rounded-lg bg-purple-50/50 border border-purple-100/50">
            <div className="w-8 h-8 rounded-md bg-purple-100 shrink-0 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                  {t("পরীক্ষা", "Exam")}
                </span>
              </div>
              <p className="text-xs font-bold text-gray-800 font-bn line-clamp-1">
                {t(ai.title_bn || ai.title, ai.title)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p className="text-xs font-bold text-gray-900">৳{ai.price}</p>
              <button type="button" onClick={() => cartStore.removeItem(ai.productId)}
                className="p-1 hover:bg-red-50 rounded-md transition-colors">
                <X className="w-3 h-3 text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  })
) : product ? (
```

- [ ] **Step 3: Import GraduationCap icon**

Add `GraduationCap` to the lucide-react imports at the top of checkout page.

- [ ] **Step 4: Verify in browser**

1. Add a course with an attached exam to cart
2. Go to checkout
3. Confirm exam appears nested under the course with purple styling
4. Confirm remove (✕) button removes only the exam, not the course
5. Confirm total recalculates correctly after removal

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/checkout/page.tsx
git commit -m "feat: render attached exams in checkout with remove option"
```

---

### Task 6: Frontend — "Buy Exam" Prompt on Learn Page

When a student is enrolled in a course that has an attached exam, but they don't have exam access (they removed it at checkout), show a prompt to purchase.

**Files:**
- Modify: `frontend/src/app/learn/[courseId]/page.tsx`

- [ ] **Step 1: Add exam purchase prompt below the curriculum accordion**

After the accordion (line 859, before closing `</div>`), add the exam prompt. The data comes from `courseData.course.attached_exams` (added in Task 2):

```typescript
{/* Exam Purchase Prompt */}
{courseData.course.attached_exams?.filter((e: any) => !e.has_access).map((exam: any) => (
  <div key={exam.exam_id} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-4 mt-4">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
        <GraduationCap className="w-5 h-5 text-purple-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-900 font-bn text-sm">
          {exam.title_bn || exam.title}
        </h4>
        <p className="text-xs text-gray-500 font-bn mt-0.5">
          এই কোর্সের সাথে একটি পরীক্ষা সংযুক্ত আছে
        </p>
        <div className="flex items-center gap-3 mt-3">
          {exam.is_free ? (
            <Link
              href={`/exams/${exam.slug}`}
              className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors font-bn"
            >
              ফ্রি পরীক্ষা দাও
            </Link>
          ) : (
            <Link
              href={`/exams/${exam.slug}`}
              className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors font-bn"
            >
              পরীক্ষা কিনো — ৳{exam.price}
            </Link>
          )}
        </div>
      </div>
    </div>
  </div>
))}
```

- [ ] **Step 2: Don't show prompt for exams the student already has access to**

The `has_access` check in the filter (`!e.has_access`) handles this. If the student bought the exam or got access through any entitlement, `has_access` will be `true` from the backend (Task 2), and the prompt won't render.

- [ ] **Step 3: Verify in browser**

Test scenarios:
1. Student enrolled in course WITH exam access → no prompt shown
2. Student enrolled in course WITHOUT exam access → purple prompt shown with price and link
3. Click "পরীক্ষা কিনো" → navigates to exam detail page where they can purchase

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/learn/[courseId]/page.tsx
git commit -m "feat: show exam purchase prompt on learn page for skipped exams"
```

---

## Summary of Changes

| Layer | What Changes | Why |
|-------|-------------|-----|
| **Backend: exams.py** | Add price/product_id to attached exams response | Cart needs pricing info |
| **Backend: progress.py** | Return `attached_exams` array with `has_access` per exam | Learn page needs to know if student should see buy prompt |
| **Frontend: cart-store.ts** | Add `attachedTo` optional field | Links exam cart items to their parent product |
| **Frontend: courses/[slug]** | Fetch + auto-add attached exams to cart | Core feature — exam appears at checkout |
| **Frontend: checkout** | Group attached exams under parent, removable | Student can opt out of exam purchase |
| **Frontend: learn/[courseId]** | Show "buy exam" prompt for skipped exams | Recovery path — student can buy later |
