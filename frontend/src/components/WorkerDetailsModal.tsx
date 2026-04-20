import { createPortal } from "react-dom";
import {
  X,
  User,
  Phone,
  Briefcase,
  DollarSign,
  HardHat,
  Calendar,
} from "lucide-react";

interface WorkerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: any;
}

export function WorkerDetailsModal({
  isOpen,
  onClose,
  worker,
}: WorkerDetailsModalProps) {
  if (!isOpen || !worker) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-800"></div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full p-1.5 backdrop-blur-md"
        >
          <X size={20} />
        </button>

        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="w-24 h-24 bg-white rounded-xl shadow-lg flex items-center justify-center border-4 border-white text-blue-600">
              <User size={48} />
            </div>
            <div className="mb-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${worker.is_active ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}
              >
                {worker.is_active ? "Active Status" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
              {worker.first_name} {worker.last_name}
            </h2>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-widest mt-1 flex items-center gap-1.5">
              <HardHat size={14} className="text-blue-500" />
              {worker.role}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-colors">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Phone size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">
                  Contact Number
                </p>
                <p className="text-slate-900 font-medium">
                  {worker.phone_number || "No number provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-colors">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <DollarSign size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">
                  Daily Compensation
                </p>
                <p className="text-slate-900 font-medium">
                  {worker.daily_rate} Rwf{" "}
                  <span className="text-slate-400 text-sm font-normal">
                    / day
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-colors">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Briefcase size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">
                  Worker ID
                </p>
                <p className="text-slate-900 font-medium font-mono text-sm">
                  BW-WRK-{String(worker.id).padStart(4, "0")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-colors">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <Calendar size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">
                  Contract Period
                </p>
                <p className="text-slate-900 font-medium text-sm">
                  {worker.start_date || 'N/A'} &mdash; {worker.end_date || 'Ongoing'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
