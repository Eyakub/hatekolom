# Guest Checkout & Fraud Prevention for Physical Items

**Date:** 2026-04-12
**Status:** Approved

## Problem

The current system requires login (phone + OTP) for all purchases. For digital products (courses, ebooks, exams) this is necessary — entitlements are tied to user accounts. But for physical books/items, this registration wall kills conversion. Bangladeshi customers want to order fast — name, phone, address, done.

At the same time, guest COD orders are vulnerable to:
1. **Bots/spam** placing bulk fake orders to manipulate stock
2. **Fake contact info** — undeliverable orders waste admin time and shipping cost
3. **COD refusals** — less frequent but still a cost

**Solution:** Allow guest checkout for physical-only orders with a backend risk scoring system that flags suspicious orders for admin review. Zero friction for the buyer, full visibility for the admin.

---

## 1. Guest Order Endpoint

### `POST /orders/guest` (no auth required)

**Request body:**
```json
{
  "phone": "01XXXXXXXXX",
  "name": "Customer Name",
  "address": "Full delivery address",
  "area": "Optional area",
  "city": "Dhaka",
  "zone": "inside_dhaka | outside_dhaka",
  "postal": "1200",
  "notes": "Optional notes",
  "items": [{ "product_id": "uuid", "quantity": 1 }],
  "payment_method": "cod | bkash | nagad | card | bank",
  "device_fingerprint": { ... },
  "ip_info": { "is_vpn": false, "country": "BD", "ip": "x.x.x.x" }
}
```

**Constraints:**
- Only `product_type = "physical_book"` items allowed
- No coupons for guest orders
- Max cart value cap (configurable, default 5000 BDT)
- All payment methods available (COD, bKash, Nagad, Card, Bank)

**Backend behavior:**
1. Validate items are physical, active, and in stock
2. Use prefetched `ip_info` from frontend (re-validate IP against request headers; if mismatch, do live ip-api.com call)
3. Run `FraudService.score_order()` — compute score and flags
4. Look up phone in `users` table — if found, attach `user_id` to order; if not, `user_id = NULL`
5. Create Order (`is_guest=True`, `fraud_score`, `fraud_flags`, `ip_address`, `device_fingerprint`)
6. Create OrderItems, deduct stock
7. Create Payment record
   - COD: `status=initiated`, order stays `pending`
   - Online (bKash/Nagad/Card/Bank): call SSLCommerz, return `gateway_url`
8. Create Shipment (`status=pending`)
9. Return order confirmation with `order_number` (and `gateway_url` if online payment)

**Phone-to-user linking:**
- If the phone matches an existing user, the order is linked via `user_id` — the user sees it in their dashboard when they log in
- If no match, `user_id = NULL` (true guest order)
- No retroactive linking for orders placed before registration in v1

### `GET /orders/ip-check` (no auth required)

Called when guest checkout form loads. Prefetches IP data so order submission is instant.

- Reads client IP from request headers
- Calls `http://ip-api.com/json/{ip}?fields=proxy,hosting,country`
- Caches results per IP for 1 hour
- Returns: `{ is_vpn: bool, country: string, ip: string }`
- Rate limited: max 30 requests per IP per hour

---

## 2. Fraud Scoring Engine

### FraudConfig Model

Single-row settings table with configurable thresholds. Managed by superadmin via admin panel.

```
Table: "fraud_config"

Rate Limits:
- phone_rate_window_hours      (Integer, default=24)
- phone_rate_max_orders         (Integer, default=2)
- phone_rate_score              (Integer, default=30)
- ip_rate_window_hours          (Integer, default=24)
- ip_rate_max_orders            (Integer, default=3)
- ip_rate_score                 (Integer, default=25)
- fingerprint_rate_window_hours (Integer, default=24)
- fingerprint_rate_max_orders   (Integer, default=3)
- fingerprint_rate_score        (Integer, default=25)

Address & Quantity:
- min_address_length            (Integer, default=15)
- address_quality_score         (Integer, default=15)
- max_single_item_qty           (Integer, default=5)
- max_total_items               (Integer, default=10)
- quantity_spike_score           (Integer, default=20)

Fixed Scores:
- phone_format_score            (Integer, default=40)
- vpn_proxy_score               (Integer, default=30)
- blacklist_score               (Integer, default=35)
- prepaid_discount_score        (Integer, default=-20)

Risk Thresholds:
- medium_risk_threshold         (Integer, default=30)
- high_risk_threshold           (Integer, default=60)

Guest Order Limits:
- max_cart_value                (Integer, default=5000)

Meta:
- updated_at                    (DateTime)
- updated_by                    (UUID, FK to users)
```

