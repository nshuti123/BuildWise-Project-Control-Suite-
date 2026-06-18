import { useState, useEffect, useMemo } from "react";
import api from "../api";
import { MetricCard } from "../components/MetricCard";
import {
  Users,
  Shield,
  Activity,
  Settings,
  FileText,
  Database,
  Server,
  Cpu,
  RefreshCw,
  Bell,
  HardHat,
  Briefcase,
  AlertTriangle,
  LayoutGrid,
  CheckSquare,
  DollarSign,
  Truck,
  BarChart3,
  Wallet,
  ArrowRight,
  Lock,
  GripVertical,
} from "lucide-react";
import { arrayMove, loadLayout, saveLayout, type LayoutState } from "../utils/customizableLayout";
import { asList } from "../utils/apiHelpers";

const QUICK_MODULES: {
  id: string;
  label: string;
  description: string;
  icon: typeof Users;
  accent: string;
}[] = [
  { id: "planning", label: "Project Planning", description: "Schedules & milestones", icon: LayoutGrid, accent: "bg-blue-600" },
  { id: "tasks", label: "Tasks", description: "Work assignments", icon: CheckSquare, accent: "bg-violet-600" },
  { id: "budget", label: "Budget & Costs", description: "Financial control", icon: DollarSign, accent: "bg-emerald-600" },
  { id: "procurement", label: "Procurement", description: "Orders & suppliers", icon: Truck, accent: "bg-orange-600" },
  { id: "technical-approvals", label: "Approvals", description: "Review queue", icon: Shield, accent: "bg-indigo-600" },
  { id: "users", label: "User Management", description: "Accounts & roles", icon: Users, accent: "bg-slate-700" },
  { id: "payrolls", label: "Payroll", description: "Staff compensation", icon: Wallet, accent: "bg-teal-600" },
  { id: "reports", label: "Reports", description: "Analytics & exports", icon: BarChart3, accent: "bg-rose-600" },
];

interface SystemLog {
  id: number;
  user: string;
  user_role?: string | null;
  action: string;
  type: string;
  timestamp: string;
}

interface SystemMetrics {
  cpu_usage?: string;
  memory_usage?: string;
  uptime?: string;
  disk_used_gb?: number;
  disk_total_gb?: number;
  disk_percent?: number;
}

