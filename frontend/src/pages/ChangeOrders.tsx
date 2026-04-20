import {
  FileText,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";

export function ChangeOrders() {
  const changeOrders = [
    {
      id: "CO-001",
      title: "Foundation Reinforcement",
      description:
        "Additional steel reinforcement required due to soil conditions in Sector C.",
      cost: 45000,
      status: "Approved",
      date: "May 12, 2024",
      impact: "High",
    },
    {
      id: "CO-002",
      title: "HVAC System Upgrade",
      description:
        "Client requested upgrade to HEPA filtration units for all office areas.",
      cost: 120000,
      status: "Pending",
      date: "Jun 05, 2024",
      impact: "Medium",
    },
    {
      id: "CO-003",
      title: "Lobby Flooring Material Change",
      description:
        "Switch from ceramic tile to marble as per revised interior design.",
      cost: 85000,
      status: "Rejected",
      date: "Jun 10, 2024",
      impact: "Low",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Change Orders</h1>
          <p className="text-slate-500">
            Manage scope changes and budget adjustments
          </p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus size={20} />
          New Change Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Total Requests
              </p>
              <p className="text-2xl font-bold text-slate-900">12</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Approved Cost
              </p>
              <p className="text-2xl font-bold text-slate-900">Rwf45.2M</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Pending Approval
              </p>
              <p className="text-2xl font-bold text-slate-900">3</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-900">
            Recent Change Requests
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ID / Title
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cost Impact
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {changeOrders.map((co) => (
                <tr
                  key={co.id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {co.id}
                        </span>
                        {co.impact === "High" && (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded font-medium">
                            High Impact
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-slate-900">{co.title}</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs">
                        {co.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {co.date}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-slate-900 font-medium">
                      Rwf{co.cost.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        co.status === "Approved"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : co.status === "Pending"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {co.status === "Approved" && (
                        <CheckCircle2 size={12} className="mr-1.5" />
                      )}
                      {co.status === "Pending" && (
                        <Clock size={12} className="mr-1.5" />
                      )}
                      {co.status === "Rejected" && (
                        <XCircle size={12} className="mr-1.5" />
                      )}
                      {co.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Details <ArrowRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
