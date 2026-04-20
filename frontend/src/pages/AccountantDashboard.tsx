import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, AlertTriangle, FileText } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import api from "../api";

export function AccountantDashboard() {
  const [budgetMetrics, setBudgetMetrics] = useState({
    totalBudget: 0,
    totalSpent: 0,
    pendingPayments: 0
  });
  
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Use fixed projectId 1 for prototype
  const projectId = 1;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // We will reuse the actual payrolls API
      const payrollRes = await api.get(`/workforce/payrolls/?project=${projectId}`);
      const fetchedPayrolls = payrollRes.data;
      setPayrolls(fetchedPayrolls);

      // Simple mock metrics relying on fetched data
      const pendingTotal = fetchedPayrolls
        .filter((p: any) => p.status === 'pending')
        .reduce((sum: number, p: any) => sum + Number(p.total_amount), 0);
        
      setBudgetMetrics({
        totalBudget: 1500000, 
        totalSpent: 450000,
        pendingPayments: pendingTotal
      });
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading Financial Data...</div>;
  }

  const pendingPayrollsCount = payrolls.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Accountant Dashboard
          </h1>
          <p className="text-slate-600">
            System-wide financial oversight and approvals
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Budget Allocation"
          value={`${budgetMetrics.totalBudget.toLocaleString()} Rwf`}
          change="Available pipeline"
          changeType="positive"
          icon={DollarSign}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Total Accrued Expenses"
          value={`${budgetMetrics.totalSpent.toLocaleString()} Rwf`}
          change="Completed payments"
          changeType="neutral"
          icon={TrendingUp}
          iconColor="bg-orange-500"
        />
        <MetricCard
          title="Pending Commitments"
          value={`${budgetMetrics.pendingPayments.toLocaleString()} Rwf`}
          change={`${pendingPayrollsCount} batches require approval`}
          changeType={pendingPayrollsCount > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          iconColor={pendingPayrollsCount > 0 ? "bg-red-500" : "bg-emerald-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
               <FileText className="text-blue-600" />
               Pending Payrolls
            </h2>
          </div>
          
          <div className="space-y-4">
             {payrolls.filter(p => p.status === 'pending').length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                    No pending payrolls require your action.
                </div>
             ) : (
                payrolls.filter(p => p.status === 'pending').slice(0, 5).map(payroll => (
                   <div key={payroll.id} className="p-4 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
                       <div>
                          <p className="font-bold text-slate-900">Batch {payroll.id} - {payroll.date}</p>
                          <p className="text-xs text-slate-500 mt-1">Initiated by System</p>
                       </div>
                       <div className="text-right">
                          <p className="font-bold text-slate-800">{Number(payroll.total_amount).toLocaleString()} Rwf</p>
                          <p className="text-xs text-amber-600 font-bold uppercase mt-1">Pending Review</p>
                       </div>
                   </div>
                ))
             )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
               <TrendingUp className="text-emerald-600" />
               Budget Burn Rate
            </h2>
          </div>
          <div className="space-y-4">
              <div>
                  <div className="flex justify-between text-sm mb-2">
                     <span className="font-bold text-slate-700">Operational Target</span>
                     <span className="text-slate-600">{((budgetMetrics.totalSpent / budgetMetrics.totalBudget) * 100).toFixed(1)}% Consumed</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                     <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${(budgetMetrics.totalSpent / budgetMetrics.totalBudget) * 100}%` }}></div>
                  </div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg mt-6 text-sm text-blue-800">
                  <p><strong>Note:</strong> Over 60% of the allocated budget remains unspent. Labor payments account for approx 15% of historical expenditure.</p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
