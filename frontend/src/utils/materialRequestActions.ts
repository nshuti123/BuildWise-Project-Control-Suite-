import api from "../api";

export const CANCELLABLE_REQUISITION_STATUSES = new Set([
  "pending",
  "po_approved",
  "rejected",
]);

export function canCancelMaterialRequest(status: string): boolean {
  return CANCELLABLE_REQUISITION_STATUSES.has(status);
}

export function materialRequestBadgeClass(status: string): string {
  const base =
    "px-3 py-1 text-xs font-bold uppercase rounded-full tracking-wider border shrink-0 ";
  if (status === "pending") return base + "bg-slate-50 text-slate-600 border-slate-200";
  if (status === "po_approved") return base + "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "approved") return base + "bg-blue-50 text-blue-600 border-blue-200";
  if (status === "ordered") return base + "bg-indigo-50 text-indigo-600 border-indigo-200";
  if (status === "fulfilled") return base + "bg-green-50 text-green-700 border-green-200";
  if (status === "cancelled") return base + "bg-slate-100 text-slate-600 border-slate-300";
  if (status === "rejected") return base + "bg-red-50 text-red-600 border-red-200";
  return base + "bg-slate-50 text-slate-600 border-slate-200";
}

export function materialRequestStatusClass(status: string): string {
  if (status === "pending") return "bg-slate-100 text-slate-500";
  if (status === "po_approved") return "bg-amber-100 text-amber-800";
  if (status === "approved") return "bg-blue-100 text-blue-600";
  if (status === "ordered") return "bg-indigo-100 text-indigo-600";
  if (status === "fulfilled") return "bg-green-100 text-green-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-600";
  return "bg-red-100 text-red-600";
}

export function materialRequestStatusLabel(
  status: string,
  req?: { requested_by_role?: string; site_engineer_confirmed_at?: string | null },
): string {
  if (status === "po_approved") return "Awaiting confirmation";
  if (status === "pending") {
    if (
      req?.requested_by_role === "site-foreman" &&
      !req?.site_engineer_confirmed_at
    ) {
      return "Awaiting Site Engineer";
    }
    if (req?.site_engineer_confirmed_at) {
      return "Awaiting Procurement";
    }
    return "Pending";
  }
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";
  return status.replace(/_/g, " ");
}

export async function cancelMaterialRequest(requestId: number): Promise<void> {
  await api.post(`/procurement/requests/${requestId}/cancel/`);
}