function parsePercent(value?: string): number {
  if (!value) return 0;
  const n = parseFloat(value.replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function MetricBar({
  label,
  value,
  percent,
  colorClass,
}: {
  label: string;
  value: string;
  percent: number;
  colorClass: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">{value}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function AdminDashboard({
  setActiveModule,
}: {
  setActiveModule?: (module: string) => void;
}) {
  const [usersCount, setUsersCount] = useState<number>(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState<number>(0);
  const [recentLogs, setRecentLogs] = useState<SystemLog[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const defaultHeaderCards = ["users", "projects", "health", "storage"];
  const defaultSections = ["serverStatus", "recentActivity", "security", "masterData"];
  const [cardsLayout, setCardsLayout] = useState<LayoutState>(() =>
    loadLayout("buildwise.dashboard.admin.cards.v1", defaultHeaderCards),
  );
  const [sectionsLayout, setSectionsLayout] = useState<LayoutState>(() =>
    loadLayout("buildwise.dashboard.admin.sections.v1", defaultSections),
  );

  useEffect(() => saveLayout("buildwise.dashboard.admin.cards.v1", cardsLayout), [cardsLayout]);
  useEffect(() => saveLayout("buildwise.dashboard.admin.sections.v1", sectionsLayout), [sectionsLayout]);

  const fetchSystemData = async () => {
    setIsLoading(true);
    try {
      const [usersResponse, logsResponse, metricsResponse, portfolioResponse] =
        await Promise.all([
          api.get("/users/"),
          api.get("/users/system-logs/"),
          api.get("/users/system-metrics/"),
          api.get("/projects/portfolio-analytics/"),
        ]);
      if (usersResponse.data) {
        const users = asList<{ is_active?: boolean }>(usersResponse.data);
        setUsersCount(users.filter((u) => u.is_active).length);
      }
      if (portfolioResponse.data?.kpis) {
        const kpis = portfolioResponse.data.kpis as {
          total_projects?: number;
          completed_projects?: number;
        };
        const total = kpis.total_projects ?? 0;
        const completed = kpis.completed_projects ?? 0;
        setActiveProjectsCount(Math.max(0, total - completed));
      }
      if (logsResponse.data) {
        setRecentLogs(asList<SystemLog>(logsResponse.data));
      }
      if (metricsResponse.data) {
        setMetrics(metricsResponse.data);
      }
    } catch (err) {
      console.error("Failed to fetch system data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
  }, []);

  const cpuPercent = parsePercent(metrics?.cpu_usage);
  const diskPercent = metrics?.disk_percent ?? 0;

  const systemHealth = useMemo(() => {
    if (!metrics) return { label: "—", type: "neutral" as const };
    const score = 100 - Math.max(cpuPercent, diskPercent) * 0.5;
    if (score >= 85) return { label: `${Math.round(score)}%`, type: "positive" as const };
    if (score >= 70) return { label: `${Math.round(score)}%`, type: "neutral" as const };
    return { label: `${Math.round(score)}%`, type: "negative" as const };
  }, [metrics, cpuPercent, diskPercent]);

  const getLogStyle = (type: string) => {
    switch (type) {
      case "system":
        return { icon: Database, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-100" };
      case "security":
        return { icon: Shield, color: "text-violet-600", bg: "bg-violet-50", ring: "ring-violet-100" };
      case "alert":
        return { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-100" };
      case "user":
        return { icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-100" };
      default:
        return { icon: FileText, color: "text-slate-600", bg: "bg-slate-50", ring: "ring-slate-100" };
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading system overview…</p>
      </div>
    );
  }

  const headerMetricNodes: Record<string, React.ReactNode> = {
    users: (
      <MetricCard
        title="Active Users"
        value={isLoading ? "—" : String(usersCount)}
        change="Registered accounts"
        changeType="neutral"
        icon={Users}
        iconColor="bg-blue-600"
      />
    ),
    projects: (
      <MetricCard
        title="Active Projects"
        value={isLoading ? "—" : String(activeProjectsCount)}
        change="In progress portfolio"
        changeType="positive"
        icon={HardHat}
        iconColor="bg-orange-600"
      />
    ),
    health: (
      <MetricCard
        title="System Health"
        value={isLoading ? "—" : systemHealth.label}
        change={cpuPercent > 80 ? "High CPU load" : "All services nominal"}
        changeType={systemHealth.type}
        icon={Activity}
        iconColor="bg-emerald-600"
      />
    ),
    storage: (
      <MetricCard
        title="Storage Used"
        value={
          isLoading || !metrics?.disk_used_gb
            ? "—"
            : `${metrics.disk_used_gb} GB`
        }
        change={
          metrics?.disk_total_gb
            ? `${diskPercent}% of ${metrics.disk_total_gb} GB`
            : "Disk capacity"
        }
        changeType={diskPercent > 85 ? "negative" : "neutral"}
        icon={Database}
        iconColor="bg-indigo-600"
      />
    ),
  };

  const serverStatusNode = (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <Server size={20} className="text-slate-400" />
            Server Status
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">Live platform metrics</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </span>
      </div>

      <div className="space-y-5 flex-1">
        <MetricBar
          label="CPU Usage"
          value={metrics?.cpu_usage || "—"}
          percent={cpuPercent}
          colorClass={
            cpuPercent > 80 ? "bg-red-500" : cpuPercent > 60 ? "bg-amber-500" : "bg-blue-500"
          }
        />
        <MetricBar
          label="Storage"
          value={
            metrics?.disk_used_gb != null
              ? `${metrics.disk_used_gb} / ${metrics.disk_total_gb ?? "—"} GB`
              : "—"
          }
          percent={diskPercent}
          colorClass={
            diskPercent > 85 ? "bg-red-500" : diskPercent > 70 ? "bg-amber-500" : "bg-indigo-500"
          }
        />

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Cpu size={14} />
              <span className="text-xs font-semibold uppercase tracking-wide">Memory</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{metrics?.memory_usage || "—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Activity size={14} />
              <span className="text-xs font-semibold uppercase tracking-wide">Uptime</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{metrics?.uptime || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const recentActivityNode = (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <Bell size={20} className="text-slate-400" />
            Recent Activity
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">Latest system and user events</p>
        </div>
        {setActiveModule && (
          <button
            type="button"
            onClick={() => setActiveModule("logs")}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
          >
            View all
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
        {recentLogs.length > 0 ? (
          recentLogs.map((log, idx) => {
            const style = getLogStyle(log.type);
            const LogIcon = style.icon;
            const isLast = idx === recentLogs.length - 1;
            return (
              <div key={log.id} className="flex gap-4 relative pb-5">
                {!isLast && (
                  <span className="absolute left-4 top-9 bottom-0 w-px bg-slate-200" />
                )}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-4 ${style.bg} ${style.color} ${style.ring}`}
                >
                  <LogIcon size={14} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-slate-900 leading-snug">
                    <span className="font-semibold">{log.user}</span>
                    {log.user_role && (
                      <span className="text-slate-500 font-normal"> · {log.user_role}</span>
                    )}{" "}
                    <span className="text-slate-600">{log.action}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-slate-400 text-center py-12 rounded-xl border border-dashed border-slate-200">
            No recent activity recorded
          </div>
        )}
      </div>
    </div>
  );

  const securityNode = (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
          <Lock size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Security & Access</h3>
          <p className="text-sm text-slate-500">Platform-wide authentication policies</p>
        </div>
      </div>
      <div className="space-y-3">
        {[
          {
            title: "Require 2FA",
            desc: "Force two-factor auth for admins and project managers",
            enabled: true,
          },
          {
            title: "Global Registration",
            desc: "Allow new user sign-ups from the login page",
            enabled: false,
          },
          {
            title: "Maintenance Mode",
            desc: "Restrict access to administrators during updates",
            enabled: false,
            warn: true,
          },
        ].map((item) => (
          <div
            key={item.title}
            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
              item.warn
                ? "bg-amber-50/60 border-amber-100 hover:bg-amber-50"
                : "bg-slate-50/80 border-slate-100 hover:bg-slate-50"
            }`}
          >
            <div>
              <p className={`font-semibold text-sm ${item.warn ? "text-amber-900" : "text-slate-900"}`}>
                {item.title}
              </p>
              <p className={`text-xs mt-0.5 ${item.warn ? "text-amber-700" : "text-slate-500"}`}>
                {item.desc}
              </p>
            </div>
            <div
              className={`w-11 h-6 rounded-full relative shrink-0 transition-colors ${
                item.enabled
                  ? "bg-blue-600"
                  : item.warn
                    ? "bg-amber-300"
                    : "bg-slate-300"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                  item.enabled ? "right-1" : "left-1"
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const masterDataNode = (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between min-h-[280px]">
      <div>
        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
          <Briefcase size={24} className="text-orange-400" />
        </div>
        <h3 className="font-bold text-xl mb-2">Master Data</h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          Configure global project categories, material catalogs, and approved vendor directories
          used across all sites.
        </p>
      </div>
      <button
        type="button"
        className="mt-6 w-full px-5 py-2.5 bg-white text-slate-900 rounded-xl hover:bg-slate-100 transition-colors font-semibold text-sm inline-flex items-center justify-center gap-2"
      >
        Manage catalogs
        <ArrowRight size={16} />
      </button>
    </div>
  );

  const sectionNodes: Record<string, React.ReactNode> = {
    serverStatus: (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">{serverStatusNode}</div>
        <div className="lg:col-span-2">{recentActivityNode}</div>
      </div>
    ),
    recentActivity: null,
    security: (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {securityNode}
        {masterDataNode}
      </div>
    ),
    masterData: null,
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8 text-left">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 shadow-xl">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
              <Shield size={16} />
              System Administration
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2">
              Platform Control Center
            </h1>
            <p className="text-slate-300 max-w-xl text-sm lg:text-base">
              Monitor BuildWise health, manage users, and access every operational module from
              one central dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchSystemData()}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizing((v) => !v)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                isCustomizing
                  ? "bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30"
                  : "bg-white/10 hover:bg-white/20 border border-white/20"
              }`}
            >
              <Settings size={16} />
              {isCustomizing ? "Done customizing" : "Customize layout"}
            </button>
          </div>
        </div>
      </div>

      {/* Quick access */}
      {setActiveModule && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Operations</h2>
              <p className="text-sm text-slate-500">Full administrator access to all modules</p>
            </div>
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

      {isCustomizing && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 flex items-center gap-2">
          <GripVertical size={16} />
          Drag cards and sections to reorder your dashboard layout.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cardsLayout.order
          .filter((id) => !(cardsLayout.hidden || []).includes(id))
          .map((id, idx) => (
            <div
              key={id}
              draggable={isCustomizing}
              onDragStart={(e) => {
                if (!isCustomizing) return;
                e.dataTransfer.setData("text/plain", String(idx));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!isCustomizing) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!isCustomizing) return;
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isNaN(from) || from === idx) return;
                setCardsLayout((prev) => ({ ...prev, order: arrayMove(prev.order, from, idx) }));
              }}
              className={isCustomizing ? "cursor-move ring-2 ring-orange-300 rounded-2xl" : ""}
            >
              {headerMetricNodes[id]}
            </div>
          ))}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {sectionsLayout.order
          .filter((id) => !(sectionsLayout.hidden || []).includes(id))
          .map((id, idx) => {
            const node = sectionNodes[id];
            if (!node) return null;
            return (
              <div
                key={id}
                draggable={isCustomizing}
                onDragStart={(e) => {
                  if (!isCustomizing) return;
                  e.dataTransfer.setData("text/plain", String(idx));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!isCustomizing) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!isCustomizing) return;
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (Number.isNaN(from) || from === idx) return;
                  setSectionsLayout((prev) => ({
                    ...prev,
                    order: arrayMove(prev.order, from, idx),
                  }));
                }}
                className={isCustomizing ? "cursor-move ring-2 ring-orange-300 rounded-2xl p-1" : ""}
              >
                {node}
              </div>
            );
          })}
      </div>
    </div>
  );
}
