import React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, DollarSign, X } from "lucide-react";

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "success" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!isOpen) return null;

  const getConfig = () => {
    switch (type) {
      case "danger":
        return {
          bg: "bg-red-50",
          icon: <AlertCircle className="text-red-600" size={32} />,
          btn: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
        };
      case "success":
        return {
          bg: "bg-green-50",
          icon: <CheckCircle2 className="text-green-600" size={32} />,
          btn: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
        };
      case "info":
        return {
          bg: "bg-blue-50",
          icon: <DollarSign className="text-blue-600" size={32} />,
          btn: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
        };
      case "warning":
      default:
        return {
          bg: "bg-orange-50",
          icon: <AlertCircle className="text-orange-600" size={32} />,
          btn: "bg-orange-600 hover:bg-orange-700 focus:ring-orange-500",
        };
    }
  };

  const config = getConfig();

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative transform transition-all scale-100">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-8 pb-6 text-center">
          <div className={`w-16 h-16 rounded-full ${config.bg} flex items-center justify-center mx-auto mb-5 shadow-inner`}>
            {config.icon}
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
        </div>

        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
