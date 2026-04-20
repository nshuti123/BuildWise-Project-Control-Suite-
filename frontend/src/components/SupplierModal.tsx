import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from "lucide-react";
import api from "../api";

interface Supplier {
  id: number;
  name: string;
  rating: string;
  materials_supplied?: number[];
  email?: string;
}

interface Material {
  id: number;
  name: string;
  unit: string;
}

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierSaved: () => void;
  supplierToEdit?: Supplier | null;
}

export function SupplierModal({
  isOpen,
  onClose,
  onSupplierSaved,
  supplierToEdit,
}: SupplierModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState("");
  const [materialsSupplied, setMaterialsSupplied] = useState<number[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch available materials for the multi-select checklist
    const fetchMaterials = async () => {
      try {
        const res = await api.get("/procurement/materials/");
        setAvailableMaterials(res.data);
      } catch (err) {
        console.error("Failed to fetch materials for modal", err);
      }
    };
    if (isOpen) {
      fetchMaterials();
    }
  }, [isOpen]);

  useEffect(() => {
    if (supplierToEdit) {
      setName(supplierToEdit.name);
      setEmail(supplierToEdit.email || "");
      setRating(supplierToEdit.rating);
      setMaterialsSupplied(supplierToEdit.materials_supplied || []);
    } else {
      setName("");
      setEmail("");
      setRating("");
      setMaterialsSupplied([]);
    }
  }, [supplierToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const payload = {
      name,
      email: email || null,
      rating: parseFloat(rating) || 0.0,
      materials_supplied: materialsSupplied,
    };

    try {
      if (supplierToEdit) {
        await api.put(`/procurement/suppliers/${supplierToEdit.id}/`, payload);
      } else {
        await api.post("/procurement/suppliers/", payload);
      }
      onSupplierSaved();
      handleClose();
    } catch (err: any) {
      console.error("Failed to save supplier", err);
      setError(
        err.response?.data?.detail ||
          "Failed to save supplier. Please check inputs."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setRating("");
    setMaterialsSupplied([]);
    setError("");
    onClose();
  };

  const toggleMaterial = (materialId: number) => {
    setMaterialsSupplied(prev => 
      prev.includes(materialId) 
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  if (!isOpen) return null;

  return (
    createPortal(
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {supplierToEdit ? "Edit Supplier" : "Add New Supplier"}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
                Supplier Name
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Acme Construction Supplies"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address (For automated POs)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. orders@acme.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Performance Rating (0.0 - 5.0)
              </label>
              <input
                required
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="4.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Materials Supplied
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
                {availableMaterials.length === 0 ? (
                  <span className="text-sm text-slate-500 col-span-2">Loading materials...</span>
                ) : (
                  availableMaterials.map((material) => (
                    <label key={material.id} className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={materialsSupplied.includes(material.id)}
                          onChange={() => toggleMaterial(material.id)}
                        />
                      </div>
                      <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                        {material.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 mt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-blue-600/20 cursor-pointer"
              >
                {isLoading ? "Saving..." : "Save Supplier"}
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
