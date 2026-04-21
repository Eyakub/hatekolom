export type RevenuePoint = { date: string; amount: string };

/**
 * Gap-fills a sparse daily revenue series so every calendar day in the
 * requested window is represented (zero amount for quiet days). The API
 * only returns days that had successful payments, which makes raw sparklines
 * and "vs yesterday" comparisons misleading.
 */
export function fillMissingDays(data: RevenuePoint[], days: number): RevenuePoint[] {
  const map = new Map(data.map((p) => [p.date, p.amount]));
  const out: RevenuePoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, amount: map.get(key) || "0" });
  }
  return out;
}
