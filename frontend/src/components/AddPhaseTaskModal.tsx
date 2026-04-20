import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "../api";

interface AddPhaseTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  task?: any;
  onSuccess: () => void;
}

export function AddPhaseTaskModal({
  isOpen,
  onClose,
  projectId,
  task,
  onSuccess,
}: AddPhaseTaskModalProps) {
  const [formData, setFormData] = useState({
    phase: "",
    task_name: "",
    start_date: "",
    end_date: "",
    progress: 0,
    status: "pending",
    tracking_method: "manual",
    target_units: 0,
    completed_units: 0,
    unit_name: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (task) {
      setFormData({
        phase: task.phase,
        task_name: task.task_name,
        start_date: task.start_date,
        end_date: task.end_date,
        progress: task.progress,
        status: task.status,
        tracking_method: task.tracking_method || "manual",
        target_units: task.target_units || 0,
        completed_units: task.completed_units || 0,
        unit_name: task.unit_name || "",
      });
    } else {
      setFormData({
        phase: "",
        task_name: "",
        start_date: "",
        end_date: "",
        progress: 0,
        status: "pending",
        tracking_method: "manual",
        target_units: 0,
        completed_units: 0,
        unit_name: "",
      });
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const payload = { ...formData, project: projectId };

      if (task && task.id) {
        await api.put(`/projects/phase-tasks/${task.id}/`, payload);
      } else {
        await api.post("/projects/phase-tasks/", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save timeline task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {task ? "Edit Timeline Task" : "Add Timeline Task"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Phase Name</label>
              <input
                type="text"
                required
                value={formData.phase}
                onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                placeholder="e.g. Foundation"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Task Name</label>
              <input
                type="text"
                required
                value={formData.task_name}
                onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                placeholder="e.g. Concrete Pouring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700">Tracking Method</label>
            <select
              value={formData.tracking_method}
              onChange={(e) => setFormData({ ...formData, tracking_method: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none bg-white font-medium text-slate-900"
            >
              <option value="manual">Manual Percentage (Slider)</option>
              <option value="subtasks">Automated from Linked Subtasks</option>
              <option value="units">Physical Quantities (Units)</option>
            </select>
          </div>

          {formData.tracking_method === "units" && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
               <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Target</label>
                <input
                  type="number"
                  min="0"
                  required={formData.tracking_method === "units"}
                  value={formData.target_units}
                  onChange={(e) => setFormData({ ...formData, target_units: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Completed</label>
                <input
                  type="number"
                  min="0"
                  required={formData.tracking_method === "units"}
                  value={formData.completed_units}
                  onChange={(e) => setFormData({ ...formData, completed_units: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Unit Name</label>
                <input
                  type="text"
                  required={formData.tracking_method === "units"}
                  value={formData.unit_name}
                  onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                  placeholder="e.g. Tons"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none bg-white"
              >
                <option value="pending">Pending</option>
                <option value="on-track">On Track</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            {formData.tracking_method === "manual" ? (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Progress (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-500">Progress</label>
                <div className="w-full px-3 py-2 border border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-400 text-sm">
                   Calculated Automatically
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
