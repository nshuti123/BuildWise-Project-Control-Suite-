import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Star, Truck } from "lucide-react";
import api from "../api";
import { SupplierModal } from "../components/SupplierModal";

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
}

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [suppliersRes, materialsRes] = await Promise.all([
        api.get("/procurement/suppliers/"),
        api.get("/procurement/materials/")
      ]);
      setSuppliers(suppliersRes.data);
      setMaterials(materialsRes.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setSupplierToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setIsModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading && suppliers.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading Suppliers...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Supplier Management
          </h1>
          <p className="text-slate-600">
            Maintain your vendor directory and performance ratings
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">Add Supplier</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="text-blue-600" />
            Vendor Directory
          </h2>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
              No suppliers found matching your search.
            </div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Supplier Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Performance Rating</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Materials Supplied</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 text-sm font-medium text-slate-900">
                      <div>{supplier.name}</div>
                      {supplier.email && (
                        <div className="text-xs text-slate-500 font-normal mt-0.5" title="Purchase Orders will be sent here">{supplier.email}</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 w-fit bg-amber-50 px-2 pl-1.5 py-1 rounded text-amber-700 border border-amber-100">
                        <Star size={14} className="fill-amber-500 text-amber-500" />
                        <span className="text-sm font-bold">
                          {Number(supplier.rating).toFixed(1)} <span className="text-xs text-amber-600/60 font-medium">/ 5.0</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(supplier.materials_supplied || []).length === 0 ? (
                          <span className="text-xs text-slate-400 italic">None</span>
                        ) : (
                          (supplier.materials_supplied || []).map(matId => {
                            const mat = materials.find(m => m.id === matId);
                            return mat ? (
                              <span key={mat.id} className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                {mat.name}
                              </span>
                            ) : null;
                          })
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => openEditModal(supplier)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSupplierSaved={fetchData}
        supplierToEdit={supplierToEdit}
      />
    </div>
  );
}
