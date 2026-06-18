import { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Truck,
  AlertCircle,
  Star,
  BarChart2,
  PieChart as PieChartIcon
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import { NewOrderModal } from "../components/NewOrderModal";
import { MaterialRequisitionsPanel } from "../components/MaterialRequisitionsPanel";
import api from "../api";
import { arrayMove, loadLayout, saveLayout, type LayoutState } from "../utils/customizableLayout";
import { TableReportActions } from "../components/TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";

interface Supplier {
  id: number;
  name: string;
  rating: string;
}

interface Material {
  id: number;
  name: string;
  unit: string;
  unit_price: string;
  current_stock: string;
  minimum_stock: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  material_name: string;
  material_unit: string;
  quantity: string;
  total_amount: string;
  status: "pending" | "on-track" | "delayed" | "completed";
  order_date: string;
}

/** `all` = x-axis by month; `YYYY-MM` = x-axis by date within that month */
type SpendTrendMonthFilter = "all" | string;

const SPEND_TREND_MONTH_KEY = "buildwise.dashboard.procurement.spendTrendMonth.v1";

function loadSpendTrendMonth(): SpendTrendMonthFilter {
  if (typeof window === "undefined") return "all";
  const raw = window.localStorage.getItem(SPEND_TREND_MONTH_KEY);
  return raw && /^\d{4}-\d{2}$/.test(raw) ? raw : "all";
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function listOrderMonths(orders: PurchaseOrder[]): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  orders.forEach((o) => {
    if (o.status === "pending") return;
    const date = new Date(o.order_date);
    if (Number.isNaN(date.getTime())) return;
    const key = monthKeyFromDate(date);
    if (!seen.has(key)) {
      seen.set(
        key,
        date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      );
    }
  });
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, label]) => ({ key, label }));
}

function buildSpendTrendData(
  orders: PurchaseOrder[],
  monthFilter: SpendTrendMonthFilter,
): { name: string; spend: number }[] {
  const buckets = new Map<string, { spend: number; sortKey: number; name: string }>();

  orders.forEach((o) => {
    if (o.status === "pending") return;
    const date = new Date(o.order_date);
    if (Number.isNaN(date.getTime())) return;

    const amount = parseFloat(o.total_amount);
    if (Number.isNaN(amount)) return;

    const orderMonth = monthKeyFromDate(date);

    let bucketKey: string;
    let sortKey: number;
    let label: string;

    if (monthFilter === "all") {
      bucketKey = orderMonth;
      const [y, m] = orderMonth.split("-").map(Number);
      sortKey = new Date(y, m - 1, 1).getTime();
      label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } else {
      if (orderMonth !== monthFilter) return;
      bucketKey = date.toISOString().slice(0, 10);
      sortKey = new Date(bucketKey).getTime();
      label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.spend += amount;
    } else {
      buckets.set(bucketKey, { spend: amount, sortKey, name: label });
    }
  });

  return [...buckets.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ name, spend }) => ({ name, spend }));
}

