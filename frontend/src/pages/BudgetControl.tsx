import { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  Plus,
  Receipt,
  ListTodo,
  PieChart as PieChartIcon,
  Pencil,
  Tags,
  Trash2,
  Activity,
  Download,
  Calendar,
  Briefcase,
  FileText
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
  AreaChart,
  Area,
} from "recharts";
import api from "../api";
import { BudgetItemModal } from "../components/BudgetItemModal";
import { CategoryModal } from "../components/CategoryModal";
import { TransactionModal } from "../components/TransactionModal";
import { TransactionReceiptModal } from "../components/TransactionReceiptModal";
import { CustomReportModal } from "../components/CustomReportModal";
import { TableReportActions } from "../components/TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

const FINANCE_APPROVER_ROLES = new Set([
  "accountant",
  "director-finance",
  "managing-director",
  "admin",
  "project-manager",
]);

/** Must match backend BUILDWISE_FINANCE_ESCALATION_THRESHOLD (RWF) */
const FINANCE_ESCALATION_THRESHOLD = 5_000_000;

function canUserApproveTransaction(
  role: string | undefined,
  amount: number,
): boolean {
  if (!role || !FINANCE_APPROVER_ROLES.has(role)) return false;
  if (role === "project-manager" && amount >= FINANCE_ESCALATION_THRESHOLD) {
    return false;
  }
  return true;
}

function canUserDeleteTransaction(role: string | undefined): boolean {
  return (
    role === "director-finance" ||
    role === "managing-director" ||
    role === "admin"
  );
}

interface BudgetSummary {
  total_planned: number;
  total_budget?: number;
  total_allocated?: number;
  remaining_to_allocate?: number;
  total_actual: number;
  variance: number;
  variance_percent: number;
  by_category: Array<{
    category__name: string;
    category__color: string;
    planned: number;
    actual: number;
  }>;
}

interface Transaction {
  id: number;
  description: string;
  category: number;
  category_details: {
    name: string;
    color: string;
  };
  amount: string;
  transaction_date: string;
  status: string;
  notes: string;
}

interface Project {
  id: number;
  name: string;
  budget?: string;
  budget_amount?: number | string;
}

