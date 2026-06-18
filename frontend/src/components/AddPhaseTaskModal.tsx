import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import api from "../api";
import { addWorkingDays } from "../utils/calendar";

interface ProjectPhaseOption {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface AddPhaseTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  task?: any;
  tasks: any[];
  phases?: ProjectPhaseOption[];
  defaultPhaseId?: number | null;
  onSuccess: () => void;
}

export function AddPhaseTaskModal({
  isOpen,
  onClose,
  projectId,
  task,
  tasks,
  phases = [],
  defaultPhaseId = null,
  onSuccess,
}: AddPhaseTaskModalProps) {
  const [formData, setFormData] = useState({
    project_phase: "" as string | number,
    phase: "",
    task_name: "",
    start_date: "",
    duration_working_days: 1,
    progress: 0,
    status: "pending",
    tracking_method: "manual",
    target_units: 0,
    completed_units: 0,
    unit_name: "",
    depends_on: "" as string | number,
    assigned_to: [] as string[],
  });
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && projectId) {
      api.get(`/workforce/workers/?project=${projectId}`).then(res => {
        setTeamMembers(res.data);
      }).catch(err => console.error("Failed to load workforce project team", err));
    }
  }, [isOpen, projectId]);

  useEffect(() => {
    if (task) {
      setFormData({
        project_phase: task.project_phase ?? "",
        phase: task.phase,
        task_name: task.task_name,
        start_date: task.start_date,
        duration_working_days: task.duration_working_days || 1,
        progress: task.progress,
        status: task.status,
        tracking_method: task.tracking_method || "manual",
        target_units: task.target_units || 0,
        completed_units: task.completed_units || 0,
        unit_name: task.unit_name || "",
        depends_on: task.depends_on || "",
        assigned_to: Array.isArray(task.assigned_to_details) 
            ? task.assigned_to_details.map((u: any) => u.id.toString()) 
            : (task.assigned_to_details ? [task.assigned_to_details.id.toString()] : []),
      });
    } else {
      const initialPhaseId =
        defaultPhaseId ??
        (phases.length === 1 ? phases[0].id : "");
      const initialPhaseName =
        phases.find((p) => p.id === initialPhaseId)?.name ?? "";
      const initialPhase = phases.find((p) => p.id === initialPhaseId);
      setFormData({
        project_phase: initialPhaseId,
        phase: initialPhaseName,
        task_name: "",
        start_date: initialPhase?.start_date?.slice(0, 10) || "",
        duration_working_days: 1,
        progress: 0,
        status: "pending",
        tracking_method: "manual",
        target_units: 0,
        completed_units: 0,
        unit_name: "",
        depends_on: "",
        assigned_to: [],
      });
    }
  }, [task, isOpen, defaultPhaseId, phases]);

  if (!isOpen) return null;

  const selectedPhase = phases.find(
    (p) => p.id === Number(formData.project_phase),
  );
  const phaseStart = selectedPhase?.start_date?.slice(0, 10);
  const phaseEnd = selectedPhase?.end_date?.slice(0, 10);

  const estimatedEnd =
    formData.start_date && formData.duration_working_days > 0
      ? addWorkingDays(formData.start_date, formData.duration_working_days)
      : null;
  const estimatedEndStr = estimatedEnd
    ? `${estimatedEnd.getFullYear()}-${String(estimatedEnd.getMonth() + 1).padStart(2, "0")}-${String(estimatedEnd.getDate()).padStart(2, "0")}`
    : null;
  const exceedsPhase =
    phaseEnd && estimatedEndStr && estimatedEndStr > phaseEnd;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (selectedPhase && (!phaseStart || !phaseEnd)) {
      setError(
        `Phase "${selectedPhase.name}" has no schedule dates. Edit the phase and set start/end dates first.`,
      );
      setIsSubmitting(false);
      return;
    }
    if (phaseStart && formData.start_date < phaseStart) {
      setError(`Task cannot start before the phase start date (${phaseStart}).`);
      setIsSubmitting(false);
      return;
    }
    if (exceedsPhase) {
      setError(
        `Task would end on ${estimatedEndStr}, after the phase ends on ${phaseEnd}. Shorten duration or adjust dates.`,
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const payload: any = { ...formData, project: projectId };
      if (payload.project_phase) {
        payload.project_phase = Number(payload.project_phase);
        const selected = phases.find((p) => p.id === payload.project_phase);
        if (selected) payload.phase = selected.name;
      } else if (!payload.phase?.trim()) {
        setError("Select a construction phase for this task.");
        setIsSubmitting(false);
        return;
      }
      if (payload.assigned_to.length === 0) {
          delete payload.assigned_to;
      } else {
          payload.assigned_to = payload.assigned_to.map(Number);
      }

      if (task && task.id) {
        await api.put(`/projects/phase-tasks/${task.id}/`, payload);
      } else {
        await api.post("/projects/phase-tasks/", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save timeline task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) return;
    
    setIsSubmitting(true);
    try {
      await api.delete(`/projects/phase-tasks/${task.id}/`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete task");
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {task ? "Edit Timeline Task" : "Add Timeline Task"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Construction phase</label>
              {phases.length > 0 ? (
                <select
                  required
                  value={formData.project_phase}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : "";
                    const selected = phases.find((p) => p.id === id);
                    setFormData({
                      ...formData,
                      project_phase: id,
                      phase: selected?.name ?? "",
                      start_date: selected?.start_date?.slice(0, 10) || formData.start_date,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                >
                  <option value="">Select phase…</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={formData.phase}
                  onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                  placeholder="e.g. Foundation Works"
                />
              )}
              {selectedPhase && phaseStart && phaseEnd && (
                <p className="text-xs text-slate-500">
                  Phase window: {phaseStart} → {phaseEnd}
                </p>
              )}
              {phases.length === 0 && (
                <p className="text-xs text-amber-700">
                  No phases yet — add phases on Project Planning first.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Task Name</label>
              <input
                type="text"
                required
                value={formData.task_name}
                onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                placeholder="e.g. Concrete Pouring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                required
                min={phaseStart}
                max={phaseEnd}
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
              {exceedsPhase && (
                <p className="text-xs text-red-600">
                  Duration exceeds phase end ({phaseEnd})
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Duration (Working Days)</label>
              <input
                type="number"
                min="1"
                required
                value={formData.duration_working_days}
                onChange={(e) => setFormData({ ...formData, duration_working_days: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
              <div className="text-xs text-slate-500 mt-1">
                Estimated End Date: {formData.start_date && formData.duration_working_days > 0 ? addWorkingDays(formData.start_date, formData.duration_working_days)?.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "TBD"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Assign To</label>
                <div className="w-full border border-slate-300 rounded-lg bg-slate-50 h-32 overflow-y-auto p-1.5 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent outline-none">
                  {teamMembers.length === 0 ? (
                    <div className="p-3 py-6 text-sm text-slate-400 text-center font-medium italic">No workers available to assign.</div>
                  ) : (
                    teamMembers.map(member => {
                      const isChecked = formData.assigned_to.includes(member.id.toString());
                      return (
                      <label key={member.id} className={`flex items-center justify-between p-2 rounded-md cursor-pointer border transition-colors mb-1 ${isChecked ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-white hover:border-slate-200'}`}>
                        <span className={`text-sm font-medium ${isChecked ? 'text-blue-800' : 'text-slate-700'}`}>
                          {member.first_name} {member.last_name}
                        </span>
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-600 cursor-pointer"
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              assigned_to: checked 
                                ? [...prev.assigned_to, member.id.toString()]
                                : prev.assigned_to.filter(id => id !== member.id.toString())
                            }));
                          }}
                        />
                      </label>
                    )})
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Blocked By / Depends On</label>
                <select
                  value={formData.depends_on}
                  onChange={(e) => {
                    const val = e.target.value;
                    const depId = val ? parseInt(val) : "";
                    // Auto-calculate start date if a dependency is chosen
                    if (depId) {
                      const depTask = tasks.find(t => t.id === depId);
                      if (depTask && depTask.end_date) {
                        setFormData({ ...formData, depends_on: depId, start_date: depTask.end_date });
                        return;
                      }
                    }
                    setFormData({ ...formData, depends_on: depId });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none bg-white font-medium text-slate-900"
                >
                <option value="">None (Can start immediately)</option>
                {tasks?.filter(t => t.id !== task?.id).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.task_name} (Ends: {t.end_date})
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-500 mt-1">If selected, this task becomes dependent and part of the network timeline.</div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700">Tracking Method</label>
            <select
              value={formData.tracking_method}
              onChange={(e) => setFormData({ ...formData, tracking_method: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none bg-white font-medium text-slate-900"
            >
              <option value="manual">Manual Percentage (Slider)</option>
              <option value="subtasks">Automated from Linked Subtasks</option>
              <option value="units">Physical Quantities (Units)</option>
            </select>
          </div>

          {formData.tracking_method === "units" && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
               <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Target</label>
                <input
                  type="number"
                  min="0"
                  required={formData.tracking_method === "units"}
                  value={formData.target_units}
                  onChange={(e) => setFormData({ ...formData, target_units: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Completed</label>
                <input
                  type="number"
                  min="0"
                  required={formData.tracking_method === "units"}
                  value={formData.completed_units}
                  onChange={(e) => setFormData({ ...formData, completed_units: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Unit Name</label>
                <input
                  type="text"
                  required={formData.tracking_method === "units"}
                  value={formData.unit_name}
                  onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                  placeholder="e.g. Tons"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => {
                  const next = e.target.value;
                  setFormData((prev) => {
                    // UX: if user marks Completed in manual tracking,
                    // also set progress to 100 so the timeline turns green immediately.
                    if (next === "completed" && prev.tracking_method === "manual") {
                      return { ...prev, status: next, progress: 100 };
                    }
                    return { ...prev, status: next };
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none bg-white"
              >
                <option value="pending">Pending</option>
                <option value="on-track">On Track</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            {formData.tracking_method === "manual" ? (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Progress (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-500">Progress</label>
                <div className="w-full px-3 py-2 border border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-400 text-sm">
                   Calculated Automatically
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3 w-full sticky bottom-0 bg-white">
            {task && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium border border-red-100"
              >
                Delete
              </button>
            )}
            <div className="flex gap-3 flex-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 shadow-sm shadow-blue-600/20"
              >
                {isSubmitting ? "Saving..." : "Save Task"}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
