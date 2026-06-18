import { useMemo, useState, useEffect } from "react";
import api from "../api";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { canCreateProject } from "../utils/projectPermissions";
import { useAuth } from "../context/AuthContext";
import { ProjectWorkspace } from "../components/ProjectWorkspace";
import { formatBudget } from "../utils/formatters";
import { asList, formatRelativeTime } from "../utils/apiHelpers";
import { useProject, type Project } from "../context/ProjectContext";
import {
  Building2,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  Plus,
  CheckCircle2,
  ListTodo,
  Calendar,
  ChevronDown,
  Timer,
  Flag,
  CircleAlert,
  Briefcase,
  ArrowRight,
  Settings,
  GripVertical,
  Shield,
  FileText,
  Package,
  MessageSquare,
  MapPin,
} from "lucide-react";

const QUICK_MODULES: {
  id: string;
  label: string;
  description: string;
  icon: typeof ListTodo;
  accent: string;
}[] = [
  { id: "planning", label: "Planning", description: "Schedule & milestones", icon: Calendar, accent: "bg-blue-600" },
  { id: "tasks", label: "Tasks", description: "Assign & track work", icon: ListTodo, accent: "bg-violet-600" },
  { id: "budget", label: "Budget", description: "Costs & transactions", icon: DollarSign, accent: "bg-emerald-600" },
  { id: "technical-approvals", label: "Approvals", description: "Pending reviews", icon: Shield, accent: "bg-indigo-600" },
  { id: "procurement", label: "Procurement", description: "Orders & materials", icon: Package, accent: "bg-orange-600" },
  { id: "progress", label: "Progress", description: "Site monitoring", icon: TrendingUp, accent: "bg-teal-600" },
  { id: "reports", label: "Reports", description: "Exports & analytics", icon: FileText, accent: "bg-rose-600" },
  { id: "communication", label: "Messages", description: "Team communication", icon: MessageSquare, accent: "bg-slate-700" },
];

type DashboardLayoutState = {
  metrics: string[];
  sections: string[];
};

const DASHBOARD_LAYOUT_STORAGE_KEY = "buildwise.dashboard.layout.v1";

function arrayMove<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function safeLoadLayout(defaults: DashboardLayoutState): DashboardLayoutState {
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DashboardLayoutState>;
    const merge = (key: keyof DashboardLayoutState) => {
      const def = defaults[key];
      const saved = Array.isArray(parsed[key]) ? (parsed[key] as string[]) : [];
      const filteredSaved = saved.filter((id) => def.includes(id));
      const missing = def.filter((id) => !filteredSaved.includes(id));
      return [...filteredSaved, ...missing];
    };
    return { metrics: merge("metrics"), sections: merge("sections") };
  } catch {
    return defaults;
  }
}

