// First-touch UTM attribution, kept only in this browser tab's session.
const KEY = "ss_attribution";
export type Attribution = Partial<Record<"utm_source"|"utm_medium"|"utm_campaign"|"utm_term"|"utm_content"|"referrer"|"landing_page", string>>;
export function captureAttribution() {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    const a: Attribution = {};
    for (const k of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"] as const) {
      const v = p.get(k); if (v) a[k] = v.slice(0, 200);
    }
    const existing = sessionStorage.getItem(KEY);
    if (Object.keys(a).length === 0 && existing) return;
    if (Object.keys(a).length === 0) {
      const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : "";
      if (!ref) return;
      a.utm_source = new URL(ref).hostname; a.utm_medium = "referral";
    }
    a.referrer = (document.referrer || "").slice(0, 300);
    a.landing_page = (window.location.pathname + window.location.search).slice(0, 300);
    sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch { /* ignore */ }
}
export function readAttribution(): Attribution {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
