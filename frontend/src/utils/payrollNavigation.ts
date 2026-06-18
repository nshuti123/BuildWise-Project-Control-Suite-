const PAYROLL_APPROVALS_FOCUS_KEY = "bw_payroll_approvals_focus";

export type PayrollApprovalsFocus = {
  payrollId?: number;
  tab?: "pending" | "history";
};

export function openPayrollApprovalsFocus(focus: PayrollApprovalsFocus) {
  sessionStorage.setItem(PAYROLL_APPROVALS_FOCUS_KEY, JSON.stringify(focus));
}

export function consumePayrollApprovalsFocus(): PayrollApprovalsFocus | null {
  const raw = sessionStorage.getItem(PAYROLL_APPROVALS_FOCUS_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PAYROLL_APPROVALS_FOCUS_KEY);
  try {
    return JSON.parse(raw) as PayrollApprovalsFocus;
  } catch {
    return null;
  }
}

export function parsePayrollIdFromNotification(
  title: string,
  message: string,
  link?: string | null,
): number | null {
  if (link) {
    const fromLink = link.match(/[?&]payroll=(\d+)/i);
    if (fromLink) return Number(fromLink[1]);
  }
  const text = `${title} ${message}`;
  const fromText = text.match(/payroll\s*#(\d+)/i);
  if (fromText) return Number(fromText[1]);
  return null;
}

export function isPayrollNotification(
  title: string,
  message: string,
  link?: string | null,
): boolean {
  const text = `${title} ${message} ${link ?? ""}`.toLowerCase();
  return (
    text.includes("payroll") ||
    (link?.toLowerCase().startsWith("payrolls") ?? false)
  );
}

export function payrollNotificationTab(
  title: string,
  message: string,
  userRole: string,
): "pending" | "history" {
  const text = `${title} ${message}`.toLowerCase();
  if (text.includes("reject")) {
    return "history";
  }
  if (
    text.includes("payment request") ||
    text.includes("submitted for finance") ||
    text.includes("awaiting finance")
  ) {
    return "pending";
  }
  if (text.includes("approved") && userRole === "site-foreman") {
    return "history";
  }
  return "pending";
}
