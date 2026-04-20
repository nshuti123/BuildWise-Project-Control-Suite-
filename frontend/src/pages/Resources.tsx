import { Users, Briefcase, Clock, Calendar, Filter, Plus } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
export function Resources() {
  const workloadData = [
    {
      name: "Site Engineers",
      current: 85,
      capacity: 100,
    },
    {
      name: "Architects",
      current: 45,
      capacity: 60,
    },
    {
      name: "Laborers",
      current: 180,
      capacity: 200,
    },
    {
      name: "Electricians",
      current: 35,
      capacity: 40,
    },
    {
      name: "Plumbers",
      current: 28,
      capacity: 35,
    },
  ];
  const teamMembers = [
    {
      name: "James Wilson",
      role: "Senior Site Engineer",
      project: "Riverside Mall",
      status: "active",
      utilization: 95,
    },
    {
      name: "Maria Garcia",
      role: "Structural Lead",
      project: "Corporate Tower",
      status: "active",
      utilization: 80,
    },
    {
      name: "Robert Brown",
      role: "Safety Officer",
      project: "Multiple",
      status: "active",
      utilization: 60,
    },
    {
      name: "Lisa Anderson",
      role: "Architect",
      project: "Residential Estate",
      status: "leave",
      utilization: 0,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Resource Management
          </h1>
          <p className="text-slate-600">
            Team allocation, workload balancing, and capacity planning
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Filter size={18} />
            <span className="text-sm font-medium">Filter</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} />
            <span className="text-sm font-medium">Allocate Resource</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Workforce"
          value="342"
          change="+12 this month"
          changeType="positive"
          icon={Users}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Avg. Utilization"
          value="82%"
          change="Optimal range"
          changeType="positive"
          icon={Briefcase}
          iconColor="bg-green-600"
        />
        <MetricCard
          title="Overtime Hours"
          value="145h"
          change="+15% vs last week"
          changeType="negative"
          icon={Clock}
          iconColor="bg-orange-500"
        />
        <MetricCard
          title="On Leave"
          value="8"
          change="3 returning soon"
          changeType="neutral"
          icon={Calendar}
          iconColor="bg-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Resource Capacity vs Allocation
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={workloadData}
              layout="vertical"
              margin={{
                left: 40,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={true}
                stroke="#e2e8f0"
              />
              <XAxis type="number" />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{
                  fontSize: 12,
                }}
              />
              <Tooltip
                cursor={{
                  fill: "#f1f5f9",
                }}
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              />
              <Legend />
              <Bar
                dataKey="current"
                name="Current Allocation"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
              <Bar
                dataKey="capacity"
                name="Total Capacity"
                fill="#e2e8f0"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Key Personnel Status
          </h2>
          <div className="space-y-4">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${member.status === "active" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}
                >
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {member.name}
                    </h3>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${member.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {member.status === "active" ? "Active" : "On Leave"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {member.role} • {member.project}
                  </p>
                  {member.status === "active" && (
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${member.utilization > 90 ? "bg-red-500" : "bg-blue-500"}`}
                        style={{
                          width: `${member.utilization}%`,
                        }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            View Full Team Directory
          </button>
        </div>
      </div>
    </div>
  );
}
