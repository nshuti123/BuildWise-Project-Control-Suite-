import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  CheckCircle2,
  Edit2,
  Trash2,
  Search,
  DollarSign,
  CalendarIcon as LucideCalendar,
} from "lucide-react";
import api from "../api";
import { AddWorkerModal } from "../components/AddWorkerModal";
import { WorkerDetailsModal } from "../components/WorkerDetailsModal";
import { ConfirmActionModal } from "../components/ConfirmActionModal";

export function WorkforceManagement() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [viewedWorker, setViewedWorker] = useState<any>(null);
  const [expiringWorkers, setExpiringWorkers] = useState<any[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; type: any; onConfirm: () => void }>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => {} });
  const [activeTab, setActiveTab] = useState<"directory" | "attendance">(
    "directory",
  );
  const [isPayrollLocked, setIsPayrollLocked] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const projectId = 1;

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (activeTab === "attendance") {
      fetchAttendances();
      fetchPayrollStatus();
    }
  }, [activeTab, attendanceDate]);

  const fetchPayrollStatus = async () => {
    try {
       const resp = await api.get(`/workforce/payrolls/?project=${projectId}&date=${attendanceDate}`);
       setIsPayrollLocked(resp.data.length > 0);
    } catch(err) {
       console.error(err);
    }
  }

  const fetchWorkers = async () => {
    try {
      const resp = await api.get(`/workforce/workers/?project=${projectId}`);
      const allWorkers = resp.data;
      setWorkers(allWorkers);
      
      const today = new Date();
      const expiring = allWorkers.filter((w: any) => {
         if (!w.end_date) return false;
         const endDate = new Date(w.end_date);
         const diffTime = endDate.getTime() - today.getTime();
         const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
         return diffDays >= 0 && diffDays <= 1; 
      });
      setExpiringWorkers(expiring.sort((a: any,b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendances = async () => {
    try {
      const resp = await api.get(
        `/workforce/attendances/?project=${projectId}&date=${attendanceDate}`,
      );
      setAttendances(resp.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAttendance = async (
    workerId: number,
    status: string,
    existingId: number | null,
  ) => {
    if (isPayrollLocked) {
         setConfirmModal({
             isOpen: true,
             title: "Attendance Locked",
             message: "You cannot edit attendance of a day where payment was already initiated.",
             type: "danger",
             onConfirm: () => {}
         });
         return;
    }
    try {
      if (existingId) {
        await api.patch(`/workforce/attendances/${existingId}/`, { status });
      } else {
        await api.post(`/workforce/attendances/`, {
          worker: workerId,
          date: attendanceDate,
          status,
          overtime_hours: 0,
        });
      }
      fetchAttendances();
    } catch (err: any) {
      setConfirmModal({
          isOpen: true,
          title: "Action Denied",
          message: err.response?.data?.detail || "Failed to update attendance records.",
          type: "danger",
          onConfirm: () => {}
      });
    }
  };

  const handleDeleteWorker = async (id: number) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this worker? Attendance logs may be affected.",
      )
    )
      return;
    try {
      await api.delete(`/workforce/workers/${id}/`);
      fetchWorkers();
    } catch (err) {
      console.error("Failed to delete worker", err);
    }
  };

  const openAppModal = (worker: any = null) => {
    setSelectedWorker(worker);
    setIsModalOpen(true);
  };

  const openDetailsModal = (worker: any) => {
    setViewedWorker(worker);
    setIsDetailsModalOpen(true);
  };

  const handleInitiatePayrollClick = () => {
    setConfirmModal({
      isOpen: true,
      title: "Generate Daily Payroll",
      message: `Are you sure you want to lock the attendance logs and generate payroll for ${attendanceDate}? This action will calculate earnings based on current attendance.`,
      type: "info",
      onConfirm: async () => {
        try {
          const resp = await api.post('/workforce/payrolls/initiate/', { project: projectId, date: attendanceDate });
          setTimeout(() => {
            setConfirmModal({
              isOpen: true,
              title: "Payroll Successful!",
              message: `Payroll batch generated successfully! Total Amount: ${resp.data.total_amount} Rwf.`,
              type: "success",
              onConfirm: () => {}
            });
            setIsPayrollLocked(true);
          }, 400);
        } catch (err: any) {
          setTimeout(() => {
            setConfirmModal({
              isOpen: true,
              title: "Initiation Failed",
              message: err.response?.data?.detail || 'Error initiating payroll. A record might already exist or there are no attendance logs for today.',
              type: "danger",
              onConfirm: () => {}
            });
          }, 400);
        }
      }
    });
  };

  const getWorkerAttendance = (workerId: number) => {
    return attendances.find((a) => a.worker === workerId);
  };

  const filteredWorkers = workers.filter((worker) => {
    const fullName = `${worker.first_name} ${worker.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      worker.role.toLowerCase().includes(query) ||
      worker.phone_number?.includes(query)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Workforce Management
          </h1>
          <p className="text-slate-600">
            Register manual labor and track site attendance
          </p>
        </div>
        <button
          onClick={() => openAppModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <UserPlus size={18} />
          <span className="font-medium text-sm">Add Worker</span>
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-4">
          <button
            className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "directory"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("directory")}
          >
            <div className="flex items-center gap-2">
              <Users size={16} /> Personnel Directory
            </div>
          </button>
          <button
            className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "attendance"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("attendance")}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} /> Daily Attendance Grid
            </div>
          </button>
        </div>
        <div className="pb-3 relative">
          <Search size={16} className="absolute left-3 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="Search workers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none w-64 md:w-72 shadow-sm transition-shadow"
          />
        </div>
      </div>

      {expiringWorkers.length > 0 && activeTab === "directory" && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 border border-orange-200 rounded-xl p-5 flex items-start gap-4 shadow-sm relative overflow-hidden group mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="bg-orange-100 ring-4 ring-white p-2.5 rounded-full text-orange-600 mt-0.5 shrink-0 shadow-sm animate-bounce">
            <LucideCalendar size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-orange-900 font-bold text-sm mb-1 uppercase tracking-wider">Contract Expirations Pending</h3>
            <p className="text-orange-700 text-xs font-medium mb-3">The following personnel have contracts expiring tomorrow. If unrenewed, the system immediately disables them.</p>
            <div className="flex flex-wrap gap-2">
              {expiringWorkers.map(w => {
                 const diffDays = Math.ceil((new Date(w.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                 return (
                 <button 
                   key={w.id} 
                   onClick={() => openAppModal(w)}
                   className="flex items-center gap-2 bg-white/80 backdrop-blur border border-orange-200 hover:border-orange-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:shadow-md hover:-translate-y-0.5"
                 >
                   <span className="text-slate-800">{w.first_name} {w.last_name}</span>
                   <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shadow-sm ${diffDays <= 0 ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                     {diffDays <= 0 ? 'Expired' : `${diffDays} days`}
                   </span>
                 </button>
              )})}
            </div>
          </div>
        </div>
      )}

      {activeTab === "directory" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 uppercase text-xs tracking-wider">
                  Worker Name
                </th>
                <th className="px-6 py-4 uppercase text-xs tracking-wider">
                  Role / Trade
                </th>
                <th className="px-6 py-4 uppercase text-xs tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-4 uppercase text-xs tracking-wider">
                  Daily Rate (Rwf)
                </th>
                <th className="px-6 py-4 uppercase text-xs tracking-wider text-right">
                  Status
                </th>
                <th className="px-6 py-4 uppercase text-xs tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkers.map((worker) => (
                <tr
                  key={worker.id}
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => openDetailsModal(worker)}
                >
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {worker.first_name} {worker.last_name}
                  </td>
                  <td className="px-6 py-4 text-slate-600 capitalize">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold text-slate-700">
                      {worker.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {worker.phone_number || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono">
                    {worker.daily_rate} Rwf
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${worker.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {worker.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAppModal(worker);
                        }}
                        className="hover:text-blue-600 transition-colors p-1"
                        title="Edit Worker"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorker(worker.id);
                        }}
                        className="hover:text-red-500 transition-colors p-1"
                        title="Remove Worker"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredWorkers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    {workers.length === 0
                      ? "No workers registered for this site."
                      : "No workers found matching your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm inline-flex">
              <CalendarIcon />
              <label className="text-sm font-bold text-slate-700">
                Attendance Log Date:
              </label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-bold text-blue-700 bg-white"
              />
            </div>
            
            <button 
              onClick={handleInitiatePayrollClick}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              <DollarSign size={18} />
              Initiate Daily Payroll
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredWorkers.map((worker) => {
              const record = getWorkerAttendance(worker.id);
              return (
                <div
                  key={worker.id}
                  className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {worker.first_name} {worker.last_name}
                      </h3>
                      <p className="text-xs font-medium text-slate-500 capitalize bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-1">
                        {worker.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() =>
                        handleMarkAttendance(
                          worker.id,
                          "present",
                          record?.id || null,
                        )
                      }
                      disabled={isPayrollLocked}
                      className={`py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${record?.status === "present" ? "bg-green-500 text-white shadow-inner scale-[0.98]" : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                    >
                      ✓ Present
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          handleMarkAttendance(
                            worker.id,
                            "half-day",
                            record?.id || null,
                          )
                        }
                        disabled={isPayrollLocked}
                        className={`py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${record?.status === "half-day" ? "bg-orange-500 text-white shadow-inner scale-[0.98]" : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        Half-Day
                      </button>
                      <button
                        onClick={() =>
                          handleMarkAttendance(
                            worker.id,
                            "absent",
                            record?.id || null,
                          )
                        }
                        disabled={isPayrollLocked}
                        className={`py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${record?.status === "absent" ? "bg-red-500 text-white shadow-inner scale-[0.98]" : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        ✕ Absent
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredWorkers.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                {workers.length === 0
                  ? "No workers available to track. Add personnel first."
                  : "No workers found matching your search."}
              </div>
            )}
          </div>
        </div>
      )}

      <AddWorkerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        workerToEdit={selectedWorker}
        onSuccess={() => {
          fetchWorkers();
        }}
      />

      <WorkerDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        worker={viewedWorker}
      />
      
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
