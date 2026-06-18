import { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import {
  CheckCircle2,
  XCircle,
  Search,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronUp,
  User,
  History,
  Clock,
} from "lucide-react";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { Pagination } from "../components/Pagination";
import { withProjectQuery } from "../utils/apiHelpers";
import { useProject } from "../context/ProjectContext";
import { ProjectScopeBanner } from "../components/ProjectScopeBanner";
import { useAuth } from "../context/AuthContext";
import { canInitiateWorkerPayment } from "../utils/roleCapabilities";
import { openWorkforcePayrollReview } from "../utils/workforceNavigation";
import { consumePayrollApprovalsFocus } from "../utils/payrollNavigation";
import { TableReportActions } from "../components/TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";

const STATUS_LABELS: Record<string, string> = {
  awaiting_site_engineer: "Awaiting site engineer",
  awaiting_finance: "Awaiting finance department",
  approved: "Approved",
  rejected: "Rejected",
  pending: "Awaiting site engineer",
};

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results: any[] }).results;
  }
  return [];
}

export function PayrollApprovals({
  setActiveModule,
}: {
  setActiveModule?: (module: string) => void;
}) {
  const { user } = useAuth();
  const { currentProjectId, projects } = useProject();
  const activeProject = projects.find((p) => p.id === currentProjectId);
  const role = user?.role ?? "";
  const userId = user?.id;

  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPayroll, setExpandedPayroll] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "success" | "danger";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    onConfirm: () => {},
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const payrollFocusRef = useRef(
    null as ReturnType<typeof consumePayrollApprovalsFocus>,
  );

  useEffect(() => {
    payrollFocusRef.current = consumePayrollApprovalsFocus();
    if (payrollFocusRef.current?.tab) {
      setTab(payrollFocusRef.current.tab);
    }
  }, []);

  useEffect(() => {
    fetchPayrolls(currentPage);
  }, [currentPage, currentProjectId]);

  useEffect(() => {
    const focus = payrollFocusRef.current;
    if (!focus?.payrollId || payrolls.length === 0) return;
    const found = payrolls.some((p) => p.id === focus.payrollId);
    if (found) {
      setExpandedPayroll(focus.payrollId);
      setSearchQuery(String(focus.payrollId));
      payrollFocusRef.current = null;
    }
  }, [payrolls]);

  const fetchPayrolls = async (page: number = 1) => {
    try {
      const resp = await api.get(
        withProjectQuery(`/workforce/payrolls/?page=${page}`, currentProjectId),
      );
      setPayrolls(asList(resp.data));

      const authResp = resp as { pagination?: { count: number } };
      if (authResp.pagination) {
        setTotalItems(authResp.pagination.count);
        setTotalPages(Math.ceil(authResp.pagination.count / 10));
      } else {
        const list = asList(resp.data);
        setTotalItems(list.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const userApprovedPayroll = (p: any) => {
    if (role === "accountant") return p.accountant_approved_by === userId;
    if (role === "director-finance") return p.director_finance_approved_by === userId;
    return false;
  };

  const userCanApprove = (p: any) => {
    if (p.status !== "awaiting_finance") return false;
    if (role === "accountant" || role === "director-finance") return true;
    if (role === "admin" || role === "managing-director") return true;
    return false;
  };

  const userCanReject = (p: any) =>
    p.status === "awaiting_finance" &&
    (role === "accountant" ||
      role === "director-finance" ||
      role === "admin" ||
      role === "managing-director");

  const pendingList = useMemo(
    () =>
      payrolls.filter(
        (p) => p.status === "awaiting_finance" && userCanApprove(p),
      ),
    [payrolls, role, userId],
  );

  const historyList = useMemo(
    () =>
      payrolls.filter(
        (p) =>
          p.status === "approved" ||
          p.status === "rejected" ||
          userApprovedPayroll(p),
      ),
    [payrolls, role, userId],
  );

  const displayed = tab === "pending" ? pendingList : historyList;

  const filtered = displayed.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.date).includes(q) ||
      String(p.project_name || "").toLowerCase().includes(q) ||
      String(p.id).includes(q)
    );
  });

  const payrollBatchesReport = useMemo((): TableReportData => {
    const columns = ["Batch ID", "Date", "Project", "Amount (Rwf)", "Status", "Initiated by"];
    const rows = filtered.map((p) => [
      String(p.id),
      p.date,
      p.project_name ?? "—",
      Number(p.total_amount).toLocaleString(),
      STATUS_LABELS[p.status] || p.status,
      p.initiated_by_name ?? "—",
    ]);
    return {
      title: tab === "pending" ? "Payroll Awaiting Approval" : "Payroll Approval History",
      subtitle: `${filtered.length} batches`,
      filename: `Payroll_${tab}`,
      columns,
      rows,
    };
  }, [filtered, tab]);

  const buildPayrollLineItemsReport = (payroll: any): TableReportData => ({
    title: `Payroll Line Items — Batch #${payroll.id}`,
    subtitle: `${payroll.project_name ?? "Project"} · ${payroll.date}`,
    filename: `Payroll_Lines_${payroll.id}`,
    columns: ["Worker", "Trade", "Details", "Amount (Rwf)"],
    rows: (payroll.records || []).map((record: any) => [
      record.worker_name,
      record.worker_role,
      Number(record.calculated_amount) > 0 ? "Paid from attendance" : "Unpaid (absent)",
      Number(record.calculated_amount).toLocaleString(),
    ]),
  });

  const handleFinanceApprove = (payroll: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Approve payroll",
      message: `Approve ${Number(payroll.total_amount).toLocaleString()} Rwf for ${payroll.project_name || "project"} on ${payroll.date}? This finalizes the payment and records the labor expense.`,
      type: "success",
      onConfirm: async () => {
        try {
          await api.post(`/workforce/payrolls/${payroll.id}/finance-approve/`);
          await fetchPayrolls(currentPage);
          setTab("history");
        } catch (err: any) {
          console.error(err);
          alert(err.response?.data?.detail || "Approval failed.");
        }
      },
    });
  };

  const handleReject = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Reject payroll",
      message: "Reject this payroll batch? Attendance can be corrected and resubmitted.",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.post(`/workforce/payrolls/${id}/reject/`, {
            reason: rejectNotes || undefined,
          });
          setRejectNotes("");
          setRejectTargetId(null);
          await fetchPayrolls(currentPage);
        } catch (err: any) {
          console.error(err);
          alert(err.response?.data?.detail || "Rejection failed.");
        }
      },
    });
  };

  const FinanceBadges = ({ payroll }: { payroll: any }) => {
    if (payroll.status !== "approved") return null;
    const approver =
      payroll.approved_by_name ||
      payroll.accountant_approved_by_name ||
      payroll.director_finance_approved_by_name;
    return (
      <p className="text-xs text-green-700 mt-2 font-medium">
        Approved by {approver || "finance"}
      </p>
    );
  };

  const statusBadgeClass = (status: string) => {
    if (status === "awaiting_finance") return "bg-amber-100 text-amber-800";
    if (status === "approved") return "bg-green-100 text-green-800";
    if (status === "rejected") return "bg-red-100 text-red-800";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Payroll Approvals
          </h1>
          <p className="text-slate-600">
            After the site engineer confirms attendance, the finance department
            approves to finalize payment. Labor budget updates on approval.
          </p>
        </div>
      </div>

      {activeProject && role !== "site-foreman" && (
        <ProjectScopeBanner
          projectName={activeProject.name}
          context="payroll approvals"
        />
      )}

      {canInitiateWorkerPayment(role) && setActiveModule && currentProjectId && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-emerald-900">
            To <strong>initiate worker payment</strong>, mark attendance in Workforce & Payroll, then
            submit the daily payroll batch.
          </p>
          <button
            type="button"
            onClick={() => {
              openWorkforcePayrollReview(new Date().toISOString().split("T")[0]);
              setActiveModule("workforce");
            }}
            className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg"
          >
            Go to Workforce & Payroll
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
            tab === "pending"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Clock size={16} />
          Awaiting my action ({pendingList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
            tab === "history"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <History size={16} />
          Approval history ({historyList.length})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by date, project, or batch ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none w-64 md:w-80 shadow-sm transition-shadow"
            />
          </div>
          <TableReportActions
            report={payrollBatchesReport}
            projectId={currentProjectId ?? undefined}
            disabled={filtered.length === 0}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {tab === "pending"
              ? "No payroll batches need your approval right now."
              : "No payroll history to display yet."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((payroll) => (
              <div key={payroll.id} className="flex flex-col">
                <div
                  className={`p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${expandedPayroll === payroll.id ? "bg-blue-50/30" : ""}`}
                  onClick={() =>
                    setExpandedPayroll(
                      expandedPayroll === payroll.id ? null : payroll.id,
                    )
                  }
                >
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        payroll.status === "awaiting_finance"
                          ? "bg-amber-100 text-amber-600"
                          : payroll.status === "approved"
                            ? "bg-green-100 text-green-600"
                            : payroll.status === "rejected"
                              ? "bg-red-100 text-red-600"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <DollarSign size={24} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg text-slate-900">
                          {Number(payroll.total_amount).toLocaleString()} Rwf
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${statusBadgeClass(payroll.status)}`}
                        >
                          {STATUS_LABELS[payroll.status] || payroll.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 font-medium flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} /> {payroll.date}
                        </span>
                        <span>{payroll.project_name}</span>
                        <span className="flex items-center gap-1.5">
                          <User size={14} /> Foreman: {payroll.initiated_by_name}
                        </span>
                        {payroll.site_confirmed_by_name && (
                          <span className="text-blue-700">
                            SE: {payroll.site_confirmed_by_name}
                          </span>
                        )}
                      </div>
                      {(payroll.status === "approved") && (
                        <FinanceBadges payroll={payroll} />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {tab === "pending" && userCanApprove(payroll) && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleFinanceApprove(payroll)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
                        >
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTargetId(payroll.id);
                            handleReject(payroll.id);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium text-sm rounded-lg transition-colors"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="text-slate-400 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      {expandedPayroll === payroll.id ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </button>
                  </div>
                </div>

                {rejectTargetId === payroll.id && tab === "pending" && (
                  <div
                    className="px-6 pb-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      placeholder="Rejection reason (optional)"
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      className="w-full max-w-md text-sm border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                )}

                {expandedPayroll === payroll.id && (
                  <div className="bg-slate-50 border-t border-slate-100 p-6 animate-fade-in shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider">
                        Payroll Line Items ({payroll.records?.length || 0})
                      </h4>
                      <TableReportActions
                        report={buildPayrollLineItemsReport(payroll)}
                        projectId={payroll.project ?? currentProjectId ?? undefined}
                        disabled={!(payroll.records?.length)}
                        size="sm"
                      />
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider">
                              Worker
                            </th>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider">
                              Trade
                            </th>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider">
                              Details
                            </th>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider text-right">
                              Amount (Rwf)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(payroll.records || []).map((record: any) => (
                            <tr
                              key={record.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-6 py-3 font-bold text-slate-800">
                                {record.worker_name}
                              </td>
                              <td className="px-6 py-3 text-slate-600 capitalize">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold text-slate-700">
                                  {record.worker_role}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-slate-600">
                                {Number(record.calculated_amount) > 0 ? (
                                  <span className="text-green-600 font-medium">
                                    Paid from attendance
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-medium">
                                    Unpaid (absent)
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-medium text-slate-900">
                                {Number(record.calculated_amount).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
        />
      </div>
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