### FraudService.score_order()

`score_order(phone, ip_info, fingerprint, items, payment_method, db) -> { score, flags, risk_level }`

Loads FraudConfig (cached with short TTL), runs all checks, sums score, returns result.

**Scoring factors:**

| Factor | Check | Points (from config) |
|---|---|---|
| Phone rate limit | Same phone >= `phone_rate_max_orders` in `phone_rate_window_hours` | `phone_rate_score` |
| IP rate limit | Same IP >= `ip_rate_max_orders` in `ip_rate_window_hours` | `ip_rate_score` |
| Device fingerprint | Same fingerprint >= `fingerprint_rate_max_orders` in window | `fingerprint_rate_score` |
| Phone blacklist | Phone has past cancelled/returned orders | `blacklist_score` |
| Address quality | Address length < `min_address_length` or missing area | `address_quality_score` |
| Quantity spike | Single qty > `max_single_item_qty` or total > `max_total_items` | `quantity_spike_score` |
| Phone format | Doesn't match BD mobile pattern `01[3-9]\d{8}` | `phone_format_score` |
| VPN/Proxy | ip-api detected proxy, VPN, or datacenter IP | `vpn_proxy_score` |
| Prepaid payment | Payment method is bKash/Nagad/Card/Bank (not COD) | `prepaid_discount_score` (-20) |

**Risk levels:**
- 0 to `medium_risk_threshold - 1` -> **low** (green)
- `medium_risk_threshold` to `high_risk_threshold - 1` -> **medium** (yellow)
- `high_risk_threshold`+ -> **high** (red)

**Phone blacklist** is derived dynamically — query orders where `shipping_phone = phone` and shipment status is `returned` or order status is `cancelled`. No separate blacklist table.

---

## 3. Frontend Guest Checkout Flow

### Routing logic on `/checkout` page:

- **Not authenticated + cart is all physical items** -> show guest checkout form
- **Not authenticated + cart has any digital items** -> redirect to `/login?redirect=/checkout` (existing behavior)
- **Authenticated** -> existing checkout flow, unchanged

### Guest checkout form:

Fields (bilingual labels):
- নাম / Name (required)
- ফোন / Phone (required, BD format client-side validation)
- ঠিকানা / Address (required, textarea)
- এলাকা / Area (optional)
- শহর / City (default "ঢাকা / Dhaka")
- জোন / Zone (inside/outside Dhaka — radio buttons, drives shipping fee)
- পোস্টাল কোড / Postal (optional)
- নোট / Notes (optional)
- Payment method selector (COD, bKash, Nagad, Card, Bank)

**No** password, OTP, account creation prompt, or coupon field.

### Device fingerprint:

Collected silently on page load. Lightweight client-side computation:
- Canvas fingerprint + screen resolution + timezone + user agent
- Hashed together into a string
- No external library needed

### IP check prefetch:

On guest form render, call `GET /orders/ip-check`. Store result in component state. Pass as `ip_info` on order submission.

### After submission:

- **COD:** Show confirmation page — "আপনার অর্ডার নিশ্চিত হয়েছে। ORD-XXXXXXXX"
- **Online payment:** Redirect to `gateway_url` (SSLCommerz). On return, show success/fail page.
- Cart cleared after success
- No login nudge, no "create account" prompt

---

## 4. Admin Panel

### Order List View (existing, enhanced):

- New **risk badge column** — green (low), yellow (medium), red (high)
- New **"Guest" tag** next to customer name for guest orders
- Filterable by risk level
- Sortable by fraud score

### Order Detail View (existing, enhanced):

New **Fraud section** showing:
- Score (e.g., "65/100")
- Risk level badge
- List of triggered flags with descriptions (e.g., "Same phone placed 3 orders in 24h", "VPN detected")
- IP address and VPN/proxy status
- Device fingerprint hash

### Fraud Config Page (new, superadmin only):

- Grouped sections: Rate Limits, Address & Quantity, Scoring Points, Risk Thresholds, Guest Order Limits
- Each field: label + current value + input
- Single save button -> `PATCH /admin/fraud-config`
- "Last updated by [name] at [date]" footer

### Fraud Dashboard Page (new):

