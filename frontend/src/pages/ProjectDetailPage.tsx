import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import api from "../api";
import { ProjectStaffPanel, type ProjectStaffData } from "../components/ProjectStaffPanel";
import { ProjectDocumentsPanel } from "../components/ProjectDocumentsPanel";
import { ProjectStatusEditor } from "../components/ProjectStatusEditor";
import { formatBudget } from "../utils/formatters";

interface ProjectDetailPageProps {
  projectId: number;
  onBack: () => void;
}

interface ProjectDetail extends ProjectStaffData {
  location_details?: { name: string };
  address_line_2?: string;
  budget?: string;
  budget_amount?: number;
  deadline?: string;
  progress: number;
  status: "on-track" | "at-risk" | "delayed" | "completed";
  status_is_manual?: boolean;
  construction_type?: string;
  manager_details?: { id: number };
  stats?: {
    tasks_total: number;
    tasks_completed: number;
    tasks_overdue: number;
    approved_spend: number;
    budget_amount?: number | null;
  };
}

export function ProjectDetailPage({ projectId, onBack }: ProjectDetailPageProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/projects/${projectId}/full-detail/`);
      setProject(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to load project details.");
      try {
        const fallback = await api.get(`/projects/${projectId}/`);
        setProject(fallback.data);
      } catch {
        setProject(null);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !project) {
    return <div className="p-8 text-center text-slate-500">Loading project…</div>;
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error || "Project not found"}</p>
        <button onClick={onBack} className="mt-4 text-cyan-600 font-medium">
          Go back
        </button>
      </div>
    );
  }

  const stats = project.stats;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-200 text-slate-500 rounded-full transition-colors shrink-0"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 truncate">
              {project.name}
            </h1>
            <ProjectStatusEditor
              projectId={project.id}
              status={project.status}
              managerId={project.manager_details?.id}
              onUpdated={(patch) => setProject((p) => (p ? { ...p, ...patch } : p))}
            />
          </div>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
            <Building2 size={16} />
            <span className="capitalize">
              {project.construction_type || "General"} construction
            </span>
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Progress</p>
            <p className="text-2xl font-bold text-slate-900">{project.progress}%</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <ClipboardList size={12} /> Tasks
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {stats.tasks_completed}/{stats.tasks_total}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <AlertTriangle size={12} /> Overdue tasks
            </p>
            <p className="text-2xl font-bold text-red-600">{stats.tasks_overdue}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <TrendingUp size={12} /> Approved spend
            </p>
            <p className="text-lg font-bold text-slate-900">
              {stats.approved_spend.toLocaleString()} RWF
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Project information</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500 flex items-center gap-1">
                <MapPin size={14} /> Location
              </dt>
              <dd className="font-medium text-slate-900 mt-1">
                {project.location_details?.name || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd className="font-medium text-slate-900 mt-1">
                {project.address_line_2 || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 flex items-center gap-1">
                <DollarSign size={14} /> Budget
              </dt>
              <dd className="font-medium text-slate-900 mt-1">
                {formatBudget(project.budget) ||
                  (project.budget_amount
                    ? `${Number(project.budget_amount).toLocaleString()} RWF`
                    : "TBD")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 flex items-center gap-1">
                <Clock size={14} /> Deadline
              </dt>
              <dd className="font-medium text-slate-900 mt-1">
                {project.deadline
                  ? new Date(project.deadline).toLocaleDateString()
                  : "Not set"}
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-500">Overall progress</span>
              <span className="font-bold">{project.progress}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>

        <ProjectStaffPanel project={project} onUpdate={(u) => setProject((p) => ({ ...p!, ...u }))} />
      </div>

      <ProjectDocumentsPanel project={project} />
    </div>
  );
}
