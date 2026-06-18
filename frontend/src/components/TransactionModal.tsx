import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Receipt } from "lucide-react";
import api from "../api";
import { asList, formatApiError } from "../utils/apiHelpers";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: TransactionModalProps) {
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [budgetItemId, setBudgetItemId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [transactionDate, setTransactionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchBudgetItems();
      setDescription("");
      setCategoryId("");
      setBudgetItemId("");
      setAmount("");
      setTransactionDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setError("");
    }
  }, [isOpen, projectId]);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/projects/budget-categories/");
      setCategories(asList(res.data));
    } catch (err) {
      console.error("Failed to load budget categories", err);
    }
  };

  const fetchBudgetItems = async () => {
    try {
      const res = await api.get(`/projects/budget-items/?project=${projectId}`);
      setBudgetItems(asList(res.data));
    } catch (err) {
      console.error("Failed to load budget items", err);
    }
  };

  // Auto-select category when budget item is selected
  useEffect(() => {
    if (budgetItemId) {
      const selectedItem = budgetItems.find((b) => b.id.toString() === budgetItemId);
      if (selectedItem) {
        setCategoryId(selectedItem.category.toString());
      }
    }
  }, [budgetItemId, budgetItems]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !categoryId || !amount || !transactionDate) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const payload = {
      project: projectId,
      category: Number(categoryId),
      budget_item: budgetItemId ? Number(budgetItemId) : null,
      description,
      amount: Number(amount),
      transaction_date: transactionDate,
      notes,
    };

    try {
      await api.post("/projects/transactions/", payload);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(formatApiError(err, "Failed to save transaction."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-700 rounded-lg flex items-center justify-center">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Log Expense (Transaction)
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
          <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Link to Budget Item</label>
              <select
                value={budgetItemId}
                onChange={(e) => setBudgetItemId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white transition-shadow"
              >
                <option value="">-- No Specific Budget Item (General Expense) --</option>
                {budgetItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description} ({item.category_details?.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                disabled={!!budgetItemId}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow ${budgetItemId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
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
                placeholder="e.g. Fuel for generator"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Amount (Rwf) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || "")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow font-mono"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Date *</label>
                <input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                rows={2}
                placeholder="Optional details or receipt #..."
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
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold shadow-md shadow-orange-500/20 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Log Expense"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
