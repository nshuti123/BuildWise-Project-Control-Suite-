import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import api from "../api";
import { TaskProgressPhotos, type TaskPhoto } from "./TaskProgressPhotos";

interface UserDetails {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

interface Project {
  id: number;
  name: string;
  manager_details?: UserDetails;
  site_engineer_details?: UserDetails;
  subcontractor_details?: UserDetails[];
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskData?: any;
  projectId?: number;
}

export function AddTaskModal({
  isOpen,
  onClose,
  onSuccess,
  taskData,
  projectId,
}: AddTaskModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    time_str: "",
    priority: "medium",
    status: "pending",
    project: "",
    phase_task: "",
    required_skills: [] as string[],
    assigned_to: [] as string[],
  });
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [phaseTasks, setPhaseTasks] = useState<any[]>([]);

  // Subtask UI States
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [activeSubtaskDropdown, setActiveSubtaskDropdown] = useState<
    number | null
  >(null);
  const [progressPhotos, setProgressPhotos] = useState<TaskPhoto[]>([]);

  const refreshProgressPhotos = async (taskId?: number) => {
    const id = taskId ?? taskData?.id;
    if (!id) return;
    try {
      const resp = await api.get(`/projects/tasks/${id}/`);
      setProgressPhotos(resp.data.progress_photos || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      if (taskData) {
        setFormData({
          title: taskData.title || "",
          description: taskData.description || "",
          location: taskData.location || "",
          date: taskData.date || new Date().toISOString().split("T")[0],
          time_str: taskData.time_str || "09:00 AM",
          priority: taskData.priority || "medium",
          status: taskData.status || "pending",
          required_skills: taskData.required_skills || [],
          project: taskData.project_details
            ? taskData.project_details.id.toString()
            : "",
          phase_task: taskData.phase_task ? taskData.phase_task.toString() : "",
          assigned_to: Array.isArray(taskData.assigned_to_details)
            ? taskData.assigned_to_details.map((u: any) => u.id.toString())
            : taskData.assigned_to_details
              ? [taskData.assigned_to_details.id.toString()]
              : [],
        });
        setSubtasks(taskData.subtasks ? [...taskData.subtasks] : []);
        setProgressPhotos(taskData.progress_photos || []);
        refreshProgressPhotos(taskData.id);
      } else {
        // Reset form on open
        setFormData((prev) => ({
          ...prev,
          title: "",
          description: "",
          location: "",
          date: new Date().toISOString().split("T")[0],
          time_str: "09:00 AM",
          priority: "medium",
          status: "pending",
          required_skills: [],
          project: projectId
            ? projectId.toString()
            : projects.length > 0
              ? projects[0].id.toString()
              : "",
          phase_task: "",
          assigned_to: [],
        }));
        setSubtasks([]);
        setProgressPhotos([]);
      }
      setError("");
    }
  }, [isOpen, taskData, projectId]);

  const fetchProjects = async () => {
    try {
      const resp = await api.get("/projects/");
      setProjects(resp.data);
      if (resp.data.length > 0 && !formData.project) {
        setFormData((prev) => ({
          ...prev,
          project: resp.data[0].id.toString(),
        }));
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  useEffect(() => {
    if (formData.project) {
      api
        .get(`/workforce/workers/?project=${formData.project}&page_size=1000`)
        .then((res) => {
          setTeamMembers(res.data);
        })
        .catch((err) =>
          console.error("Failed to load workforce for project", err),
        );

      api
        .get(`/projects/phase-tasks/?project=${formData.project}&page_size=1000`)
        .then((res) => {
          setPhaseTasks(res.data);
        })
        .catch((err) =>
          console.error("Failed to load phase tasks for project", err),
        );
    } else {
      setTeamMembers([]);
      setPhaseTasks([]);
    }
  }, [formData.project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.project) {
      setError("Please select a project");
      setLoading(false);
      return;
    }

    if (formData.status === "completed" && taskData) {
      const hasIncompleteSubtasks = subtasks.some((st: any) => !st.is_completed);
      if (hasIncompleteSubtasks) {
        setError("Cannot mark task as complete while it has incomplete subtasks.");
        setLoading(false);
        return;
      }
    }

    try {
      const payload: any = { ...formData };
      if (!payload.phase_task) delete payload.phase_task; // If empty string, do not send or send null
      payload.assigned_to = payload.assigned_to.map(Number);

      if (taskData) {
        // Edit mode
        await api.patch(`/projects/tasks/${taskData.id}/`, payload);
      } else {
        // Create mode
        await api.post("/projects/tasks/", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create task:", err);
      setError(
        err.response?.data?.detail ||
          "Failed to create task. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Subtask API interactors
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !taskData) return;
    try {
      const res = await api.post("/projects/subtasks/", {
        title: newSubtaskTitle,
        parent_task: taskData.id,
        is_completed: false,
        assigned_to: [],
      });
      setSubtasks([...subtasks, res.data]);
      setNewSubtaskTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSubtask = async (subtask: any) => {
    try {
      const newStatus = !subtask.is_completed;
      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === subtask.id ? { ...s, is_completed: newStatus } : s,
        ),
      );
      await api.patch(`/projects/subtasks/${subtask.id}/`, {
        is_completed: newStatus,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveSubtask = async (id: number) => {
    try {
      setSubtasks((prev) => prev.filter((s) => s.id !== id));
      await api.delete(`/projects/subtasks/${id}/`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignSubtaskWorker = async (
    subtaskId: number,
    workerId: number,
    currentlyAssigned: boolean,
  ) => {
    try {
      const subtask = subtasks.find((s) => s.id === subtaskId);
      if (!subtask) return;
      const currentIds = subtask.assigned_to_details
        ? subtask.assigned_to_details.map((w: any) => w.id)
        : [];
      const newIds = currentlyAssigned
        ? currentIds.filter((id: number) => id !== workerId)
        : [...currentIds, workerId];

      // Optimistic UI update
      const updatedWorker = teamMembers.find((w) => w.id === workerId);
      setSubtasks((prev) =>
        prev.map((s) => {
          if (s.id !== subtaskId) return s;
          const newDetails = currentlyAssigned
            ? s.assigned_to_details.filter((w: any) => w.id !== workerId)
            : [...(s.assigned_to_details || []), updatedWorker];
          return { ...s, assigned_to_details: newDetails };
        }),
      );

      await api.patch(`/projects/subtasks/${subtaskId}/`, {
        assigned_to: newIds,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (
      !taskData ||
      !window.confirm(
        "Are you sure you want to delete this task? This action cannot be undone.",
      )
    )
      return;

    setLoading(true);
    try {
      await api.delete(`/projects/tasks/${taskData.id}/`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete task");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {taskData ? "Edit Task" : "Add New Task"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project
              </label>
              <div className="relative">
                <Briefcase
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <select
                  required
                  value={formData.project}
                  onChange={(e) =>
                    setFormData({ ...formData, project: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
                >
                  <option value="" disabled>
                    Select Project
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phase Task
              </label>
              <div className="relative">
                <select
                  value={formData.phase_task}
                  onChange={(e) =>
                    setFormData({ ...formData, phase_task: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
                >
                  <option value="">
                    No Phase (Unassigned)
                  </option>
                  {phaseTasks.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.phase} - {pt.task_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Required Skills (Auto-Assign)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["mason", "carpenter", "plumber", "electrician", "laborer", "welder", "painter", "driver", "other"].map(skill => (
                  <label key={skill} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="checkbox"
                      checked={formData.required_skills.includes(skill)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, required_skills: [...formData.required_skills, skill] });
                        } else {
                          setFormData({ ...formData, required_skills: formData.required_skills.filter(s => s !== skill) });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700 capitalize">{skill}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assigned Workers (Direct)
              </label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white custom-scrollbar shadow-sm">
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4 text-center">No workers available. Please select a project first.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {teamMembers.map(worker => (
                      <label key={worker.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={formData.assigned_to.includes(worker.id.toString())}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, assigned_to: [...formData.assigned_to, worker.id.toString()] });
                            } else {
                              setFormData({ ...formData, assigned_to: formData.assigned_to.filter(id => id !== worker.id.toString()) });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{worker.full_name || worker.email}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{(worker.role || 'worker').replace('-', ' ')}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Task Title
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="e.g. Inspect scaffolding"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none h-24 resize-none transition-all"
                placeholder="Provide a detailed description or instructions..."
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Location / Zone
              </label>
              <div className="relative">
                <MapPin
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="e.g. Block B, Level 2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time
                </label>
                <div className="relative">
                  <Clock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    value={formData.time_str}
                    onChange={(e) =>
                      setFormData({ ...formData, time_str: e.target.value })
                    }
                    placeholder="e.g. 09:00 AM"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p })}
                    className={`py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                      formData.priority === p
                        ? p === "high"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : p === "medium"
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {taskData?.id && (
              <div className="border-t border-slate-200 pt-6 mt-4">
                <TaskProgressPhotos
                  taskId={taskData.id}
                  photos={progressPhotos}
                  canUpload
                  onPhotosChange={() => refreshProgressPhotos(taskData.id)}
                />
              </div>
            )}

            {taskData && (
              <div className="border-t border-slate-200 pt-6 mt-4">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                  Subtask Checklist
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shadow-sm">
                    {subtasks.filter((s) => s.is_completed).length} /{" "}
                    {subtasks.length} Completed
                  </span>
                </h3>

                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {subtasks.map((st) => (
                    <div
                      key={st.id}
                      className={`flex flex-col gap-2 p-3 border rounded-xl transition-all ${st.is_completed ? "bg-slate-50 border-slate-200" : "bg-white border-blue-100 shadow-sm"}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={st.is_completed}
                          onChange={() => handleToggleSubtask(st)}
                          className="mt-0.5 w-4 h-4 text-blue-600 bg-white border-slate-300 rounded cursor-pointer focus:ring-blue-500"
                        />
                        <div
                          className={`flex-1 text-sm font-medium ${st.is_completed ? "line-through text-slate-400" : "text-slate-700"}`}
                        >
                          {st.title}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(st.id)}
                          className="text-slate-400 hover:text-red-500 p-1 bg-slate-50 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="ml-7 flex items-center justify-between mt-1">
                        <div className="flex -space-x-1.5">
                          {st.assigned_to_details?.map((u: any) => (
                            <div
                              key={u.id}
                              className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] border-2 border-white shadow-sm ${st.is_completed ? "bg-slate-200 text-slate-500" : "bg-green-100 text-green-700"}`}
                              title={u.full_name}
                            >
                              {u.full_name?.charAt(0)}
                            </div>
                          ))}
                          {(!st.assigned_to_details ||
                            st.assigned_to_details.length === 0) && (
                            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                              Unassigned
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSubtaskDropdown(
                                activeSubtaskDropdown === st.id ? null : st.id,
                              )
                            }
                            className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                          >
                            + Resources
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    placeholder="Record an actionable subtask item..."
                    className="flex-1 text-sm border-2 border-slate-100 px-3 py-2 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    className="bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 px-4 py-2 rounded-xl text-sm font-bold text-white hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    Append
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 flex items-center justify-between gap-3 w-full sticky bottom-0 bg-white shadow-[0_-8px_10px_-5px_rgba(255,255,255,1)]">
              {taskData && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm shadow-blue-600/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading
                    ? "Saving..."
                    : taskData
                      ? "Save Changes"
                      : "Create Task"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Worker Overlay Panel */}
        {activeSubtaskDropdown !== null &&
          createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
              <div className="w-full max-w-2xl max-h-[90vh] bg-white/95 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col m-4">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 shadow-sm">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Assign Resources
                    </h3>
                    <p
                      className="text-xs text-slate-500 mt-0.5"
                      title={
                        subtasks.find((s) => s.id === activeSubtaskDropdown)
                          ?.title
                      }
                    >
                      Select workers mapped to this subtask line item
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSubtaskDropdown(null)}
                    className="p-2 bg-slate-100/50 hover:bg-slate-100 text-slate-500 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 custom-scrollbar">
                  <div className="grid gap-3 max-w-sm mx-auto">
                    {teamMembers.map((worker) => {
                      const st = subtasks.find(
                        (s) => s.id === activeSubtaskDropdown,
                      );
                      const isAssigned = st?.assigned_to_details?.some(
                        (w: any) => w.id === worker.id,
                      );
                      return (
                        <label
                          key={worker.id}
                          className={`flex items-center justify-between p-3.5 border-2 rounded-xl cursor-pointer transition-all ${isAssigned ? "border-blue-400 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-200 shadow-sm"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-sm shadow-sm ${isAssigned ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"}`}
                            >
                              {worker.full_name?.charAt(0)}
                            </div>
                            <div>
                              <p
                                className={`text-sm font-bold ${isAssigned ? "text-blue-900" : "text-slate-700"}`}
                              >
                                {worker.full_name}
                              </p>
                              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                Worker Profile
                              </p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isAssigned || false}
                            onChange={() =>
                              handleAssignSubtaskWorker(
                                activeSubtaskDropdown,
                                worker.id,
                                isAssigned || false,
                              )
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-slate-300 rounded cursor-pointer focus:ring-blue-500 focus:ring-offset-1"
                          />
                        </label>
                      );
                    })}

                    {teamMembers.length === 0 && (
                      <div className="text-center p-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white shadow-sm flex flex-col items-center gap-2">
                        <span className="font-bold text-slate-500">
                          No active workers found
                        </span>
                        <span className="text-xs">
                          Select a valid project or map structural staff first.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex justify-center shadow-[0_-8px_10px_-5px_rgba(0,0,0,0.05)] z-10 sticky bottom-0">
                  <button
                    onClick={() => setActiveSubtaskDropdown(null)}
                    className="w-full max-w-sm py-3 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2 justify-center"
                  >
                    Confirm Mapping
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>,
    document.body,
  );
}
