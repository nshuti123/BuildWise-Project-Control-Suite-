import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, AlertOctagon, Plus } from "lucide-react";
import api from "../api";
import { asList } from "../utils/apiHelpers";
import { IncidentModal } from "./IncidentModal";

export type SiteIncidentRow = {
  id: number;
  incident_type: string;
  severity: string;
  status: string;
  description: string;
  date_reported?: string;
  reported_by_name?: string;
  project_name?: string;
};

interface SiteIncidentsPanelProps {
  projectId: number | null;
  /** When set, only this project's incidents (required to log new ones). */
  projectName?: string;
  canLog?: boolean;
  canResolve?: boolean;
  maxOpenShown?: number;
  showResolved?: boolean;
  className?: string;
}

export function SiteIncidentsPanel({
  projectId,
  projectName,
  canLog = false,
  canResolve = false,
  maxOpenShown = 5,
  showResolved = true,
  className = "",
}: SiteIncidentsPanelProps) {
  const [incidents, setIncidents] = useState<SiteIncidentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const url = projectId
        ? `/projects/incidents/?project=${projectId}`
        : "/projects/incidents/?status=open";
      const response = await api.get(url);
      setIncidents(asList(response.data));
    } catch (error) {
      console.error("Failed to fetch incidents:", error);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const openIncidents = incidents.filter((i) => i.status === "open");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");

  const handleResolve = async (incidentId: number) => {
    setResolvingId(incidentId);
    try {
      await api.post(`/projects/incidents/${incidentId}/resolve/`);
      await fetchIncidents();
    } catch (error) {
      console.error("Failed to resolve incident:", error);
      alert("Could not mark this incident as resolved.");
    } finally {
      setResolvingId(null);
    }
  };

  const severityClass = (severity: string) => {
    if (severity === "critical") return "bg-red-100 text-red-700";
    if (severity === "high") return "bg-orange-100 text-orange-700";
    return "bg-amber-50 text-amber-600";
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={20} />
            Site incidents
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {projectName
              ? `Safety, equipment, and quality issues on ${projectName}`
              : "Open incidents across your projects"}
          </p>
        </div>
        {canLog && projectId && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm"
          >
            <Plus size={16} />
            Log incident
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-6 text-center">Loading incidents…</p>
      ) : openIncidents.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
          <AlertOctagon className="text-slate-300 mx-auto mb-2" size={32} />
          <p className="text-sm text-slate-600 font-medium">No open incidents</p>
          {canLog && projectId && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-3 text-sm font-semibold text-red-600 hover:text-red-800"
            >
              Report an incident
            </button>
          )}
        </div>
      ) : (
        <div className="bg-red-50 rounded-2xl border-2 border-red-200 overflow-hidden">
          <div className="p-4 bg-red-600 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              Active incidents
            </h3>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
              {openIncidents.length}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {openIncidents.slice(0, maxOpenShown).map((incident) => (
              <div
                key={incident.id}
                className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex items-start gap-3"
              >
                <div
                  className={`p-1.5 rounded-md mt-0.5 shrink-0 ${severityClass(incident.severity)}`}
                >
                  <AlertOctagon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 capitalize">
                    {incident.incident_type.replace(/_/g, " ")}
                    {!projectId && incident.project_name && (
                      <span className="text-slate-500 font-medium">
                        {" "}
                        · {incident.project_name}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{incident.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1 capitalize">
                    {incident.severity} severity
                    {incident.reported_by_name && ` · ${incident.reported_by_name}`}
                  </p>
                </div>
                {canResolve && (
                  <button
                    type="button"
                    disabled={resolvingId === incident.id}
                    onClick={() => handleResolve(incident.id)}
                    className="shrink-0 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {resolvingId === incident.id ? "…" : "Resolve"}
                  </button>
                )}
              </div>
            ))}
            {openIncidents.length > maxOpenShown && (
              <p className="text-xs text-red-800 text-center font-medium">
                +{openIncidents.length - maxOpenShown} more open incident(s)
              </p>
            )}
          </div>
        </div>
      )}

      {showResolved && resolvedIncidents.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recently resolved</h3>
          <ul className="space-y-2">
            {resolvedIncidents.slice(0, 3).map((incident) => (
              <li
                key={incident.id}
                className="text-sm text-slate-600 flex justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
              >
                <span className="capitalize truncate">
                  {incident.incident_type}
                  {!projectId && incident.project_name
                    ? ` · ${incident.project_name}`
                    : ""}
                </span>
                <span className="text-emerald-700 font-medium shrink-0">Resolved</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canLog && projectId && (
        <IncidentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchIncidents}
          projectId={projectId}
        />
      )}
    </div>
  );
}
