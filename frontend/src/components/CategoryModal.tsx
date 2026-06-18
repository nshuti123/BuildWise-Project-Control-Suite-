import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Tags } from "lucide-react";
import api from "../api";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categoryToEdit?: any;
}

export function CategoryModal({
  isOpen,
  onClose,
  onSuccess,
  categoryToEdit,
}: CategoryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (categoryToEdit) {
        setName(categoryToEdit.name || "");
        setDescription(categoryToEdit.description || "");
        setColor(categoryToEdit.color || "#3b82f6");
      } else {
        setName("");
        setDescription("");
        setColor("#3b82f6");
      }
      setError("");
    }
  }, [isOpen, categoryToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError("Name is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const payload = {
      name,
      description,
      color,
      is_active: true,
    };

    try {
      if (categoryToEdit) {
        await api.patch(`/projects/budget-categories/${categoryToEdit.id}/`, payload);
      } else {
        await api.post("/projects/budget-categories/", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError("Failed to save category. " + (err.response?.data?.name?.[0] || err.response?.data?.detail || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center">
              <Tags size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {categoryToEdit ? "Edit Category" : "New Category"}
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

        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                placeholder="e.g. Permits & Fees"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Color *</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  required
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-10 p-1 border border-slate-300 rounded-lg cursor-pointer bg-white"
                />
                <span className="text-sm font-mono text-slate-500">{color}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                rows={2}
                placeholder="Brief description of what belongs in this category..."
              />
            </div>
          </form>
        </div>

        <div className="p-6 bg-white shrink-0 flex gap-3">
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
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Category"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
