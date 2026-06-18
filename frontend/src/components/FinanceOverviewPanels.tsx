import {
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { formatBudget, formatRwf } from "../utils/formatters";

export type FinanceKpis = {
  total_projects?: number;
  total_budget?: number;
  total_spend?: number;
  remaining_budget?: number;
  budget_utilization?: number;
  pending_transactions?: number;
  pending_transaction_amount?: number;
  pending_payroll_batches?: number;
  pending_payroll_amount?: number;
};

export type PendingTransactionRow = {
  id: number;
  description: string;
  amount: number;
  transaction_date: string;
  project_name?: string | null;
  category_name?: string | null;
};

export type PayrollRow = {
  id: number;
  date: string;
  status: string;
  total_amount: number | string;
  project_name?: string;
  initiated_by_name?: string;
  site_confirmed_by_name?: string;
  approved_by_name?: string;
  accountant_approved_by_name?: string;
  director_finance_approved_by_name?: string;
};

export function FinanceKpiGrid({ kpis }: { kpis: FinanceKpis | null }) {
  const totalBudget = Number(kpis?.total_budget ?? 0);
  const totalSpend = Number(kpis?.total_spend ?? 0);
  const remaining = Number(
    kpis?.remaining_budget ?? Math.max(0, totalBudget - totalSpend),
  );
  const utilization = Number(kpis?.budget_utilization ?? 0);
  const pendingTxCount = Number(kpis?.pending_transactions ?? 0);
  const pendingTxAmount = Number(kpis?.pending_transaction_amount ?? 0);
  const pendingPayrollBatches = Number(kpis?.pending_payroll_batches ?? 0);
  const pendingPayrollAmount = Number(kpis?.pending_payroll_amount ?? 0);

  const cards = [
    {
      title: "Planned budget",
      value: formatBudget(totalBudget),
      sub: `${kpis?.total_projects ?? 0} active project(s)`,
      tone: "text-slate-600",
    },
    {
      title: "Approved spend",
      value: formatRwf(totalSpend),
      sub: `${utilization}% of planned budget used`,
      tone: utilization > 90 ? "text-amber-700" : "text-emerald-700",
    },
    {
      title: "Budget remaining",
      value: formatRwf(remaining),
      sub: remaining <= 0 && totalBudget > 0 ? "At or over plan" : "Available headroom",
      tone: remaining <= 0 && totalBudget > 0 ? "text-red-700" : "text-blue-700",
    },
    {
      title: "Pending expenses",
      value: formatRwf(pendingTxAmount),
      sub:
        pendingTxCount > 0
          ? `${pendingTxCount} transaction(s) awaiting approval`
          : "No pending expense logs",
      tone: pendingTxCount > 0 ? "text-orange-700" : "text-slate-600",
    },
    {
      title: "Payroll awaiting finance",
      value: formatRwf(pendingPayrollAmount),
      sub:
        pendingPayrollBatches > 0
          ? `${pendingPayrollBatches} batch(es) to approve`
          : "Payroll queue clear",
      tone: pendingPayrollBatches > 0 ? "text-amber-700" : "text-emerald-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
            {card.title}
          </p>
          <p className="text-2xl font-extrabold text-slate-900">{card.value}</p>
          <p className={`text-xs font-medium mt-2 ${card.tone}`}>{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function PendingExpensesPanel({
  items,
  onOpenBudget,
}: {
  items: PendingTransactionRow[];
  onOpenBudget?: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <DollarSign className="text-orange-600" size={22} />
          Pending expense approvals
        </h2>
        {onOpenBudget && items.length > 0 && (
          <button
            type="button"
            onClick={onOpenBudget}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Open Budget & Costs
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Purchase orders, payroll, and manual expenses logged as pending appear here until
        finance approves them.
      </p>
      {items.length === 0 ? (
        <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
          No pending transactions in your portfolio.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((tx) => (
            <div
              key={tx.id}
              className="p-4 border border-slate-200 rounded-lg flex items-center justify-between gap-4 bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{tx.description}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {tx.project_name || "Project"} · {tx.category_name || "Expense"} ·{" "}
                  {tx.transaction_date}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-800">{formatRwf(tx.amount)}</p>
                <p className="text-xs text-orange-600 font-bold uppercase mt-1">Pending</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PendingPayrollPanel({
  payrolls,
  onOpenPayrolls,
}: {
  payrolls: PayrollRow[];
  onOpenPayrolls?: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="text-amber-600" size={22} />
          Payroll awaiting approval
        </h2>
        {onOpenPayrolls && payrolls.length > 0 && (
          <button
            type="button"
            onClick={onOpenPayrolls}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Payroll Operations
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      {payrolls.length === 0 ? (
        <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
          No payroll batches awaiting finance approval.
        </div>
      ) : (
        <div className="space-y-3">
          {payrolls.slice(0, 6).map((payroll) => (
            <div
              key={payroll.id}
              className="p-4 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-900">
                  {payroll.project_name || "Project"} · {payroll.date}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Foreman: {payroll.initiated_by_name || "—"}
                  {payroll.site_confirmed_by_name &&
                    ` · Site engineer: ${payroll.site_confirmed_by_name}`}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="font-bold text-slate-800">
                  {formatRwf(payroll.total_amount)}
                </p>
                <p className="text-xs text-amber-600 font-bold uppercase mt-1">
                  Awaiting finance
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BudgetUtilizationPanel({
  utilization,
  totalBudget,
  totalSpend,
}: {
  utilization: number;
  totalBudget: number;
  totalSpend: number;
}) {
  const pct = Math.min(100, Math.max(0, utilization));
  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
        <TrendingUp className="text-emerald-600" size={22} />
        Budget utilization
      </h2>
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medium text-slate-700">Approved spend vs planned</span>
        <span className="font-bold text-slate-900">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
        <div
          className={`${barColor} h-4 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-slate-500 text-xs uppercase font-bold">Planned</p>
          <p className="font-bold text-slate-900 mt-1">{formatRwf(totalBudget)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-slate-500 text-xs uppercase font-bold">Approved</p>
          <p className="font-bold text-slate-900 mt-1">{formatRwf(totalSpend)}</p>
        </div>
      </div>
      {totalBudget <= 0 && (
        <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
          No budget lines are planned yet. Add budget items under Budget & Costs so
          utilization and remaining amounts are meaningful.
        </p>
      )}
    </div>
  );
}

export function PayrollHistoryPanel({ payrolls }: { payrolls: PayrollRow[] }) {
  const recent = payrolls
    .filter((p) => p.status === "approved" || p.status === "rejected")
    .slice(0, 6);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
        <CheckCircle2 className="text-green-600" size={22} />
        Recent payroll decisions
      </h2>
      {recent.length === 0 ? (
        <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
          No recent payroll activity.
        </div>
      ) : (
        <div className="space-y-3">
          {recent.map((payroll) => (
            <div
              key={payroll.id}
              className="py-3 border-b border-slate-100 last:border-0 flex justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 text-sm">
                  {payroll.project_name} · {payroll.date}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {payroll.status === "approved"
                    ? `Approved by ${payroll.approved_by_name || payroll.accountant_approved_by_name || payroll.director_finance_approved_by_name || "finance"}`
                    : "Rejected"}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full h-fit shrink-0 ${
                  payroll.status === "approved"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {formatRwf(payroll.total_amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CashFlowSummaryPanel({
  cashFlow,
}: {
  cashFlow: { date: string; amount: number }[];
}) {
  const recent = cashFlow.slice(-6);
  const max = Math.max(...recent.map((c) => c.amount), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
        <TrendingUp className="text-blue-600" size={22} />
        Approved spend by month
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg border border-slate-100">
          No approved transactions yet — spend will appear here month by month.
        </p>
      ) : (
        <div className="space-y-3">
          {recent.map((row) => (
            <div key={row.date}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">{row.date}</span>
                <span className="font-semibold text-slate-900">{formatRwf(row.amount)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(row.amount / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
