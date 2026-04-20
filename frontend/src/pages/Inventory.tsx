import { useState, useEffect } from "react";
import { Plus, Search, Edit2, AlertTriangle, Package, AlertCircle } from "lucide-react";
import api from "../api";
import { MaterialModal } from "../components/MaterialModal";

interface Material {
  id: number;
  name: string;
  unit: string;
  unit_price: string;
  current_stock: string;
  minimum_stock: string;
}

export function Inventory() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const [matRes, reqRes] = await Promise.all([
        api.get("/procurement/materials/"),
        api.get("/procurement/requests/")
      ]);
      setMaterials(matRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      console.error("Failed to fetch materials:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleRequestStatusObj = async (requestId: number, newStatus: string) => {
    try {
       await api.patch(`/procurement/requests/${requestId}/approve/`, { status: newStatus });
       fetchMaterials();
    } catch (err) {
       console.error("Failed to update request", err);
    }
  }

  const openAddModal = () => {
    setMaterialToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (material: Material) => {
    setMaterialToEdit(material);
    setIsModalOpen(true);
  };

  const formatCurrency = (amount: string | number) => {
    return Number(amount).toLocaleString();
  };

  const calculateStockPercentage = (current: string, min: string) => {
    const c = parseFloat(current);
    const m = parseFloat(min);
    if (m === 0) return c > 0 ? 100 : 0;
    const max = m * 3;
    const percentage = (c / max) * 100;
    return Math.min(Math.max(percentage, 0), 100);
  };

  const filteredMaterials = materials.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading && materials.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading Inventory...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Inventory Management
          </h1>
          <p className="text-slate-600">
            Track and adjust material stock levels directly
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">Add Material</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="text-amber-600" />
            Field Requisitions
          </h2>
        </div>
        
        <div className="overflow-hidden rounded-xl border border-slate-200">
             {requests.filter(r => r.status === 'pending' || r.status === 'approved').length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-50">No incoming field requisitions pending review.</div>
             ) : (
                <div className="divide-y divide-slate-100 bg-white">
                   {requests.filter(r => r.status === 'pending' || r.status === 'approved').map(req => (
                      <div key={req.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                         <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                               <Package size={20} />
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-900">{req.material_name} <span className="text-slate-500">x {Number(req.quantity_requested)} {req.material_unit}</span></h4>
                               <p className="text-xs font-medium text-slate-500 mt-0.5">Requested by {req.requested_by_name} for <span className="font-bold text-slate-700">{req.project_name}</span></p>
                               {req.notes && <p className="text-xs text-slate-600 italic bg-amber-50 px-2 py-1 rounded inline-block mt-1">"{req.notes}"</p>}
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                             {req.status === 'pending' ? (
                                <>
                                   <button onClick={() => handleRequestStatusObj(req.id, 'approved')} className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200">Approve</button>
                                   <button onClick={() => handleRequestStatusObj(req.id, 'rejected')} className="px-4 py-2 bg-red-50 text-red-700 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors border border-red-200">Reject</button>
                                </>
                             ) : (
                                <button onClick={() => handleRequestStatusObj(req.id, 'fulfilled')} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold shadow-sm rounded-lg hover:bg-blue-700 transition-colors">Fulfill Request</button>
                             )}
                         </div>
                      </div>
                   ))}
                </div>
             )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-blue-600" />
            Material Master List
          </h2>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
              No materials found matching your search.
            </div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Unit Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Unit Price (Rwf)</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 w-1/4">Stock Level</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((item) => {
                  const isLow = parseFloat(item.current_stock) <= parseFloat(item.minimum_stock);
                  const percentage = calculateStockPercentage(item.current_stock, item.minimum_stock);

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 text-sm font-medium text-slate-900">
                        {item.name}
                        {isLow && (
                          <span className="inline-flex ml-2 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} /> Low Stock
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {item.unit}
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-900 font-medium">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-between mb-1.5">
                          <span className={`text-sm font-medium ${isLow ? "text-red-600" : "text-slate-600"}`}>
                            {Number(item.current_stock)}
                          </span>
                          <span className="text-xs text-slate-400">Min: {Number(item.minimum_stock)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isLow ? "bg-red-500" : "bg-blue-500"}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      </td>
                    </tr>
                  )}
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <MaterialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onMaterialSaved={fetchMaterials}
        materialToEdit={materialToEdit}
      />
    </div>
  );
}
