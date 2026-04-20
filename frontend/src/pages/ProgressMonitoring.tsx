import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Download,
} from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
export function ProgressMonitoring() {
  const progressData = [
    {
      month: "Jan",
      planned: 10,
      actual: 10,
    },
    {
      month: "Feb",
      planned: 25,
      actual: 22,
    },
    {
      month: "Mar",
      planned: 40,
      actual: 35,
    },
    {
      month: "Apr",
      planned: 55,
      actual: 48,
    },
    {
      month: "May",
      planned: 70,
      actual: 65,
    },
    {
      month: "Jun",
      planned: 85,
      actual: 78,
    },
  ];
  const projects = [
    {
      name: "Riverside Mall Complex",
      phase: "Structural Framework",
      completion: 78,
      status: "on-track",
      delay: 0,
      manager: "John Manager",
    },
    {
      name: "Corporate Office Tower",
      phase: "Foundation",
      completion: 45,
      status: "delayed",
      delay: 12,
      manager: "Sarah Johnson",
    },
    {
      name: "Residential Estate Phase 2",
      phase: "Finishing",
      completion: 92,
      status: "on-track",
      delay: 0,
      manager: "David Lee",
    },
    {
      name: "Industrial Warehouse",
      phase: "Site Preparation",
      completion: 34,
      status: "at-risk",
      delay: 5,
      manager: "Mike Chen",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Progress Monitoring
          </h1>
          <p className="text-slate-600">
            Real-time project status and performance metrics
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Filter size={18} />
            <span className="text-sm font-medium">Filter View</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={18} />
            <span className="text-sm font-medium">Export Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Overall Completion"
          value="67%"
          change="+5% this month"
          changeType="positive"
          icon={TrendingUp}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Milestones Met"
          value="24/30"
          change="80% success rate"
          changeType="positive"
          icon={CheckCircle2}
          iconColor="bg-green-600"
        />
        <MetricCard
          title="Total Delay Days"
          value="17"
          change="+2 this week"
          changeType="negative"
          icon={Clock}
          iconColor="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Planned vs Actual Progress
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressData}>
                <defs>
                  <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="planned"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPlanned)"
                  name="Planned"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  name="Actual"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Delay Alerts
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="text-red-600 shrink-0 mt-0.5"
                  size={20}
                />
                <div>
                  <h3 className="font-semibold text-red-900">
                    Corporate Office Tower
                  </h3>
                  <p className="text-sm text-red-800 mt-1">
                    Foundation work delayed by 12 days due to heavy rainfall.
                    Critical path impacted.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="text-yellow-600 shrink-0 mt-0.5"
                  size={20}
                />
                <div>
                  <h3 className="font-semibold text-yellow-900">
                    Industrial Warehouse
                  </h3>
                  <p className="text-sm text-yellow-800 mt-1">
                    Material delivery pending for site preparation. 5 days risk
                    estimated.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="text-blue-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold text-blue-900">
                    Schedule Update
                  </h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Riverside Mall Complex is 2 days ahead of schedule for
                    structural phase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          Project Portfolio Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <div
              key={index}
              className="border border-slate-200 rounded-lg p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">{project.name}</h3>
                  <p className="text-sm text-slate-600">{project.phase}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${project.status === "on-track" ? "bg-green-100 text-green-800 border-green-200" : project.status === "delayed" ? "bg-red-100 text-red-800 border-red-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"}`}
                >
                  {project.status === "on-track"
                    ? "On Track"
                    : project.status === "delayed"
                      ? `Delayed (${project.delay} days)`
                      : "At Risk"}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Completion</span>
                  <span className="font-semibold text-slate-900">
                    {project.completion}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${project.status === "delayed" ? "bg-red-500" : project.status === "at-risk" ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{
                      width: `${project.completion}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-100">
                <span>Manager: {project.manager}</span>
                <button className="text-blue-600 hover:text-blue-700 font-medium">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
