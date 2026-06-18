import { useState } from "react";
import { Calendar, Mail, Paperclip, X } from "lucide-react";
import { emailTransactionReportProject } from "../utils/tableReportExport";

export interface EmailReportPayload {
  email: string;
  message: string;
  attachments: File[];
}

export type EmailSendMode = "table" | "today" | "custom";

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  sending?: boolean;
  onSend: (payload: EmailReportPayload) => Promise<void>;
  /** When set with transactionReports, enables daily / custom PDF email actions */
  projectId?: number | null;
  transactionReports?: boolean;
}

function todayDateKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function EmailReportModal({
  isOpen,
  onClose,
  title,
  description,
  sending = false,
  onSend,
  projectId,
  transactionReports = false,
}: EmailReportModalProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayDateKey());
  const [error, setError] = useState("");
  const [activeSend, setActiveSend] = useState<EmailSendMode | null>(null);

  const showPeriodReports = transactionReports && !!projectId;
  const isBusy = sending || activeSend !== null;

  const customRangeValid =
    !!startDate && !!endDate && new Date(startDate) <= new Date(endDate);

  if (!isOpen) return null;

  const reset = () => {
    setEmail("");
    setMessage("");
    setAttachments([]);
    setStartDate("");
    setEndDate(todayDateKey());
    setError("");
    setActiveSend(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const basePayload = (): EmailReportPayload | null => {
    if (!email.trim()) {
      setError("Recipient email is required.");
      return null;
    }
    return {
      email: email.trim(),
      message: message.trim(),
      attachments,
    };
  };

  const runSend = async (mode: EmailSendMode, action: () => Promise<void>) => {
    const payload = basePayload();
    if (!payload) return;
    if (mode === "custom" && !customRangeValid) {
      setError("Select a valid start and end date for the custom report.");
      return;
    }
    setError("");
    setActiveSend(mode);
    try {
      await action();
      reset();
      onClose();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to send email.");
    } finally {
      setActiveSend(null);
    }
  };

  const handleSendTable = () => runSend("table", () => onSend(basePayload()!));

  const handleSendToday = () =>
    runSend("today", () =>
      emailTransactionReportProject(projectId!, {
        ...basePayload()!,
        type: "Daily",
      }),
    );

  const handleSendCustom = () =>
    runSend("custom", () =>
      emailTransactionReportProject(projectId!, {
        ...basePayload()!,
        type: "Custom",
        startDate,
        endDate,
      }),
    );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose} aria-hidden />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail size={20} className="text-blue-600" />
              {title}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          </div>
          <button type="button" onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-900">
          <p className="font-semibold mb-1">Including custom documents</p>
          <p className="text-blue-800/90 leading-relaxed">
            The generated report PDF is attached automatically. Use{" "}
            <strong>Add custom attachments</strong> below to include your own files (contracts,
            drawings, signed forms, photos, etc.). All selected files are sent together to the
            recipient in one email.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          Recipient email <span className="text-red-600">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="colleague@company.com"
        />

        <label className="block text-sm font-bold text-slate-700 mb-1.5">Message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm h-24 resize-none mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Please find the report attached. Additional supporting documents are included."
        />

        {showPeriodReports && (
          <div className="mb-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
              <Calendar size={16} />
              Custom date range
            </div>
            <p className="text-xs text-indigo-800/90 leading-relaxed">
              Used by <strong>Send custom report</strong> — generates a branded PDF of all
              transactions between the selected dates.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          Add custom attachments (optional)
        </label>
        <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 text-sm text-slate-600 mb-2">
          <Paperclip size={16} />
          Choose files to attach
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length) setAttachments((prev) => [...prev, ...files]);
              e.target.value = "";
            }}
          />
        </label>
        {attachments.length > 0 && (
          <ul className="mb-4 space-y-1.5 max-h-28 overflow-y-auto">
            {attachments.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between text-sm bg-slate-50 px-2 py-1.5 rounded-lg"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-red-600 shrink-0 ml-2"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSendTable}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {activeSend === "table" ? "Sending…" : "Send email"}
            </button>
          </div>

          {showPeriodReports && (
            <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSendToday}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                title="Generate today's transactions PDF and email it"
              >
                {activeSend === "today" ? "Sending…" : "Send today's report"}
              </button>
              <button
                type="button"
                disabled={isBusy || !customRangeValid}
                onClick={handleSendCustom}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                title="Generate a PDF for the selected date range and email it"
              >
                {activeSend === "custom" ? "Sending…" : "Send custom report"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