export function ProcurementOfficerDashboard({
  setActiveModule,
}: {
  setActiveModule?: (module: string) => void;
}) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reorderMaterialId, setReorderMaterialId] = useState("");
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [spendTrendMonth, setSpendTrendMonth] =
    useState<SpendTrendMonthFilter>(loadSpendTrendMonth);

  const defaultMetrics = ["pendingOrders", "inventoryValue", "deliveriesDue", "approvedSpend"];
  const defaultSections = ["analytics", "recentOrders", "sidebar"];

  const [metricsLayout, setMetricsLayout] = useState<LayoutState>(() =>
    loadLayout("buildwise.dashboard.procurement.metrics.v1", defaultMetrics),
  );
  const [sectionsLayout, setSectionsLayout] = useState<LayoutState>(() =>
    loadLayout("buildwise.dashboard.procurement.sections.v1", defaultSections),
  );

  useEffect(() => saveLayout("buildwise.dashboard.procurement.metrics.v1", metricsLayout), [metricsLayout]);
  useEffect(() => saveLayout("buildwise.dashboard.procurement.sections.v1", sectionsLayout), [sectionsLayout]);
  useEffect(() => {
    try {
      window.localStorage.setItem(SPEND_TREND_MONTH_KEY, spendTrendMonth);
    } catch {
      /* ignore */
    }
  }, [spendTrendMonth]);

  const handleReorder = (materialId: number) => {
    setReorderMaterialId(materialId.toString());
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setReorderMaterialId("");
    setIsModalOpen(false);
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [materialsRes, ordersRes, suppliersRes] = await Promise.all([
        api.get("/procurement/materials/"),
        api.get("/procurement/orders/"),
        api.get("/procurement/suppliers/"),
      ]);
      setMaterials(materialsRes.data);
      setOrders(ordersRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute Metrics dynamically
  const pendingOrdersCount = orders.filter((o) => o.status === "pending").length;
  const deliveriesDueCount = orders.filter(
    (o) => o.status === "on-track" || o.status === "delayed"
  ).length;

  const lowStockAlerts = materials.filter(
    (m) => parseFloat(m.current_stock) <= parseFloat(m.minimum_stock)
  );

  const calculateMonthlySpend = () => {
    const recentOrders = orders.filter((o) => o.status !== "pending");
    const totalSpend = recentOrders.reduce(
      (acc, order) => acc + parseFloat(order.total_amount),
      0
    );
    return totalSpend;
  };

  const calculateInventoryValue = () => {
    return materials.reduce(
      (acc, material) => acc + (parseFloat(material.current_stock) * parseFloat(material.unit_price)),
      0
    );
  };

  const totalSpend = calculateMonthlySpend();
  const inventoryValue = calculateInventoryValue();

  // --- ANALYTICS DATA AGGREGATION ---

  const spendTrendMonthOptions = useMemo(() => listOrderMonths(orders), [orders]);

  useEffect(() => {
    if (
      spendTrendMonth !== "all" &&
      !spendTrendMonthOptions.some((m) => m.key === spendTrendMonth)
    ) {
      setSpendTrendMonth("all");
    }
  }, [spendTrendMonth, spendTrendMonthOptions]);

  const spendTrendData = useMemo(
    () => buildSpendTrendData(orders, spendTrendMonth),
    [orders, spendTrendMonth],
  );

  const spendTrendByDay = spendTrendMonth !== "all";
  const spendTrendTickAngle =
    spendTrendByDay && spendTrendData.length > 10 ? -35 : 0;

  // 2. Category Split (Pie Chart)
  const getCategoryData = () => {
    let materialSpend = 0;
    let equipmentSpend = 0;
    
    orders.forEach((o) => {
      // Assuming we can infer from material name or if we have an order_type. 
      // If order_type is not available, we use a simple heuristic or default to 50/50 for demo.
      // Wait, PurchaseOrder interface has order_type? No, the interface above didn't, but the backend does.
      // Let's add it to the interface mentally, or infer from material_name containing 'Excavator' etc.
      // Since it's not in the strict frontend interface above, we'll try to use order_type if it exists, else default.
      const amount = parseFloat(o.total_amount);
      const isEq = (o as any).order_type === 'equipment' || o.material_name.toLowerCase().includes('equipment') || o.material_name.toLowerCase().includes('crane') || o.material_name.toLowerCase().includes('excavator');
      
      if (isEq) {
        equipmentSpend += amount;
      } else {
        materialSpend += amount;
      }
    });

    return [
      { name: 'Materials', value: materialSpend },
      { name: 'Equipment', value: equipmentSpend }
    ];
  };

  // 3. Stock Health (Bar Chart)
  const getStockHealthData = () => {
    // Top 5 materials with the highest stock value
    return [...materials]
      .sort((a, b) => (parseFloat(b.current_stock) * parseFloat(b.unit_price)) - (parseFloat(a.current_stock) * parseFloat(a.unit_price)))
      .slice(0, 5)
      .map(m => ({
        name: m.name.length > 15 ? m.name.substring(0, 15) + '...' : m.name,
        Current: parseFloat(m.current_stock),
        Minimum: parseFloat(m.minimum_stock)
      }));
  };

  const categoryData = getCategoryData();
  const stockHealthData = getStockHealthData();

  const COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#f43f5e'];

  // Take the most recent 5 orders for the table
  const recentOrders = orders.slice(0, 5);

  const formatCurrency = (amount: number | string) => {
    return Number(amount).toLocaleString();
  };

  const recentOrdersReport = useMemo((): TableReportData => {
    const columns = ["Order ID", "Supplier", "Material", "Amount (Rwf)", "Status"];
    const rows = recentOrders.map((order) => [
      order.po_number,
      order.supplier_name,
      `${Number(order.quantity)} ${order.material_unit} ${order.material_name}`,
      formatCurrency(order.total_amount),
      order.status,
    ]);
    return {
      title: "Recent Purchase Orders",
      subtitle: `${recentOrders.length} orders`,
      filename: "Procurement_Recent_Orders",
      columns,
      rows,
    };
  }, [recentOrders]);

  if (isLoading && materials.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading Dashboard Data...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Procurement Dashboard
            </h1>
            <p className="text-slate-600">
              Approve field material requests, manage warehouse stock, and suppliers.
            </p>
          </div>

          <button
            onClick={() => setIsCustomizing((v) => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border shadow-sm transition-colors ${
              isCustomizing
                ? "bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title="Reorder dashboard widgets"
          >
            {isCustomizing ? "Done" : "Customize"}
          </button>
        </div>
      </div>

      <MaterialRequisitionsPanel onUpdated={fetchDashboardData} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {(() => {
          const nodes: Record<string, React.ReactNode> = {
            pendingOrders: (
              <MetricCard
                title="Pending Orders"
                value={pendingOrdersCount.toString()}
                change="Requires action"
                changeType={pendingOrdersCount > 0 ? "negative" : "neutral"}
                icon={ShoppingCart}
                iconColor="bg-blue-600"
              />
            ),
            inventoryValue: (
              <MetricCard
                title="Inventory Value (Rwf)"
                value={formatCurrency(inventoryValue)}
                change="Current market value"
                changeType="neutral"
                icon={Package}
                iconColor="bg-purple-600"
              />
            ),
            deliveriesDue: (
              <MetricCard
                title="Deliveries Due"
                value={deliveriesDueCount.toString()}
                change="On-track/Delayed"
                changeType={deliveriesDueCount > 0 ? "negative" : "neutral"}
                icon={Truck}
                iconColor="bg-orange-500"
              />
            ),
            approvedSpend: (
              <MetricCard
                title="Total Approved Spend (Rwf)"
                value={formatCurrency(totalSpend)}
                change="All-time processed"
                changeType="neutral"
                icon={TrendingUp}
                iconColor="bg-green-600"
              />
            ),
          };

          return metricsLayout.order
            .filter((id) => !(metricsLayout.hidden || []).includes(id))
            .map((id, idx) => (
              <div
                key={id}
                draggable={isCustomizing}
                onDragStart={(e) => {
                  if (!isCustomizing) return;
                  e.dataTransfer.setData("text/plain", String(idx));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!isCustomizing) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!isCustomizing) return;
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (Number.isNaN(from) || from === idx) return;
                  setMetricsLayout((prev) => ({ ...prev, order: arrayMove(prev.order, from, idx) }));
                }}
                className={isCustomizing ? "cursor-move rounded-2xl ring-2 ring-orange-200" : ""}
              >
                {nodes[id]}
              </div>
            ));
        })()}
      </div>

      {(() => {
        const sectionNodes: Record<string, React.ReactNode> = {
          analytics: (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="text-blue-600" size={20} />
                    Procurement Spend Trend
                  </h2>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <span className="text-slate-500">Month</span>
                    <select
                      value={spendTrendMonth}
                      onChange={(e) =>
                        setSpendTrendMonth(e.target.value as SpendTrendMonthFilter)
                      }
                      className="border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer min-w-[10rem]"
                      aria-label="Choose month for spend trend"
                    >
                      <option value="all">All months</option>
                      {spendTrendMonthOptions.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-slate-500 -mt-4 mb-4">
                  {spendTrendByDay
                    ? "Daily spend for the selected month (x-axis: date)"
                    : "Spend across months (x-axis: month)"}
                </p>
                <div className="h-72">
                  {spendTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={spendTrendData}
                        margin={{
                          top: 10,
                          right: 10,
                          left: 0,
                          bottom: spendTrendTickAngle ? 8 : 0,
                        }}
                      >
                        <defs>
                          <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          angle={spendTrendTickAngle}
                          textAnchor={spendTrendTickAngle ? "end" : "middle"}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          height={spendTrendTickAngle ? 52 : 30}
                          interval={spendTrendData.length > 14 ? "preserveStartEnd" : 0}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `Rwf ${(val/1000000).toFixed(1)}M`} />
                        <RechartsTooltip
                          formatter={(value: number) => [formatCurrency(value) + ' Rwf', 'Spend']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm italic border-2 border-dashed border-slate-100 rounded-lg">
                      Not enough data to display trend
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <PieChartIcon className="text-purple-600" size={20} />
                    Spend by Category
                  </h2>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number) => [formatCurrency(value) + ' Rwf', 'Amount']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <BarChart2 className="text-emerald-600" size={20} />
                    Stock Health
                  </h2>
                  <div className="h-56">
                    {stockHealthData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stockHealthData} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                          <RechartsTooltip
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="Current" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                          <Bar dataKey="Minimum" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={12} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm italic border-2 border-dashed border-slate-100 rounded-lg">
                        No inventory data
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ),
          recentOrders: (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    Recent Purchase Orders
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <TableReportActions
                      report={recentOrdersReport}
                      disabled={recentOrders.length === 0}
                    />
                  <button
                    type="button"
                    onClick={() => setActiveModule?.("orders")}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    View All Orders
                  </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {recentOrders.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                      No purchase orders found.
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                            Order ID
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                            Supplier
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                            Amount (Rwf)
                          </th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.map((order) => (
                          <tr
                            key={order.id}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-3 px-4 text-sm font-medium text-blue-600">
                              {order.po_number}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-900">
                              <div className="font-medium">{order.supplier_name}</div>
                              <div className="text-xs text-slate-500">
                                {Number(order.quantity)} {order.material_unit} {order.material_name}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm font-semibold text-slate-900">
                              {formatCurrency(order.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <StatusBadge status={order.status} size="sm" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-4">
                    Low Stock Alerts
                  </h2>
                  {lowStockAlerts.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-4">
                      All material stocks are healthy.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lowStockAlerts.map((alert) => {
                        const stockLevel = parseFloat(alert.current_stock);
                        const isCritical = stockLevel === 0;

                        return (
                          <div
                            key={alert.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              isCritical ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <AlertCircle className={isCritical ? "text-red-600" : "text-amber-600"} size={20} />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {alert.name}
                                </p>
                                <p className={`text-xs ${isCritical ? "text-red-700" : "text-amber-700"}`}>
                                  Stock: {stockLevel} {alert.unit} (Min: {alert.minimum_stock})
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleReorder(alert.id)}
                              className={`text-xs font-medium bg-white px-3 py-1 rounded border hover:bg-opacity-50 ${
                                isCritical ? "text-red-600 border-red-200 hover:bg-red-50" : "text-amber-600 border-amber-200 hover:bg-amber-50"
                              }`}
                            >
                              Reorder
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Top Suppliers</h3>

                  {suppliers.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-4">
                      No suppliers found.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {suppliers.slice(0, 5).map((supplier) => (
                        <div
                          key={supplier.id}
                          className="flex items-center justify-between group"
                        >
                          <span className="text-sm font-medium text-slate-700 group-hover:text-amber-600 transition-colors">
                            {supplier.name}
                          </span>
                          <div className="flex items-center gap-1.5 bg-amber-50 px-2 pl-1.5 py-0.5 rounded text-amber-700">
                            <Star
                              size={12}
                              className="fill-amber-500 text-amber-500"
                            />
                            <span className="text-xs font-bold">
                              {Number(supplier.rating).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
          sidebar: null, // already included inside recentOrders section layout (kept for forward expansion)
        };

        return (
          <div className="space-y-6">
            {sectionsLayout.order
              .filter((id) => !(sectionsLayout.hidden || []).includes(id))
              .map((id, idx) => {
                const node = sectionNodes[id];
                if (!node) return null;
                return (
                  <div
                    key={id}
                    draggable={isCustomizing}
                    onDragStart={(e) => {
                      if (!isCustomizing) return;
                      e.dataTransfer.setData("text/plain", String(idx));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (!isCustomizing) return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!isCustomizing) return;
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      if (Number.isNaN(from) || from === idx) return;
                      setSectionsLayout((prev) => ({ ...prev, order: arrayMove(prev.order, from, idx) }));
                    }}
                    className={isCustomizing ? "cursor-move ring-2 ring-orange-200 rounded-2xl" : ""}
                    title={isCustomizing ? "Drag to reorder section" : undefined}
                  >
                    {node}
                  </div>
                );
              })}
          </div>
        );
      })()}
      <NewOrderModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onOrderCreated={fetchDashboardData}
        initialMaterialId={reorderMaterialId}
      />
    </div>
  );
}

