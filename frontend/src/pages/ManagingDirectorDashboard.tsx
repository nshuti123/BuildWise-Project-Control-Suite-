import { useState, useEffect, useMemo } from "react";
import api from "../api";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import { formatBudget } from "../utils/formatters";
import {
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Crown,
  ArrowRight,
  Briefcase,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
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
  pending_transactions: number;
  pending_transaction_amount: number;
  active_staff: number;
}

interface AnalyticsPayload {
  kpis: PortfolioKpis;
  status_distribution: { name: string; value: number }[];
  cash_flow: { date: string; amount: number }[];
  staff_by_department: { department: string; count: number }[];
}

interface ProjectRow {
  id: number;
  name: string;
  progress: number;
  status: "on-track" | "at-risk" | "delayed" | "completed";
  deadline?: string;
  construction_type?: string;
  manager_details?: { full_name?: string };
  site_engineer_details?: { full_name?: string };
  budget_amount?: number | string;
}

const STATUS_COLORS: Record<string, string> = {
  "on-track": "#22c55e",
  "at-risk": "#eab308",
  delayed: "#ef4444",
  completed: "#3b82f6",
};

const DEPT_LABELS: Record<string, string> = {
  executive: "Executive",
  finance: "Finance",
  technical: "Technical",
  site: "Site Operations",
  external: "External",
  "": "Unassigned",
};

