import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, PackagePlus } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

interface Task {
  id: number;
  title: string;
}

interface SiteInventoryItem {
  id: number;
  material: number;
  material_name: string;
  material_unit: string;
  current_stock: string;
}

interface AllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: SiteInventoryItem | null;
  projectId: number;
}

export function AllocationModal({
  isOpen,
  onClose,
  onSuccess,
  item,
  projectId
}: AllocationModalProps) {
  const { user } = useAuth();
  const needsApproval = ["site-engineer", "site-foreman", "procurement-officer"].includes(
    user?.role ?? ""
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && projectId) {
      fetchTasks();
    }
  }, [isOpen, projectId]);

  const fetchTasks = async () => {
    try {
      const response = await api.get(`/projects/tasks/?project=${projectId}`);
      setTasks(response.data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    
    const qty = parseFloat(quantity);
    if (qty <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    
    if (qty > parseFloat(item.current_stock)) {
      setError(`Cannot allocate more than current stock (${item.current_stock}).`);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await api.post("/procurement/allocations/", {
        site_inventory: item.id,
        task: selectedTask,
        quantity: quantity,
        notes: notes
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to allocate materials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTask("");
    setQuantity("");
    setNotes("");
    setError("");
    onClose();
  };

  if (!isOpen || !item) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <PackagePlus size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold">Allocate Materials</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">{item.material_name}</h3>
            <p className="text-xs text-blue-700">Available Stock: <strong>{Number(item.current_stock)} {item.material_unit}</strong></p>
            {needsApproval && (
              <p className="text-xs text-amber-800 mt-2">
                Stock updates immediately. Your manager must approve this allocation; if rejected, stock is restored.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Assign to Task
              </label>
              <select
                required
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>Select a task...</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantity to Allocate
              </label>
              <div className="relative">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={item.current_stock}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full pl-3 pr-16 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.0"
                />
                <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-400">
                  {item.material_unit}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows={3}
                placeholder="e.g. For sector B concrete pour..."
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? "Allocating..." : "Confirm Allocation"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
