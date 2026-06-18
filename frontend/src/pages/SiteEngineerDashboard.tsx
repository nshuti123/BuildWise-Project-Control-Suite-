import { useState, useEffect } from "react";
import api from "../api";
import { AddTaskModal } from "../components/AddTaskModal";
import {
  ClipboardCheck,
  HardHat,
  AlertTriangle,
  Package,
  FileText,
  CheckSquare,
  Clock,
  UserCheck,
  Wrench,
  AlertOctagon,
  ChevronRight,
  DollarSign,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { asList } from "../utils/apiHelpers";
import { openWorkforcePayrollReview } from "../utils/workforceNavigation";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { MetricCard } from "../components/MetricCard";
import { AddWorkerModal } from "../components/AddWorkerModal";
import { MaterialRequestModal } from "../components/MaterialRequestModal";
import { MaterialRequisitionsPanel } from "../components/MaterialRequisitionsPanel";
import {
  canCancelMaterialRequest,
  cancelMaterialRequest,
  materialRequestBadgeClass,
  materialRequestStatusLabel,
} from "../utils/materialRequestActions";
import { IncidentModal } from "../components/IncidentModal";
import { arrayMove, loadLayout, saveLayout, type LayoutState } from "../utils/customizableLayout";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import {
  ProjectStaffPanel,
  type ProjectStaffData,
} from "../components/ProjectStaffPanel";

interface Task {
  id: number;
  title: string;
  description: string;
  location: string;
  date: string;
  time_str: string;
  priority: string;
  status: string;
}

const INCIDENT_RESOLVER_ROLES = new Set([
  "site-engineer",
  "project-manager",
  "technical-director",
  "admin",
  "managing-director",
]);

export function SiteEngineerDashboard({
  setActiveModule,
}: {
  setActiveModule?: (module: string) => void;
}) {
  const { user } = useAuth();
  const { currentProjectId, projects } = useProject();
  const currentProject = projects.find(p => p.id === currentProjectId);
  const canResolveIncident = INCIDENT_RESOLVER_ROLES.has(user?.role ?? "");

  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  
  // Worker states
  const [expiringWorkers, setExpiringWorkers] = useState<any[]>([]);
  const [activeWorkerCount, setActiveWorkerCount] = useState(0);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [workerToRenew, setWorkerToRenew] = useState<any>(null);

  // Incidents
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<number | null>(null);

  // Procurement
  const [isMaterialRequestModalOpen, setIsMaterialRequestModalOpen] = useState(false);
  const [materialRequestToRevise, setMaterialRequestToRevise] = useState<any | null>(null);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [cancellingRequestId, setCancellingRequestId] = useState<number | null>(null);
  
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [projectStaff, setProjectStaff] = useState<ProjectStaffData | null>(null);
  const [pendingPayrolls, setPendingPayrolls] = useState<any[]>([]);
  const [payrollModal, setPayrollModal] = useState<{
    open: boolean;
    payrollId: number | null;
    action: "approve" | "reject";
    date: string;
    amount: number;
  }>({ open: false, payrollId: null, action: "approve", date: "", amount: 0 });

  const metricsDefault = ["tasksToday", "workersOnSite", "safetyIssues", "equipmentActive"];
  const panelsDefault = ["dailyTasks", "contractAlerts", "safetyChecklist", "quickActions"];
  const [metricsLayout, setMetricsLayout] = useState<LayoutState>(() =>
    loadLayout("buildwise.dashboard.siteEngineer.metrics.v1", metricsDefault),
  );
  const [panelsLayout, setPanelsLayout] = useState<LayoutState>(() =>
    loadLayout("buildwise.dashboard.siteEngineer.panels.v1", panelsDefault),
  );

  useEffect(() => saveLayout("buildwise.dashboard.siteEngineer.metrics.v1", metricsLayout), [metricsLayout]);
  useEffect(() => saveLayout("buildwise.dashboard.siteEngineer.panels.v1", panelsLayout), [panelsLayout]);

  const fetchProjectStaff = async () => {
    if (!currentProjectId) {
      setProjectStaff(null);
      return;
    }
    try {
      const res = await api.get(`/projects/${currentProjectId}/`);
      setProjectStaff(res.data);
    } catch (e) {
      console.error("Failed to load project team", e);
      setProjectStaff(null);
    }
  };

  const fetchPendingPayrolls = async () => {
    if (!currentProjectId) {
      setPendingPayrolls([]);
      return;
    }
    try {
      const resp = await api.get(
        `/workforce/payrolls/?project=${currentProjectId}&status=awaiting_site_engineer`,
      );
      setPendingPayrolls(asList(resp.data));
    } catch (err) {
      console.error(err);
      setPendingPayrolls([]);
    }
  };

  useEffect(() => {
    if (currentProjectId) {
      fetchTasks();
      fetchWorkers();
      fetchMaterialRequests();
      fetchIncidents();
      fetchProjectStaff();
      fetchPendingPayrolls();
    } else {
      setDailyTasks([]);
      setExpiringWorkers([]);
      setActiveWorkerCount(0);
      setProjectStaff(null);
      setMaterialRequests([]);
      setIncidents([]);
      setLoading(false);
    }
  }, [currentProjectId]);

  const fetchIncidents = async () => {
    try {
      const response = await api.get(`/projects/incidents/?project=${currentProjectId}`);
      setIncidents(asList(response.data));
    } catch (error) {
      console.error("Failed to fetch incidents:", error);
    }
  };

  const handleResolveIncident = async (incidentId: number) => {
    setResolvingIncidentId(incidentId);
    try {
      await api.post(`/projects/incidents/${incidentId}/resolve/`);
      await fetchIncidents();
    } catch (error) {
      console.error("Failed to resolve incident:", error);
      alert("Could not mark this incident as resolved.");
    } finally {
      setResolvingIncidentId(null);
    }
  };

  const fetchMaterialRequests = async () => {
    try {
      const response = await api.get(`/procurement/requests/?project=${currentProjectId}`);
      setMaterialRequests(response.data);
    } catch (error) {
      console.error("Failed to fetch material requests:", error);
    }
  };

  const handleCancelMaterialRequest = async (requestId: number) => {
    if (!window.confirm("Cancel this material requisition? This cannot be undone.")) return;
    setCancellingRequestId(requestId);
    try {
      await cancelMaterialRequest(requestId);
      await fetchMaterialRequests();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Could not cancel this requisition.");
    } finally {
      setCancellingRequestId(null);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await api.get(`/workforce/workers/?project=${currentProjectId}`);
      const allWorkers = response.data;
      
      const today = new Date();
      let activeCount = 0;
      
      const expiring = allWorkers.filter((w: any) => {
         if (!w.is_active) return false;
         activeCount++;
         
         if (!w.end_date) return false;
         const endDate = new Date(w.end_date);
         const diffTime = endDate.getTime() - today.getTime();
         const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
         return diffDays >= -2 && diffDays <= 14; 
      });
      
      setActiveWorkerCount(activeCount);
      setExpiringWorkers(expiring.sort((a: any,b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()));
    } catch (err) {
      console.error("Failed to fetch workers:", err);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/projects/tasks/?project=${currentProjectId}`);
      // Filter for tasks scheduled today
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTasks = response.data.filter((t: any) => t.date === todayStr);
      setDailyTasks(todayTasks);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (taskId: number, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await api.patch(`/projects/tasks/${taskId}/`, { status: newStatus });
      setDailyTasks(tasks => 
        tasks.map(task => task.id === taskId ? { ...task, status: newStatus } : task)
      );
    } catch (error) {
      console.error("Failed to update task status:", error);
    }
  };

  const handleViewPayroll = (date: string) => {
    openWorkforcePayrollReview(date);
    setActiveModule?.("workforce");
  };

  const submitPayrollAction = async () => {
    if (!payrollModal.payrollId) return;
    try {
      if (payrollModal.action === "approve") {
        await api.post(`/workforce/payrolls/${payrollModal.payrollId}/confirm-site/`);
      } else {
        await api.post(`/workforce/payrolls/${payrollModal.payrollId}/reject/`, {
          reason: "Rejected by site engineer",
        });
      }
      await fetchPendingPayrolls();
    } catch (err) {
      console.error(err);
      alert("Action failed. Please try again.");
    }
  };

  const openSafetyIssues = incidents.filter(i => i.incident_type === 'safety' && i.status === 'open');
  const openEquipmentIssues = incidents.filter(i => i.incident_type === 'equipment' && i.status === 'open');
  const completedTasks = dailyTasks.filter(t => t.status === 'completed').length;

  if (!currentProjectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
         <HardHat size={64} className="text-slate-300 mb-4" />
         <h2 className="text-2xl font-bold text-slate-700">No Project Selected</h2>
         <p className="text-slate-500 mt-2">Please select an active project from the sidebar to view site operations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 rounded-3xl p-8 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden">
        {/* Abstract background graphics */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-20 w-40 h-40 rounded-full bg-orange-500/10 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
               <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-bold text-blue-200 tracking-wider">
                 LIVE OPERATIONS
               </span>
               <span className="flex items-center gap-1 text-xs font-medium text-slate-300">
                 <Clock size={12} /> {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
               </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">
              {currentProject?.name}
            </h1>
            <p className="text-blue-100/80 font-medium text-lg">
              Daily Field Report & Operations Control
            </p>
          </div>
          <div className="flex gap-3">
             <button
              onClick={() => setIsCustomizing((v) => !v)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all backdrop-blur-md border ${
                isCustomizing
                  ? "bg-orange-500/20 border-orange-500/50 text-orange-100 hover:bg-orange-500/30"
                  : "bg-white/10 border-white/20 text-white hover:bg-white/20"
              }`}
            >
              {isCustomizing ? "Save Layout" : "Customize UI"}
            </button>
          </div>
        </div>
      </div>

      {pendingPayrolls.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="text-amber-700" size={22} />
            <h2 className="text-lg font-bold text-amber-950">
              Payroll awaiting your review ({pendingPayrolls.length})
            </h2>
          </div>
          <p className="text-sm text-amber-900/80">
            Site foreman submitted daily payroll. View attendance to make changes, approve to
            send to the finance department, or reject to notify the foreman only.
          </p>
          <div className="space-y-3">
            {pendingPayrolls.map((p) => (
              <div
                key={p.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-xl border border-amber-200 p-4"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {p.date} · {Number(p.total_amount).toLocaleString()} Rwf
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    From {p.initiated_by_name || "site foreman"} · Batch #{p.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewPayroll(p.date)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                  >
                    <Eye size={16} /> View
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPayrollModal({
                        open: true,
                        payrollId: p.id,
                        action: "approve",
                        date: p.date,
                        amount: Number(p.total_amount),
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPayrollModal({
                        open: true,
                        payrollId: p.id,
                        action: "reject",
                        date: p.date,
                        amount: Number(p.total_amount),
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {(() => {
          const nodes: Record<string, React.ReactNode> = {
            tasksToday: (
              <MetricCard
                title="Tasks Today"
                value={`${completedTasks}/${dailyTasks.length}`}
                change={`${dailyTasks.length - completedTasks} remaining`}
                changeType="neutral"
                icon={CheckSquare}
                iconColor="bg-blue-600"
              />
            ),
            workersOnSite: (
              <MetricCard
                title="Active Crew"
                value={activeWorkerCount.toString()}
                change="Currently On-Site"
                changeType="positive"
                icon={HardHat}
                iconColor="bg-orange-500"
              />
            ),
            safetyIssues: (
              <MetricCard
                title="Safety Issues"
                value={openSafetyIssues.length.toString()}
                change={openSafetyIssues.length === 0 ? "All clear" : "Action required"}
                changeType={openSafetyIssues.length === 0 ? "positive" : "negative"}
                icon={AlertTriangle}
                iconColor="bg-red-500"
              />
            ),
            equipmentActive: (
              <MetricCard
                title="Equip. Issues"
                value={openEquipmentIssues.length.toString()}
                change={openEquipmentIssues.length === 0 ? "All operational" : "Maintenance needed"}
                changeType={openEquipmentIssues.length === 0 ? "positive" : "negative"}
                icon={Wrench}
                iconColor="bg-indigo-500"
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
                className={`transition-all duration-300 ${isCustomizing ? "cursor-move ring-2 ring-orange-400 rounded-2xl scale-105 shadow-xl z-10" : "hover:-translate-y-1"}`}
              >
                {nodes[id]}
              </div>
            ));
        })()}
      </div>

      {currentProjectId && projectStaff && (
        <ProjectStaffPanel project={projectStaff} onUpdate={setProjectStaff} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tasks & Requisitions */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Today's Tasks */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/60 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <ClipboardCheck size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Today's Schedule</h2>
              </div>
              <button 
                onClick={() => setIsAddTaskModalOpen(true)}
                className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg hover:bg-blue-100 transition-colors"
              >
                + Add Task
              </button>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : dailyTasks.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center">
                   <div className="p-4 bg-slate-50 rounded-full mb-4">
                     <CheckSquare size={32} className="text-slate-300" />
                   </div>
                   <h3 className="text-lg font-bold text-slate-700">Clear Schedule</h3>
                   <p className="text-slate-500 mt-1">No tasks are explicitly scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dailyTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                        task.status === "completed" 
                          ? "bg-slate-50 border-slate-100 opacity-75" 
                          : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => toggleTaskStatus(task.id, task.status)}
                          className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                            task.status === "completed" 
                              ? "bg-green-500 text-white" 
                              : "bg-slate-100 border border-slate-300 text-transparent hover:border-blue-500"
                          }`}
                        >
                          <CheckSquare size={14} className={task.status === "completed" ? "opacity-100" : "opacity-0"} />
                        </button>
                        <div>
                          <h3 className={`font-bold ${task.status === "completed" ? "text-slate-500 line-through" : "text-slate-900"}`}>
                            {task.title}
                          </h3>
                          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-1.5">
                            {task.time_str && (
                              <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                                <Clock size={12} /> {task.time_str}
                              </span>
                            )}
                            {task.location && (
                              <span className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                {task.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${
                        task.priority === "high" ? "bg-red-50 text-red-600 border-red-100" : 
                        task.priority === "medium" ? "bg-orange-50 text-orange-600 border-orange-100" : 
                        "bg-blue-50 text-blue-600 border-blue-100"
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Foreman requisitions awaiting SE confirmation */}
          <MaterialRequisitionsPanel
            projectId={currentProjectId}
            onUpdated={fetchMaterialRequests}
          />

          {/* Material Requisitions */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/60 overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Package size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Recent Requisitions</h2>
              </div>
            </div>
            <div className="p-6">
              {materialRequests.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No recent material requests for this project.</div>
              ) : (
                <div className="grid gap-3">
                  {materialRequests.slice(0,5).map((req) => (
                    <div key={req.id} className="p-4 rounded-xl border border-slate-100 bg-white hover:shadow-md transition-all space-y-2">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                              <Package size={18} />
                           </div>
                           <div>
                             <p className="font-bold text-slate-900 text-sm">{req.material_name}</p>
                             <p className="text-xs font-medium text-slate-500 mt-0.5">Quantity: <span className="text-slate-700">{Number(req.quantity_requested)} {req.material_unit}</span></p>
                           </div>
                        </div>
                        <span className={materialRequestBadgeClass(req.status)}>
                          {materialRequestStatusLabel(req.status, req)}
                        </span>
                      </div>
                      {req.status === 'rejected' && req.rejection_notes && (
                        <div className="ml-14 text-sm bg-red-50 border border-red-100 rounded-lg p-3">
                          <p className="text-xs font-bold uppercase text-red-800 mb-1">Rejection notes</p>
                          <p className="text-red-900">{req.rejection_notes}</p>
                        </div>
                      )}
                      {(req.status === 'approved' || req.status === 'fulfilled') && req.approval_notes && (
                        <div className="ml-14 text-sm bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                          <p className="text-xs font-bold uppercase text-emerald-800 mb-1">Approval notes</p>
                          <p className="text-emerald-900">{req.approval_notes}</p>
                        </div>
                      )}
                      {(req.status === 'rejected' || canCancelMaterialRequest(req.status)) && (
                        <div className="ml-14 flex flex-wrap items-center gap-4">
                          {req.status === 'rejected' && (
                            <button
                              type="button"
                              onClick={() => {
                                setMaterialRequestToRevise(req);
                                setIsMaterialRequestModalOpen(true);
                              }}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800"
                            >
                              Revise & resubmit
                            </button>
                          )}
                          {canCancelMaterialRequest(req.status) && (
                            <button
                              type="button"
                              disabled={cancellingRequestId === req.id}
                              onClick={() => handleCancelMaterialRequest(req.id)}
                              className="text-xs font-bold text-slate-600 hover:text-red-700 disabled:opacity-50"
                            >
                              {cancellingRequestId === req.id ? 'Cancelling…' : 'Cancel request'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Alerts */}
        <div className="space-y-8">
          
          {/* Quick Actions Grid */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/60 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
               Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setIsMaterialRequestModalOpen(true)}
                className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-blue-100 group"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform duration-300">
                  <Package className="text-blue-600" size={24} />
                </div>
                <span className="text-sm font-bold text-slate-800">Req. Material</span>
              </button>

              <button 
                onClick={() => setIsIncidentModalOpen(true)}
                className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-red-100 group"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform duration-300">
                  <AlertOctagon className="text-red-600" size={24} />
                </div>
                <span className="text-sm font-bold text-slate-800">Log Incident</span>
              </button>

              <button className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-emerald-100 group">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="text-emerald-600" size={24} />
                </div>
                <span className="text-sm font-bold text-slate-800">Daily Report</span>
              </button>

              <button className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-purple-100 group">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform duration-300">
                  <Users className="text-purple-600" size={24} />
                </div>
                <span className="text-sm font-bold text-slate-800">Crew Check-in</span>
              </button>
            </div>
          </div>

          {/* Active Incidents Widget */}
          {incidents.filter(i => i.status === 'open').length > 0 && (
             <div className="bg-red-50 rounded-2xl shadow-md border-2 border-red-200 overflow-hidden">
                <div className="p-4 bg-red-600 text-white flex items-center justify-between">
                   <h3 className="font-bold flex items-center gap-2">
                      <AlertTriangle size={18} /> Active Incidents
                   </h3>
                   <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
                      {incidents.filter(i => i.status === 'open').length}
                   </span>
                </div>
                <div className="p-4 space-y-3">
                   {incidents.filter(i => i.status === 'open').slice(0,3).map(incident => (
                      <div key={incident.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex items-start gap-3">
                         <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${incident.severity === 'critical' ? 'bg-red-100 text-red-700' : incident.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-amber-50 text-amber-600'}`}>
                            <AlertOctagon size={16} />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 capitalize">{incident.incident_type} Issue</p>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{incident.description}</p>
                            <p className="text-[10px] text-slate-400 mt-1 capitalize">{incident.severity} severity</p>
                         </div>
                         {canResolveIncident && (
                           <button
                             type="button"
                             disabled={resolvingIncidentId === incident.id}
                             onClick={() => handleResolveIncident(incident.id)}
                             className="shrink-0 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                           >
                             {resolvingIncidentId === incident.id ? "…" : "Resolve"}
                           </button>
                         )}
                      </div>
                   ))}
                </div>
             </div>
          )}

          {/* Contracts Expliring Widget */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/60 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Contract Alerts
              </h2>
              {expiringWorkers.length > 0 && (
                <span className="bg-orange-100 text-orange-700 py-1 px-2.5 rounded-full text-xs font-bold animate-pulse">
                   {expiringWorkers.length} expiring
                </span>
              )}
            </div>
            
            {expiringWorkers.length > 0 ? (
               <div className="space-y-3">
                  {expiringWorkers.map(w => {
                     const daysLeft = Math.ceil((new Date(w.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                     return (
                     <div key={w.id} className="flex items-center justify-between p-3 bg-orange-50/50 border border-orange-100 rounded-xl hover:bg-orange-50 transition-colors group">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-orange-100 flex items-center justify-center text-orange-600">
                              <UserCheck size={18} />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-slate-800">{w.first_name} {w.last_name}</p>
                              <p className={`text-xs font-bold mt-0.5 ${daysLeft <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                {daysLeft <= 0 ? (daysLeft === 0 ? "Expires today!" : "EXPIRED") : `Ends in ${daysLeft} days`}
                              </p>
                           </div>
                        </div>
                        <button onClick={() => { setWorkerToRenew(w); setIsAddWorkerModalOpen(true); }} className="w-8 h-8 rounded-full bg-white border border-orange-200 flex items-center justify-center text-orange-600 opacity-0 group-hover:opacity-100 hover:bg-orange-600 hover:text-white transition-all shadow-sm">
                           <ChevronRight size={16} />
                        </button>
                     </div>
                  )})}
               </div>
            ) : (
               <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100">
                  <UserCheck size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">All crew contracts are currently stable.</p>
               </div>
            )}
          </div>
          
        </div>
      </div>

      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        onSuccess={() => {
          fetchTasks();
        }}
      />
      
      <AddWorkerModal
        isOpen={isAddWorkerModalOpen}
        onClose={() => setIsAddWorkerModalOpen(false)}
        projectId={currentProjectId}
        workerToEdit={workerToRenew}
        onSuccess={() => {
            fetchWorkers();
            setWorkerToRenew(null);
        }}
      />

      <MaterialRequestModal
        isOpen={isMaterialRequestModalOpen}
        onClose={() => {
          setIsMaterialRequestModalOpen(false);
          setMaterialRequestToRevise(null);
        }}
        onSuccess={() => {
          fetchMaterialRequests();
          setMaterialRequestToRevise(null);
        }}
        projectId={currentProjectId!}
        requestToRevise={materialRequestToRevise}
      />
      
      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        onSuccess={fetchIncidents}
        projectId={currentProjectId}
      />

      <ConfirmActionModal
        isOpen={payrollModal.open}
        title={payrollModal.action === "approve" ? "Approve payroll" : "Reject payroll"}
        message={
          payrollModal.action === "approve"
            ? `Approve ${payrollModal.amount.toLocaleString()} Rwf for ${payrollModal.date} and send to the finance department?`
            : `Reject payroll for ${payrollModal.date}? The site foreman will be notified and finance will not see this request.`
        }
        confirmText={payrollModal.action === "approve" ? "Approve" : "Reject"}
        type={payrollModal.action === "approve" ? "info" : "danger"}
        onConfirm={submitPayrollAction}
        onCancel={() =>
          setPayrollModal({
            open: false,
            payrollId: null,
            action: "approve",
            date: "",
            amount: 0,
          })
        }
      />
    </div>
  );
}

// Ensure Users icon is defined for Quick Actions
function Users(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
