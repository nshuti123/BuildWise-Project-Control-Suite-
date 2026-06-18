import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import { withProjectQuery } from "../utils/apiHelpers";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { ProjectScopeBanner } from "../components/ProjectScopeBanner";
import {
  CheckCircle2,
  XCircle,
  Shield,
  Package,
  ClipboardList,
  AlertTriangle,
  Layers,
  RefreshCw,
  Eye,
  UserCog,
} from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";
import { hasFullAccess } from "../utils/roleCapabilities";

interface ApprovalActor {
  id?: number;
  full_name?: string;
  username?: string;
  role?: string;
  role_display?: string;
}

interface ResolutionEvent {
  action: string;
  label: string;
  actor?: ApprovalActor | null;
  at?: string | null;
  notes?: string;
}

interface ApprovalRow {
  id: number;
  request_type: string;
  request_type_display: string;
  title: string;
  description: string;
  status: string;
  status_display?: string;
  project_name?: string;
  requested_by_details?: ApprovalActor;
  approver_details?: ApprovalActor;
  resolved_by_details?: ApprovalActor | null;
  created_at: string;
  resolved_at?: string;
  notes?: string;
  audit_trail?: string;
  resolution_history?: ResolutionEvent[];
  highlight_for_viewer?: boolean;
  subject_status?: string | null;
  is_actionable?: boolean;
}

function actorLabel(actor?: ApprovalActor | null) {
  if (!actor) return "Unknown";
  const name = actor.full_name || actor.username || "Unknown";
  const role = actor.role_display || actor.role;
  return role ? `${name} (${role})` : name;
}

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const TYPE_ICONS: Record<string, typeof Package> = {
  material_request: Package,
  purchase_order: Package,
  task_complete: ClipboardList,
  incident: AlertTriangle,
  allocation: Layers,
  staff_assignment: UserCog,
};

const POLL_MS = 10000;

