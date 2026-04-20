import {
  FileText,
  Download,
  Calendar,
  Plus,
  PieChart,
  BarChart2,
  Table,
  FileSpreadsheet,
} from "lucide-react";
export function Reports() {
  const templates = [
    {
      name: "Monthly Progress Report",
      type: "Progress",
      icon: BarChart2,
      color: "bg-blue-100 text-blue-600",
    },
    {
      name: "Cost Variance Analysis",
      type: "Financial",
      icon: PieChart,
      color: "bg-green-100 text-green-600",
    },
    {
      name: "Resource Utilization",
      type: "HR",
      icon: Table,
      color: "bg-purple-100 text-purple-600",
    },
    {
      name: "Material Inventory Log",
      type: "Procurement",
      icon: FileSpreadsheet,
      color: "bg-orange-100 text-orange-600",
    },
  ];
  const recentReports = [
    {
      name: "May 2024 Financial Summary",
      date: "2024-06-01",
      author: "John Manager",
      size: "2.4 MB",
      format: "PDF",
    },
    {
      name: "Weekly Site Safety Audit",
      date: "2024-06-12",
      author: "Sarah Johnson",
      size: "1.1 MB",
      format: "PDF",
    },
    {
      name: "Q2 Material Procurement",
      date: "2024-06-10",
      author: "Mike Chen",
      size: "850 KB",
      format: "XLSX",
    },
    {
      name: "Project Timeline Update",
      date: "2024-06-08",
      author: "David Lee",
      size: "3.2 MB",
      format: "PPTX",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Reporting & Analytics
          </h1>
          <p className="text-slate-600">
            Generate, schedule, and export project reports
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">Create Custom Report</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Report Templates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template, index) => (
                <div
                  key={index}
                  className="bg-white p-5 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${template.color}`}>
                      <template.icon size={24} />
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {template.type}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Standard template for {template.name.toLowerCase()} with key
                    metrics.
                  </p>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                      Generate
                    </button>
                    <button className="px-3 py-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded hover:bg-slate-100 transition-colors">
                      <Calendar size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Recent Reports
              </h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View Archive
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Report Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Date Generated
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Generated By
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((report, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded text-slate-500">
                            <FileText size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {report.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {report.format} • {report.size}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {report.date}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {report.author}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="text-slate-400 hover:text-blue-600 transition-colors">
                          <Download size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Scheduled Reports
            </h2>
            <div className="space-y-4">
              {[
                {
                  name: "Weekly Progress Update",
                  schedule: "Every Monday, 9:00 AM",
                  recipients: 8,
                },
                {
                  name: "Monthly Financials",
                  schedule: "1st of month, 10:00 AM",
                  recipients: 4,
                },
                {
                  name: "Daily Site Log",
                  schedule: "Daily, 6:00 PM",
                  recipients: 3,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <Calendar className="text-blue-600 shrink-0 mt-1" size={18} />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500">{item.schedule}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.recipients} recipients
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              Manage Schedules
            </button>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6 text-white">
            <h2 className="text-lg font-bold mb-2">Need Custom Analytics?</h2>
            <p className="text-blue-100 text-sm mb-4">
              Create advanced dashboards and custom visualizations for your
              specific project needs.
            </p>
            <button className="w-full py-2 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors">
              Open Analytics Builder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
