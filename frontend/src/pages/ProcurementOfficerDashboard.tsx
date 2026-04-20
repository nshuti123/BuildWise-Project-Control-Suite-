import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Truck,
  AlertCircle,
  Star,
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

export function ProcurementOfficerDashboard() {
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



  // Take the most recent 5 orders for the table
  const recentOrders = orders.slice(0, 5);

  const formatCurrency = (amount: number | string) => {
    return Number(amount).toLocaleString();
  };

  if (isLoading && materials.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading Dashboard Data...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Procurement Dashboard
        </h1>
        <p className="text-slate-600">
          Material Management & Supplier Relations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Pending Orders"
          value={pendingOrdersCount.toString()}
          change="Requires action"
          changeType={pendingOrdersCount > 0 ? "negative" : "neutral"}
          icon={ShoppingCart}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Inventory Value (Rwf)"
          value={formatCurrency(inventoryValue)}
          change="Current market value"
          changeType="neutral"
          icon={Package}
          iconColor="bg-purple-600"
        />
        <MetricCard
          title="Deliveries Due"
          value={deliveriesDueCount.toString()}
          change="On-track/Delayed"
          changeType={deliveriesDueCount > 0 ? "negative" : "neutral"}
          icon={Truck}
          iconColor="bg-orange-500"
        />
        <MetricCard
          title="Total Approved Spend (Rwf)"
          value={formatCurrency(totalSpend)}
          change="All-time processed"
          changeType="neutral"
          icon={TrendingUp}
          iconColor="bg-green-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Recent Purchase Orders
            </h2>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All Orders
            </button>
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
                        }`}>
                        Reorder
                        </button>
                    </div>
                )})}
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
      <NewOrderModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onOrderCreated={fetchDashboardData}
        initialMaterialId={reorderMaterialId}
      />
    </div>
  );
}

