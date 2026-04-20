import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from "lucide-react";
import api from "../api";

interface Supplier {
  id: number;
  name: string;
}

interface Material {
  id: number;
  name: string;
  unit: string;
  unit_price: string;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: () => void;
  initialMaterialId?: string;
}

export function NewOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
  initialMaterialId,
}: NewOrderModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [orderDate, setOrderDate] = useState(today);
  const [deliveryDate, setDeliveryDate] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedMaterial && quantity) {
      const material = materials.find((m) => m.id.toString() === selectedMaterial.toString());
      if (material && material.unit_price) {
        const total = parseFloat(quantity) * parseFloat(material.unit_price);
        setTotalAmount(total.toFixed(2));
      }
    } else {
      setTotalAmount("");
    }
  }, [selectedMaterial, quantity, materials]);

  useEffect(() => {
    if (isOpen) {
      fetchFormData();
      if (initialMaterialId) {
        setSelectedMaterial(initialMaterialId);
      }
    }
  }, [isOpen, initialMaterialId]);

  const fetchFormData = async () => {
    try {
      const [suppliersRes, materialsRes] = await Promise.all([
        api.get("/procurement/suppliers/"),
        api.get("/procurement/materials/"),
      ]);
      setSuppliers(suppliersRes.data);
      setMaterials(materialsRes.data);
    } catch (err) {
      console.error("Failed to fetch form data", err);
      setError("Failed to load suppliers and materials. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await api.post("/procurement/orders/", {
        po_number: `PO-${new Date().getFullYear()}-${Math.floor(
          Math.random() * 10000,
        )
          .toString()
          .padStart(4, "0")}`,
        supplier: selectedSupplier,
        material: selectedMaterial,
        quantity: quantity,
        total_amount: totalAmount,
        status: "pending",
        order_date: orderDate,
        delivery_date: deliveryDate || null,
      });

      onOrderCreated(); // Trigger refresh on parent
      handleClose(); // Close the modal and reset
    } catch (err: any) {
      console.error("Failed to create order", err);
      setError(
        err.response?.data?.detail ||
          "Failed to create order. Please check inputs.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form state
    setSelectedSupplier("");
    setSelectedMaterial("");
    setQuantity("");
    setTotalAmount("");
    setDeliveryDate("");
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
            New Purchase Order
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
                Supplier
              </label>
              <select
                required
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>
                  Select a supplier...
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Material
              </label>
              <select
                required
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>
                  Select a material...
                </option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total Amount (Rwf) - Auto-calculated
                </label>
                <input
                  readOnly
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalAmount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 focus:outline-none cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Order Date
                </label>
                <input
                  required
                  type="date"
                  min={today}
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Valued Delivery Date
                </label>
                <input
                  type="date"
                  min={orderDate || today}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
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
                {isLoading ? "Creating Order..." : "Create Order"}
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
