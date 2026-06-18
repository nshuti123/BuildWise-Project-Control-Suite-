import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  FileText,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import api from "../api";
import { Pagination } from "../components/Pagination";
import { TableReportActions } from "../components/TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";

interface SystemLog {
  id: number;
  user: string;
  user_role?: string | null;
  action: string;
  type: string;
  timestamp: string;
}

interface PaginatedLogs {
  count: number;
  next: string | null;
  previous: string | null;
  results: SystemLog[];
}

const LOG_FILTERS = [
  { id: "all", label: "All events" },
  { id: "security", label: "Security" },
  { id: "alert", label: "Alerts" },
  { id: "user", label: "User actions" },
  { id: "system", label: "System" },
] as const;

function getLogStyle(type: string) {
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
}

function isHighlightedLog(log: SystemLog): boolean {
  const action = log.action.toLowerCase();
  return (
    log.type === "security" ||
    action.includes("failed login") ||
    action.includes("generated report")
  );
}

function asPaginated(data: unknown): PaginatedLogs {
  if (data && typeof data === "object" && "results" in data) {
    const payload = data as PaginatedLogs;
    return {
      count: payload.count ?? payload.results.length,
      next: payload.next ?? null,
      previous: payload.previous ?? null,
      results: Array.isArray(payload.results) ? payload.results : [],
    };
  }
  const list = Array.isArray(data) ? (data as SystemLog[]) : [];
  return { count: list.length, next: null, previous: null, results: list };
}

export function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pageSize = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, debouncedSearch]);

  const fetchLogs = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(pageSize),
      });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await api.get(`/users/system-logs/?${params.toString()}`);
      const payload = asPaginated(response.data);
      setLogs(payload.results);
      setTotalCount(payload.count);
    } catch (err) {
      console.error("Failed to load system logs:", err);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, typeFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const summary = useMemo(() => {
    const failed = logs.filter((l) => l.action.toLowerCase().includes("failed login")).length;
    const reports = logs.filter((l) => l.action.toLowerCase().includes("generated report")).length;
    return { failed, reports };
  }, [logs]);

  const logsReport = useMemo((): TableReportData => {
    const columns = ["Timestamp", "Type", "User", "Role", "Action"];
    const rows = logs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.type,
      log.user,
      log.user_role ?? "—",
      log.action,
    ]);
    return {
      title: "System Logs",
      subtitle: `Page ${currentPage} · ${logs.length} events (filter: ${typeFilter})`,
      filename: "System_Logs",
      columns,
      rows,
    };
  }, [logs, currentPage, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Logs</h1>
          <p className="text-slate-600 mt-1">
            Audit trail for security events, report generation, and platform activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <TableReportActions report={logsReport} disabled={logs.length === 0 || isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total events</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount.toLocaleString()}</p>
        </div>
        <div className="bg-violet-50 rounded-xl border border-violet-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Failed logins (page)</p>
          <p className="text-2xl font-bold text-violet-900 mt-1">{summary.failed}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Reports generated (page)</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{summary.reports}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {LOG_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTypeFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === filter.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions (e.g. failed login, generated report)…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading system logs…</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No log entries match your filters.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const style = getLogStyle(log.type);
              const LogIcon = style.icon;
              const highlighted = isHighlightedLog(log);
              return (
                <div
                  key={log.id}
                  className={`flex gap-4 p-4 ${highlighted ? "bg-amber-50/40" : "hover:bg-slate-50/80"}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-4 ${style.bg} ${style.color} ${style.ring}`}
                  >
                    <LogIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {log.type}
                      </span>
                      {highlighted && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Important
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-900 mt-1 leading-snug">
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
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
