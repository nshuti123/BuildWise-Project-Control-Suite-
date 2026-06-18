const REVIEW_KEY = "bw_workforce_review";

export function openWorkforcePayrollReview(date: string) {
  sessionStorage.setItem(
    REVIEW_KEY,
    JSON.stringify({ tab: "attendance", date }),
  );
}

export function consumeWorkforcePayrollReview(): {
  tab?: "attendance" | "directory";
  date?: string;
} | null {
  const raw = sessionStorage.getItem(REVIEW_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(REVIEW_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
