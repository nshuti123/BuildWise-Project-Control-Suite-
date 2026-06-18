import { useState } from "react";
import { FileText, Mail, Sheet } from "lucide-react";
import { EmailReportModal } from "./EmailReportModal";
import {
  type TableReportData,
  exportTableExcelClient,
  exportTableExcelProject,
  exportTablePdfClient,
  exportTablePdfProject,
  emailTableReportGeneric,
  emailTableReportProject,
  downloadBlob,
} from "../utils/tableReportExport";

interface TableReportActionsProps {
  report: TableReportData;
  projectId?: number | null;
  disabled?: boolean;
  size?: "sm" | "md";
  emailSubject?: string;
  /** Show "Send today's report" / "Send custom report" in the email modal (project required) */
  transactionReports?: boolean;
}

export function TableReportActions({
  report,
  projectId,
  disabled = false,
  size = "sm",
  emailSubject,
  transactionReports,
}: TableReportActionsProps) {
  const showTransactionReports = transactionReports ?? !!projectId;
  const [busy, setBusy] = useState<"pdf" | "excel" | "email" | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const btn =
    size === "sm"
      ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
      : "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors";

  const handlePdf = async () => {
    setBusy("pdf");
    try {
      if (projectId) {
        await exportTablePdfProject(projectId, report);
      } else {
        downloadBlob(exportTablePdfClient(report), `${report.filename}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF.");
    } finally {
      setBusy(null);
    }
  };

  const handleExcel = async () => {
    setBusy("excel");
    try {
      if (projectId) {
        await exportTableExcelProject(projectId, report);
      } else {
        exportTableExcelClient(report);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate Excel file.");
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (payload: { email: string; message: string; attachments: File[] }) => {
    setBusy("email");
    try {
      if (projectId) {
        await emailTableReportProject(projectId, report, {
          ...payload,
          subject: emailSubject || `BuildWise Report — ${report.title}`,
        });
      } else {
        await emailTableReportGeneric(report, {
          ...payload,
          subject: emailSubject || `BuildWise Report — ${report.title}`,
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const isDisabled = disabled || report.rows.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={handlePdf}
          disabled={isDisabled || busy !== null}
          className={`${btn} text-white bg-red-600 hover:bg-red-700`}
          title="Download PDF report"
        >
          <FileText size={size === "sm" ? 14 : 16} />
          {busy === "pdf" ? "PDF…" : "PDF"}
        </button>
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          disabled={isDisabled || busy !== null}
          className={`${btn} text-slate-700 bg-white border border-slate-300 hover:bg-slate-50`}
          title="Email report with optional custom attachments"
        >
          <Mail size={size === "sm" ? 14 : 16} />
          Email
        </button>
        <button
          type="button"
          onClick={handleExcel}
          disabled={isDisabled || busy !== null}
          className={`${btn} text-white bg-emerald-600 hover:bg-emerald-700`}
          title="Download Excel report"
        >
          <Sheet size={size === "sm" ? 14 : 16} />
          {busy === "excel" ? "Excel…" : "Excel"}
        </button>
      </div>

      <EmailReportModal
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        title={`Email — ${report.title}`}
        description={
          showTransactionReports
            ? "Send the table PDF, today's transactions report, or a custom date-range report. Add extra files if needed."
            : "The report PDF is attached automatically. Add any extra files you want the recipient to receive."
        }
        sending={busy === "email"}
        onSend={handleEmail}
        projectId={projectId}
        transactionReports={showTransactionReports}
      />
    </>
  );
}
