import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Building2,
  ChevronDown,
  ListTodo,
  Flag,
} from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from "../api";
import { useProject } from "../context/ProjectContext";
import { asList } from "../utils/apiHelpers";

interface OverviewMetrics {
  progress?: number;
  total_tasks?: number;
  completed_tasks?: number;
  overdue_tasks?: number;
  due_soon_tasks?: number;
  milestones_total?: number;
  milestones_completed?: number;
  task_completion_pct?: number;
}

interface PhaseTaskRow {
  id: number;
  task_name: string;
  phase: string;
  start_date: string;
  end_date?: string | null;
  progress: number;
  status: string;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildProgressChart(phaseTasks: PhaseTaskRow[], projectProgress: number) {
  if (phaseTasks.length === 0) {
    return [{ label: "Current", planned: projectProgress, actual: projectProgress }];
  }

  const sorted = [...phaseTasks].sort(
    (a, b) =>
      (parseDate(a.start_date)?.getTime() ?? 0) - (parseDate(b.start_date)?.getTime() ?? 0),
  );

  const today = startOfDay(new Date());
  let runningPlanned = 0;
  let runningActual = 0;

  const points = sorted.map((pt, idx) => {
    const start = parseDate(pt.start_date);
    const end = parseDate(pt.end_date) ?? start;
    let plannedForTask = 0;
    if (start && end) {
      if (today >= end) {
        plannedForTask = 100;
      } else if (today <= start) {
        plannedForTask = 0;
      } else {
        const span = end.getTime() - start.getTime();
        plannedForTask =
          span > 0
            ? Math.min(100, Math.round(((today.getTime() - start.getTime()) / span) * 100))
            : 0;
      }
    }
    runningPlanned += plannedForTask;
    runningActual += pt.progress ?? 0;
    const n = idx + 1;
    const label = pt.task_name.length > 14 ? `${pt.task_name.slice(0, 12)}…` : pt.task_name;
    return {
      label,
      planned: Math.round(runningPlanned / n),
      actual: Math.round(runningActual / n),
    };
  });

  return points.slice(-10);
}

export function ProgressMonitoring({
  setActiveModule,
}: {
  setActiveModule?: (module: string) => void;
}) {
  const { currentProjectId, setCurrentProjectId, projects, loadingProjects } = useProject();
  const [project, setProject] = useState<any>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [phaseTasks, setPhaseTasks] = useState<PhaseTaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!currentProjectId) {
      setProject(null);
      setMetrics(null);
      setTasks([]);
      setMilestones([]);
      setPhaseTasks([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [overviewRes, tasksRes, phaseRes] = await Promise.all([
          api.get(`/projects/${currentProjectId}/overview/`),
          api.get(`/projects/tasks/?project=${currentProjectId}&page_size=500`),
          api.get(`/projects/phase-tasks/?project=${currentProjectId}&page_size=500`),
        ]);

        const overview = overviewRes.data;
        setProject(overview.project ?? null);
        setMetrics(overview.metrics ?? null);
        setMilestones(asList(overview.milestones));
        setTasks(asList(tasksRes.data));
        setPhaseTasks(asList(phaseRes.data));
      } catch (err) {
        console.error("Failed to fetch progress data", err);
        setProject(null);
        setMetrics(null);
        setTasks([]);
        setMilestones([]);
        setPhaseTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentProjectId]);

  const projectProgress = metrics?.progress ?? project?.progress ?? 0;
  const completedTasks = metrics?.completed_tasks ?? tasks.filter((t) => t.status === "completed").length;
  const totalTasks = metrics?.total_tasks ?? tasks.length;
  const completedMilestones =
    metrics?.milestones_completed ?? milestones.filter((m) => m.status === "completed").length;
  const totalMilestones = metrics?.milestones_total ?? milestones.length;

  const delayAlerts = useMemo(() => {
    const today = startOfDay(new Date());
    const alerts: {
      id: string;
      type: string;
      title: string;
      projectName: string;
      delayDays: number;
      severity: "critical" | "warning";
    }[] = [];
    const projName = project?.name ?? "Project";

    tasks.forEach((task) => {
      if (task.status === "completed" || !task.date) return;
      const deadline = parseDate(task.date);
      if (!deadline || deadline >= today) return;
      const delayDays = Math.floor(
        (today.getTime() - deadline.getTime()) / (1000 * 3600 * 24),
      );
      alerts.push({
        id: `task-${task.id}`,
        type: "task",
        title: task.title,
        projectName: projName,
        delayDays,
        severity: delayDays > 7 ? "critical" : "warning",
      });
    });

    milestones.forEach((ms) => {
      if (ms.status === "completed" || !ms.date) return;
      const deadline = parseDate(ms.date);
      if (!deadline || deadline >= today) return;
      const delayDays = Math.floor(
        (today.getTime() - deadline.getTime()) / (1000 * 3600 * 24),
      );
      alerts.push({
        id: `ms-${ms.id}`,
        type: "milestone",
        title: ms.name || ms.title || "Milestone",
        projectName: projName,
        delayDays,
        severity: delayDays > 14 ? "critical" : "warning",
      });
    });

    phaseTasks.forEach((pt) => {
      if (pt.status === "completed" || !pt.end_date) return;
      const deadline = parseDate(pt.end_date);
      if (!deadline || deadline >= today) return;
      const delayDays = Math.floor(
        (today.getTime() - deadline.getTime()) / (1000 * 3600 * 24),
      );
      alerts.push({
        id: `pt-${pt.id}`,
        type: "schedule",
        title: `${pt.phase} — ${pt.task_name}`,
        projectName: projName,
        delayDays,
        severity: delayDays > 10 ? "critical" : "warning",
      });
    });

    alerts.sort((a, b) => b.delayDays - a.delayDays);
    return alerts;
  }, [tasks, milestones, phaseTasks, project]);

  const totalDelayDays = delayAlerts.reduce((sum, a) => sum + a.delayDays, 0);
  const progressChartData = useMemo(
    () => buildProgressChart(phaseTasks, projectProgress),
    [phaseTasks, projectProgress],
  );

  const handleExport = async () => {
    if (!currentProjectId) return;
    setExporting(true);
    try {
      const response = await api.get(
        `/projects/${currentProjectId}/generate-report/?type=Progress`,
        { responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Progress_Report_${project?.name?.replace(/\s+/g, "_") || currentProjectId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Could not export progress report.");
    } finally {
      setExporting(false);
    }
  };

  if (loadingProjects && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading projects…</p>
      </div>
    );
  }

  if (!currentProjectId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <Building2 size={40} className="mx-auto text-slate-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">No project selected</h2>
        <p className="text-sm text-slate-500">
          Choose a project from the sidebar to monitor progress, milestones, and schedule delays.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading progress data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-6 lg:p-8 shadow-xl">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-teal-400 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-300 text-sm font-semibold uppercase tracking-widest mb-2">
              <TrendingUp size={16} />
              Progress Monitoring
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mb-1">
              {project?.name ?? "Project timeline"}
            </h1>
            <p className="text-slate-300 text-sm">
              Real-time schedule tracking, milestones, and delay alerts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
              <Building2 size={16} className="text-teal-200" />
              <div className="relative">
                <select
                  value={currentProjectId}
                  onChange={(e) => setCurrentProjectId(Number(e.target.value))}
                  className="appearance-none bg-transparent pr-7 text-sm font-semibold text-white outline-none min-w-[140px]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="text-slate-900">
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-teal-200 pointer-events-none"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-teal-500/25"
            >
              <Download size={16} />
              {exporting ? "Exporting…" : "Export report"}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Overall Completion"
          value={`${projectProgress}%`}
          change={`${completedTasks} of ${totalTasks} tasks done`}
          changeType={projectProgress >= 60 ? "positive" : "neutral"}
          icon={TrendingUp}
          iconColor="bg-teal-600"
        />
        <MetricCard
          title="Timeline Adherence"
          value={`${completedTasks + completedMilestones} / ${totalTasks + totalMilestones}`}
          change="Tasks & milestones completed"
          changeType="positive"
          icon={CheckCircle2}
          iconColor="bg-emerald-600"
        />
        <MetricCard
          title="Total Delay Days"
          value={String(totalDelayDays)}
          change={
            delayAlerts.length > 0
              ? `${delayAlerts.length} active alert${delayAlerts.length === 1 ? "" : "s"}`
              : "On schedule"
          }
          changeType={totalDelayDays > 0 ? "negative" : "positive"}
          icon={Clock}
          iconColor="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Planned vs actual progress</h2>
          <p className="text-sm text-slate-500 mb-6">
            Based on schedule phase tasks for this project
          </p>
          {phaseTasks.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <ListTodo size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No schedule tasks yet.</p>
              {setActiveModule && (
                <button
                  type="button"
                  onClick={() => setActiveModule("planning")}
                  className="mt-3 text-sm font-semibold text-teal-600 hover:text-teal-700"
                >
                  Add tasks in Project Planning →
                </button>
              )}
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressChartData}>
                  <defs>
                    <linearGradient id="pmPlanned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pmActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                    formatter={(v: number) => [`${v}%`]}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="planned"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    fill="url(#pmPlanned)"
                    name="Planned"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="#0d9488"
                    strokeWidth={2}
                    fill="url(#pmActual)"
                    name="Actual"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Delay alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            Delay alerts
            {delayAlerts.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs py-0.5 px-2 rounded-full font-bold">
                {delayAlerts.length}
              </span>
            )}
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {delayAlerts.length === 0 ? (
              <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-sm">
                All tasks, milestones, and schedule items are on time.
              </div>
            ) : (
              delayAlerts.slice(0, 8).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-xl ${
                    alert.severity === "critical"
                      ? "bg-red-50 border-red-100"
                      : "bg-amber-50 border-amber-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className={`shrink-0 mt-0.5 ${
                        alert.severity === "critical" ? "text-red-600" : "text-amber-600"
                      }`}
                      size={18}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${
                          alert.severity === "critical" ? "text-red-700" : "text-amber-700"
                        }`}
                      >
                        {alert.type === "milestone"
                          ? "Milestone"
                          : alert.type === "schedule"
                            ? "Schedule"
                            : "Task"}
                      </p>
                      <p
                        className={`text-sm font-semibold mt-0.5 ${
                          alert.severity === "critical" ? "text-red-900" : "text-amber-900"
                        }`}
                      >
                        {alert.title}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          alert.severity === "critical" ? "text-red-700" : "text-amber-700"
                        }`}
                      >
                        {alert.delayDays} day{alert.delayDays === 1 ? "" : "s"} overdue
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Milestones & tasks snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Flag size={18} className="text-violet-600" />
            Milestones
            <span className="text-xs font-normal text-slate-500 ml-auto">
              {completedMilestones}/{totalMilestones} completed
            </span>
          </h2>
          {milestones.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
              No milestones defined for this project.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                    <p className="text-xs text-slate-500">
                      {m.date ? new Date(m.date).toLocaleDateString() : "No date"}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      m.status === "completed"
                        ? "completed"
                        : m.status === "on-track"
                          ? "on-track"
                          : "pending"
                    }
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ListTodo size={18} className="text-blue-600" />
            Open tasks
            <span className="text-xs font-normal text-slate-500 ml-auto">
              {totalTasks - completedTasks} remaining
            </span>
          </h2>
          {tasks.filter((t) => t.status !== "completed").length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
              All tasks are completed.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tasks
                .filter((t) => t.status !== "completed")
                .slice(0, 12)
                .map((t) => {
                  const overdue =
                    t.date &&
                    t.status !== "completed" &&
                    parseDate(t.date)! < startOfDay(new Date());
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        overdue
                          ? "bg-red-50 border-red-100"
                          : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                        <p className="text-xs text-slate-500">
                          {t.date ? `Due ${new Date(t.date).toLocaleDateString()}` : "No due date"}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                          t.status === "in_progress"
                            ? "bg-blue-100 text-blue-700"
                            : overdue
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {overdue ? "Overdue" : t.status?.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Portfolio */}
      {projects.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">All your projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCurrentProjectId(p.id)}
                className={`text-left border rounded-xl p-4 transition-all hover:shadow-md ${
                  p.id === currentProjectId
                    ? "border-teal-300 bg-teal-50 ring-2 ring-teal-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{p.name}</h3>
                  <StatusBadge status={p.status as any} size="sm" />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Progress</span>
                  <span className="font-bold text-slate-800">{p.progress ?? 0}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-teal-500"
                    style={{ width: `${Math.min(100, p.progress ?? 0)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
