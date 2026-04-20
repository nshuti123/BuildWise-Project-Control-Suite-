import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from "lucide-react";
import api from "../api";

interface Material {
  id: number;
  name: string;
  unit: string;
  unit_price: string;
  current_stock: string;
  minimum_stock: string;
}

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMaterialSaved: () => void;
  materialToEdit?: Material | null;
}

export function MaterialModal({
  isOpen,
  onClose,
  onMaterialSaved,
  materialToEdit,
}: MaterialModalProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [currentStock, setCurrentStock] = useState("");
  const [minimumStock, setMinimumStock] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (materialToEdit) {
      setName(materialToEdit.name);
      setUnit(materialToEdit.unit);
      setUnitPrice(materialToEdit.unit_price);
      setCurrentStock(materialToEdit.current_stock);
      setMinimumStock(materialToEdit.minimum_stock);
    } else {
      // Reset
      setName("");
      setUnit("");
      setUnitPrice("");
      setCurrentStock("");
      setMinimumStock("");
    }
  }, [materialToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const payload = {
      name,
      unit,
      unit_price: unitPrice || 0,
      current_stock: currentStock || 0,
      minimum_stock: minimumStock || 0,
    };

    try {
      if (materialToEdit) {
        await api.put(`/procurement/materials/${materialToEdit.id}/`, payload);
      } else {
        await api.post("/procurement/materials/", payload);
      }
      onMaterialSaved();
      handleClose();
    } catch (err: any) {
      console.error("Failed to save material", err);
      setError(
        err.response?.data?.detail ||
          "Failed to save material. Please check inputs."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setUnit("");
    setUnitPrice("");
    setCurrentStock("");
    setMinimumStock("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    createPortal(
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {materialToEdit ? "Edit Material" : "Add New Material"}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Material Name
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Portland Cement"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit Type
                </label>
                <input
                  required
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Bags, Tons"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit Price (Rwf)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Stock
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Minimum Stock Warning
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 sticky bottom-0">
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
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm shadow-blue-600/20"
              >
                {isLoading ? "Saving..." : "Save Material"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
  );
}