export function ManagingDirectorDashboard({
  setActiveModule,
}: {
  setActiveModule?: (m: string) => void;
}) {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [orgNodes, setOrgNodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [analyticsRes, projectsRes, orgRes] = await Promise.all([
          api.get("/projects/portfolio-analytics/"),
          api.get("/projects/"),
          api.get("/users/org-chart/"),
        ]);
        setAnalytics(analyticsRes.data);
        setProjects(projectsRes.data);
        setOrgNodes(orgRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const kpis = analytics?.kpis;
  const statusChart = analytics?.status_distribution ?? [];
  const cashFlow = analytics?.cash_flow ?? [];
  const staffByDept = analytics?.staff_by_department ?? [];

  const deptChart = useMemo(
    () =>
      staffByDept.map((d) => ({
        name: DEPT_LABELS[d.department] || d.department || "Other",
        count: d.count,
      })),
    [staffByDept],
  );

  const topProjects = useMemo(
    () => [...projects].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0)).slice(0, 6),
    [projects],
  );

  const atRiskProjects = useMemo(
    () => projects.filter((p) => p.status === "at-risk" || p.status === "delayed"),
    [projects],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading executive overview…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 shadow-xl">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-500 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold uppercase tracking-widest mb-2">
              <Crown size={16} />
              Executive Command Center
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2">
              Company Overview
            </h1>
            <p className="text-slate-300 max-w-xl text-sm lg:text-base">
              Real-time visibility across {kpis?.total_projects ?? 0} construction projects,{" "}
              {kpis?.active_staff ?? 0} staff, and company-wide financial performance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {setActiveModule && (kpis?.pending_transactions ?? 0) > 0 && (
              <button
                onClick={() => setActiveModule("budget")}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-orange-500/30"
              >
                <DollarSign size={18} />
                {kpis?.pending_transactions} pending in Budget & Costs
              </button>
            )}
            {setActiveModule && (
              <button
                onClick={() => setActiveModule("reports")}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium text-sm transition-colors"
              >
                View reports
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid */}
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
          title="Portfolio Budget"
          value={formatBudget(kpis?.total_budget ?? 0)}
          change="Planned spend"
          icon={DollarSign}
          iconColor="bg-emerald-600"
        />
        <MetricCard
          title="Approved Spend"
          value={formatBudget(kpis?.total_spend ?? 0)}
          change={`${kpis?.budget_utilization ?? 0}% utilized`}
          changeType={
            (kpis?.budget_utilization ?? 0) > 90 ? "negative" : "neutral"
          }
          icon={TrendingUp}
          iconColor="bg-indigo-600"
        />
        <MetricCard
          title="Avg Progress"
          value={`${Math.round(kpis?.avg_progress ?? 0)}%`}
          change={`${kpis?.completed_projects ?? 0} completed`}
          changeType="positive"
          icon={CheckCircle2}
          iconColor="bg-violet-600"
        />
        <MetricCard
          title="At Risk / Delayed"
          value={String(kpis?.at_risk_projects ?? 0)}
          change="Needs attention"
          changeType={(kpis?.at_risk_projects ?? 0) > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
          iconColor="bg-amber-500"
        />
        <MetricCard
          title="Active Staff"
          value={String(kpis?.active_staff ?? 0)}
          change={`${kpis?.pending_transactions ?? 0} txns to review`}
          icon={Users}
          iconColor="bg-slate-700"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Company cash flow</h2>
          <p className="text-sm text-slate-500 mb-6">Approved spend across all projects (monthly)</p>
          {cashFlow.length === 0 ? (
            <p className="text-slate-400 text-sm py-16 text-center">No transaction history yet</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlow}>
                  <defs>
                    <linearGradient id="execSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                    tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatBudget(v), "Spend"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#ea580c"
                    strokeWidth={2}
                    fill="url(#execSpend)"
                  />
                </AreaChart>
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
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
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
              <div className="grid grid-cols-2 gap-2 mt-2">
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

      {/* Projects + Approvals */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Project portfolio</h2>
              <p className="text-sm text-slate-500">All sites — progress and leadership</p>
            </div>
            {setActiveModule && (
              <button
                onClick={() => setActiveModule("progress")}
                className="text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                View all <ArrowRight size={14} />
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {projects.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">No projects in the portfolio</p>
            ) : (
              projects.map((p) => (
                <div key={p.id} className="px-6 py-4 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span>PM: {p.manager_details?.full_name || "Unassigned"}</span>
                        <span>Engineer: {p.site_engineer_details?.full_name || "—"}</span>
                        {p.construction_type && (
                          <span className="capitalize">{p.construction_type}</span>
                        )}
                      </p>
                    </div>
                    <StatusBadge status={p.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-orange-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, p.progress ?? 0)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700 w-10 text-right">
                      {p.progress ?? 0}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Pending transactions</h2>
              {setActiveModule && (kpis?.pending_transactions ?? 0) > 0 && (
                <button
                  onClick={() => setActiveModule("budget")}
                  className="text-xs font-semibold text-orange-600 hover:underline"
                >
                  Budget & Costs
                </button>
              )}
            </div>
            {(kpis?.pending_transactions ?? 0) === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <CheckCircle2 className="mx-auto mb-2 text-green-500" size={28} />
                No pending financial approvals
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-2xl font-bold text-slate-900">
                  {kpis?.pending_transactions}
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    items · {formatBudget(kpis?.pending_transaction_amount ?? 0)}
                  </span>
                </p>
                <p className="text-sm text-slate-600">
                  Review and approve from Budget & Costs on any project.
                </p>
                {setActiveModule && (
                  <button
                    onClick={() => setActiveModule("budget")}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                  >
                    Go to Budget & Costs
                  </button>
                )}
              </div>
            )}
          </div>

          {atRiskProjects.length > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
              <h3 className="font-bold text-red-900 flex items-center gap-2 mb-3">
                <AlertTriangle size={18} />
                Attention required
              </h3>
              <ul className="space-y-2">
                {atRiskProjects.slice(0, 4).map((p) => (
                  <li key={p.id} className="text-sm text-red-800 font-medium">
                    {p.name}
                    <span className="text-red-600 font-normal ml-1">({p.status})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: staff + org + highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Workforce by department</h2>
          <p className="text-sm text-slate-500 mb-4">Active login accounts</p>
          {deptChart.length === 0 ? (
            <p className="text-slate-400 text-sm">No staff data</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Briefcase size={20} className="text-slate-500" />
            Top performers
          </h2>
          <p className="text-sm text-slate-500 mb-4">Highest progress this period</p>
          <ul className="space-y-3">
            {topProjects.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate text-sm">{p.name}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700">{p.progress}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Organization</h2>
          <p className="text-sm text-slate-500 mb-4">Reporting structure</p>
          <div className="max-h-52 overflow-y-auto pr-2 space-y-1 text-sm custom-scrollbar">
            {orgNodes
              .filter((n) => !n.reports_to_id)
              .map((head) => (
                <OrgNode key={head.id} node={head} all={orgNodes} depth={0} />
              ))}
            {orgNodes.length === 0 && (
              <p className="text-slate-400">Assign managers in Team & Users</p>
            )}
          </div>
          {setActiveModule && (
            <button
              onClick={() => setActiveModule("users")}
              className="mt-4 w-full py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Manage team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrgNode({
  node,
  all,
  depth,
}: {
  node: { id: number; name: string; role: string };
  all: { id: number; name: string; role: string; reports_to_id: number | null }[];
  depth: number;
}) {
  const children = all.filter((n) => n.reports_to_id === node.id);
  return (
    <div className={depth > 0 ? "ml-3 border-l border-slate-200 pl-3" : ""}>
      <p className="py-1">
        <span className="font-medium text-slate-800">{node.name}</span>
        <span className="text-slate-400 ml-2 text-xs capitalize">
          {node.role.replace(/-/g, " ")}
        </span>
      </p>
      {children.map((c) => (
        <OrgNode key={c.id} node={c} all={all} depth={depth + 1} />
      ))}
    </div>
  );
}
