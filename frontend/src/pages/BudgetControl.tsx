import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
export function BudgetControl() {
  const budgetData = [
    {
      category: "Labor",
      planned: 120,
      actual: 115,
    },
    {
      category: "Materials",
      planned: 180,
      actual: 195,
    },
    {
      category: "Equipment",
      planned: 80,
      actual: 75,
    },
    {
      category: "Subcontractors",
      planned: 150,
      actual: 160,
    },
    {
      category: "Permits",
      planned: 30,
      actual: 28,
    },
  ];
  const expenseBreakdown = [
    {
      name: "Materials",
      value: 195,
      color: "#3b82f6",
    },
    {
      name: "Subcontractors",
      value: 160,
      color: "#f97316",
    },
    {
      name: "Labor",
      value: 115,
      color: "#10b981",
    },
    {
      name: "Equipment",
      value: 75,
      color: "#8b5cf6",
    },
    {
      name: "Permits",
      value: 28,
      color: "#ef4444",
    },
  ];
  const totalPlanned = budgetData.reduce((sum, item) => sum + item.planned, 0);
  const totalActual = budgetData.reduce((sum, item) => sum + item.actual, 0);
  const variance = totalActual - totalPlanned;
  const variancePercent = ((variance / totalPlanned) * 100).toFixed(1);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Budget & Cost Control
        </h1>
        <p className="text-slate-600">
          Riverside Mall Complex - Financial Overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="text-blue-600" size={20} />
            </div>
            <span className="text-sm font-medium text-slate-600">
              Total Budget
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            Rwf{totalPlanned}M
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="text-orange-600" size={20} />
            </div>
            <span className="text-sm font-medium text-slate-600">
              Actual Spend
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">Rwf{totalActual}M</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-lg ${variance > 0 ? "bg-red-100" : "bg-green-100"}`}
            >
              {variance > 0 ? (
                <TrendingUp className="text-red-600" size={20} />
              ) : (
                <TrendingDown className="text-green-600" size={20} />
              )}
            </div>
            <span className="text-sm font-medium text-slate-600">Variance</span>
          </div>
          <p
            className={`text-3xl font-bold ${variance > 0 ? "text-red-600" : "text-green-600"}`}
          >
            {variance > 0 ? "+" : ""}Rwf{Math.abs(variance)}M
          </p>
          <p className="text-sm text-slate-600 mt-1">
            {variance > 0 ? "+" : ""}
            {variancePercent}%
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="text-purple-600" size={20} />
            </div>
            <span className="text-sm font-medium text-slate-600">
              Remaining
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            Rwf{totalPlanned - totalActual}M
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Budget vs Actual by Category
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={budgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="category"
                tick={{
                  fontSize: 12,
                }}
              />
              <YAxis
                tick={{
                  fontSize: 12,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
              <Legend />
              <Bar
                dataKey="planned"
                fill="#3b82f6"
                name="Planned (RwfM)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="actual"
                fill="#f97316"
                name="Actual (RwfM)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Expense Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expenseBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {expenseBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `Rwf${value}M`}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          Recent Transactions
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                  Description
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                  Category
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                  Amount
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  date: "2024-06-10",
                  desc: "Steel beams delivery",
                  category: "Materials",
                  amount: 12500000,
                  status: "approved",
                },
                {
                  date: "2024-06-09",
                  desc: "Crane rental - Week 12",
                  category: "Equipment",
                  amount: 850000,
                  status: "approved",
                },
                {
                  date: "2024-06-08",
                  desc: "Electrical subcontractor",
                  category: "Subcontractors",
                  amount: 5200000,
                  status: "pending",
                },
                {
                  date: "2024-06-07",
                  desc: "Labor - Site crew",
                  category: "Labor",
                  amount: 3100000,
                  status: "approved",
                },
                {
                  date: "2024-06-06",
                  desc: "Concrete mix delivery",
                  category: "Materials",
                  amount: 4800000,
                  status: "approved",
                },
              ].map((transaction, index) => (
                <tr
                  key={index}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {transaction.date}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-900 font-medium">
                    {transaction.desc}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      {transaction.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-900 font-semibold text-right">
                    Rwf{(transaction.amount / 1000000).toFixed(2)}M
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${transaction.status === "approved" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                    >
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {variance > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle
            className="text-red-600 flex-shrink-0 mt-0.5"
            size={20}
          />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">
              Budget Overrun Alert
            </h3>
            <p className="text-sm text-red-800">
              Current spending exceeds planned budget by Rwf{variance}M (
              {variancePercent}%). Review material costs and subcontractor
              expenses for optimization opportunities.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
