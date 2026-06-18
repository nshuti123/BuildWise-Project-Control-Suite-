import { useState, useEffect, useCallback } from "react";
import { Package, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import {
  canCancelMaterialRequest,
  cancelMaterialRequest,
  materialRequestStatusLabel,
} from "../utils/materialRequestActions";

interface MaterialRequest {
  id: number;
  material_name: string;
  material_unit: string;
  quantity_requested: string | number;
  status: string;
  project_name?: string;
  requested_by_name?: string;
  requested_by_role?: string;
  site_engineer_confirmed_at?: string | null;
  site_engineer_confirmed_by_name?: string | null;
  notes?: string;
  rejection_notes?: string;
  approval_notes?: string;
  reviewed_by_name?: string;
  created_at?: string;
}

interface MaterialRequisitionsPanelProps {
  projectId?: number | null;
  compact?: boolean;
  className?: string;
  onUpdated?: () => void;
}

const APPROVER_ROLES = new Set([
  "project-manager",
  "procurement-officer",
  "technical-director",
  "admin",
  "managing-director",
  "site-engineer",
]);

function isForemanAwaitingSe(req: MaterialRequest): boolean {
  return (
    req.status === "pending" &&
    req.requested_by_role === "site-foreman" &&
    !req.site_engineer_confirmed_at
  );
}

function isAwaitingProcurement(req: MaterialRequest): boolean {
  return (
    req.status === "pending" &&
    (req.requested_by_role !== "site-foreman" || !!req.site_engineer_confirmed_at)
  );
}

export function MaterialRequisitionsPanel({
  projectId = null,
  compact = false,
  className = "",
  onUpdated,
}: MaterialRequisitionsPanelProps) {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const canAct = APPROVER_ROLES.has(role);
  const isPO = role === "procurement-officer";
  const isPM = role === "project-manager";
  const isSE = role === "site-engineer";
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MaterialRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [approveTarget, setApproveTarget] = useState<MaterialRequest | null>(null);
  const [approveNotes, setApproveNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = projectId
        ? `/procurement/requests/?project=${projectId}&page_size=100`
        : "/procurement/requests/?page_size=100";
      const res = await api.get(url);
      const list = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setRequests(list);
    } catch (e) {
      console.error("Failed to load material requests", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitApprove = async () => {
    if (!approveTarget) return;
    const seConfirm = isSE && isForemanAwaitingSe(approveTarget);
    if (!seConfirm && !approveNotes.trim()) {
      alert("Please add a note when approving this requisition.");
      return;
    }
    setActingId(approveTarget.id);
    try {
      await api.patch(`/procurement/requests/${approveTarget.id}/approve/`, {
        status: "approved",
        notes: approveNotes.trim(),
      });
      setApproveTarget(null);
      setApproveNotes("");
      await load();
      onUpdated?.();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to approve request.");
    } finally {
      setActingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!rejectNotes.trim()) {
      alert("Please add a comment explaining why this requisition is being rejected.");
      return;
    }
    setActingId(rejectTarget.id);
    try {
      await api.patch(`/procurement/requests/${rejectTarget.id}/approve/`, {
        status: "rejected",
        notes: rejectNotes.trim(),
      });
      setRejectTarget(null);
      setRejectNotes("");
      await load();
      onUpdated?.();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to reject request.");
    } finally {
      setActingId(null);
    }
  };

  const awaitingAction = requests.filter(
    (r) => r.status === "pending" || r.status === "po_approved",
  );
  const recentlyApproved = requests.filter((r) => r.status === "approved").slice(0, 8);

  const canSeConfirm = (req: MaterialRequest) =>
    isSE && isForemanAwaitingSe(req);

  const canPoApprove = (req: MaterialRequest) =>
    isPO && isAwaitingProcurement(req);

  const canPmApprovePending = (req: MaterialRequest) =>
    req.status === "pending" &&
    (isPM ||
      role === "technical-director" ||
      role === "admin" ||
      role === "managing-director");

  const canConfirmPoApproved = (req: MaterialRequest) =>
    req.status === "po_approved" &&
    (isPM ||
      role === "technical-director" ||
      role === "admin" ||
      role === "managing-director");

  const canApprovePending = (req: MaterialRequest) =>
    canSeConfirm(req) || canPoApprove(req) || canPmApprovePending(req);

  const canReject = (req: MaterialRequest) =>
    canSeConfirm(req) ||
    canPoApprove(req) ||
    canPmApprovePending(req) ||
    canConfirmPoApproved(req);

  const canCancel = (req: MaterialRequest) =>
    canAct && canCancelMaterialRequest(req.status);

  const handleCancel = async (requestId: number) => {
    if (!window.confirm("Cancel this material requisition?")) return;
    setActingId(requestId);
    try {
      await cancelMaterialRequest(requestId);
      await load();
      onUpdated?.();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to cancel request.");
    } finally {
      setActingId(null);
    }
  };

  const pendingCount = awaitingAction.length;

  const approveButtonLabel = (req: MaterialRequest) => {
    if (req.status === "po_approved") return "Confirm";
    if (canSeConfirm(req)) return "Confirm";
    if (isPO) return "Approve";
    return "Approve";
  };

  const panelSubtitle = () => {
    if (isSE) {
      return "Confirm foreman requisitions before they go to Procurement.";
    }
    if (isPO || isPM) {
      return "Approve or reject with a required note. Foreman requests need Site Engineer confirmation first.";
    }
    return "Review site requests from engineers and foremen.";
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${
        pendingCount > 0 ? "border-amber-300 ring-1 ring-amber-200" : ""
      } ${className}`}
    >
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle
            className={pendingCount > 0 ? "text-amber-600" : "text-slate-400"}
            size={22}
          />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Field material requisitions</h2>
            <p className="text-xs text-slate-500">{panelSubtitle()}</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="text-xs font-bold uppercase tracking-wide text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
            {pendingCount} awaiting action
          </span>
        )}
      </div>

      <div className={compact ? "p-3" : "p-4"}>
        {loading ? (
          <p className="text-center text-slate-500 py-6 text-sm">Loading requisitions…</p>
        ) : awaitingAction.length === 0 && recentlyApproved.length === 0 ? (
          <p className="text-center text-slate-500 py-6 text-sm">
            No field requisitions need action right now.
          </p>
        ) : (
          <div className="space-y-6">
            {awaitingAction.length > 0 && (
              <div className="space-y-3">
                {awaitingAction.map((req) => (
                  <RequisitionRow
                    key={req.id}
                    req={req}
                    actingId={actingId}
                    statusLabel={materialRequestStatusLabel(req.status, req)}
                    onApprove={() => {
                      setApproveTarget(req);
                      setApproveNotes("");
                    }}
                    onReject={() => {
                      setRejectTarget(req);
                      setRejectNotes("");
                    }}
                    showApprove={canApprovePending(req) || canConfirmPoApproved(req)}
                    showReject={canReject(req)}
                    showCancel={canCancel(req)}
                    onCancel={() => handleCancel(req.id)}
                    approveLabel={approveButtonLabel(req)}
                  />
                ))}
              </div>
            )}

            {recentlyApproved.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Approved requisitions
                </h3>
                <div className="space-y-2">
                  {recentlyApproved.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-emerald-100 rounded-lg bg-emerald-50/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {req.material_name}{" "}
                          <span className="text-slate-500 font-medium">
                            × {Number(req.quantity_requested)} {req.material_unit}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {req.requested_by_name || "Site user"}
                          {req.reviewed_by_name
                            ? ` · Approved by ${req.reviewed_by_name}`
                            : ""}
                        </p>
                        {req.approval_notes && (
                          <p className="text-xs text-emerald-800 mt-1 italic">
                            "{req.approval_notes}"
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-bold uppercase text-emerald-800 bg-emerald-100 px-2 py-1 rounded shrink-0">
                        Approved
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {approveTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setApproveTarget(null)}
            aria-hidden
          />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {approveTarget.status === "po_approved"
                ? "Confirm requisition"
                : isSE && isForemanAwaitingSe(approveTarget)
                  ? "Confirm foreman requisition"
                  : "Approve requisition"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {approveTarget.material_name} × {Number(approveTarget.quantity_requested)}{" "}
              {approveTarget.material_unit}
              {isSE && isForemanAwaitingSe(approveTarget)
                ? " — confirm to forward to Procurement for final approval."
                : " — add a note for the audit trail and site team."}
            </p>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              {isSE && isForemanAwaitingSe(approveTarget) ? "Notes (optional)" : "Approval notes"}{" "}
              {!(isSE && isForemanAwaitingSe(approveTarget)) && (
                <span className="text-red-600">*</span>
              )}
            </label>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm h-28 resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder={
                isSE && isForemanAwaitingSe(approveTarget)
                  ? "e.g. Confirmed for slab pour — forward to procurement."
                  : "e.g. Approved for foundation work — release from warehouse stock."
              }
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actingId === approveTarget.id}
                onClick={submitApprove}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {actingId === approveTarget.id
                  ? "Processing…"
                  : isSE && isForemanAwaitingSe(approveTarget)
                    ? "Confirm & send to Procurement"
                    : "Approve & release stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setRejectTarget(null)}
            aria-hidden
          />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Reject requisition</h3>
            <p className="text-sm text-slate-500 mb-4">
              {rejectTarget.material_name} × {Number(rejectTarget.quantity_requested)}{" "}
              {rejectTarget.material_unit} — explain what needs to change so the requester can
              revise and resubmit.
            </p>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Rejection notes <span className="text-red-600">*</span>
            </label>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm h-28 resize-none focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="e.g. Quantity too high for current phase — reduce to 50 bags and resubmit."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actingId === rejectTarget.id}
                onClick={submitReject}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {actingId === rejectTarget.id ? "Rejecting…" : "Reject & return to site"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequisitionRow({
  req,
  actingId,
  statusLabel,
  onApprove,
  onReject,
  onCancel,
  showApprove,
  showReject,
  showCancel,
  approveLabel,
}: {
  req: MaterialRequest;
  actingId: number | null;
  statusLabel: string;
  onApprove: () => void;
  onReject: () => void;
  onCancel?: () => void;
  showApprove: boolean;
  showReject: boolean;
  showCancel?: boolean;
  approveLabel: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-slate-100 rounded-lg bg-white hover:bg-slate-50/80">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
          <Package size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900">
            {req.material_name}{" "}
            <span className="text-slate-500 font-medium">
              × {Number(req.quantity_requested)} {req.material_unit}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {req.requested_by_name || "Site user"}
            {req.requested_by_role === "site-foreman" ? " (Foreman)" : ""}
            {req.project_name ? ` · ${req.project_name}` : ""}
          </p>
          {req.site_engineer_confirmed_by_name && (
            <p className="text-xs text-emerald-700 mt-0.5">
              Confirmed by {req.site_engineer_confirmed_by_name}
            </p>
          )}
          {req.notes && (
            <p className="text-xs text-slate-600 italic mt-1">"{req.notes}"</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <span
          className={`text-xs font-bold uppercase px-2 py-1 rounded ${
            req.status === "po_approved" ||
            (req.status === "pending" && req.site_engineer_confirmed_at)
              ? "text-amber-800 bg-amber-100"
              : req.status === "pending" && req.requested_by_role === "site-foreman"
                ? "text-purple-800 bg-purple-100"
                : "text-slate-600 bg-slate-100"
          }`}
        >
          {statusLabel}
        </span>
        {showApprove && (
          <button
            type="button"
            disabled={actingId === req.id}
            onClick={onApprove}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
          >
            {actingId === req.id ? "…" : approveLabel}
          </button>
        )}
        {showReject && (
          <button
            type="button"
            disabled={actingId === req.id}
            onClick={onReject}
            className="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            Reject
          </button>
        )}
        {showCancel && onCancel && (
          <button
            type="button"
            disabled={actingId === req.id}
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
