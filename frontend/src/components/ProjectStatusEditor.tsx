import { useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { StatusBadge } from "./StatusBadge";
import { formatApiError } from "../utils/apiHelpers";
import { canAssignProjectManager } from "../utils/projectPermissions";

type ProjectStatus = "on-track" | "at-risk" | "delayed" | "completed";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "on-track", label: "On Track" },
  { value: "at-risk", label: "At Risk" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
];

interface ProjectStatusEditorProps {
  projectId: number;
  status: ProjectStatus;
  managerId?: number | null;
  onUpdated: (patch: { status: ProjectStatus; status_is_manual?: boolean }) => void;
}

export function ProjectStatusEditor({
  projectId,
  status,
  managerId,
  onUpdated,
}: ProjectStatusEditorProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isPM = user?.role === "project-manager" && managerId === user?.id;
  const canEdit = canAssignProjectManager(user?.role) || user?.role === "admin" || isPM;

  if (!canEdit) {
    return <StatusBadge status={status} size="md" />;
  }

  const saveStatus = async (newStatus: ProjectStatus) => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/projects/${projectId}/`, { status: newStatus });
      onUpdated({ status: newStatus, status_is_manual: true });
    } catch (err: unknown) {
      setError(formatApiError(err, "Failed to update status"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <select
        value={status}
        disabled={busy}
        onChange={(e) => saveStatus(e.target.value as ProjectStatus)}
        className="text-sm font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-cyan-600 outline-none disabled:opacity-60"
        aria-label="Project status"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
    </div>
  );
}
