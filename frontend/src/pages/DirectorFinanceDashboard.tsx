import { useState, useEffect, useMemo } from "react";
import api from "../api";
import { FileText, DollarSign } from "lucide-react";
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

export function DirectorFinanceDashboard({
  setActiveModule,
}: {
  setActiveModule?: (m: string) => void;
}) {
  const { currentProjectId, projects } = useProject();
  const [kpis, setKpis] = useState<FinanceKpis | null>(null);
  const [cashFlow, setCashFlow] = useState<{ date: string; amount: number }[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransactionRow[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const projectScope = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)?.name
    : null;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const analyticsUrl = currentProjectId
          ? `/projects/portfolio-analytics/?project=${currentProjectId}`
          : "/projects/portfolio-analytics/";
        const payrollUrl = currentProjectId
          ? `/workforce/payrolls/?project=${currentProjectId}`
          : "/workforce/payrolls/";

        const [analytics, usersRes, payrollRes] = await Promise.all([
          api.get(analyticsUrl),
          api.get("/users/"),
          api.get(payrollUrl),
        ]);

        setKpis(analytics.data.kpis);
        setCashFlow(analytics.data.cash_flow || []);
        setPendingTransactions(analytics.data.recent_pending_transactions || []);
        setTeam(
          asList(usersRes.data).filter((u: any) =>
            ["accountant", "director-finance"].includes(u.role),
          ),
        );
        const list = asList(payrollRes.data) as PayrollRow[];
        list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        setPayrolls(list);
      } catch (e) {
        console.error(e);
        setLoadError("Could not load finance overview. Check that the server is running.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentProjectId]);

  const pendingPayrolls = useMemo(
    () => payrolls.filter((p) => p.status === "awaiting_finance"),
    [payrolls],
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading finance overview...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 border border-red-100 rounded-xl">
        {loadError}
      </div>
    );
  }

  const pendingTxCount = Number(kpis?.pending_transactions ?? 0);
  const pendingPayrollBatches = Number(kpis?.pending_payroll_batches ?? 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Finance overview</h1>
          <p className="text-slate-600 mt-1">
            {projectScope
              ? `Portfolio metrics for ${projectScope}`
              : "Company-wide budget, spend, and approval queues"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {setActiveModule && pendingPayrollBatches > 0 && (
            <button
              type="button"
              onClick={() => setActiveModule("payrolls")}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium shadow-sm"
            >
              <FileText size={18} />
              {pendingPayrollBatches} payroll batch
              {pendingPayrollBatches === 1 ? "" : "es"} pending
            </button>
          )}
          {setActiveModule && pendingTxCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveModule("budget")}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium shadow-sm"
            >
              <DollarSign size={18} />
              {pendingTxCount} pending expense{pendingTxCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
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

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Finance team</h2>
        <div className="space-y-2">
          {team.length === 0 ? (
            <p className="text-sm text-slate-500">No finance users found.</p>
          ) : (
            team.map((u) => (
              <div
                key={u.id}
                className="flex justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <span className="font-medium">{u.full_name || u.username}</span>
                <span className="text-sm text-slate-500 capitalize">
                  {u.role.replace(/-/g, " ")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
