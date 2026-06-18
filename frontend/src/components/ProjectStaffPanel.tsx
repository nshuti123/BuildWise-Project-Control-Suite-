import { useState, useEffect, useCallback } from "react";
import { Check, X as XIcon, UserCog, Clock } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { canAssignProjectManager } from "../utils/projectPermissions";

type StaffUser = {
  id: number;
  full_name?: string;
  username?: string;
  email?: string;
  role?: string;
};

export interface ProjectStaffData {
  id: number;
  name?: string;
  manager_details?: StaffUser | null;
  site_engineer_details?: StaffUser | null;
  project_accountant_details?: StaffUser | null;
  procurement_officer_details?: StaffUser | null;
  site_foreman_details?: StaffUser | null;
  pending_staff_assignments?: {
    approval_id: number;
    field?: string;
    candidate_name?: string;
    requested_by?: string;
    created_at?: string;
  }[];
}

interface ProjectStaffPanelProps {
  project: ProjectStaffData;
  onUpdate: (updated: ProjectStaffData) => void;
  compact?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  manager: "Project Manager",
  site_engineer: "Site Engineer",
  project_accountant: "Project Accountant",
  procurement_officer: "Procurement Officer",
  site_foreman: "Site Foreman",
};

function displayUser(u?: StaffUser | null) {
  if (!u) return "Unassigned";
  return u.full_name || u.username || u.email || "—";
}

export function ProjectStaffPanel({
  project,
  onUpdate,
  compact = false,
}: ProjectStaffPanelProps) {
  const { user } = useAuth();
  const role = user?.role;
  const isTD = role === "technical-director";
  const isPM = role === "project-manager";
  const isSiteEngineerOnProject =
    role === "site-engineer" && project.site_engineer_details?.id === user?.id;
  const canAssignTdCore = canAssignProjectManager(role) || isTD;
  const canAssignSiteFieldStaff = isSiteEngineerOnProject || isTD;

  const [candidates, setCandidates] = useState<Record<string, StaffUser[]>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCandidates = useCallback(async (field: string) => {
    try {
      const res = await api.get(
        `/projects/staff-candidates/?field=${field}&project=${project.id}`,
      );
      const list = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setCandidates((prev) => ({ ...prev, [field]: list }));
    } catch (e) {
      console.error(e);
    }
  }, [project.id]);

  useEffect(() => {
    if (editing) loadCandidates(editing);
  }, [editing, loadCandidates]);

  const patchDirect = async (field: string, userId: string | null) => {
    setBusy(true);
    setError("");
    try {
      const body: Record<string, number | null> = {
        [field]: userId ? parseInt(userId, 10) : null,
      };
      const res = await api.patch(`/projects/${project.id}/`, body);
      onUpdate(res.data);
      setEditing(null);
    } catch (err: any) {
      setError(
        err.response?.data?.[field]?.[0] ||
          err.response?.data?.detail ||
          "Assignment failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const requestApproval = async (field: string, userId: string) => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/projects/${project.id}/request-staff/`, {
        assignment_field: field,
        user_id: parseInt(userId, 10),
      });
      const detail = await api.get(`/projects/${project.id}/full-detail/`);
      onUpdate(detail.data);
      setEditing(null);
      alert("Submitted for approval.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const rows: {
    field: string;
    details?: StaffUser | null;
    direct: boolean;
    request: boolean;
  }[] = [
    {
      field: "manager",
      details: project.manager_details,
      direct: canAssignTdCore,
      request: false,
    },
    {
      field: "site_engineer",
      details: project.site_engineer_details,
      direct: canAssignTdCore,
      request: false,
    },
    {
      field: "project_accountant",
      details: project.project_accountant_details,
      direct: canAssignTdCore,
      request: false,
    },
    {
      field: "procurement_officer",
      details: project.procurement_officer_details,
      direct: canAssignSiteFieldStaff,
      request: isPM && !canAssignSiteFieldStaff,
    },
    {
      field: "site_foreman",
      details: project.site_foreman_details,
      direct: canAssignSiteFieldStaff,
      request: false,
    },
  ];

  const renderRow = (row: (typeof rows)[0]) => {
    const canChange = row.direct || row.request;
    const isEditing = editing === row.field;

    return (
      <div
        key={row.field}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {FIELD_LABELS[row.field]}
          </p>
          <p className="text-sm font-medium text-slate-900 mt-0.5">
            {displayUser(row.details)}
          </p>
          {row.request && !row.direct && (
            <p className="text-[11px] text-amber-700 mt-0.5">
              Requires approval
              {row.field === "procurement_officer" ? " (Technical Director)" : " (Project Manager)"}
            </p>
          )}
          {row.direct && isSiteEngineerOnProject && !isTD && (
            <p className="text-[11px] text-cyan-700 mt-0.5">
              You can assign this role on your project
            </p>
          )}
        </div>
        {canChange && (
          <div className="flex items-center gap-2 min-w-[200px]">
            {isEditing ? (
              <>
                <select
                  value={selected[row.field] ?? ""}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [row.field]: e.target.value }))
                  }
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  disabled={busy}
                >
                  <option value="">Select…</option>
                  {(candidates[row.field] || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {displayUser(c)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !selected[row.field]}
                  onClick={() => {
                    const uid = selected[row.field];
                    if (row.direct) patchDirect(row.field, uid);
                    else requestApproval(row.field, uid);
                  }}
                  className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"
                >
                  <XIcon size={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(row.field);
                  setSelected((s) => ({
                    ...s,
                    [row.field]: row.details?.id?.toString() ?? "",
                  }));
                }}
                className="text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg"
              >
                {row.details ? "Reassign" : "Assign"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <UserCog className="text-cyan-600" size={22} />
        <div>
          <h2 className="text-lg font-bold text-slate-900">Project team</h2>
          <p className="text-xs text-slate-500">
            {isTD
              ? "Assign PM, site engineer, and project accountant directly. Approve procurement officer requests in Technical Approvals."
              : isSiteEngineerOnProject
                ? "Assign the procurement officer and site foreman for this project."
                : isPM
                  ? "Request a procurement officer — Technical Director must approve."
                  : "Staff assignments for this project"}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <div>
        {(isSiteEngineerOnProject && !isTD
          ? rows.filter((r) =>
              ["site_engineer", "procurement_officer", "site_foreman"].includes(r.field),
            )
          : rows
        ).map(renderRow)}
      </div>

      {project.pending_staff_assignments &&
        project.pending_staff_assignments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold uppercase text-amber-800 mb-2 flex items-center gap-1">
              <Clock size={14} /> Pending assignment requests
            </p>
            <ul className="space-y-2">
              {project.pending_staff_assignments.map((p) => (
                <li
                  key={p.approval_id}
                  className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-900"
                >
                  {FIELD_LABELS[p.field || ""] || p.field}: {p.candidate_name} — requested by{" "}
                  {p.requested_by}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
