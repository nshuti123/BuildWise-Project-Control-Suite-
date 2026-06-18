import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import api from "../api";

interface AddMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  milestone?: any;
  onSuccess: () => void;
}

export function AddMilestoneModal({
  isOpen,
  onClose,
  projectId,
  milestone,
  onSuccess,
}: AddMilestoneModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    status: "pending",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (milestone) {
      setFormData({
        name: milestone.name,
        date: milestone.date,
        status: milestone.status,
      });
    } else {
      setFormData({ name: "", date: "", status: "pending" });
    }
  }, [milestone, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        ...formData,
        project: projectId,
      };

      if (milestone && milestone.id) {
        await api.put(`/projects/milestones/${milestone.id}/`, payload);
      } else {
        await api.post("/projects/milestones/", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!milestone || !window.confirm("Are you sure you want to delete this milestone? This action cannot be undone.")) return;
    
    setIsSubmitting(true);
    try {
      await api.delete(`/projects/milestones/${milestone.id}/`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete milestone");
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {milestone ? "Edit Milestone" : "Define New Milestone"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Milestone Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              placeholder="e.g. Foundation Complete"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Target Date
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none bg-white"
            >
              <option value="pending">Pending</option>
              <option value="on-track">On Track</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3 w-full sticky bottom-0 bg-white">
            {milestone && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium border border-red-100"
              >
                Delete
              </button>
            )}
            <div className="flex gap-3 flex-1">
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 shadow-sm shadow-blue-600/20"
              >
                {isSubmitting ? "Saving..." : "Save Milestone"}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
