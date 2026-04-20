import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Package, X, Loader2 } from "lucide-react";
import api from "../api";

interface MaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
}

export function MaterialRequestModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
}: MaterialRequestModalProps) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMaterials();
      setSelectedMaterial("");
      setQuantity("");
      setNotes("");
      setError(null);
    }
  }, [isOpen]);

  const fetchMaterials = async () => {
    try {
      const resp = await api.get("/procurement/materials/");
      setMaterials(resp.data);
    } catch (err) {
      console.error("Failed to fetch materials", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || !quantity) {
      setError("Please select a material and enter a quantity.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post("/procurement/requests/", {
        project: projectId,
        material: selectedMaterial,
        quantity_requested: quantity,
        notes: notes,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to submit material request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Selected Material Unit Hint
  const activeMaterial = materials.find(
    (m) => m.id.toString() === selectedMaterial,
  );
  const unitLabel = activeMaterial ? activeMaterial.unit : "units";

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Request Materials
              </h2>
              <p className="text-sm text-slate-500">
                Submit a field requisition
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Material Needed
            </label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-800"
              required
            >
              <option value="">Select a material from registry...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.current_stock} {m.unit} in stock)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Quantity Requested
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-800 pr-16"
                placeholder="0.00"
                required
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold pointer-events-none">
                {unitLabel}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Location / Purpose Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-800 h-24 resize-none"
              placeholder="e.g. For foundation pouring at Zone B"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Submitting Request...
                </>
              ) : (
                "Submit Field Requisition"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