function persistLayout(layout: DashboardLayoutState) {
  try {
    localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function daysBetweenToday(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffTime = d.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function ProgressRing({
  value,
  size = 112,
  stroke = 12,
  label,
  sublabel,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}) {
  const v = clamp(value, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  const gap = c - dash;
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="text-slate-200"
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="text-blue-600"
            stroke="currentColor"
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {Math.round(v)}%
            </div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              progress
            </div>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        {label && <div className="font-bold text-slate-900">{label}</div>}
        {sublabel && <div className="text-sm text-slate-600">{sublabel}</div>}
      </div>
    </div>
  );
}

function MiniBars({
  items,
  height = 42,
}: {
  items: { label: string; value: number; colorClass: string }[];
  height?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((i) => {
        const h = Math.round((i.value / max) * height);
        return (
          <div key={i.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="flex items-end justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  {i.label}
                </div>
                <div className="text-lg font-extrabold text-slate-900">{i.value}</div>
              </div>
              <div
                className={`w-3 rounded-full ${i.colorClass}`}
                style={{ height: Math.max(10, h) }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Dashboard({ setActiveModule }: { setActiveModule?: (module: string) => void }) {
  const { user } = useAuth();
  const { currentProjectId, setCurrentProjectId, projects, refreshProjects, loadingProjects } = useProject();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const showCreateProject = canCreateProject(user?.role);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCustomizingLayout, setIsCustomizingLayout] = useState(false);

  interface OverviewMetrics {
    budget_amount?: number | null;
    budget_label?: string;
    approved_spend?: number;
    team_size?: number;
    total_tasks?: number;
    completed_tasks?: number;
    in_progress_tasks?: number;
    pending_tasks?: number;
    task_completion_pct?: number;
    overdue_tasks?: number;
    due_soon_tasks?: number;
    milestones_total?: number;
    milestones_completed?: number;
    progress?: number;
    status?: string;
  }

  interface ActivityItem {
    action: string;
    detail?: string;
    project: string;
    timestamp: string;
    type: "success" | "warning" | "info";
  }

  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const activeProject = projects.find(p => p.id === currentProjectId) || null;

  const defaultLayout = useMemo<DashboardLayoutState>(() => {
    return {
      metrics: ["totalBudget", "teamSize", "taskCompletion", "overallProgress"],
      sections: ["progressAnalytics", "recentActivity", "attentionBanner"],
    };
  }, []);

  const [layout, setLayout] = useState<DashboardLayoutState>(() => safeLoadLayout(defaultLayout));

  useEffect(() => {
    // If defaults change across deploys, re-merge (keeps user order where possible).
    setLayout((prev) => {
      const ensure = (key: keyof DashboardLayoutState) => {
        const def = defaultLayout[key];
        const saved = Array.isArray(prev[key]) ? prev[key] : [];
        const filtered = saved.filter((id) => def.includes(id));
        const missing = def.filter((id) => !filtered.includes(id));
        return [...filtered, ...missing];
      };
      return { metrics: ensure("metrics"), sections: ensure("sections") };
    });
  }, [defaultLayout]);

  useEffect(() => {
    persistLayout(layout);
  }, [layout]);

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    const fetchOverview = async () => {
      if (!currentProjectId) {
        setOverviewMetrics(null);
        setMilestones([]);
        setRecentActivity([]);
        return;
      }
      setLoadingAnalytics(true);
      try {
        const res = await api.get(`/projects/${currentProjectId}/overview/`);
        setOverviewMetrics(res.data.metrics ?? null);
        setMilestones(asList(res.data.milestones));
        setRecentActivity(asList(res.data.recent_activity));
      } catch (err) {
        console.error("Failed to fetch project overview", err);
        setOverviewMetrics(null);
        setMilestones([]);
        setRecentActivity([]);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchOverview();
  }, [currentProjectId]);

  const derived = useMemo(() => {
    const m = overviewMetrics;
    const totalTasks = m?.total_tasks ?? 0;
    const completedTasks = m?.completed_tasks ?? 0;
    const inProgressTasks = m?.in_progress_tasks ?? 0;
    const pendingTasks = m?.pending_tasks ?? 0;
    const taskCompletionPct = m?.task_completion_pct ?? 0;
    const overdueCount = m?.overdue_tasks ?? 0;
    const dueSoonCount = m?.due_soon_tasks ?? 0;
    const milestoneCompleted = m?.milestones_completed ?? 0;

    const upcomingMilestones = milestones
      .map((ms) => ({ ...ms, daysFromNow: daysBetweenToday(ms.date ?? ms.due_date) }))
      .filter((ms) => ms.daysFromNow !== null)
      .sort((a: any, b: any) => (a.daysFromNow as number) - (b.daysFromNow as number));

    const nextMilestone = upcomingMilestones.find((ms: any) => (ms.daysFromNow as number) >= 0) || null;
    const deadlineDays = daysBetweenToday(activeProject?.deadline);
    const projectStatus = m?.status ?? activeProject?.status;

    const attentionLevel =
      projectStatus === "delayed" || overdueCount > 0
        ? "high"
        : projectStatus === "at-risk" || dueSoonCount > 0
          ? "medium"
          : "low";

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      taskCompletionPct,
      overdueCount,
      dueSoonCount,
      milestoneCompleted,
      nextMilestone,
      deadlineDays,
      attentionLevel,
      approvedSpend: m?.approved_spend ?? 0,
      teamSize: m?.team_size ?? 0,
    };
  }, [overviewMetrics, milestones, activeProject]);

  if (selectedProject) {
    return (
      <ProjectWorkspace 
        project={selectedProject} 
        onBack={() => {
          setSelectedProject(null);
          refreshProjects();
        }} 
        onUpdate={(upd) => {
          setSelectedProject(upd);
        }} 
      />
    );
  }

  if (loadingProjects && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading your projects…</p>
      </div>
    );
  }

  const greetingName = user?.full_name?.split(" ")[0] || user?.username || "Manager";

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 lg:p-8 shadow-xl">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold uppercase tracking-widest mb-2">
              <Briefcase size={16} />
              Project Management Hub
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mb-1">
              Welcome back, {greetingName}
            </h1>
            <p className="text-slate-300 text-sm lg:text-base max-w-2xl">
              {activeProject
                ? `Managing ${activeProject.name} — track progress, budget, and team performance in real time.`
                : `You have ${projects.length} project${projects.length === 1 ? "" : "s"}. Select one below to view analytics.`}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2 backdrop-blur-sm">
                <Building2 size={16} className="text-blue-200 shrink-0" />
                <div className="relative">
                  <select
                    value={currentProjectId ?? ""}
                    onChange={(e) =>
                      setCurrentProjectId(e.target.value ? Number(e.target.value) : null)
                    }
                    className="appearance-none bg-transparent pr-7 text-sm font-semibold text-white outline-none min-w-[160px] max-w-[240px]"
                    disabled={loadingProjects || projects.length === 0}
                    aria-label="Select project"
                  >
                    <option value="" disabled className="text-slate-900">
                      {loadingProjects ? "Loading…" : "Select project"}
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="text-slate-900">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-200 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {setActiveModule && activeProject && derived.overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveModule("tasks")}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-red-500/25"
              >
                <AlertTriangle size={16} />
                {derived.overdueCount} overdue task{derived.overdueCount === 1 ? "" : "s"}
              </button>
            )}
            {setActiveModule && (
              <button
                type="button"
                onClick={() => setActiveModule("planning")}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/25"
              >
                Open planning
                <ArrowRight size={16} />
              </button>
            )}
            {showCreateProject && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium text-sm transition-colors"
              >
                <Plus size={16} />
                New project
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCustomizingLayout((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                isCustomizingLayout
                  ? "bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25"
                  : "bg-white/10 hover:bg-white/20 border border-white/20"
              }`}
            >
              <Settings size={16} />
              {isCustomizingLayout ? "Done" : "Customize"}
            </button>
          </div>
        </div>
      </div>

      {/* Quick access */}
      {setActiveModule && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Quick access</h2>
            <p className="text-sm text-slate-500">Jump to key project management modules</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            {QUICK_MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModule(m.id)}
                  className="group text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div
                    className={`w-10 h-10 ${m.accent} rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-105 transition-transform`}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{m.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Project portfolio */}
      {projects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your projects</h2>
              <p className="text-sm text-slate-500">Click a project to focus the dashboard</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => {
              const isActive = project.id === currentProjectId;
              const loc =
                project.location_details?.name ||
                (typeof project.location === "string" ? project.location : null);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setCurrentProjectId(project.id)}
                  className={`text-left rounded-2xl border p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                    isActive
                      ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200 shadow-sm"
                      : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                      {project.name}
                    </h3>
                    <StatusBadge status={project.status} size="sm" />
                  </div>
                  {loc && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-3 truncate">
                      <MapPin size={12} className="shrink-0" />
                      {loc}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>Progress</span>
                    <span className="font-bold text-slate-800">{project.progress ?? 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        project.status === "delayed"
                          ? "bg-red-500"
                          : project.status === "at-risk"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${clamp(project.progress ?? 0, 0, 100)}%` }}
                    />
                  </div>
                  {project.deadline && (
                    <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                      <Calendar size={12} />
                      Due {new Date(project.deadline).toLocaleDateString()}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isCustomizingLayout && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 flex items-center gap-2">
          <GripVertical size={16} />
          Drag metric cards and sections to reorder your dashboard layout.
        </div>
      )}

      {!activeProject && projects.length === 0 && !loadingProjects && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">No projects assigned yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            When projects are assigned to you, they will appear here with live analytics and progress tracking.
          </p>
        </div>
      )}

      {activeProject && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(() => {
          const metricNodes: Record<string, React.ReactNode> = {
            totalBudget: (
              <MetricCard
                title="Total Budget"
                value={
                  activeProject
                    ? formatBudget((activeProject as any).budget_amount ?? activeProject.budget)
                    : "-"
                }
                change={
                  activeProject && derived.approvedSpend > 0
                    ? `${derived.approvedSpend.toLocaleString()} RWF spent (approved)`
                    : activeProject?.construction_type || ""
                }
                changeType="neutral"
                icon={DollarSign}
                iconColor="bg-blue-600"
              />
            ),
            teamSize: (
              <MetricCard
                title="Team Size"
                value={loadingAnalytics ? "..." : derived.teamSize.toString()}
                change="Active workers on site"
                changeType="neutral"
                icon={Users}
                iconColor="bg-purple-600"
              />
            ),
            taskCompletion: (
              <MetricCard
                title="Task Completion"
                value={loadingAnalytics ? "..." : `${derived.taskCompletionPct}%`}
                change={`${derived.completedTasks} / ${derived.totalTasks} Tasks`}
                changeType={derived.totalTasks > 0 && derived.taskCompletionPct >= 60 ? "positive" : "neutral"}
                icon={CheckCircle2}
                iconColor="bg-emerald-500"
              />
            ),
            overallProgress: (
              <MetricCard
                title="Overall Progress"
                value={activeProject ? `${activeProject.progress}%` : "0%"}
                change={activeProject ? `Status: ${activeProject.status.replace('-', ' ')}` : ""}
                changeType={activeProject?.status === 'delayed' ? 'negative' : activeProject?.status === 'at-risk' ? 'negative' : 'positive'}
                icon={TrendingUp}
                iconColor="bg-orange-500"
              />
            ),
          };

          return layout.metrics.map((id, idx) => {
            const node = metricNodes[id];
            if (!node) return null;
            return (
              <div
                key={id}
                draggable={isCustomizingLayout}
                onDragStart={(e) => {
                  if (!isCustomizingLayout) return;
                  e.dataTransfer.setData("text/plain", `metric:${idx}`);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!isCustomizingLayout) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  if (!isCustomizingLayout) return;
                  e.preventDefault();
                  const data = e.dataTransfer.getData("text/plain");
                  if (!data.startsWith("metric:")) return;
                  const from = Number(data.replace("metric:", ""));
                  if (Number.isNaN(from) || from === idx) return;
                  setLayout((prev) => ({ ...prev, metrics: arrayMove(prev.metrics, from, idx) }));
                }}
                className={isCustomizingLayout ? "cursor-move rounded-2xl ring-2 ring-orange-200" : ""}
                title={isCustomizingLayout ? "Drag to reorder" : undefined}
              >
                {node}
              </div>
            );
          });
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className={`lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${
            isCustomizingLayout ? "ring-2 ring-orange-200" : ""
          }`}
          draggable={isCustomizingLayout}
          onDragStart={(e) => {
            if (!isCustomizingLayout) return;
            const idx = layout.sections.indexOf("progressAnalytics");
            e.dataTransfer.setData("text/plain", `section:${idx}`);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (!isCustomizingLayout) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (!isCustomizingLayout) return;
            e.preventDefault();
            const data = e.dataTransfer.getData("text/plain");
            if (!data.startsWith("section:")) return;
            const from = Number(data.replace("section:", ""));
            const to = layout.sections.indexOf("progressAnalytics");
            if (Number.isNaN(from) || from === to) return;
            setLayout((prev) => ({ ...prev, sections: arrayMove(prev.sections, from, to) }));
          }}
          title={isCustomizingLayout ? "Drag to reorder section" : undefined}
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Progress & Analytics</h2>
              <p className="text-sm text-slate-600 mt-1">
                {activeProject ? "Live snapshot for the selected project." : "Pick a project to see progress and analytics."}
              </p>
            </div>
            {activeProject?.status && <StatusBadge status={activeProject.status as any} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <ProgressRing
                value={activeProject?.progress ?? derived.taskCompletionPct}
                label={activeProject ? activeProject.name : "No project selected"}
                sublabel={
                  derived.deadlineDays === null
                    ? "Set a project deadline to unlock schedule insights."
                    : derived.deadlineDays < 0
                      ? `${Math.abs(derived.deadlineDays)} days past deadline`
                      : `${derived.deadlineDays} days to deadline`
                }
              />

              <div className="mt-5">
                <MiniBars
                  items={[
                    { label: "To do", value: derived.pendingTasks, colorClass: "bg-slate-300" },
                    { label: "In prog", value: derived.inProgressTasks, colorClass: "bg-blue-500" },
                    { label: "Done", value: derived.completedTasks, colorClass: "bg-emerald-500" },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue tasks</div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1">
                        {loadingAnalytics ? "…" : derived.overdueCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
                      <CircleAlert size={20} />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Only counts non-completed tasks with past due dates.
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due soon</div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1">
                        {loadingAnalytics ? "…" : derived.dueSoonCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                      <Timer size={20} />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Due today or tomorrow.
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Flag size={18} className="text-purple-600" />
                    Milestones
                  </h3>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {loadingAnalytics ? "Loading…" : `${derived.milestoneCompleted}/${milestones.length} completed`}
                  </div>
                </div>
                {loadingAnalytics ? (
                  <div className="text-sm text-slate-500">Loading milestones...</div>
                ) : milestones.length === 0 ? (
                  <div className="text-sm text-slate-500">No milestones defined.</div>
                ) : (
                  <div className="space-y-3">
                    {(milestones as any[]).slice(0, 4).map((m) => (
                      <div
                        key={m.id}
                        className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">{m.title ?? m.name}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Calendar size={12} />
                            {(m.date ?? m.due_date)
                              ? new Date(m.date ?? m.due_date).toLocaleDateString()
                              : "No due date"}
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : m.status === "delayed"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {String(m.status ?? "pending").replace("-", " ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {derived.nextMilestone && (
                  <div className="mt-4 text-xs text-slate-600 bg-purple-50 border border-purple-100 rounded-xl p-3">
                    <span className="font-bold text-purple-900">Next milestone:</span>{" "}
                    <span className="font-semibold">{derived.nextMilestone.title ?? derived.nextMilestone.name}</span>{" "}
                    <span className="text-purple-800">
                      (in {derived.nextMilestone.daysFromNow} days)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col ${
            isCustomizingLayout ? "ring-2 ring-orange-200" : ""
          }`}
          draggable={isCustomizingLayout}
          onDragStart={(e) => {
            if (!isCustomizingLayout) return;
            const idx = layout.sections.indexOf("recentActivity");
            e.dataTransfer.setData("text/plain", `section:${idx}`);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (!isCustomizingLayout) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (!isCustomizingLayout) return;
            e.preventDefault();
            const data = e.dataTransfer.getData("text/plain");
            if (!data.startsWith("section:")) return;
            const from = Number(data.replace("section:", ""));
            const to = layout.sections.indexOf("recentActivity");
            if (Number.isNaN(from) || from === to) return;
            setLayout((prev) => ({ ...prev, sections: arrayMove(prev.sections, from, to) }));
          }}
          title={isCustomizingLayout ? "Drag to reorder section" : undefined}
        >
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="text-blue-500" size={24} />
            Recent Activity
          </h2>

          <div className="space-y-0 relative flex-1">
            {!currentProjectId ? (
              <p className="text-sm text-slate-500 py-8 text-center">Select a project to see activity.</p>
            ) : loadingAnalytics ? (
              <p className="text-sm text-slate-500 py-8 text-center">Loading activity…</p>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No recent activity for this project yet.</p>
            ) : (
              <>
            <div className="absolute left-3 top-2 bottom-4 w-px bg-slate-200"></div>
            {recentActivity.map((activity, index) => (
              <div key={`${activity.timestamp}-${index}`} className="flex gap-4 relative py-3">
                <div className="relative mt-1 z-10">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 absolute top-0 left-1.5 ${
                      activity.type === "success" 
                        ? "bg-emerald-400 animate-ping opacity-75" 
                        : activity.type === "warning" 
                        ? "bg-orange-400 animate-ping opacity-75" 
                        : "bg-blue-400 animate-ping opacity-75"
                    }`}
                  />
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 relative left-1.5 border-2 border-white shadow-sm ${
                      activity.type === "success" 
                        ? "bg-emerald-500" 
                        : activity.type === "warning" 
                        ? "bg-orange-500" 
                        : "bg-blue-500"
                    }`}
                  />
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 hover:bg-slate-100 transition-colors cursor-default">
                  <p className="text-sm font-bold text-slate-900">
                    {activity.action}
                  </p>
                  {activity.detail && (
                    <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{activity.detail}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                    <Clock size={12} />
                    {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`border rounded-2xl p-5 flex items-start gap-4 shadow-sm relative overflow-hidden group ${
        derived.attentionLevel === "high"
          ? "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
          : derived.attentionLevel === "medium"
            ? "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200"
            : "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200"
        } ${isCustomizingLayout ? "ring-2 ring-orange-200" : ""}`}
        draggable={isCustomizingLayout}
        onDragStart={(e) => {
          if (!isCustomizingLayout) return;
          const idx = layout.sections.indexOf("attentionBanner");
          e.dataTransfer.setData("text/plain", `section:${idx}`);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (!isCustomizingLayout) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!isCustomizingLayout) return;
          e.preventDefault();
          const data = e.dataTransfer.getData("text/plain");
          if (!data.startsWith("section:")) return;
          const from = Number(data.replace("section:", ""));
          const to = layout.sections.indexOf("attentionBanner");
          if (Number.isNaN(from) || from === to) return;
          setLayout((prev) => ({ ...prev, sections: arrayMove(prev.sections, from, to) }));
        }}
        title={isCustomizingLayout ? "Drag to reorder section" : undefined}
      >
        <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
          <AlertTriangle size={100} className="text-orange-600" />
        </div>
        <div className={`p-2 rounded-xl ${
          derived.attentionLevel === "high"
            ? "bg-red-100/80"
            : derived.attentionLevel === "medium"
              ? "bg-orange-100/80"
              : "bg-emerald-100/80"
        }`}>
          <AlertTriangle
            className={`flex-shrink-0 ${
              derived.attentionLevel === "high"
                ? "text-red-600"
                : derived.attentionLevel === "medium"
                  ? "text-orange-600"
                  : "text-emerald-700"
            }`}
            size={24}
          />
        </div>
        <div className="relative z-10">
          <h3 className={`font-bold mb-1 tracking-wide ${
            derived.attentionLevel === "high"
              ? "text-red-900"
              : derived.attentionLevel === "medium"
                ? "text-orange-900"
                : "text-emerald-900"
          }`}>
            {derived.attentionLevel === "high"
              ? "Attention required"
              : derived.attentionLevel === "medium"
                ? "Keep an eye on this"
                : "Everything looks healthy"}
          </h3>
          <p className={`text-sm font-medium leading-relaxed max-w-3xl ${
            derived.attentionLevel === "high"
              ? "text-red-800"
              : derived.attentionLevel === "medium"
                ? "text-orange-800"
                : "text-emerald-800"
          }`}>
            {!activeProject ? (
              <>Select a project to surface schedule and workload risks.</>
            ) : derived.attentionLevel === "high" ? (
              <>
                <strong>{activeProject.name}</strong> has{" "}
                <strong>{derived.overdueCount}</strong> overdue task(s).
                Review task assignments and upcoming milestones to prevent further slippage.
              </>
            ) : derived.attentionLevel === "medium" ? (
              <>
                <strong>{activeProject.name}</strong> has{" "}
                <strong>{derived.dueSoonCount}</strong> task(s) due soon.
                Consider reallocating resources to stay on track.
              </>
            ) : (
              <>
                <strong>{activeProject.name}</strong> is trending well. Keep the team focused on the next milestone.
              </>
            )}
          </p>
        </div>
      </div>
        </>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refreshProjects}
      />
    </div>
  );
}
