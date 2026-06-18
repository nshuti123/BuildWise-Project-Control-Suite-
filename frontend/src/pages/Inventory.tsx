import { useState, useEffect } from "react";
import { Plus, Search, Edit2, AlertTriangle, Package } from "lucide-react";
import api from "../api";
import { MaterialModal } from "../components/MaterialModal";
import { MaterialRequisitionsPanel } from "../components/MaterialRequisitionsPanel";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { ProjectScopeBanner } from "../components/ProjectScopeBanner";
import { Pagination } from "../components/Pagination";

interface Material {
  id: number;
  name: string;
  unit: string;
  unit_price: string;
  current_stock: string;
  minimum_stock: string;
}

export function Inventory() {
  const { user } = useAuth();
  const { currentProjectId, projects } = useProject();
  const isProcurementOfficer = user?.role === "procurement-officer";
  const activeProject = projects.find((p) => p.id === currentProjectId);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchMaterials = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const matRes = await api.get(`/procurement/materials/?page=${page}`);
      const payload = matRes.data;
      const list = Array.isArray(payload) ? payload : payload?.results ?? [];
      setMaterials(list);

      if (payload && typeof payload === "object" && "count" in payload) {
        const count = Number(payload.count) || list.length;
        setTotalItems(count);
        setTotalPages(Math.max(1, Math.ceil(count / 10)));
      } else {
        setTotalItems(list.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to fetch materials:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials(currentPage);
  }, [currentPage]);

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
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20 cursor-pointer font-medium"
        >
          <Plus size={18} />
          <span className="text-sm">Add Material</span>
        </button>
      </div>

      {activeProject && !isProcurementOfficer && (
        <ProjectScopeBanner
          projectName={activeProject.name}
          context="material requisitions"
        />
      )}

      {(isProcurementOfficer || currentProjectId) && (
        <MaterialRequisitionsPanel
          className="mb-6"
          projectId={isProcurementOfficer ? null : currentProjectId}
          onUpdated={() => fetchMaterials(currentPage)}
        />
      )}

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
          <Pagination
             currentPage={currentPage}
             totalPages={totalPages}
             onPageChange={setCurrentPage}
             totalItems={totalItems}
          />
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
