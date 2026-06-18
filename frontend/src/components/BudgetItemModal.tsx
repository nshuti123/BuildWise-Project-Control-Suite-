import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, DollarSign } from "lucide-react";
import api from "../api";

interface BudgetItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
  projectBudget?: number;
  remainingToAllocate?: number;
  itemToEdit?: any;
}

export function BudgetItemModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
  projectBudget,
  remainingToAllocate,
  itemToEdit,
}: BudgetItemModalProps) {
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [plannedAmount, setPlannedAmount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (itemToEdit) {
        setDescription(itemToEdit.description);
        setCategoryId(itemToEdit.category);
        setPlannedAmount(itemToEdit.planned_amount);
        setNotes(itemToEdit.notes || "");
      } else {
        setDescription("");
        setCategoryId("");
        setPlannedAmount("");
        setNotes("");
      }
      setError("");
    }
  }, [isOpen, itemToEdit]);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/projects/budget-categories/");
      setCategories(res.data);
    } catch (err) {
      console.error("Failed to load budget categories", err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !categoryId || !plannedAmount) {
      setError("Please fill in all required fields.");
      return;
    }

    // Fast client-side guard (server still enforces the real rule)
    if (
      typeof projectBudget === "number" &&
      projectBudget > 0 &&
      typeof remainingToAllocate === "number" &&
      plannedAmount !== "" &&
      Number(plannedAmount) > Math.max(0, remainingToAllocate)
    ) {
      setError(
        `Planned amount exceeds remaining budget to allocate. Remaining: Rwf ${Math.max(0, remainingToAllocate).toLocaleString()}.`,
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    const payload = {
      project: projectId,
      category: Number(categoryId),
      description,
      planned_amount: plannedAmount,
      notes,
    };

    try {
      if (itemToEdit) {
        await api.put(`/projects/budget-items/${itemToEdit.id}/`, payload);
      } else {
        await api.post("/projects/budget-items/", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      const fieldMsg =
        (Array.isArray(data?.planned_amount) && data.planned_amount[0]) ||
        data?.planned_amount ||
        data?.detail;
      setError("Failed to save budget item. " + (fieldMsg || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {itemToEdit ? "Edit Budget Item" : "Plan New Budget"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 bg-slate-50 border-b border-slate-200">
          <form id="budget-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            {typeof projectBudget === "number" && projectBudget > 0 && typeof remainingToAllocate === "number" && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-800">Project budget cap</div>
                  <div className="font-mono font-bold text-slate-900">Rwf {projectBudget.toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <div className="text-slate-600">Remaining to allocate</div>
                  <div className="font-mono font-bold text-emerald-700">Rwf {Math.max(remainingToAllocate, 0).toLocaleString()}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Allocations are enforced by the server — you can’t save a plan that exceeds the project budget.
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white transition-shadow"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Description *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                placeholder="e.g. Phase 1 Material Costs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Planned Amount (Rwf) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(parseFloat(e.target.value) || "")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow font-mono"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                rows={3}
                placeholder="Optional details..."
              />
            </div>
          </form>
        </div>

        <div className="p-6 bg-white shrink-0 flex gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Budget Item"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
