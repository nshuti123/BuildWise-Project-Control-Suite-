import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Truck,
  Package,
  Clock,
  Calendar,
  Hash,
  Building,
  Trash2,
  Loader2,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { ConfirmActionModal } from "./ConfirmActionModal";

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  material_name: string;
  material_unit: string;
  quantity: string;
  total_amount: string;
  status: "pending" | "on-track" | "delayed" | "completed";
  order_date: string;
  delivery_date?: string;
  order_type?: string;
}

interface PurchaseOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  canDelete?: boolean;
  onDeleted?: () => void;
}

export function PurchaseOrderDetailModal({
  isOpen,
  onClose,
  order,
  canDelete = false,
  onDeleted,
}: PurchaseOrderDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !order) return null;

  const formatCurrency = (amount: string | number) => {
    return Number(amount).toLocaleString();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const api = (await import("../api")).default;
      await api.delete(`/procurement/orders/${order.id}/`);
      setConfirmDelete(false);
      onClose();
      onDeleted?.();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Could not delete this purchase order.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteBlockedHint =
    order.status === "completed"
      ? "Stock received for this order will be reversed in the warehouse."
      : order.status === "pending"
        ? "Any pending finance payment request linked to this order will also be removed."
        : undefined;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  Order Details
                </h2>
                <p className="text-sm text-slate-500 font-mono">{order.po_number}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <p className="text-sm text-slate-500 mb-1">Current Status</p>
                <StatusBadge status={order.status} />
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 mb-1">Total Amount</p>
                <p className="text-xl font-bold text-slate-900">
                  Rwf{formatCurrency(order.total_amount)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building size={16} /> Supplier
                </div>
                <p className="font-medium text-slate-900">{order.supplier_name}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Package size={16} /> Item
                </div>
                <p className="font-medium text-slate-900">{order.material_name}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Hash size={16} /> Quantity
                </div>
                <p className="font-medium text-slate-900">
                  {Number(order.quantity)} {order.material_unit}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Package size={16} /> Type
                </div>
                <p className="font-medium text-slate-900 capitalize">
                  {order.order_type || "Material"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar size={16} /> Order Date
                </div>
                <p className="font-medium text-slate-900">
                  {formatDate(order.order_date)}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock size={16} /> Est. Delivery
                </div>
                <p className="font-medium text-slate-900">
                  {formatDate(order.delivery_date || "")}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between gap-3">
            {canDelete ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete order
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmActionModal
        isOpen={confirmDelete}
        title="Delete purchase order?"
        message={`Permanently delete ${order.po_number}? This cannot be undone.${
          deleteBlockedHint ? ` ${deleteBlockedHint}` : ""
        }`}
        confirmText={deleting ? "Deleting…" : "Delete order"}
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDelete(false)}
      />
    </>,
    document.body,
  );
}
