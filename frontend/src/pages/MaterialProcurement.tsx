import { useState, useEffect } from "react";
import {
  Package,
  Truck,
  AlertTriangle,
  ShoppingCart,
  Filter,
  Plus,
  Search,
  Star,
  AlertCircle,
} from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import { NewOrderModal } from "../components/NewOrderModal";
import api from "../api";

interface Supplier {
  id: number;
  name: string;
  rating: string;
}

interface Material {
  id: number;
  name: string;
  unit: string;
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

export function MaterialProcurement() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reorderMaterialId, setReorderMaterialId] = useState("");

  const handleReorder = (materialId: number) => {
    setReorderMaterialId(materialId.toString());
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setReorderMaterialId("");
    setIsModalOpen(false);
  };

  const fetchData = async () => {
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
    } catch (err) {
      console.error("Failed to fetch procurement data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      setOrders((prev) => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
      await api.patch(`/procurement/orders/${orderId}/`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error("Failed to update PO status", err);
      fetchData();
    }
  };



  // Compute Metrics
  const activeOrdersCount = orders.filter(
    (o) => o.status !== "completed",
  ).length;
  const pendingDeliveriesCount = orders.filter(
    (o) => o.status === "pending" || o.status === "delayed",
  ).length;
  const delayedOrdersCount = orders.filter(
    (o) => o.status === "delayed",
  ).length;
  const lowStockItemsCount = materials.filter(
    (m) => parseFloat(m.current_stock) <= parseFloat(m.minimum_stock),
  ).length;

  // Quick hack to format currency
  const formatCurrency = (amount: string | number) => {
    return Number(amount).toLocaleString();
  };

  // Calculate percentage for progress bars safely
  const calculateStockPercentage = (current: string, min: string) => {
    const c = parseFloat(current);
    const m = parseFloat(min);
    if (m === 0) return c > 0 ? 100 : 0;
    // Assume max cap is roughly 3x minimum for visual scaling
    const max = m * 3;
    const percentage = (c / max) * 100;
    return Math.min(Math.max(percentage, 0), 100);
  };

  // Helper to format date safely
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (isLoading && materials.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading Procurement Data...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Material Procurement
          </h1>
          <p className="text-slate-600">
            Manage suppliers, inventory, and purchase orders
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm cursor-pointer">
            <Filter size={18} />
            <span className="text-sm font-medium">Filter</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">New Order</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Orders"
          value={activeOrdersCount.toString()}
          change="Currently active"
          changeType="neutral"
          icon={ShoppingCart}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Total Orders"
          value={orders.length.toString()}
          change="All time records"
          changeType="neutral"
          icon={Package}
          iconColor="bg-purple-600"
        />
        <MetricCard
          title="Pending Deliveries"
          value={pendingDeliveriesCount.toString()}
          change={`${delayedOrdersCount} delayed`}
          changeType={delayedOrdersCount > 0 ? "negative" : "neutral"}
          icon={Truck}
          iconColor="bg-orange-500"
        />
        <MetricCard
          title="Low Stock Items"
          value={lowStockItemsCount.toString()}
          change={lowStockItemsCount > 0 ? "Action required" : "All good"}
          changeType={lowStockItemsCount > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
          iconColor={lowStockItemsCount > 0 ? "bg-red-500" : "bg-green-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">


          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Recent Purchase Orders
            </h2>
            <div className="relative hidden sm:block">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search orders..."
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                No purchase orders found. Create one to get started!
              </div>
            ) : (
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Order ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Supplier
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Items
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                      Amount (Rwf)
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-blue-600">
                        {order.po_number}
                        <div className="text-xs text-slate-400 font-normal mt-0.5">
                          {formatDate(order.order_date)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium">
                        {order.supplier_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {Number(order.quantity)} {order.material_unit}{" "}
                        {order.material_name}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-slate-900 text-right">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                           <StatusBadge status={order.status} size="sm" />
                           <select
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id, e.target.value)}
                              className="text-xs border border-slate-200 rounded text-slate-600 bg-white py-0.5 px-1 hover:border-slate-300 focus:outline-none cursor-pointer"
                              title="Update Status"
                           >
                              <option value="pending">Pending</option>
                              <option value="on-track" disabled={order.status === 'completed'}>On Track</option>
                              <option value="completed" disabled={order.status === 'completed'}>Completed</option>
                           </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Inventory Levels
            </h2>

            {materials.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-4">
                No materials tracked yet.
              </div>
            ) : (
              <div className="space-y-6">
                {materials.map((item) => {
                  const isLow =
                    parseFloat(item.current_stock) <=
                    parseFloat(item.minimum_stock);
                  const percentage = calculateStockPercentage(
                    item.current_stock,
                    item.minimum_stock,
                  );

                  return (
                    <div key={item.id}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-700">
                          {item.name}{" "}
                          <span className="text-xs text-slate-400 font-normal">
                            ({item.unit})
                          </span>
                        </span>
                        <span
                          className={`text-sm font-medium ${isLow ? "text-red-600" : "text-slate-600"}`}
                        >
                          {Number(item.current_stock)}{" "}
                          {isLow && (
                            <AlertTriangle
                              size={12}
                              className="inline ml-1 mb-0.5"
                            />
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isLow ? "bg-red-500" : "bg-blue-500"}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Low Stock Alerts
            </h2>
            {materials.filter(m => parseFloat(m.current_stock) <= parseFloat(m.minimum_stock)).length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">
                    All material stocks are healthy.
                </div>
            ) : (
                <div className="space-y-3">
                {materials.filter(m => parseFloat(m.current_stock) <= parseFloat(m.minimum_stock)).map((alert) => {
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
                        }`}>
                        Reorder
                        </button>
                    </div>
                )})}
                </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
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

      <NewOrderModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onOrderCreated={fetchData}
        initialMaterialId={reorderMaterialId}
      />
    </div>
  );
}