**Summary cards (top row):**
- Total orders today / this week / this month
- Guest vs authenticated order split
- Orders flagged medium / high risk (count + percentage)
- Cancelled/returned order rate

**Charts:**
- Risk distribution — donut chart: low / medium / high over selected period
- Daily trend line — orders per day with stacked colors for risk levels
- Top triggered flags — bar chart showing which fraud flags fire most often

**Repeat offenders table:**
- Phones with 3+ cancelled/returned orders
- Columns: phone, total orders, cancelled count, returned count, last order date
- Click to view all orders from that phone

**Time period selector:** Today / Last 7 days / Last 30 days / Custom range

Data sourced from existing Order + Shipment tables. No new tracking tables needed.

---

## 5. Backend Architecture

### New files:

| What | Location |
|---|---|
| FraudConfig model | `backend/app/models/fraud.py` |
| FraudService | `backend/app/services/fraud_service.py` |
| Fraud schemas | `backend/app/schemas/fraud.py` |
| IP check utility | `backend/app/utils/ip_check.py` |
| Fingerprint utility | `backend/app/utils/fingerprint.py` |
| Guest order endpoint | `backend/app/api/v1/orders.py` (new route) |
| Fraud admin endpoints | `backend/app/api/v1/admin.py` (new routes) |

### Changes to existing files:

**Order model** — changes:
- `user_id` — change from `nullable=False` to `nullable=True` (required for guest orders with no matching user)
- New columns:
  - `fraud_score` (Integer, nullable)
  - `fraud_flags` (JSONB, nullable)
  - `ip_address` (String(45), nullable)
  - `device_fingerprint` (JSONB, nullable)
  - `is_guest` (Boolean, default=False)

**Order schemas** — add fraud fields to admin-facing response schemas

**Payment service** — handle `user_id = NULL` for guest orders in SSLCommerz callbacks

**Checkout page (frontend)** — conditional guest form

**Admin orders page (frontend)** — risk badges, filters, fraud detail section

**Admin sidebar (frontend)** — new Fraud Config and Fraud Dashboard links

### Request flow for `POST /orders/guest`:

```
1. Validate request (phone format, items physical & active, stock, cart value cap)
2. Use prefetched ip_info (or fallback to live ip-api.com call if IP mismatch)
3. FraudService.score_order(phone, ip_info, fingerprint, items, payment_method, db)
   - Load FraudConfig (cached)
   - Run all checks, sum score, collect flags
4. Look up phone in users table -> attach user_id if found
5. Create Order (is_guest=True, fraud_score, fraud_flags, payment_method)
6. Create OrderItems, deduct stock
7. Create Payment
   - COD: status=initiated
   - Online: call SSLCommerz, get gateway_url
8. Create Shipment (status=pending)
9. Return order confirmation (+ gateway_url if online)
```

### ip-api.com integration:

- Endpoint: `GET http://ip-api.com/json/{ip}?fields=proxy,hosting,country`
- 2-second timeout — if fails, skip VPN check, don't block order
- Cache per IP for 1 hour (in-memory dict or Redis)
- Free tier: 45 requests/minute — sufficient for 20-100 orders/day
- Rate limit on `/orders/ip-check`: 30 requests per IP per hour

---

## 6. Security

**Rate limiting:**
- `POST /orders/guest`: max 10 requests per IP per hour (429 if exceeded)
- `GET /orders/ip-check`: max 30 requests per IP per hour
- Separate from fraud scoring — this is hard blocking, not just tagging

**IP re-validation:**
- Frontend sends `ip_info`, but backend compares `ip_info.ip` against actual request IP from headers
- If mismatch, discard frontend data and do live ip-api.com call
- Prevents someone from sending `{ is_vpn: false }` manually

**Fraud data integrity:**
- `fraud_score` and `fraud_flags` are never accepted from client — always computed server-side
- `device_fingerprint` can be spoofed but is one factor among many

**Stock protection:**
- Stock deducted immediately on order creation
- If admin cancels a flagged order, stock is restored
- Prevents bots from locking up inventory

**Guest order limitations:**
- Physical books only
- No coupons
- Max cart value cap (configurable, default 5000 BDT)
- All payment methods available (COD + online)

**Existing flows unchanged:**
- Authenticated order flow (`POST /orders/`) — no changes
- Course/ebook/exam purchases — still require login
- Payment callbacks — minor update to handle `user_id = NULL`
- Entitlement service — not involved (physical items only)
- Shipping service — no changes
