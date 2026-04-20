import { useState, useEffect } from "react";
import api from "../api";
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
} from "lucide-react";

export function AdminDashboard() {
  const [usersCount, setUsersCount] = useState<number>(0);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSystemData = async () => {
      setIsLoading(true);
      try {
        const [usersResponse, logsResponse, metricsResponse] = await Promise.all([
          api.get("/users/"),
          api.get("/users/system-logs/"),
          api.get("/users/system-metrics/")
        ]);
        if (usersResponse.data) {
          setUsersCount(usersResponse.data.length);
        }
        if (logsResponse.data) {
          setRecentLogs(logsResponse.data);
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
    fetchSystemData();
  }, []);

  const getLogStyle = (type: string) => {
    switch (type) {
      case 'system': return { icon: Database, color: "text-blue-500", bg: "bg-blue-50" };
      case 'security': return { icon: Shield, color: "text-purple-500", bg: "bg-purple-50" };
      case 'alert': return { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" };
      case 'user': return { icon: Activity, color: "text-green-500", bg: "bg-green-50" };
      default: return { icon: FileText, color: "text-slate-500", bg: "bg-slate-50" };
    }
  };


  const systemMetrics = [
    { label: "CPU Usage", value: metrics?.cpu_usage || "-", icon: Cpu, color: "text-blue-600" },
    {
      label: "Memory Usage",
      value: metrics?.memory_usage || "-",
      icon: Server,
      color: "text-indigo-600",
    },
    {
      label: "Uptime",
      value: metrics?.uptime || "-",
      icon: Activity,
      color: "text-green-600",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Overview</h1>
          <p className="text-slate-500">
            Monitor BuildWise platform health and high-level configurations.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm">
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Refresh Stats
        </button>
      </div>

      {/* Primary Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">
              Total Active Users
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {isLoading ? "-" : usersCount}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
            <HardHat size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">
              Active Projects
            </p>
            <p className="text-2xl font-bold text-slate-900">12</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">System Health</p>
            <p className="text-2xl font-bold text-slate-900">98%</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
            <Database size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Storage Used</p>
            <p className="text-2xl font-bold text-slate-900">{metrics?.disk_used_gb ? `${metrics.disk_used_gb} GB` : "-"}</p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Server Status Mini-Dashboard */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Server size={20} className="text-slate-400" />
              Server Status
            </h3>
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Online
            </span>
          </div>

          <div className="space-y-6 flex-1">
            {systemMetrics.map((metric, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-slate-50 ${metric.color}`}>
                    <metric.icon size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {metric.label}
                  </span>
                </div>
                <span className="font-bold text-slate-900">{metric.value}</span>
              </div>
            ))}

            <div className="pt-4 mt-auto">
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-1000" 
                  style={{ width: `${metrics?.disk_percent || 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Storage Capacity</span>
                <span>{metrics?.disk_used_gb || 0}GB / {metrics?.disk_total_gb || 0}GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent System Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Bell size={20} className="text-slate-400" />
              Recent System Activity
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All Logs
            </button>
          </div>

          <div className="space-y-5">
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => {
                const style = getLogStyle(log.type);
                const LogIcon = style.icon;
                return (
                  <div key={log.id} className="flex gap-4">
                    <div
                      className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.color}`}
                    >
                      <LogIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{log.user}</span> {log.action}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500 text-center py-4">No recent activity</div>
            )}
          </div>
        </div>
      </div>

      {/* System Configurations Snippet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-slate-400" size={24} />
            <h3 className="font-bold text-slate-900 text-lg">
              Global Security Settings
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div>
                <p className="font-medium text-slate-900">Require 2FA</p>
                <p className="text-xs text-slate-500">
                  Force Two-Factor Auth for Admin & Project Managers
                </p>
              </div>
              <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div>
                <p className="font-medium text-slate-900">
                  Allow Global Registration
                </p>
                <p className="text-xs text-slate-500">
                  Enable new user signups via login page
                </p>
              </div>
              <div className="w-10 h-5 bg-slate-300 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100 transition-colors">
              <div>
                <p className="font-medium text-orange-900">Maintenance Mode</p>
                <p className="text-xs text-orange-700">
                  Lockout non-admins for system updates
                </p>
              </div>
              <div className="w-10 h-5 bg-orange-300 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <Briefcase size={32} />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-2">
            Master Data Management
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm">
            Configure global project categories, master material catalogs, and
            approved vendor directories.
          </p>
          <button className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm">
            Manage Master Data
          </button>
        </div>
      </div>
    </div>
  );
}
