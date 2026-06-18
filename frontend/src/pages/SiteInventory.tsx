import React, { useState, useEffect, useMemo } from "react";
import { Package, Search, PackagePlus, AlertTriangle, FileText, Download } from "lucide-react";
import api from "../api";
import { useProject } from "../context/ProjectContext";
import { AllocationModal } from "../components/AllocationModal";
import { MaterialRequestModal } from "../components/MaterialRequestModal";
import {
  canCancelMaterialRequest,
  cancelMaterialRequest,
  materialRequestBadgeClass,
  materialRequestStatusLabel,
} from "../utils/materialRequestActions";
import { Pagination } from "../components/Pagination";
import { UsageReportDateControls } from "../components/UsageReportDateControls";
import { TableReportActions } from "../components/TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";
import { getYesterdayDateKey } from "../utils/inventoryDateRange";

interface SiteInventoryItem {
  id: number;
  material: number;
  material_name: string;
  material_unit: string;
  material_minimum_stock?: string | number;
  current_stock: string;
  updated_at: string;
}

function isLowStock(item: SiteInventoryItem): boolean {
  const stock = parseFloat(item.current_stock);
  const min = parseFloat(String(item.material_minimum_stock ?? "0"));
  if (min > 0) {
    return stock <= min;
  }
  return stock > 0 && stock < 10;
}

function isOutOfStock(item: SiteInventoryItem): boolean {
  return parseFloat(item.current_stock) <= 0;
}

interface MaterialAllocationRow {
  id: number;
  material_name: string;
  material_unit: string;
  task_name: string;
  quantity: string | number;
  allocated_by_name?: string;
  date_allocated: string;
  notes?: string;
}

const REPORT_DAYS = 7;
const REPORT_TABLE_LIMIT = 12;

function withinLastDays(isoDate: string, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(isoDate).getTime() >= cutoff;
}

