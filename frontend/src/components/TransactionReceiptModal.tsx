import { X, Printer, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react";

interface TransactionReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  formatCurrency: (amount: number | string) => string;
  canDelete?: boolean;
  onDelete?: () => void;
}

export function TransactionReceiptModal({
  isOpen,
  onClose,
  transaction,
  formatCurrency,
  canDelete = false,
  onDelete,
}: TransactionReceiptModalProps) {
  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-200">
            <CheckCircle2 size={14} /> Approved
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200">
            <Clock size={14} /> Pending
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-rose-200">
            <AlertCircle size={14} /> Rejected
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-slate-200">
            {status}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:items-start print:justify-start">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm print:hidden"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:max-w-none print:w-full print:border-none print:h-auto print:block">
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50/80 gap-3 print:hidden shrink-0">
          <h2 className="text-xl font-bold text-slate-800 self-start sm:self-auto">Transaction Details</h2>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg transition-colors border border-red-200"
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Printer size={16} /> Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-6 sm:p-8 bg-white overflow-y-auto print:overflow-visible print:p-10">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-dashed border-slate-200 gap-4 sm:gap-0">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-md">
                  B
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">BuildWise</h1>
              </div>
              <p className="text-sm text-slate-500 font-medium ml-13">Official Transaction Record</p>
            </div>
            <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Receipt Number</p>
              <p className="text-lg font-mono font-bold text-slate-800">TRX-{String(transaction.id).padStart(6, "0")}</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction Date</p>
              {renderStatusBadge(transaction.status)}
            </div>
            <p className="text-xl font-semibold text-slate-800">
              {new Date(transaction.transaction_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100 print:bg-white print:border-slate-300">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Description</p>
                <p className="text-base font-medium text-slate-900 leading-relaxed">{transaction.description}</p>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-4 sm:gap-8">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Category</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 print:border-none print:p-0">
                    <span 
                      className="w-3 h-3 rounded-full print:border print:border-slate-800" 
                      style={{ backgroundColor: transaction.category_details?.color || "#3b82f6" }}
                    ></span>
                    <span className="text-sm font-semibold text-slate-700">{transaction.category_details?.name || "General"}</span>
                  </div>
                </div>
                <div className="flex-1 text-left sm:text-right pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Amount</p>
                  <p className="text-3xl font-black tracking-tight text-blue-600 print:text-slate-900 break-words">
                    Rwf {formatCurrency(Number(transaction.amount))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {transaction.notes && (
            <div className="mb-8">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Additional Notes / Reference</p>
              <p className="text-sm text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100 print:bg-white print:border-none print:p-0">
                {transaction.notes}
              </p>
            </div>
          )}

          <div className="pt-8 border-t border-slate-100 mt-12 text-center print:border-t-2 print:border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">BuildWise Financial System</p>
            <p className="text-[10px] text-slate-400">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
      
      {/* CSS for printing hidden globally except when active */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:visible, .print\\:visible * {
            visibility: visible;
          }
          .fixed.inset-0 {
            position: absolute;
            left: 0;
            top: 0;
            visibility: visible;
            width: 100%;
          }
          .fixed.inset-0 * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
