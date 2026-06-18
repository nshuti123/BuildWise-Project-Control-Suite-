import { useState, useEffect, useMemo } from "react";
import api from "../api";
import { asList } from "../utils/apiHelpers";
import { useProject } from "../context/ProjectContext";
import {
  FinanceKpiGrid,
  PendingExpensesPanel,
  PendingPayrollPanel,
  BudgetUtilizationPanel,
  PayrollHistoryPanel,
  CashFlowSummaryPanel,
  type FinanceKpis,
  type PendingTransactionRow,
  type PayrollRow,
} from "../components/FinanceOverviewPanels";

export function AccountantDashboard({
  setActiveModule,
}: {
  setActiveModule?: (m: string) => void;
} = {}) {
  const { currentProjectId, projects } = useProject();
  const [kpis, setKpis] = useState<FinanceKpis | null>(null);
  const [cashFlow, setCashFlow] = useState<{ date: string; amount: number }[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransactionRow[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const projectScope = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)?.name
    : null;

  useEffect(() => {
    fetchData();
  }, [currentProjectId]);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const analyticsUrl = currentProjectId
        ? `/projects/portfolio-analytics/?project=${currentProjectId}`
        : "/projects/portfolio-analytics/";
      const payrollUrl = currentProjectId
        ? `/workforce/payrolls/?project=${currentProjectId}`
        : "/workforce/payrolls/";

      const [analytics, payrollRes] = await Promise.all([
        api.get(analyticsUrl),
        api.get(payrollUrl),
      ]);

      setKpis(analytics.data.kpis);
      setCashFlow(analytics.data.cash_flow || []);
      setPendingTransactions(analytics.data.recent_pending_transactions || []);
      const list = asList(payrollRes.data) as PayrollRow[];
      list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      setPayrolls(list);
    } catch (err) {
      console.error(err);
      setLoadError("Could not load financial data. Check that the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const pendingPayrolls = useMemo(
    () =>
      payrolls.filter(
        (p) => p.status === "awaiting_finance",
      ),
    [payrolls],
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">Loading finance overview...</div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 border border-red-100 rounded-xl">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Finance overview</h1>
        <p className="text-slate-600 mt-1">
          {projectScope
            ? `Budget and approvals for ${projectScope}`
            : "Your assigned projects — budget, spend, and approval queues"}
        </p>
      </div>

      <FinanceKpiGrid kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetUtilizationPanel
          utilization={Number(kpis?.budget_utilization ?? 0)}
          totalBudget={Number(kpis?.total_budget ?? 0)}
          totalSpend={Number(kpis?.total_spend ?? 0)}
        />
        <CashFlowSummaryPanel cashFlow={cashFlow} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PendingExpensesPanel
          items={pendingTransactions}
          onOpenBudget={setActiveModule ? () => setActiveModule("budget") : undefined}
        />
        <PendingPayrollPanel
          payrolls={pendingPayrolls}
          onOpenPayrolls={setActiveModule ? () => setActiveModule("payrolls") : undefined}
        />
      </div>

      <PayrollHistoryPanel payrolls={payrolls} />
    </div>
  );
}