export function TechnicalApprovalInbox() {
  const { user } = useAuth();
  const { currentProjectId, projects } = useProject();
  const activeProject = projects.find((p) => p.id === currentProjectId);
  const isTD = user?.role === "technical-director";
  const isPM = user?.role === "project-manager";
  const isPO = user?.role === "procurement-officer";
  const isFullAccess = hasFullAccess(user?.role);
  const canFinalizeMaterial = isPM || isTD || isFullAccess;
  const [tab, setTab] = useState<"pending" | "history">(isTD ? "history" : "pending");
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [notesModal, setNotesModal] = useState<{
    id: number;
    action: "approve" | "reject";
    title: string;
    confirmLabel?: string;
    requestType?: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const seenHighlightIds = useRef<Set<number>>(new Set());

  const staffAssignmentField = (row: ApprovalRow): string | null => {
    if (row.request_type !== "staff_assignment" || !row.description) return null;
    try {
      const meta = JSON.parse(row.description);
      return meta.assignment_field || null;
    } catch {
      return null;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const projectScope = isPO ? null : currentProjectId;
    const withProject = (path: string) => withProjectQuery(path, projectScope);
    try {
      let url: string;
      if (isTD) {
        if (tab === "pending") {
          const [matRes, staffRes] = await Promise.all([
            api.get(withProject("/approvals/?status=po_approved&scope=technical&feed=procurement")),
            api.get(withProject("/approvals/?status=pending&scope=technical")),
          ]);
          const mats = (Array.isArray(matRes.data) ? matRes.data : matRes.data?.results ?? []).filter(
            (a: ApprovalRow) => a.is_actionable !== false,
          );
          const staff = (Array.isArray(staffRes.data) ? staffRes.data : staffRes.data?.results ?? []).filter(
            (a: ApprovalRow) =>
              a.request_type === "staff_assignment" &&
              staffAssignmentField(a) === "procurement_officer" &&
              a.is_actionable !== false,
          );
          const merged = [...staff, ...mats];
          setItems(merged.filter((a, i) => merged.findIndex((b) => b.id === a.id) === i));
          setLoading(false);
          return;
        }
        url = withProject("/approvals/?status=history&scope=technical&feed=procurement");
      } else if (tab === "pending") {
        if (isPM || isFullAccess) {
          const [matRes, staffRes] = await Promise.all([
            api.get(withProject("/approvals/?status=po_approved&scope=technical")),
            api.get(withProject("/approvals/?status=pending&scope=technical")),
          ]);
          const mats = (Array.isArray(matRes.data) ? matRes.data : matRes.data?.results ?? []).filter(
            (a: ApprovalRow) => a.is_actionable !== false,
          );
          const staff = (Array.isArray(staffRes.data) ? staffRes.data : staffRes.data?.results ?? []).filter(
            (a: ApprovalRow) =>
              a.request_type === "staff_assignment" && a.is_actionable !== false,
          );
          const merged = [...staff, ...mats];
          setItems(merged.filter((a, i) => merged.findIndex((b) => b.id === a.id) === i));
          setLoading(false);
          return;
        }
        const status = "pending";
        url = withProject(`/approvals/?status=${status}&scope=technical`);
      } else {
        url = withProject("/approvals/?status=history&scope=technical");
      }
      const res = await api.get(url);
      const list = (Array.isArray(res.data) ? res.data : res.data?.results ?? []).filter(
        (a: ApprovalRow) =>
          tab === "history" || a.is_actionable !== false,
      );
      setItems(list);

      if (isTD) {
        const newlyHighlighted = list.filter(
          (a: ApprovalRow) =>
            a.highlight_for_viewer && !seenHighlightIds.current.has(a.id),
        );
        newlyHighlighted.forEach((a: ApprovalRow) =>
          seenHighlightIds.current.add(a.id),
        );
      }
    } catch (e: any) {
      console.error(e);
      const detail = e.response?.data?.detail;
      setLoadError(
        typeof detail === "string"
          ? detail
          : "Could not load approvals. Restart the backend server and run: python manage.py migrate",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, isTD, isPM, isPO, isFullAccess, currentProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const submitAction = async () => {
    if (!notesModal) return;
    if (
      notesModal.action === "approve" &&
      notesModal.requestType === "material_request" &&
      !notes.trim()
    ) {
      alert("Please add approval notes before approving this requisition.");
      return;
    }
    if (
      notesModal.action === "reject" &&
      notesModal.requestType === "material_request" &&
      !notes.trim()
    ) {
      alert("Please add rejection notes before returning this requisition to site.");
      return;
    }
    setActingId(notesModal.id);
    try {
      await api.post(`/approvals/${notesModal.id}/${notesModal.action}/`, {
        notes: notes.trim(),
      });
      setNotesModal(null);
      setNotes("");
      await load();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Action failed");
    } finally {
      setActingId(null);
    }
  };

  const canActOnRow = (row: ApprovalRow) => {
    if (row.is_actionable === false) return false;
    if (
      row.subject_status &&
      ["approved", "fulfilled", "ordered", "rejected"].includes(row.subject_status)
    ) {
      return false;
    }
    if (row.status === "approved" || row.status === "rejected") return false;

    if (row.request_type === "staff_assignment" && row.status === "pending") {
      const field = staffAssignmentField(row);
      if (field === "procurement_officer") return isTD || isFullAccess;
      return false;
    }
    if (row.request_type === "material_request") {
      if (isPO && row.status === "pending") return true;
      if (canFinalizeMaterial && row.status === "po_approved") return true;
      if (canFinalizeMaterial && row.status === "pending") return true;
      return false;
    }
    if (isPO) return false;
    if (row.status === "pending" && isFullAccess) return true;
    if (row.status === "pending" && user?.role === "project-manager") return true;
    if (user?.role === "technical-director" && row.status === "pending") return true;
    return false;
  };

  const dismissHighlight = (id: number) => {
    seenHighlightIds.current.add(id);
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, highlight_for_viewer: false } : r)),
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-600 text-sm font-semibold uppercase tracking-wider mb-1">
            <Shield size={16} />
            {isTD ? "Procurement oversight" : "Technical oversight"}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isTD ? "Procurement activity" : "Technical approvals"}
          </h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            {isTD
              ? "You can approve or confirm material requests (optional). After Procurement approves, confirm to release stock if the PM has not. Highlighted rows are for follow-up."
              : isPO
                ? "Approve material requests first; the Project Manager confirms after you."
                : isPM
                  ? "Confirm material requests after Procurement Officer approval. History shows who approved or rejected each item on your projects."
                  : "Tasks, materials, purchase orders, incidents, and allocations."}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {activeProject && (
        <ProjectScopeBanner
          projectName={activeProject.name}
          context="approvals"
        />
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {(["pending", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "pending"
              ? isTD
                ? "Confirm queue"
                : isPM
                  ? "Awaiting confirm"
                  : isPO
                    ? "Pending (PO)"
                    : "Pending"
              : isTD
                ? "Activity log"
                : isPM
                  ? "Approval history"
                  : "History"}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          {loadError}
        </div>
      )}

      {loading && items.length === 0 && !loadError ? (
        <div className="py-16 text-center text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 className="mx-auto text-green-500 mb-3" size={40} />
          <p className="font-medium text-slate-700">
            {isTD && tab === "pending"
              ? "Nothing awaiting confirmation after procurement approval."
              : isTD
                ? "No recent procurement activity to show."
                : tab === "pending"
                ? isPM
                  ? "No material requests awaiting your confirmation."
                  : "No pending approvals."
                : isPM
                  ? "No completed approvals on your projects yet."
                  : "No approval history yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => {
            const Icon = TYPE_ICONS[row.request_type] || ClipboardList;
            const highlighted = !!row.highlight_for_viewer;
            const showActions = canActOnRow(row);
            const oversightOnly = false;

            return (
              <div
                key={row.id}
                className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${
                  highlighted
                    ? "border-cyan-400 ring-2 ring-cyan-400/60 bg-cyan-50/80 shadow-md shadow-cyan-100"
                    : "border-slate-200 hover:border-cyan-200"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex gap-4 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        highlighted ? "bg-cyan-200 text-cyan-800" : "bg-cyan-50 text-cyan-600"
                      }`}
                    >
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{row.title}</p>
                        {highlighted && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-900 bg-cyan-200 px-2 py-0.5 rounded-full">
                            {row.status === "po_approved"
                              ? "New — PO approved"
                              : "New activity"}
                          </span>
                        )}
                        {oversightOnly && (
                          <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                            <Eye size={12} /> Follow-up only
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.request_type_display}
                        {row.project_name ? ` · ${row.project_name}` : ""}
                      </p>
                      {row.description && (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                          {row.description}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        Submitted by{" "}
                        {row.requested_by_details?.full_name ||
                          row.requested_by_details?.username ||
                          "Unknown"}
                        {row.resolved_at && (
                          <>
                            {" "}
                            · {new Date(row.resolved_at).toLocaleString()}
                          </>
                        )}
                      </p>
                      {tab === "history" &&
                        row.resolution_history &&
                        row.resolution_history.length > 0 && (
                          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                            {row.resolution_history.map((ev, idx) => (
                              <li
                                key={`${row.id}-${ev.action}-${idx}`}
                                className={`text-xs rounded-lg px-3 py-2 border ${
                                  ev.action === "rejected"
                                    ? "bg-red-50 border-red-100 text-red-900"
                                    : ev.action === "po_approved"
                                      ? "bg-amber-50 border-amber-100 text-amber-900"
                                      : "bg-emerald-50 border-emerald-100 text-emerald-900"
                                }`}
                              >
                                <span className="font-bold">{ev.label}</span>
                                {" by "}
                                <span className="font-semibold">
                                  {actorLabel(ev.actor)}
                                </span>
                                {ev.at && (
                                  <span className="text-slate-500">
                                    {" "}
                                    · {formatWhen(ev.at)}
                                  </span>
                                )}
                                {ev.notes && (
                                  <span className="block mt-1 text-slate-600 italic">
                                    {ev.notes}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      {tab === "history" &&
                        (!row.resolution_history ||
                          row.resolution_history.length === 0) &&
                        row.audit_trail && (
                          <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 mt-2">
                            {row.audit_trail}
                          </p>
                        )}
                      {tab === "pending" &&
                        row.status === "po_approved" &&
                        row.resolved_by_details && (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 mt-2">
                            Procurement approved by{" "}
                            {actorLabel(row.resolved_by_details)}
                            {row.resolved_at &&
                              ` · ${formatWhen(row.resolved_at)}`}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {row.status === "pending" ? (
                      <StatusBadge status="pending" size="sm" />
                    ) : row.status === "po_approved" ? (
                      <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-1 rounded-full">
                        {row.status_display || "Procurement approved"}
                      </span>
                    ) : row.status === "approved" ||
                      row.subject_status === "approved" ||
                      row.subject_status === "fulfilled" ||
                      row.subject_status === "ordered" ? (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                        Approved
                      </span>
                    ) : row.status === "rejected" ||
                      row.subject_status === "rejected" ? (
                      <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                        Rejected
                      </span>
                    ) : null}
                    {highlighted && isTD && (
                      <button
                        type="button"
                        onClick={() => dismissHighlight(row.id)}
                        className="text-xs text-cyan-700 hover:text-cyan-900 font-medium px-2 py-1"
                      >
                        Dismiss highlight
                      </button>
                    )}
                    {showActions && (
                      <>
                        <button
                          disabled={actingId === row.id}
                          onClick={() =>
                            setNotesModal({
                              id: row.id,
                              action: "approve",
                              title: row.title,
                              requestType: row.request_type,
                              confirmLabel:
                                isPM && row.status === "po_approved"
                                  ? "Confirm"
                                  : "Approve",
                            })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          {row.status === "po_approved"
                            ? "Confirm"
                            : row.request_type === "material_request" && canFinalizeMaterial
                              ? "Approve"
                              : "Approve"}
                        </button>
                        <button
                          disabled={actingId === row.id}
                          onClick={() =>
                            setNotesModal({
                              id: row.id,
                              action: "reject",
                              title: row.title,
                              requestType: row.request_type,
                            })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {notesModal.confirmLabel || (notesModal.action === "approve" ? "Approve" : "Reject")}
            </h3>
            <p className="text-sm text-slate-500 mb-4 truncate">{notesModal.title}</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder={
                notesModal.requestType === "material_request"
                  ? notesModal.action === "approve"
                    ? "Approval notes (required)…"
                    : "Rejection notes (required)…"
                  : "Optional notes for the audit trail…"
              }
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setNotesModal(null);
                  setNotes("");
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={actingId !== null}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  notesModal.action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {notesModal.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
