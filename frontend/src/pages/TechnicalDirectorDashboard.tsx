import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { useProject } from "../context/ProjectContext";
import { formatBudget } from "../utils/formatters";
import {
  Building2,
  TrendingUp,
  Users,
  Plus,
  Wrench,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  HardHat,
  Package,
  ClipboardList,
  BarChart3,
  DollarSign,
  Eye,
  XCircle,
} from "lucide-react";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { SiteIncidentsPanel } from "../components/SiteIncidentsPanel";
import { openWorkforcePayrollReview } from "../utils/workforceNavigation";
import { canInitiateWorkerPayment } from "../utils/roleCapabilities";
import { useAuth } from "../context/AuthContext";
import { TableReportActions } from "../components/TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface PortfolioKpis {
  total_projects: number;
  total_budget: number;
  total_spend: number;
  avg_progress: number;
  budget_utilization: number;
  at_risk_projects: number;
  completed_projects: number;
  on_track_projects: number;
  pending_approvals: number;
  open_incidents?: number;
  pending_technical_approvals?: number;
}

interface PmPerformanceRow {
  id: number;
  name: string;
  email?: string;
  project_count: number;
  avg_progress: number;
  overdue_tasks: number;
  open_incidents: number;
}

interface AnalyticsPayload {
  kpis: PortfolioKpis;
  status_distribution: { name: string; value: number }[];
  pm_performance?: PmPerformanceRow[];
}

interface ProjectRow {
  id: number;
  name: string;
  progress: number;
  status: "on-track" | "at-risk" | "delayed" | "completed";
  deadline?: string;
  construction_type?: string;
  manager_details?: { id?: number; full_name?: string; username?: string };
  site_engineer_details?: { full_name?: string };
}

interface ManagerRow {
  id: number;
  full_name?: string;
  username?: string;
  email?: string;
  is_active?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  "on-track": "#22c55e",
  "at-risk": "#eab308",
  delayed: "#ef4444",
  completed: "#3b82f6",
};

const QUICK_ACTIONS = [
  { id: "planning", label: "Project Planning", desc: "Schedules & milestones", icon: Calendar, color: "bg-blue-500" },
  { id: "tasks", label: "Tasks", desc: "Site work & assignments", icon: ClipboardList, color: "bg-violet-500" },
  { id: "progress", label: "Progress", desc: "Monitor delivery", icon: TrendingUp, color: "bg-emerald-500" },
  { id: "procurement", label: "Procurement", desc: "Materials & orders", icon: Package, color: "bg-amber-500" },
  { id: "workforce", label: "Workforce & Payroll", desc: "Pay workers & attendance", icon: HardHat, color: "bg-slate-600" },
  { id: "users", label: "Team & Staff", desc: "PMs & site roles", icon: Users, color: "bg-indigo-500" },
  { id: "technical-approvals", label: "Approvals", desc: "Technical queue", icon: CheckCircle2, color: "bg-cyan-600" },
] as const;

function asList<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data?.results ?? [];
}