export function BudgetControl() {
  const { user } = useAuth();
  const { currentProjectId, setCurrentProjectId, projects } = useProject();
  const selectedProject = currentProjectId;
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [cashFlow, setCashFlow] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "items" | "transactions" | "categories">("overview");

  const [isBudgetItemModalOpen, setIsBudgetItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<any>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCustomReportModalOpen, setIsCustomReportModalOpen] = useState(false);
  const [viewedTransaction, setViewedTransaction] = useState<Transaction | null>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<any>(null);

  // Fetch budget data when project is selected
  useEffect(() => {
    if (selectedProject) {
      refreshData();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (activeTab === "categories") {
      fetchCategories();
    }
  }, [activeTab]);

  const refreshData = () => {
    if (selectedProject) {
      fetchBudgetSummary(selectedProject);
      fetchRecentTransactions(selectedProject);
      fetchBudgetItems(selectedProject);
      fetchCashFlow(selectedProject);
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (
      !window.confirm(
        `Delete transaction "${transaction.description}" (${transaction.transaction_date})? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`projects/transactions/${transaction.id}/`);
      if (viewedTransaction?.id === transaction.id) {
        setViewedTransaction(null);
      }
      refreshData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete transaction.";
      alert(msg);
    }
  };

  const handleApproveTransaction = async (transactionId: number) => {
    if (!window.confirm("Are you sure you want to approve this transaction? This action will formally deduct from the budget and complete any associated Purchase Orders.")) {
      return;
    }
    
    try {
      await api.patch(`projects/transactions/${transactionId}/approve/`);
      refreshData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to approve transaction";
      alert(msg);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get("projects/budget-categories/");
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchBudgetSummary = async (projectId: number) => {
    setLoading(true);
    try {
      const response = await api.get(`projects/budget-items/summary/?project=${projectId}`);
      setBudgetSummary(response.data);
    } catch (error) {
      console.error("Error fetching budget summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentTransactions = async (projectId: number) => {
    try {
      const response = await api.get(`projects/transactions/recent/?project=${projectId}&limit=50`);
      setTransactions(response.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const fetchBudgetItems = async (projectId: number) => {
    try {
      const response = await api.get(`projects/budget-items/?project=${projectId}`);
      setBudgetItems(response.data);
    } catch (error) {
      console.error("Error fetching budget items:", error);
    }
  };

  const fetchCashFlow = async (projectId: number) => {
    try {
      const response = await api.get(`projects/transactions/cash-flow/?project=${projectId}`);
      let cumulative = 0;
      const processed = response.data.map((item: any) => {
        cumulative += Number(item.total);
        return {
          date: item.date,
          amount: cumulative / 1000000 
        };
      });
      setCashFlow(processed);
    } catch (error) {
      console.error("Error fetching cash flow:", error);
    }
  };

  const handleGenerateReport = async (type: string, startDate?: string, endDate?: string) => {
    if (!selectedProject) return;
    try {
      let url = `projects/${selectedProject}/generate-report/?type=${type}`;
      if (startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const response = await api.get(url, { responseType: 'blob' });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (error) {
      console.error('Error downloading report', error);
      alert('Failed to generate report.');
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toFixed(0);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="backdrop-blur-xl bg-white/90 border border-slate-200 shadow-2xl rounded-xl p-4 transition-all">
          {label && <p className="text-slate-500 font-bold mb-2 text-xs uppercase tracking-wider">{label}</p>}
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4 text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-slate-700">{entry.name}:</span>
                </div>
                <span className="text-slate-900">Rwf{Number(entry.value).toFixed(2)}M</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const budgetData =
    budgetSummary?.by_category.map((cat) => ({
      category: cat.category__name,
      planned: cat.planned / 1000000,
      actual: cat.actual / 1000000,
    })) || [];

  const expenseBreakdown =
    budgetSummary?.by_category.map((cat) => ({
      name: cat.category__name,
      value: cat.actual / 1000000,
      color: cat.category__color || "#3b82f6",
    })) || [];

  const totalPlanned = budgetSummary?.total_planned || 0;
  const totalBudget = budgetSummary?.total_budget ?? totalPlanned;
  const totalAllocated = budgetSummary?.total_allocated ?? 0;
  const remainingToAllocate = budgetSummary?.remaining_to_allocate ?? (totalBudget - totalAllocated);
  const totalActual = budgetSummary?.total_actual || 0;
  const variance = budgetSummary?.variance || 0;
  const variancePercent = budgetSummary?.variance_percent || 0;
  const overallUtilization = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const topExpenses = [...budgetItems]
    .sort((a, b) => Number(b.actual_amount) - Number(a.actual_amount))
    .slice(0, 5);

  const activeProjectName =
    projects.find((p) => p.id === selectedProject)?.name ?? "Project";

  const transactionsReport = useMemo((): TableReportData => {
    const columns = ["Date", "Description", "Category", "Amount (Rwf)", "Status"];
    const rows = transactions.map((t) => [
      t.transaction_date,
      t.description,
      t.category_details?.name ?? "N/A",
      formatCurrency(Number(t.amount)),
      t.status,
    ]);
    return {
      title: `Transaction History — ${activeProjectName}`,
      subtitle: `${transactions.length} transactions`,
      filename: `Transactions_${selectedProject ?? "project"}`,
      columns,
      rows,
    };
  }, [transactions, activeProjectName, selectedProject]);

  const budgetItemsReport = useMemo((): TableReportData => {
    const columns = ["Category", "Description", "Planned (Rwf)", "Actual (Rwf)", "Utilization %", "Variance (Rwf)"];
    const rows = budgetItems.map((item) => {
      const planned = Number(item.planned_amount);
      const actual = Number(item.actual_amount);
      const utilization = planned > 0 ? ((actual / planned) * 100).toFixed(1) : "0";
      const varVal = actual - planned;
      return [
        item.category_details?.name ?? "N/A",
        item.description,
        formatCurrency(planned),
        formatCurrency(actual),
        utilization,
        formatCurrency(Math.abs(varVal)),
      ];
    });
    return {
      title: `Planned Budget Items — ${activeProjectName}`,
      subtitle: `${budgetItems.length} line items`,
      filename: `Budget_Items_${selectedProject ?? "project"}`,
      columns,
      rows,
    };
  }, [budgetItems, activeProjectName, selectedProject]);

  const categoriesReport = useMemo((): TableReportData => {
    const columns = ["Name", "Description", "Color"];
    const rows = categories.map((cat) => [cat.name, cat.description || "—", cat.color]);
    return {
      title: "Budget Categories",
      subtitle: `${categories.length} categories`,
      filename: "Budget_Categories",
      columns,
      rows,
    };
  }, [categories]);

  const handleEditItem = (item: any) => {
    setItemToEdit(item);
    setIsBudgetItemModalOpen(true);
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await api.delete(`projects/budget-categories/${id}/`);
      fetchCategories();
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 500) {
        alert("Cannot delete this category because expenses or budget items are currently using it. You can rename it or change its color instead.");
      } else {
        alert("Failed to delete category.");
      }
    }
  };

  const handleExportReport = async () => {
    if (!selectedProject) return;
    try {
      const response = await api.get(`projects/${selectedProject}/generate-report/`, {
        params: { type: 'Financial' },
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (error) {
      console.error('Error downloading report', error);
      alert('Failed to generate report.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Project Selector & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Budget & Cost Control</h1>
          <p className="text-slate-600">Track and manage project budgets, expenses, and variances</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProject || ""}
            onChange={(e) => setCurrentProjectId(Number(e.target.value))}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Select Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            onClick={refreshData}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 bg-white"
            title="Refresh Data"
          >
            <RefreshCw size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      {!selectedProject ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <DollarSign className="mx-auto text-slate-300" size={48} />
          <p className="text-slate-600 mt-4">Select a project to view budget details</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <RefreshCw className="mx-auto animate-spin text-blue-600" size={32} />
          <p className="text-slate-600 mt-4">Loading budget data...</p>
        </div>
      ) : (
        <>
          {/* Allocation Summary (Project Budget baseline) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Budget allocation</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Allocations are capped by the project budget set during project initialization.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Project budget
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1">
                    Rwf{formatCurrency(totalBudget)}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Allocated (planned)
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1">
                    Rwf{formatCurrency(totalAllocated)}
                  </div>
                </div>
                <div className={`border rounded-xl px-4 py-3 ${
                  remainingToAllocate < 0
                    ? "bg-red-50 border-red-200"
                    : remainingToAllocate === 0
                      ? "bg-orange-50 border-orange-200"
                      : "bg-emerald-50 border-emerald-200"
                }`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${
                    remainingToAllocate < 0
                      ? "text-red-700"
                      : remainingToAllocate === 0
                        ? "text-orange-700"
                        : "text-emerald-700"
                  }`}>
                    Remaining to allocate
                  </div>
                  <div className={`text-lg font-extrabold mt-1 ${
                    remainingToAllocate < 0
                      ? "text-red-900"
                      : remainingToAllocate === 0
                        ? "text-orange-900"
                        : "text-emerald-900"
                  }`}>
                    Rwf{formatCurrency(Math.max(remainingToAllocate, 0))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span className="font-medium">Allocated</span>
                <span className="font-bold">
                  {totalBudget > 0 ? ((totalAllocated / totalBudget) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    totalBudget > 0 && totalAllocated / totalBudget >= 1
                      ? "bg-gradient-to-r from-orange-500 to-red-600"
                      : "bg-gradient-to-r from-blue-500 to-indigo-600"
                  }`}
                  style={{
                    width: `${Math.min(100, totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0)}%`,
                  }}
                />
              </div>
              {totalBudget <= 0 && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This project has no budget set (or it could not be parsed). Set a project budget to enable allocation limits.
                </div>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-lg shadow-blue-900/10 border border-blue-700/50 p-6 text-white relative overflow-hidden group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                <DollarSign size={90} />
              </div>
              <div className="flex items-center gap-3 mb-2 relative z-10">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                  <DollarSign className="text-white" size={20} />
                </div>
                <span className="text-sm font-semibold text-blue-100 tracking-wide">TOTAL BUDGET</span>
              </div>
              <p className="text-3xl font-bold relative z-10 mt-3">Rwf{formatCurrency(totalBudget)}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl shadow-lg shadow-orange-900/10 border border-orange-600/50 p-6 text-white relative overflow-hidden group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                <TrendingUp size={90} />
              </div>
              <div className="flex items-center gap-3 mb-2 relative z-10">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                  <TrendingUp className="text-white" size={20} />
                </div>
                <span className="text-sm font-semibold text-orange-100 tracking-wide">ACTUAL SPEND</span>
              </div>
              <p className="text-3xl font-bold relative z-10 mt-3">Rwf{formatCurrency(totalActual)}</p>
            </div>

            <div className={`rounded-2xl shadow-lg border p-6 text-white relative overflow-hidden group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ${
              variance > 0
                ? "bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/10 border-red-600/50" 
                : "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-900/10 border-emerald-600/50"
            }`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                {variance > 0 ? <TrendingUp size={90} /> : <TrendingDown size={90} />}
              </div>
              <div className="flex items-center gap-3 mb-2 relative z-10">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                  {variance > 0 ? (
                    <TrendingUp className="text-white" size={20} />
                  ) : (
                    <TrendingDown className="text-white" size={20} />
                  )}
                </div>
                <span className="text-sm font-semibold text-white/80 tracking-wide">VARIANCE</span>
              </div>
              <p className="text-3xl font-bold relative z-10 mt-3">
                {variance > 0 ? "+" : ""}Rwf{formatCurrency(Math.abs(variance))}
              </p>
              <p className="text-sm text-white/90 mt-1 relative z-10 font-bold bg-black/10 inline-block px-2 py-0.5 rounded-md">
                {variancePercent > 0 ? "+" : ""}
                {variancePercent.toFixed(1)}%
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-purple-800 rounded-2xl shadow-lg shadow-purple-900/10 border border-purple-700/50 p-6 flex flex-col justify-between text-white relative overflow-hidden group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                <PieChartIcon size={90} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                    <DollarSign className="text-white" size={20} />
                  </div>
                  <span className="text-sm font-semibold text-purple-100 tracking-wide">REMAINING</span>
                </div>
                <p className="text-3xl font-bold mt-3">
                  Rwf{formatCurrency(totalBudget - totalActual)}
                </p>
              </div>
              
              <div className="mt-5 relative z-10">
                <div className="flex justify-between text-xs text-purple-100 mb-1.5">
                  <span className="font-medium tracking-wide">Utilization</span>
                  <span className="font-bold">{overallUtilization.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden backdrop-blur-sm shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      overallUtilization >= 100
                        ? "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]"
                        : overallUtilization >= 75
                        ? "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.8)]"
                        : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                    }`}
                    style={{ width: `${Math.min(overallUtilization, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Alert */}
          {variance > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Budget Overrun Alert</h3>
                <p className="text-sm text-red-800">
                  Current spending exceeds planned budget by Rwf{formatCurrency(variance)} (
                  {variancePercent.toFixed(1)}%). Review recent transactions for optimization opportunities.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === "overview"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <PieChartIcon size={18} />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("items")}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === "items"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ListTodo size={18} />
              Budget Items
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === "transactions"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Receipt size={18} />
              Transactions
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === "categories"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Tags size={18} />
              Categories
            </button>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === "overview" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-end">
                  <button
                    onClick={handleExportReport}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg transition-all shadow-sm font-medium"
                  >
                    <Download size={18} />
                    Export PDF Report
                  </button>
                </div>

                {/* Top Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Category Breakdown */}
                  <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <BarChart className="text-blue-500" size={24} />
                      Budget vs Actual
                    </h2>
                    {budgetData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={budgetData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}M`} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 600, fontSize: '14px', color: '#475569' }} iconType="circle" />
                          <Bar dataKey="planned" fill="#3b82f6" name="Planned" radius={[6, 6, 0, 0]} maxBarSize={40} />
                          <Bar dataKey="actual" fill="#f97316" name="Actual" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[320px] flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">No budget data available</div>
                    )}
                  </div>

                  {/* Donut Chart - Expense Distribution */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow">
                    <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <PieChartIcon className="text-purple-500" size={24} />
                      Expense Distribution
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">Breakdown of actual spending</p>
                    {expenseBreakdown.length > 0 ? (
                      <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={expenseBreakdown}
                              cx="50%"
                              cy="45%"
                              innerRadius={75}
                              outerRadius={105}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                              animationDuration={1500}
                              animationEasing="ease-out"
                            >
                              {expenseBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} className="drop-shadow-sm hover:opacity-80 transition-opacity cursor-pointer" />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 500, color: '#475569' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">No expenses logged</div>
                    )}
                  </div>
                </div>

                {/* Bottom Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Cash Flow Area Chart */}
                  <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <TrendingUp className="text-orange-500" size={24} />
                          Cumulative Spending Trend
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Total project expenditure mapped over time</p>
                      </div>
                    </div>
                    {cashFlow.length > 0 ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={cashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}M`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="amount" name="Spent" stroke="#f97316" strokeWidth={4} fillOpacity={1} fill="url(#colorAmount)" animationDuration={1500} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[320px] flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No transactions recorded yet
                      </div>
                    )}
                  </div>

                  {/* Top 5 Expenses */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow">
                    <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <ListTodo className="text-emerald-500" size={24} />
                      Largest Expenses
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">Top 5 highest actual costs</p>
                    
                    {topExpenses.length > 0 ? (
                      <div className="flex-1 flex flex-col justify-start space-y-2">
                        {topExpenses.map((item, idx) => {
                          const planned = Number(item.planned_amount);
                          const actual = Number(item.actual_amount);
                          const utilization = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
                          
                          // Find category color if available
                          const categoryColor = budgetSummary?.by_category.find(c => c.category__name === item.category_details?.name)?.category__color || '#3b82f6';
                          
                          return (
                            <div key={item.id} className="relative group p-3 -mx-3 rounded-xl hover:bg-slate-50 transition-colors">
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-semibold text-slate-700 truncate pr-2 flex items-center gap-2" title={item.description}>
                                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-xs text-slate-600">{idx + 1}</span>
                                  {item.description}
                                </span>
                                <span className="font-bold text-slate-900 whitespace-nowrap">Rwf{formatCurrency(actual)}</span>
                              </div>
                              <div className="flex justify-between text-xs text-slate-500 mb-2 pl-7">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor }}></span>
                                  {item.category_details?.name || "General"}
                                </span>
                                <span className="font-semibold">{utilization.toFixed(0)}% used</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden ml-7" style={{ width: 'calc(100% - 1.75rem)' }}>
                                <div 
                                  className="h-2 rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${utilization}%`, backgroundColor: categoryColor }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">No expenses logged</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "items" && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Planned Budget Items</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <TableReportActions
                      report={budgetItemsReport}
                      projectId={selectedProject ?? undefined}
                      disabled={budgetItems.length === 0}
                    />
                    <button
                    onClick={() => {
                      setItemToEdit(null);
                      setIsBudgetItemModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Plus size={20} />
                    Plan New Item
                  </button>
                  </div>
                </div>
                {totalBudget > 0 && remainingToAllocate <= 0 && (
                  <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg p-3 text-sm font-medium">
                    Allocation limit reached. You can still open the form, but saving will be blocked if it exceeds the project budget.
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Category</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Description</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Planned</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actual</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 w-32">Utilization</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Variance</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetItems.length > 0 ? (
                        budgetItems.map((item) => {
                          const planned = Number(item.planned_amount);
                          const actual = Number(item.actual_amount);
                          const varVal = actual - planned;
                          const utilization = planned > 0 ? (actual / planned) * 100 : 0;
                          
                          return (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <span
                                  className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap"
                                  style={{
                                    backgroundColor: `${item.category_details?.color}20`,
                                    color: item.category_details?.color || "#3b82f6",
                                  }}
                                >
                                  {item.category_details?.name || "N/A"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-900 font-medium">
                                {item.description}
                                {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-900 font-semibold text-right">
                                Rwf{formatCurrency(planned)}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-900 font-semibold text-right">
                                Rwf{formatCurrency(actual)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-700">{utilization.toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        utilization >= 100
                                          ? "bg-red-500"
                                          : utilization >= 75
                                          ? "bg-orange-500"
                                          : "bg-green-500"
                                      }`}
                                      style={{ width: `${Math.min(utilization, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                                    varVal > 0 
                                      ? "bg-red-100 text-red-700" 
                                      : varVal < 0 
                                      ? "bg-green-100 text-green-700"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {varVal > 0 ? "Over: " : varVal < 0 ? "Under: " : ""}Rwf{formatCurrency(Math.abs(varVal))}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit Budget Item"
                                >
                                  <Pencil size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No budget items planned yet. Click "Plan New Item" to start tracking costs.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "transactions" && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 animate-fade-in">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                  <h2 className="text-xl font-bold text-slate-900">Transaction History</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <TableReportActions
                      report={transactionsReport}
                      projectId={selectedProject ?? undefined}
                      disabled={transactions.length === 0}
                    />
                    <button
                      onClick={() => handleGenerateReport("Daily")}
                      className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-semibold border border-indigo-200"
                    >
                      <Calendar size={16} />
                      Daily Report
                    </button>
                    <button
                      onClick={() => handleGenerateReport("Executive")}
                      className="flex items-center gap-2 bg-teal-50 text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-100 transition-colors text-sm font-semibold border border-teal-200"
                    >
                      <Briefcase size={16} />
                      Overall Report
                    </button>
                    <button
                      onClick={() => setIsCustomReportModalOpen(true)}
                      className="flex items-center gap-2 bg-slate-50 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm font-semibold border border-slate-200"
                    >
                      <FileText size={16} />
                      Custom Report
                    </button>
                    <button
                      onClick={() => setIsTransactionModalOpen(true)}
                      className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors shadow-sm ml-2"
                    >
                      <Plus size={18} />
                      Log Expense
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Description</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Category</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Amount</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                        {canUserDeleteTransaction(user?.role) && (
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length > 0 ? (
                        transactions.map((transaction) => (
                          <tr 
                            key={transaction.id} 
                            className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => setViewedTransaction(transaction)}
                          >
                            <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                              {transaction.transaction_date}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-900">
                              <span className="font-medium">{transaction.description}</span>
                              {transaction.notes && (
                                <p className="text-xs text-slate-500 mt-1">{transaction.notes}</p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                  backgroundColor: `${transaction.category_details?.color}20`,
                                  color: transaction.category_details?.color || "#3b82f6",
                                }}
                              >
                                {transaction.category_details?.name || "N/A"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-900 font-semibold text-right">
                              Rwf{formatCurrency(Number(transaction.amount))}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <span
                                  className={`text-xs px-2 py-1 rounded font-medium ${
                                    transaction.status === "approved"
                                      ? "bg-green-100 text-green-800"
                                      : transaction.status === "pending"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {transaction.status}
                                </span>
                                {transaction.status === "pending" &&
                                  canUserApproveTransaction(
                                    user?.role,
                                    parseFloat(transaction.amount) || 0,
                                  ) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveTransaction(transaction.id);
                                    }}
                                    className="text-xs font-medium bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  >
                                    Approve
                                  </button>
                                )}
                                {transaction.status === "pending" &&
                                  user?.role === "project-manager" &&
                                  (parseFloat(transaction.amount) || 0) >=
                                    FINANCE_ESCALATION_THRESHOLD && (
                                  <span
                                    className="text-[10px] text-amber-700 max-w-[120px] leading-tight"
                                    title="Escalate to Director of Finance"
                                  >
                                    Escalate to Finance (≥5M RWF)
                                  </span>
                                )}
                              </div>
                            </td>
                            {canUserDeleteTransaction(user?.role) && (
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTransaction(transaction);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg border border-red-100 transition-colors"
                                  title="Delete transaction"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={canUserDeleteTransaction(user?.role) ? 6 : 5}
                            className="py-8 text-center text-slate-500"
                          >
                            No transactions found. Log a manual expense or approve a Purchase Order.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "categories" && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Budget Categories</h2>
                    <p className="text-sm text-slate-500">Global categories available across all projects.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <TableReportActions
                      report={categoriesReport}
                      disabled={categories.length === 0}
                    />
                    <button
                    onClick={() => {
                      setCategoryToEdit(null);
                      setIsCategoryModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={20} />
                    New Category
                  </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 w-16">Color</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Description</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700 w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div
                              className="w-6 h-6 rounded-md shadow-sm border border-slate-200"
                              style={{ backgroundColor: cat.color }}
                            />
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-900 font-medium">{cat.name}</td>
                          <td className="py-3 px-4 text-sm text-slate-500">{cat.description || "-"}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setCategoryToEdit(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit Category"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Category"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {selectedProject && (
        <>
          <BudgetItemModal
            isOpen={isBudgetItemModalOpen}
            onClose={() => setIsBudgetItemModalOpen(false)}
            projectId={selectedProject}
            projectBudget={totalBudget}
            remainingToAllocate={
              itemToEdit ? remainingToAllocate + Number(itemToEdit.planned_amount || 0) : remainingToAllocate
            }
            onSuccess={refreshData}
            itemToEdit={itemToEdit}
          />

          <TransactionModal
            isOpen={isTransactionModalOpen}
            onClose={() => setIsTransactionModalOpen(false)}
            projectId={selectedProject}
            onSuccess={refreshData}
          />
        </>
      )}

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={fetchCategories}
        categoryToEdit={categoryToEdit}
      />

      <TransactionReceiptModal
        isOpen={!!viewedTransaction}
        onClose={() => setViewedTransaction(null)}
        transaction={viewedTransaction}
        formatCurrency={formatCurrency}
        canDelete={canUserDeleteTransaction(user?.role)}
        onDelete={
          viewedTransaction
            ? () => handleDeleteTransaction(viewedTransaction)
            : undefined
        }
      />

      <CustomReportModal
        isOpen={isCustomReportModalOpen}
        onClose={() => setIsCustomReportModalOpen(false)}
        onGenerate={(start, end) => handleGenerateReport("Custom", start, end)}
      />
    </div>
  );
}
