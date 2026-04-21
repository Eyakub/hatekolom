/**
 * Human-readable labels and descriptions for every fraud flag the backend
 * can emit. Flag strings come in two forms from `fraud_service.py`:
 *   - bare:    "vpn_proxy_detected"
 *   - suffixed: "ip_rate_limit:3_orders_in_24h"
 * The `top_flags` endpoint already strips suffixes (splits on `:`), so we
 * only need to match by prefix here.
 */

export type FlagInfo = {
  label: { en: string; bn: string };
  description: { en: string; bn: string };
  severity: "info" | "warning" | "critical";
};

export const FLAG_LABELS: Record<string, FlagInfo> = {
  invalid_phone_format: {
    label: { en: "Invalid phone format", bn: "ভুল ফোন ফরম্যাট" },
    description: {
      en: "Phone number doesn't match the Bangladesh pattern (01[3–9]XXXXXXXX).",
      bn: "ফোন নাম্বার বাংলাদেশি ফরম্যাটের সাথে মেলেনি (01[3–9]XXXXXXXX)।",
    },
    severity: "warning",
  },
  phone_rate_limit: {
    label: { en: "Phone rate limit", bn: "ফোন রেট লিমিট" },
    description: {
      en: "The same phone number placed multiple orders within the configured time window.",
      bn: "একই ফোন থেকে অল্প সময়ের মধ্যে একাধিক অর্ডার এসেছে।",
    },
    severity: "warning",
  },
  ip_rate_limit: {
    label: { en: "IP rate limit", bn: "IP রেট লিমিট" },
    description: {
      en: "Multiple orders placed from the same IP address within the rate window.",
      bn: "একই IP থেকে অল্প সময়ের মধ্যে একাধিক অর্ডার এসেছে।",
    },
    severity: "warning",
  },
  fingerprint_rate_limit: {
    label: { en: "Device rate limit", bn: "ডিভাইস রেট লিমিট" },
    description: {
      en: "Multiple orders placed from the same device fingerprint within the rate window.",
      bn: "একই ডিভাইস থেকে অল্প সময়ের মধ্যে একাধিক অর্ডার এসেছে।",
    },
    severity: "warning",
  },
  vpn_proxy_detected: {
    label: { en: "VPN or proxy", bn: "VPN / প্রক্সি" },
    description: {
      en: "The request IP is flagged as a VPN, proxy, or hosting provider — real location hidden.",
      bn: "এই IP ভিপিএন/প্রক্সি হিসেবে চিহ্নিত — আসল অবস্থান লুকানো।",
    },
    severity: "critical",
  },
  phone_blacklisted: {
    label: { en: "Phone blacklisted", bn: "ফোন ব্ল্যাকলিস্টেড" },
    description: {
      en: "This phone has a history of cancelled or returned orders above the blacklist threshold.",
      bn: "এই ফোন থেকে অতীতে বাতিল/রিটার্ন অর্ডারের ইতিহাস আছে।",
    },
    severity: "critical",
  },
  quantity_spike: {
    label: { en: "Quantity spike", bn: "পরিমাণ স্পাইক" },
    description: {
      en: "Order quantity exceeds the per-item or total-items cap configured in fraud settings.",
      bn: "অর্ডারের পরিমাণ সীমার চেয়ে বেশি।",
    },
    severity: "warning",
  },
  prepaid_payment_discount: {
    label: { en: "Prepaid payment", bn: "প্রিপেইড পেমেন্ট" },
    description: {
      en: "Paid via bKash / Nagad / card / bank — typically a positive trust signal; shown here for transparency.",
      bn: "বিকাশ / নগদ / কার্ড / ব্যাংক — সাধারণত পজিটিভ সিগন্যাল; স্বচ্ছতার জন্য দেখানো হচ্ছে।",
    },
    severity: "info",
  },
  address_quality: {
    label: { en: "Weak address", bn: "দুর্বল ঠিকানা" },
    description: {
      en: "Shipping address is too short or missing area info — higher chance of failed delivery.",
      bn: "শিপিং ঠিকানা খুব সংক্ষিপ্ত বা এলাকা নেই — ডেলিভারি ব্যর্থতার ঝুঁকি বেশি।",
    },
    severity: "warning",
  },
};

const UNKNOWN: FlagInfo = {
  label: { en: "Unknown flag", bn: "অজানা ফ্ল্যাগ" },
  description: {
    en: "This flag isn't yet documented in the admin UI. It may be a new rule — check the fraud service.",
    bn: "এই ফ্ল্যাগটি এখনো ডকুমেন্টেড নয়।",
  },
  severity: "info",
};

export function getFlagInfo(flag: string): FlagInfo {
  const base = flag.split(":")[0];
  return FLAG_LABELS[base] || UNKNOWN;
}

export const SEVERITY_STYLE: Record<FlagInfo["severity"], { bg: string; fg: string; dot: string }> = {
  info:     { bg: "bg-blue-50",  fg: "text-blue-700",   dot: "bg-blue-500" },
  warning:  { bg: "bg-amber-50", fg: "text-amber-800",  dot: "bg-amber-500" },
  critical: { bg: "bg-rose-50",  fg: "text-rose-700",   dot: "bg-rose-500" },
};
