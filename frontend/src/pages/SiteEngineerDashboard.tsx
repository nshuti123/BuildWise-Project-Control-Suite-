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
  UserCheck
} from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { AddWorkerModal } from "../components/AddWorkerModal";
import { MaterialRequestModal } from "../components/MaterialRequestModal";

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

export function SiteEngineerDashboard() {
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [assignedProjects, setAssignedProjects] = useState<any[]>([]);
  
  // Worker states
  const [expiringWorkers, setExpiringWorkers] = useState<any[]>([]);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [workerToRenew, setWorkerToRenew] = useState<any>(null);

  const [isMaterialRequestModalOpen, setIsMaterialRequestModalOpen] = useState(false);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchTasks();
    fetchAssignedProjects();
    fetchWorkers();
    fetchMaterialRequests();
  }, []);

  const fetchMaterialRequests = async () => {
    try {
      const response = await api.get("/procurement/requests/");
      setMaterialRequests(response.data);
    } catch (error) {
      console.error("Failed to fetch material requests:", error);
    }
  };

  const fetchAssignedProjects = async () => {
    try {
      const response = await api.get("/projects/");
      setAssignedProjects(response.data);
    } catch (error) {
      console.error("Failed to fetch assigned projects:", error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await api.get("/workforce/workers/");
      const allWorkers = response.data;
      
      const today = new Date();
      // Only keep actie workers expiring in next 14 days
      const expiring = allWorkers.filter((w: any) => {
         if (!w.end_date || !w.is_active) return false;
         const endDate = new Date(w.end_date);
         const diffTime = endDate.getTime() - today.getTime();
         const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
         return diffDays >= -2 && diffDays <= 14; 
      });
      // Sort by soonest execution date
      setExpiringWorkers(expiring.sort((a: any,b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()));
    } catch (err) {
      console.error("Failed to fetch workers:", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get("/projects/tasks/my-tasks/");
      setDailyTasks(response.data);
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

  const safetyChecklist = [
    {
      item: "PPE Compliance Check",
      status: "checked",
    },
    {
      item: "Perimeter Fencing Secure",
      status: "checked",
    },
    {
      item: "First Aid Kit Stocked",
      status: "checked",
    },
    {
      item: "Electrical Safety Inspection",
      status: "pending",
    },
    {
      item: "Fire Extinguisher Check",
      status: "pending",
    },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Site Operations Dashboard
        </h1>
        <p className="text-slate-600 font-medium">
          {assignedProjects.length > 0
            ? assignedProjects.map((p) => p.name).join(" & ")
            : "No Assigned Projects"}{" "}
          <span className="font-normal text-slate-500">- Daily Field Report</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Tasks Today"
          value="8/12"
          change="4 pending"
          changeType="neutral"
          icon={ClipboardCheck}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Workers On-Site"
          value="45"
          change="+5 from yesterday"
          changeType="positive"
          icon={HardHat}
          iconColor="bg-orange-500"
        />
        <MetricCard
          title="Safety Issues"
          value="0"
          change="All clear"
          changeType="positive"
          icon={AlertTriangle}
          iconColor="bg-green-600"
        />
        <MetricCard
          title="Equipment Active"
          value="6/8"
          change="2 maintenance"
          changeType="neutral"
          icon={Clock}
          iconColor="bg-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Tasks Column */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Today's Tasks</h2>
            <button 
              onClick={() => setIsAddTaskModalOpen(true)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Add Task
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading tasks...</div>
            ) : dailyTasks.length === 0 ? (
              <div className="p-4 text-center text-slate-500">No tasks assigned for today.</div>
            ) : (
              dailyTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleTaskStatus(task.id, task.status)}
                      className={`mt-1 p-2 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${task.status === "completed" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400 hover:text-green-600"}`}
                    >
                      <CheckSquare size={20} />
                    </button>
                    <div>
                      <h3
                        className={`font-semibold ${task.status === "completed" ? "text-slate-500 line-through" : "text-slate-900"}`}
                      >
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={14} /> {task.time_str || "Any time"}
                        </span>
                        <span>•</span>
                        <span>{task.location || "Site"}</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${task.priority === "high" ? "bg-red-50 text-red-700 border-red-100" : task.priority === "medium" ? "bg-orange-50 text-orange-700 border-orange-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}
                  >
                    {task.priority ? task.priority.toUpperCase() : "NORMAL"}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between mt-10 mb-6">
            <h2 className="text-xl font-bold text-slate-900">My Material Requisitions</h2>
          </div>

          <div className="space-y-4">
             {materialRequests.length === 0 ? (
                <div className="p-4 text-center text-slate-500 border border-slate-100 rounded-lg">No materials requested recently.</div>
             ) : (
                materialRequests.map((req) => (
                   <div key={req.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                      <div>
                         <p className="font-bold text-slate-800">{req.material_name} <span className="font-medium text-slate-500">x {Number(req.quantity_requested)} {req.material_unit}</span></p>
                         <p className="text-xs text-slate-500 mt-1">For Project: {req.project_name}</p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full tracking-wider ${req.status === 'pending' ? 'bg-slate-100 text-slate-500' : req.status === 'approved' ? 'bg-blue-100 text-blue-600' : req.status === 'ordered' ? 'bg-indigo-100 text-indigo-600' : req.status === 'fulfilled' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                         {req.status}
                      </span>
                   </div>
                ))
             )}
          </div>
        </div>

        {/* Right Column: Safety & Quick Actions */}
        <div className="space-y-6">
        
          {/* Contracts Expliring Widget */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 border-l-4 border-l-orange-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                 <UserCheck size={20} className="text-orange-500" />
                Contract Alerts
              </h2>
              {expiringWorkers.length > 0 && (
                <span className="bg-orange-100 text-orange-700 py-1 px-2.5 rounded-full text-xs font-bold animate-pulse">{expiringWorkers.length} expiring</span>
              )}
            </div>
            
            {expiringWorkers.length > 0 ? (
               <div className="space-y-3">
                  {expiringWorkers.map(w => {
                     const daysLeft = Math.ceil((new Date(w.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                     return (
                     <div key={w.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                        <div>
                           <p className="text-sm font-bold text-slate-800">{w.first_name} {w.last_name}</p>
                           <p className={`text-xs font-bold ${daysLeft <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                             {daysLeft <= 0 ? (daysLeft === 0 ? "Expires today!" : "EXPIRED") : `Ends in ${daysLeft} days`}
                           </p>
                        </div>
                        <button onClick={() => { setWorkerToRenew(w); setIsAddWorkerModalOpen(true); }} className="px-3 py-1.5 bg-white text-orange-600 text-xs font-bold border border-orange-200 rounded hover:bg-orange-600 hover:text-white transition-colors">
                           Renew
                        </button>
                     </div>
                  )})}
               </div>
            ) : (
               <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded border border-slate-100">All local worker contracts are currently stable and well within valid parameters.</p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Safety Checklist
            </h2>
            <div className="space-y-3">
              {safetyChecklist.map((item, index) => (
                <label
                  key={index}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${item.status === "checked" ? "bg-green-500 border-green-500" : "border-slate-300 group-hover:border-blue-400"}`}
                  >
                    {item.status === "checked" && (
                      <CheckSquare size={14} className="text-white" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${item.status === "checked" ? "text-slate-500" : "text-slate-700"}`}
                  >
                    {item.item}
                  </span>
                </label>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              View Full Protocol
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsMaterialRequestModalOpen(true)}
                className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg hover:bg-amber-50 hover:border-amber-200 transition-colors border border-slate-200 group"
              >
                <Package className="text-amber-600 mb-2 group-hover:scale-110 transition-transform" size={24} />
                <span className="text-xs font-bold text-slate-700 group-hover:text-amber-700">
                  Request Material
                </span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                <FileText className="text-blue-600 mb-2" size={24} />
                <span className="text-xs font-medium text-slate-700">
                  Daily Report
                </span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                <AlertTriangle className="text-red-600 mb-2" size={24} />
                <span className="text-xs font-medium text-slate-700">
                  Report Incident
                </span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                <HardHat className="text-green-600 mb-2" size={24} />
                <span className="text-xs font-medium text-slate-700">
                  Crew Check-in
                </span>
              </button>
            </div>
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
      
      {assignedProjects.length > 0 && (
        <AddWorkerModal
          isOpen={isAddWorkerModalOpen}
          onClose={() => setIsAddWorkerModalOpen(false)}
          projectId={assignedProjects[0].id}
          workerToEdit={workerToRenew}
          onSuccess={() => {
             fetchWorkers();
             setWorkerToRenew(null);
          }}
        />
      )}

      {assignedProjects.length > 0 && (
         <MaterialRequestModal
           isOpen={isMaterialRequestModalOpen}
           onClose={() => setIsMaterialRequestModalOpen(false)}
           onSuccess={fetchMaterialRequests}
           projectId={assignedProjects[0].id}
         />
      )}
    </div>
  );
}