export function SiteInventory() {
  const { currentProjectId: selectedProject, projects } = useProject();
  const [items, setItems] = useState<SiteInventoryItem[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<MaterialAllocationRow[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState<"snapshot" | "usage" | null>(null);
  const [usageReportDate, setUsageReportDate] = useState(getYesterdayDateKey);
  const [usageDateAllocations, setUsageDateAllocations] = useState<MaterialAllocationRow[]>([]);
  const [usageDateLoading, setUsageDateLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestToRevise, setRequestToRevise] = useState<any | null>(null);
  const [cancellingRequestId, setCancellingRequestId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<SiteInventoryItem | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (selectedProject) {
      fetchInventory();
      fetchRequests();
      fetchAllocations();
    } else {
      setItems([]);
      setRequests([]);
      setAllocations([]);
      setIsLoading(false);
    }
  }, [selectedProject]);

  const fetchUsageForDate = async (projectId: number, dateKey: string) => {
    setUsageDateLoading(true);
    try {
      const response = await api.get(
        `/procurement/allocations/?project=${projectId}&date=${dateKey}&page_size=500`,
      );
      const list = Array.isArray(response.data) ? response.data : [];
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.date_allocated).getTime() - new Date(a.date_allocated).getTime(),
      );
      setUsageDateAllocations(sorted);
    } catch (err) {
      console.error("Failed to fetch usage for date:", err);
      setUsageDateAllocations([]);
    } finally {
      setUsageDateLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedProject || !usageReportDate) {
      setUsageDateAllocations([]);
      return;
    }
    fetchUsageForDate(selectedProject, usageReportDate);
  }, [selectedProject, usageReportDate]);

  const fetchRequests = async () => {
    try {
      const response = await api.get(
        `/procurement/requests/?project=${selectedProject}&page_size=100`
      );
      const list = Array.isArray(response.data) ? response.data : [];
      setRequests(list);
    } catch (err) {
      console.error("Failed to fetch material requests:", err);
    }
  };

  const handleCancelMaterialRequest = async (requestId: number) => {
    if (!window.confirm("Cancel this material requisition? This cannot be undone.")) return;
    setCancellingRequestId(requestId);
    try {
      await cancelMaterialRequest(requestId);
      await fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Could not cancel this requisition.");
    } finally {
      setCancellingRequestId(null);
    }
  };

  const fetchAllocations = async () => {
    setAllocationsLoading(true);
    try {
      const response = await api.get(
        `/procurement/allocations/?project=${selectedProject}&page_size=500`
      );
      const list = Array.isArray(response.data) ? response.data : [];
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.date_allocated).getTime() - new Date(a.date_allocated).getTime()
      );
      setAllocations(sorted);
    } catch (err) {
      console.error("Failed to fetch allocations:", err);
      setAllocations([]);
    } finally {
      setAllocationsLoading(false);
    }
  };

  const projectName =
    projects.find((p) => p.id === selectedProject)?.name ?? "Selected project";

  const allocationReport = useMemo(() => {
    const recent = allocations.filter((a) => withinLastDays(a.date_allocated, REPORT_DAYS));
    const totalQtyRecent = recent.reduce((s, a) => s + Number(a.quantity), 0);
    const totalQtyAll = allocations.reduce((s, a) => s + Number(a.quantity), 0);
    const materials = new Set(allocations.map((a) => a.material_name)).size;
    const tasks = new Set(allocations.map((a) => a.task_name)).size;
    const byMaterial: Record<string, number> = {};
    recent.forEach((a) => {
      byMaterial[a.material_name] = (byMaterial[a.material_name] ?? 0) + Number(a.quantity);
    });
    const topMaterial = Object.entries(byMaterial).sort((a, b) => b[1] - a[1])[0];
    return {
      recentCount: recent.length,
      totalCount: allocations.length,
      totalQtyRecent,
      totalQtyAll,
      materials,
      tasks,
      topMaterial: topMaterial ? { name: topMaterial[0], qty: topMaterial[1] } : null,
      tableRows: allocations.slice(0, REPORT_TABLE_LIMIT),
    };
  }, [allocations]);

  const allocationTableReport = useMemo((): TableReportData => {
    const columns = ["Date", "Material", "Quantity", "Unit", "Task", "Allocated by", "Notes"];
    const rows = allocations.map((a) => [
      a.date_allocated,
      a.material_name,
      String(a.quantity),
      a.material_unit ?? "—",
      a.task_name ?? "—",
      a.allocated_by_name ?? "—",
      a.notes ?? "—",
    ]);
    return {
      title: `Material Allocations — ${projectName}`,
      subtitle: `Full allocation history (${allocations.length} records)`,
      filename: `Material_Allocations_${selectedProject ?? "project"}`,
      columns,
      rows,
    };
  }, [allocations, projectName, selectedProject]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportInventoryPdf = async (kind: "snapshot" | "usage") => {
    if (!selectedProject) return;
    setExportingPdf(kind);
    try {
      const params = new URLSearchParams({ export_as: "pdf", kind: kind === "usage" ? "daily-usage" : "snapshot" });
      if (kind === "usage") params.set("date", usageReportDate);
      const response = await api.get(
        `/projects/${selectedProject}/site-inventory-report/?${params.toString()}`,
        { responseType: "blob" },
      );
      const suffix =
        kind === "usage"
          ? `Usage_${usageReportDate}`
          : "Full_Inventory";
      downloadBlob(response.data, `Site_Inventory_${suffix}_${selectedProject}.pdf`);
    } catch (err) {
      console.error("Failed to export site inventory PDF:", err);
      alert("Failed to generate inventory PDF report.");
    } finally {
      setExportingPdf(null);
    }
  };

  const handleExportFullReport = () => exportInventoryPdf("snapshot");
  const handleExportUsageReport = () => exportInventoryPdf("usage");

  const usageDateStats = useMemo(() => {
    const units = usageDateAllocations.reduce((s, a) => s + Number(a.quantity), 0);
    return {
      count: usageDateAllocations.length,
      units,
      materials: new Set(usageDateAllocations.map((a) => a.material_name)).size,
      tasks: new Set(usageDateAllocations.map((a) => a.task_name).filter(Boolean)).size,
    };
  }, [usageDateAllocations]);

  const handleExportCsv = () => {
    if (allocations.length === 0) return;
    const header = ["Date", "Material", "Quantity", "Unit", "Task", "Allocated By", "Notes"];
    const rows = allocations.map((a) => [
      new Date(a.date_allocated).toISOString(),
      a.material_name,
      Number(a.quantity),
      a.material_unit,
      a.task_name,
      a.allocated_by_name ?? "",
      (a.notes ?? "").replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `material-allocation-report-${selectedProject}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(
        `/procurement/site-inventory/?project=${selectedProject}&page_size=1000`
      );
      const list = Array.isArray(response.data) ? response.data : [];
      setItems(list);
    } catch (err) {
      console.error("Failed to fetch site inventory:", err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllocate = (item: SiteInventoryItem) => {
    setSelectedItem(item);
    setIsAllocationModalOpen(true);
  };

  const filteredItems = items.filter(item => 
    item.material_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const inventoryTableReport = useMemo((): TableReportData => {
    const columns = ["Material", "Current stock", "Unit", "Last updated", "Status"];
    const rows = filteredItems.map((item) => {
      const status = isOutOfStock(item) ? "Out of stock" : isLowStock(item) ? "Low stock" : "OK";
      return [
        item.material_name,
        item.current_stock,
        item.material_unit,
        new Date(item.updated_at).toLocaleString(),
        status,
      ];
    });
    return {
      title: `Site Inventory — ${projectName}`,
      subtitle: `${filteredItems.length} materials`,
      filename: `Site_Inventory_${selectedProject ?? "project"}`,
      columns,
      rows,
    };
  }, [filteredItems, projectName, selectedProject]);

  const totalStockItems = items.length;
  const lowStockItems = items.filter(isLowStock).length;
  const outOfStockItems = items.filter(isOutOfStock).length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Inventory</h1>
          <p className="text-slate-600 mt-1">
            Manage local materials and allocate them to active tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsRequestModalOpen(true)}
          disabled={!selectedProject}
          className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          <PackagePlus size={20} />
          Request Materials
        </button>
      </div>

      {!selectedProject ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <Package className="mx-auto text-slate-300" size={48} />
          <p className="text-slate-600 mt-4">Select a project to view its site inventory</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Package size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Tracked Materials</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? "—" : totalStockItems}
                </p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Low Stock</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? "—" : lowStockItems}
                </p>
                {!isLoading && outOfStockItems > 0 && (
                  <p className="text-xs text-red-600 mt-0.5">{outOfStockItems} out of stock</p>
                )}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <PackagePlus size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Pending Requisitions</p>
                <p className="text-2xl font-bold text-slate-900">{pendingRequests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <FileText size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Material Allocation — Quick Report</h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {projectName} · Last {REPORT_DAYS} days &amp; recent activity
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full lg:w-auto lg:max-w-xl">
                <UsageReportDateControls
                  layout="stacked"
                  dateKey={usageReportDate}
                  onDateChange={setUsageReportDate}
                  onPrint={handleExportUsageReport}
                  printDisabled={isLoading || usageDateLoading || exportingPdf === "usage"}
                  stats={usageDateStats}
                  statsLoading={usageDateLoading}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <TableReportActions
                    report={allocationTableReport}
                    projectId={selectedProject ?? undefined}
                    disabled={allocations.length === 0}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={handleExportFullReport}
                    disabled={isLoading || exportingPdf === "snapshot"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FileText size={16} />
                    {exportingPdf === "snapshot" ? "Generating PDF…" : "Full inventory report (PDF)"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={allocations.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {allocationsLoading ? (
              <div className="p-8 text-center text-slate-500">Loading allocation report...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-200 border-b border-slate-200">
                  {[
                    { label: `Allocations (${REPORT_DAYS}d)`, value: allocationReport.recentCount },
                    { label: "All-time allocations", value: allocationReport.totalCount },
                    { label: `Units issued (${REPORT_DAYS}d)`, value: allocationReport.totalQtyRecent.toLocaleString() },
                    { label: "Units issued (all)", value: allocationReport.totalQtyAll.toLocaleString() },
                    { label: "Materials used", value: allocationReport.materials },
                    { label: "Tasks supplied", value: allocationReport.tasks },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white p-4 text-center sm:text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>
                {allocationReport.topMaterial && (
                  <div className="px-4 py-2.5 bg-emerald-50/60 border-b border-emerald-100 text-sm text-emerald-900">
                    <span className="font-semibold">Top material (last {REPORT_DAYS} days):</span>{" "}
                    {allocationReport.topMaterial.name} — {allocationReport.topMaterial.qty.toLocaleString()} units allocated
                  </div>
                )}
                <div className="overflow-x-auto">
                  {allocationReport.tableRows.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      No material allocations recorded for this project yet.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Material</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-700">Qty</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Task</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Allocated by</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 hidden md:table-cell">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocationReport.tableRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              {new Date(row.date_allocated).toLocaleString()}
                              {withinLastDays(row.date_allocated, REPORT_DAYS) && (
                                <span className="ml-2 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Recent
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">{row.material_name}</td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-900">
                              {Number(row.quantity)}{" "}
                              <span className="text-slate-500 font-normal">{row.material_unit}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-800">{row.task_name || "—"}</td>
                            <td className="py-3 px-4 text-slate-600">{row.allocated_by_name || "—"}</td>
                            <td className="py-3 px-4 text-slate-500 hidden md:table-cell max-w-[200px] truncate">
                              {row.notes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {allocations.length > REPORT_TABLE_LIMIT && (
                  <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 bg-slate-50">
                    Showing latest {REPORT_TABLE_LIMIT} of {allocations.length} allocations. Export CSV for the full list.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
              <div className="relative w-full sm:w-auto">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-80 pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <TableReportActions
                report={inventoryTableReport}
                projectId={selectedProject ?? undefined}
                disabled={filteredItems.length === 0}
              />
            </div>

            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-8 text-center text-slate-500">Loading site inventory...</div>
              ) : paginatedItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border-t border-slate-100">
                  {searchQuery ? "No materials found matching your search." : "No materials available in the site inventory."}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-6 text-sm font-semibold text-slate-700">Material</th>
                      <th className="text-right py-3 px-6 text-sm font-semibold text-slate-700">Current Stock</th>
                      <th className="text-left py-3 px-6 text-sm font-semibold text-slate-700">Last Updated</th>
                      <th className="text-center py-3 px-6 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-medium text-slate-900">{item.material_name}</div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="font-bold text-slate-900">
                            {Number(item.current_stock)} <span className="text-slate-500 font-normal text-sm">{item.material_unit}</span>
                          </div>
                          {isLowStock(item) && !isOutOfStock(item) && (
                            <span className="text-xs text-orange-600 font-medium">Low stock</span>
                          )}
                          {isOutOfStock(item) && (
                            <span className="text-xs text-red-600 font-medium">Out of stock</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-500">
                          {new Date(item.updated_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => handleAllocate(item)}
                            disabled={parseFloat(item.current_stock) <= 0}
                            className="text-sm font-medium bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Allocate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!isLoading && totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Recent Field Requisitions</h2>
            </div>
            <div className="p-4 space-y-3">
              {requests.length === 0 ? (
                <div className="text-center text-slate-500 py-4">No recent requisitions.</div>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="p-4 border border-slate-100 rounded-lg bg-white space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-bold text-slate-800">{req.material_name} <span className="font-medium text-slate-500">x {Number(req.quantity_requested)} {req.material_unit}</span></p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(req.created_at).toLocaleString()}</p>
                      </div>
                      <span className={materialRequestBadgeClass(req.status)}>
                         {materialRequestStatusLabel(req.status, req)}
                      </span>
                    </div>
                    {req.status === 'rejected' && req.rejection_notes && (
                      <div className="text-sm bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs font-bold uppercase text-red-800 mb-1">Rejection notes</p>
                        <p className="text-red-900">{req.rejection_notes}</p>
                      </div>
                    )}
                    {(req.status === 'approved' || req.status === 'fulfilled') && req.approval_notes && (
                      <div className="text-sm bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                        <p className="text-xs font-bold uppercase text-emerald-800 mb-1">Approval notes</p>
                        <p className="text-emerald-900">{req.approval_notes}</p>
                      </div>
                    )}
                    {(req.status === 'rejected' || canCancelMaterialRequest(req.status)) && (
                      <div className="flex flex-wrap items-center gap-4">
                        {req.status === 'rejected' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRequestToRevise(req);
                              setIsRequestModalOpen(true);
                            }}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Revise & resubmit
                          </button>
                        )}
                        {canCancelMaterialRequest(req.status) && (
                          <button
                            type="button"
                            disabled={cancellingRequestId === req.id}
                            onClick={() => handleCancelMaterialRequest(req.id)}
                            className="text-sm font-semibold text-slate-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {cancellingRequestId === req.id ? 'Cancelling…' : 'Cancel request'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {selectedProject && (
        <>
          <AllocationModal
            isOpen={isAllocationModalOpen}
            onClose={() => setIsAllocationModalOpen(false)}
            onSuccess={() => {
              fetchInventory();
              fetchAllocations();
              if (selectedProject) {
                fetchUsageForDate(selectedProject, usageReportDate);
              }
            }}
            item={selectedItem}
            projectId={selectedProject}
          />
          <MaterialRequestModal
            isOpen={isRequestModalOpen}
            onClose={() => {
              setIsRequestModalOpen(false);
              setRequestToRevise(null);
            }}
            onSuccess={() => {
              fetchInventory();
              fetchRequests();
              fetchAllocations();
              setRequestToRevise(null);
            }}
            projectId={selectedProject}
            requestToRevise={requestToRevise}
          />
        </>
      )}
    </div>
    </>
  );
}