export function TechnicalDirectorDashboard({
  setActiveModule,
  onOpenProjectDetail,
}: {
  setActiveModule?: (m: string) => void;
  onOpenProjectDetail?: (projectId: number) => void;
}) {
  const { setCurrentProjectId, currentProjectId, projects: sidebarProjects } = useProject();
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [pendingPayrolls, setPendingPayrolls] = useState<any[]>([]);
  const [payrollModal, setPayrollModal] = useState<{
    open: boolean;
    payrollId: number | null;
    action: "approve" | "reject";
    date: string;
    amount: number;
  }>({ open: false, payrollId: null, action: "approve", date: "", amount: 0 });
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [analyticsRes, projectsRes, usersRes] = await Promise.all([
        api.get("/projects/portfolio-analytics/"),
        api.get("/projects/"),
        api.get("/users/"),
      ]);
      setAnalytics(analyticsRes.data);
      setProjects(asList(projectsRes.data));
      const userList = asList(usersRes.data);
      setManagers(
        userList.filter((u: { role?: string }) => u.role === "project-manager") as ManagerRow[],
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchPendingPayrolls = useCallback(async () => {
    if (!currentProjectId) {
      setPendingPayrolls([]);
      return;
    }
    try {
      const resp = await api.get(
        `/workforce/payrolls/?project=${currentProjectId}&status=awaiting_site_engineer`,
      );
      setPendingPayrolls(asList(resp.data));
    } catch (e) {
      console.error(e);
      setPendingPayrolls([]);
    }
  }, [currentProjectId]);

  useEffect(() => {
    fetchPendingPayrolls();
  }, [fetchPendingPayrolls]);

  const selectedProject = sidebarProjects.find((p) => p.id === currentProjectId);

  const goInitiateWorkerPayment = () => {
    openWorkforcePayrollReview(new Date().toISOString().split("T")[0]);
    setActiveModule?.("workforce");
  };

  const submitPayrollAction = async () => {
    if (!payrollModal.payrollId) return;
    try {
      if (payrollModal.action === "approve") {
        await api.post(`/workforce/payrolls/${payrollModal.payrollId}/confirm-site/`);
      } else {
        await api.post(`/workforce/payrolls/${payrollModal.payrollId}/reject/`, {
          reason: "Rejected by Technical Director",
        });
      }
      await fetchPendingPayrolls();
    } catch (err) {
      console.error(err);
      alert("Action failed. Please try again.");
    }
  };

  const kpis = analytics?.kpis;
  const statusChart = analytics?.status_distribution ?? [];

  const atRiskProjects = useMemo(
    () => projects.filter((p) => p.status === "at-risk" || p.status === "delayed"),
    [projects],
  );

  const progressChart = useMemo(
    () =>
      [...projects]
        .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
        .slice(0, 8)
        .map((p) => ({
          name: p.name.length > 14 ? `${p.name.slice(0, 12)}…` : p.name,
          progress: p.progress ?? 0,
        })),
    [projects],
  );

  const managersWithLoad = useMemo(
    () =>
      managers.map((m) => ({
        ...m,
        projectCount: projects.filter((p) => p.manager_details?.id === m.id).length,
      })),
    [managers, projects],
  );

  const pmPerformanceReport = useMemo((): TableReportData => {
    const rows = (analytics?.pm_performance ?? []).map((pm: any) => [
      pm.name,
      String(pm.project_count),
      `${pm.avg_progress}%`,
      String(pm.overdue_tasks),
      String(pm.open_incidents),
    ]);
    return {
      title: "Project Manager Performance",
      subtitle: `${rows.length} managers`,
      filename: "PM_Performance",
      columns: ["Manager", "Projects", "Avg progress", "Overdue tasks", "Open incidents"],
      rows,
    };
  }, [analytics?.pm_performance]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading technical portfolio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-8 shadow-xl">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-400 via-transparent to-transparent" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-2">
              <Wrench size={16} />
              Technical Portfolio
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2">
              Construction oversight
            </h1>
            <p className="text-slate-300 max-w-xl text-sm lg:text-base">
              {kpis?.total_projects ?? 0} active projects · {managers.length} project managers ·{" "}
              {Math.round(kpis?.avg_progress ?? 0)}% average progress across the portfolio.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-cyan-500/30"
            >
              <Plus size={18} />
              New project
            </button>
            {setActiveModule && (kpis?.pending_technical_approvals ?? 0) > 0 && (
              <button
                onClick={() => setActiveModule("technical-approvals")}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-cyan-500/30"
              >
                <CheckCircle2 size={18} />
                {kpis?.pending_technical_approvals} technical approvals
              </button>
            )}
            {setActiveModule && (kpis?.at_risk_projects ?? 0) > 0 && (
              <button
                onClick={() => setActiveModule("progress")}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/90 hover:bg-amber-500 rounded-xl font-semibold text-sm transition-colors"
              >
                <AlertTriangle size={18} />
                {kpis?.at_risk_projects} at risk
              </button>
            )}
            {setActiveModule && (
              <button
                onClick={() => setActiveModule("reports")}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium text-sm transition-colors"
              >
                Reports
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {canInitiateWorkerPayment(user?.role) && currentProjectId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="text-emerald-700" size={22} />
                <h2 className="text-lg font-bold text-emerald-950">Worker payments</h2>
              </div>
              <p className="text-sm text-emerald-900/80">
                {selectedProject?.name
                  ? `For ${selectedProject.name}: mark attendance, then initiate daily payroll.`
                  : "Select a project in the sidebar, then pay workers from Workforce & Payroll."}
              </p>
            </div>
            {setActiveModule && (
              <button
                type="button"
                onClick={goInitiateWorkerPayment}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors"
              >
                <DollarSign size={18} />
                Initiate worker payment
              </button>
            )}
          </div>
          {pendingPayrolls.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-emerald-200">
              <p className="text-sm font-semibold text-amber-900">
                {pendingPayrolls.length} payroll batch(es) awaiting site confirmation
              </p>
              {pendingPayrolls.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-xl border border-emerald-200 p-4"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {p.date} · {Number(p.total_amount).toLocaleString()} Rwf
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      From {p.initiated_by_name || "site"} · Batch #{p.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        openWorkforcePayrollReview(p.date);
                        setActiveModule?.("workforce");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100"
                    >
                      <Eye size={16} /> View
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPayrollModal({
                          open: true,
                          payrollId: p.id,
                          action: "approve",
                          date: p.date,
                          amount: Number(p.total_amount),
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={16} /> Send to finance
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPayrollModal({
                          open: true,
                          payrollId: p.id,
                          action: "reject",
                          date: p.date,
                          amount: Number(p.total_amount),
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <MetricCard
          title="Active Projects"
          value={String(kpis?.total_projects ?? 0)}
          change={`${kpis?.on_track_projects ?? 0} on track`}
          changeType="positive"
          icon={Building2}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Avg Progress"
          value={`${Math.round(kpis?.avg_progress ?? 0)}%`}
          change={`${kpis?.completed_projects ?? 0} completed`}
          changeType="positive"
          icon={TrendingUp}
          iconColor="bg-cyan-600"
        />
        <MetricCard
          title="At Risk / Delayed"
          value={String(kpis?.at_risk_projects ?? 0)}
          change="Requires intervention"
          changeType={(kpis?.at_risk_projects ?? 0) > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
          iconColor="bg-amber-500"
        />
        <MetricCard
          title="Portfolio Budget"
          value={formatBudget(kpis?.total_budget ?? 0)}
          change="Planned (all sites)"
          icon={BarChart3}
          iconColor="bg-indigo-600"
        />
        <MetricCard
          title="Project Managers"
          value={String(managers.length)}
          change="Technical line"
          icon={Users}
          iconColor="bg-violet-600"
        />
        <MetricCard
          title="Technical Queue"
          value={String(kpis?.pending_technical_approvals ?? 0)}
          change="Awaiting your review"
          changeType={(kpis?.pending_technical_approvals ?? 0) > 0 ? "neutral" : "positive"}
          icon={CheckCircle2}
          iconColor="bg-cyan-600"
        />
        <MetricCard
          title="Open Incidents"
          value={String(kpis?.open_incidents ?? 0)}
          change="Safety & quality"
          changeType={(kpis?.open_incidents ?? 0) > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
          iconColor="bg-red-500"
        />
      </div>

      {/* PM performance */}
      {(analytics?.pm_performance?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Project manager performance</h2>
              <p className="text-sm text-slate-500">Workload, progress, overdue tasks & open incidents</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TableReportActions
                report={pmPerformanceReport}
                disabled={!(analytics?.pm_performance?.length)}
              />
            {setActiveModule && (
              <button
                onClick={() => setActiveModule("users")}
                className="text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                Manage team →
              </button>
            )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Manager</th>
                  <th className="px-4 py-3">Projects</th>
                  <th className="px-4 py-3">Avg progress</th>
                  <th className="px-4 py-3">Overdue tasks</th>
                  <th className="px-4 py-3">Open incidents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics!.pm_performance!.map((pm) => (
                  <tr key={pm.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-medium text-slate-900">{pm.name}</td>
                    <td className="px-4 py-3">{pm.project_count}</td>
                    <td className="px-4 py-3">{pm.avg_progress}%</td>
                    <td className="px-4 py-3">
                      <span className={pm.overdue_tasks > 0 ? "text-amber-700 font-semibold" : ""}>
                        {pm.overdue_tasks}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={pm.open_incidents > 0 ? "text-red-600 font-semibold" : ""}>
                        {pm.open_incidents}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <SiteIncidentsPanel
          projectId={currentProjectId ?? null}
          projectName={selectedProject?.name}
          canResolve
          maxOpenShown={8}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Progress by project</h2>
          <p className="text-sm text-slate-500 mb-6">Top sites by completion %</p>
          {progressChart.length === 0 ? (
            <p className="text-slate-400 text-sm py-16 text-center">No projects yet</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Progress"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="progress" fill="#0ea5e9" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Project health</h2>
          <p className="text-sm text-slate-500 mb-4">Status distribution</p>
          {statusChart.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">No projects</p>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={68}
                      paddingAngle={3}
                    >
                      {statusChart.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {statusChart.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: STATUS_COLORS[s.name] || "#94a3b8" }}
                    />
                    <span className="text-slate-600 capitalize">{s.name.replace(/-/g, " ")}</span>
                    <span className="font-bold text-slate-900 ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Portfolio + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Project portfolio</h2>
              <p className="text-sm text-slate-500">Progress, PM assignment & site engineers</p>
            </div>
            {setActiveModule && (
              <button
                onClick={() => setActiveModule("progress")}
                className="text-sm font-medium text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
              >
                View all <ArrowRight size={14} />
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
            {projects.length === 0 ? (
              <p className="p-10 text-center text-slate-500 text-sm">No projects in the portfolio</p>
            ) : (
              projects.map((p) => (
                <div key={p.id} className="px-6 py-4 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentProjectId(p.id);
                          onOpenProjectDetail?.(p.id);
                        }}
                        className="font-semibold text-slate-900 truncate text-left hover:text-cyan-700 transition-colors"
                      >
                        {p.name}
                      </button>
                      <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                        <span>PM: {p.manager_details?.full_name || "Unassigned"}</span>
                        <span>SE: {p.site_engineer_details?.full_name || "—"}</span>
                        {p.deadline && (
                          <span>Due {new Date(p.deadline).toLocaleDateString()}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {onOpenProjectDetail && (
                        <button
                          type="button"
                          onClick={() => onOpenProjectDetail(p.id)}
                          className="text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg"
                        >
                          Full detail
                        </button>
                      )}
                      <StatusBadge status={p.status} size="sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.status === "delayed"
                            ? "bg-gradient-to-r from-red-500 to-red-400"
                            : p.status === "at-risk"
                              ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                              : "bg-gradient-to-r from-cyan-600 to-blue-500"
                        }`}
                        style={{ width: `${Math.min(100, p.progress ?? 0)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700 w-10 text-right tabular-nums">
                      {p.progress ?? 0}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* At risk */}
          <div
            className={`rounded-2xl border p-6 shadow-sm ${
              atRiskProjects.length > 0
                ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle
                size={20}
                className={atRiskProjects.length > 0 ? "text-amber-600" : "text-green-500"}
              />
              <h2 className="text-lg font-bold text-slate-900">Attention required</h2>
            </div>
            {atRiskProjects.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
                <p className="text-sm text-slate-600 font-medium">All projects on track</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskProjects.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 bg-white/80 rounded-xl px-3 py-2.5 border border-amber-100"
                  >
                    <span className="font-medium text-slate-900 text-sm truncate">{p.name}</span>
                    <StatusBadge status={p.status} size="sm" />
                  </div>
                ))}
                {atRiskProjects.length > 5 && (
                  <p className="text-xs text-amber-700 font-medium text-center">
                    +{atRiskProjects.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* PM roster */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Project managers</h2>
            <p className="text-sm text-slate-500 mb-4">Your direct technical reports</p>
            {managersWithLoad.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No PMs assigned yet</p>
            ) : (
              <div className="space-y-3">
                {managersWithLoad.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(m.full_name || m.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">
                        {m.full_name || m.username}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{m.email}</p>
                    </div>
                    <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-lg shrink-0">
                      {m.projectCount} {m.projectCount === 1 ? "site" : "sites"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {setActiveModule && (
              <button
                onClick={() => setActiveModule("users")}
                className="mt-4 w-full text-sm font-medium text-violet-600 hover:text-violet-700 py-2 rounded-lg hover:bg-violet-50 transition-colors"
              >
                Manage team →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {setActiveModule && (
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => setActiveModule(action.id)}
                  className="group text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-cyan-200 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div
                    className={`${action.color} w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}
                  >
                    <Icon size={20} />
                  </div>
                  <p className="font-semibold text-slate-900 text-sm">{action.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{action.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={payrollModal.open}
        title={payrollModal.action === "approve" ? "Send payroll to finance" : "Reject payroll"}
        message={
          payrollModal.action === "approve"
            ? `Send ${payrollModal.amount.toLocaleString()} Rwf for ${payrollModal.date} to the finance department?`
            : `Reject payroll for ${payrollModal.date}? The initiator will be notified.`
        }
        confirmText={payrollModal.action === "approve" ? "Send to finance" : "Reject"}
        type={payrollModal.action === "approve" ? "info" : "danger"}
        onConfirm={async () => {
          await submitPayrollAction();
          setPayrollModal({
            open: false,
            payrollId: null,
            action: "approve",
            date: "",
            amount: 0,
          });
        }}
        onClose={() =>
          setPayrollModal({
            open: false,
            payrollId: null,
            action: "approve",
            date: "",
            amount: 0,
          })
        }
      />

      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
