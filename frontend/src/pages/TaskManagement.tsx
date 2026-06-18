import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  User,
  Calendar,
  Briefcase,
  Search,
  Filter,
  AlertCircle,
  Clock,
  LayoutDashboard,
  CheckCircle2,
  X,
  Camera,
} from "lucide-react";
import api from "../api";
import { asList } from "../utils/apiHelpers";
import { AddTaskModal } from "../components/AddTaskModal";
import { TaskProgressPhotos, type TaskPhoto } from "../components/TaskProgressPhotos";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { getTaskBoardCapabilities } from "../utils/roleCapabilities";
import {
  getTaskBoardPhase,
  getTaskDateState,
  isOpenTask,
  sortTasksForDisplay,
} from "../utils/taskDeadline";
import { Pagination } from "../components/Pagination";

interface UserDetails {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

interface ProjectDetails {
  id: number;
  name: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  location: string;
  date: string;
  time_str: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  can_update_status?: boolean;
  status_lock_reason?: string;
  phase_task_details?: {
    id: number;
    phase: string;
    task_name: string;
    depends_on_phase?: string | null;
    depends_on_task_name?: string | null;
  } | null;
  required_skills?: string[];
  assigned_to_details?: UserDetails;
  project_details?: ProjectDetails;
  subtasks?: any[];
  progress_photos?: TaskPhoto[];
  photo_count?: number;
}

export function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectPhases, setProjectPhases] = useState<{ id: number; name: string; order?: number }[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [activePhaseTab, setActivePhaseTab] = useState<string>("All Phases");
  const [deadlineFilter, setDeadlineFilter] = useState<"overdue" | "due_soon" | null>(
    null,
  );
  const kanbanRef = useRef<HTMLDivElement>(null);
  const { currentProjectId, refreshProjects } = useProject();
  const { user } = useAuth();
  const taskCaps = getTaskBoardCapabilities(user?.role);

  const showError = (message: string) => {
    setToastError(message);
    setTimeout(() => setToastError(null), 5000);
  };

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "in_progress" | "completed"
  >("all");
  const [boardPage, setBoardPage] = useState(1);
  const BOARD_PAGE_SIZE = 16;
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [isAutoAssignModalOpen, setIsAutoAssignModalOpen] = useState(false);
  const [selectedTaskForAutoAssign, setSelectedTaskForAutoAssign] =
    useState<Task | null>(null);
  const [photosViewTask, setPhotosViewTask] = useState<Task | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  const [workersNeededInput, setWorkersNeededInput] = useState("1");
  const [autoAssignResult, setAutoAssignResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [autoAssignConfirm, setAutoAssignConfirm] = useState<{
    message: string;
    workersNeeded: number;
  } | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchProjectPhases();
    setDeadlineFilter(null);
    setStatusFilter("all");
    setBoardPage(1);
  }, [currentProjectId]);

  const fetchProjectPhases = async () => {
    if (!currentProjectId) {
      setProjectPhases([]);
      return;
    }
    try {
      const res = await api.get(`/projects/phases/?project=${currentProjectId}&page_size=100`);
      setProjectPhases(asList(res.data));
    } catch (err) {
      console.error("Failed to fetch project phases", err);
      setProjectPhases([]);
    }
  };

  useEffect(() => {
    setBoardPage(1);
  }, [
    statusFilter,
    activePhaseTab,
    searchQuery,
    priorityFilter,
    assigneeFilter,
    deadlineFilter,
  ]);

  const fetchTasks = async () => {
    try {
      const taskUrl = currentProjectId
        ? `/projects/tasks/?project=${currentProjectId}&page_size=1000`
        : `/projects/tasks/?page_size=1000`;
      const workerUrl = currentProjectId
        ? `/workforce/workers/?project=${currentProjectId}&page_size=1000`
        : `/workforce/workers/?page_size=1000`;

      const [tasksResp, workersResp] = await Promise.all([
        api.get(taskUrl),
        api.get(workerUrl),
      ]);
      setTasks(tasksResp.data.results || tasksResp.data);
      setWorkers(workersResp.data.results || workersResp.data || []);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  const updateTaskStatus = async (
    taskId: number,
    newStatus: string,
    task?: Task,
  ) => {
    if (!taskCaps.canChangeStatus) return;
    if (
      task &&
      task.can_update_status === false &&
      newStatus !== "pending"
    ) {
      const confirmOverride = window.confirm(
        (task.status_lock_reason ||
          "This task is dependency-locked. Complete previous phase first.") +
          "\n\nDo you want to override this lock and update the status anyway?"
      );
      if (!confirmOverride) return;
    }

    if (newStatus === "completed" && task) {
      const hasIncompleteSubtasks = task.subtasks?.some((st: any) => !st.is_completed);
      if (hasIncompleteSubtasks) {
        showError("Cannot mark task as complete while it has incomplete subtasks. Please complete all subtasks first.");
        return;
      }
    }

    try {
      await api.patch(`/projects/tasks/${taskId}/`, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t)),
      );
      if (newStatus === "completed") {
        setDeadlineFilter(null);
        setHighlightedTaskId(null);
      }
      await fetchTasks();
      refreshProjects();
    } catch (err: any) {
      const backendError =
        err?.response?.data?.status?.[0] ||
        err?.response?.data?.detail ||
        "Failed to update task status.";
      showError(backendError);
      console.error("Failed to update status", err);
    }
  };

  const openAutoAssignModal = (e: any, task: Task) => {
    if (!taskCaps.canAutoAssign) return;
    e.stopPropagation();
    setSelectedTaskForAutoAssign(task);
    setWorkersNeededInput("1");
    setIsAutoAssignModalOpen(true);
  };

  const handleAutoAssign = async (allowOverbook = false) => {
    if (!selectedTaskForAutoAssign) return;
    const requiredSkills = Array.isArray(selectedTaskForAutoAssign.required_skills)
      ? selectedTaskForAutoAssign.required_skills
      : [];
    if (requiredSkills.length === 0) {
      setAutoAssignResult({
        type: "error",
        message:
          "Auto-assign needs at least one required skill on this task. Edit the task and tick skills like mason/carpenter/electrician first.",
      });
      return;
    }

    const assignedIds = new Set(
      (Array.isArray(selectedTaskForAutoAssign.assigned_to_details)
        ? selectedTaskForAutoAssign.assigned_to_details
        : selectedTaskForAutoAssign.assigned_to_details
          ? [selectedTaskForAutoAssign.assigned_to_details]
          : []
      ).map((u: any) => u.id),
    );
    const matchingWorkers = workers.filter(
      (w: any) =>
        w?.is_active &&
        requiredSkills.includes(w?.role) &&
        !assignedIds.has(w?.id),
    );
    if (matchingWorkers.length === 0) {
      const availableRoles = Array.from(
        new Set(
          workers
            .filter((w: any) => w?.is_active)
            .map((w: any) => w?.role)
            .filter(Boolean),
        ),
      );
      setAutoAssignResult({
        type: "error",
        message: `No active workers match required skill(s): ${requiredSkills.join(", ")}. Available active roles in this project: ${availableRoles.length ? availableRoles.join(", ") : "none"}.`,
      });
      return;
    }

    const workersNeeded = Number(workersNeededInput);
    if (!Number.isInteger(workersNeeded) || workersNeeded < 1) {
      setAutoAssignResult({
        type: "error",
        message: "Please enter a valid whole number (1 or more).",
      });
      return;
    }

    try {
      const resp = await api.post(
        `/projects/tasks/${selectedTaskForAutoAssign.id}/auto-assign/`,
        {
          workers_needed: workersNeeded,
          allow_overbook: allowOverbook,
        },
      );
      if (resp?.data?.detail || resp?.data?.message) {
        setAutoAssignResult({
          type: "success",
          message:
            resp.data.detail || resp.data.message || "Auto-assign successful.",
        });
      }
      setIsAutoAssignModalOpen(false);
      fetchTasks();
    } catch (err: any) {
      if (err?.response?.data?.needs_confirmation && !allowOverbook) {
        setAutoAssignConfirm({
          message:
            err.response?.data?.detail ||
            "Selected workers are already assigned to active tasks.",
          workersNeeded,
        });
        return;
      }
      let backendMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message;
      if (!backendMessage && err?.response?.data && typeof err.response.data === "object") {
        const firstValue = Object.values(err.response.data)[0];
        if (Array.isArray(firstValue)) {
          backendMessage = String(firstValue[0]);
        } else if (firstValue) {
          backendMessage = String(firstValue);
        }
      }
      setAutoAssignResult({
        type: "error",
        message:
          backendMessage ||
          "Could not auto-assign task. Please check required skills, workers availability, and network connection.",
      });
    }
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dateState = (task: Task) => getTaskDateState(task.date, task.status, today);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Map<number, { id: number; name: string }>();
    tasks.forEach((task) => {
      const users = Array.isArray(task.assigned_to_details)
        ? task.assigned_to_details
        : task.assigned_to_details
          ? [task.assigned_to_details]
          : [];
      users.forEach((u: any) => {
        assignees.set(u.id, {
          id: u.id,
          name: u.full_name || "Unknown",
        });
      });
    });
    return Array.from(assignees.values());
  }, [tasks]);

  // Apply filters linearly
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Text Search Match
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        task.title.toLowerCase().includes(searchLower) ||
        (task.description &&
          task.description.toLowerCase().includes(searchLower));

      // 2. Priority Filter Match
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;

      // 3. Assignee Filter Match
      const users = Array.isArray(task.assigned_to_details)
        ? task.assigned_to_details
        : task.assigned_to_details
          ? [task.assigned_to_details]
          : [];
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "unassigned"
          ? users.length === 0
          : users.some((u: any) => u.id.toString() === assigneeFilter));

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      const { isOverdue, isDueSoon } = dateState(task);
      const matchesDeadline =
        !deadlineFilter ||
        (isOpenTask(task.status) &&
          ((deadlineFilter === "overdue" && isOverdue) ||
            (deadlineFilter === "due_soon" && isDueSoon)));

      return (
        matchesSearch &&
        matchesPriority &&
        matchesAssignee &&
        matchesStatus &&
        matchesDeadline
      );
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, deadlineFilter, today]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    const orderedNames = [...projectPhases]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => p.name);
    orderedNames.forEach((name) => {
      groups[name] = [];
    });
    filteredTasks.forEach((task) => {
      const phase = getTaskBoardPhase(task);
      if (!groups[phase]) groups[phase] = [];
      groups[phase].push(task);
    });
    return groups;
  }, [filteredTasks, projectPhases]);

  const dashboardMetrics = useMemo(() => {
    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    Object.values(groupedTasks).flat().forEach(task => {
      total++;
      if (task.status === "pending") pending++;
      else if (task.status === "in_progress") inProgress++;
      else if (task.status === "completed") completed++;
    });

    const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, pending, inProgress, completed, progressPercentage };
  }, [groupedTasks]);

  const calculateWorkload = () => {
    const workloadMap = new Map<number, any>();

    tasks.forEach((task) => {
      if (task.status === "completed") return;

      const users = Array.isArray(task.assigned_to_details)
        ? task.assigned_to_details
        : task.assigned_to_details
          ? [task.assigned_to_details]
          : [];

      users.forEach((user: any) => {
        if (!workloadMap.has(user.id)) {
          workloadMap.set(user.id, {
            name: user.full_name || "Unknown",
            role: user.role ? user.role.replace("-", " ") : "Worker",
            tasks: 0,
            capacity: 0,
          });
        }

        const data = workloadMap.get(user.id);
        data.tasks += 1;
        data.capacity = Math.min(Math.round((data.tasks / 10) * 100), 100);
      });
    });

    return Array.from(workloadMap.values()).sort((a, b) => b.tasks - a.tasks);
  };

  const workload = calculateWorkload();

  const activeTasks = useMemo(
    () => tasks.filter((t) => isOpenTask(t.status)),
    [tasks],
  );

  const overdueTasks = useMemo(
    () => activeTasks.filter((t) => dateState(t).isOverdue),
    [activeTasks, today],
  );
  const dueSoonTasks = useMemo(
    () =>
      activeTasks.filter((t) => {
        const s = dateState(t);
        return s.isDueSoon && !s.isOverdue;
      }),
    [activeTasks, today],
  );

  const overdueCount = overdueTasks.length;
  const dueSoonCount = dueSoonTasks.length;

  const applyDeadlineFilter = (filter: "overdue" | "due_soon") => {
    setDeadlineFilter((prev) => (prev === filter ? null : filter));
    setTimeout(() => {
      kanbanRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const criticalTasksToShow =
    deadlineFilter === "overdue"
      ? overdueTasks
      : deadlineFilter === "due_soon"
        ? dueSoonTasks
        : [];

  const availablePhases = Object.keys(groupedTasks);
  const phasesList = useMemo(() => {
    const fromProject = [...projectPhases]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => p.name);

    if (fromProject.length > 0) {
      const extras = availablePhases.filter(
        (p) => p !== "Other tasks" && !fromProject.includes(p),
      );
      const other = availablePhases.includes("Other tasks") ? ["Other tasks"] : [];
      return ["All Phases", ...fromProject, ...extras, ...other];
    }

    const other = availablePhases.includes("Other tasks") ? ["Other tasks"] : [];
    const named = availablePhases
      .filter((p) => p !== "Other tasks")
      .sort((a, b) => a.localeCompare(b));
    return ["All Phases", ...other, ...named];
  }, [availablePhases, projectPhases]);

  const goToTask = (task: Task) => {
    const phase = getTaskBoardPhase(task);
    if (availablePhases.includes(phase)) {
      setActivePhaseTab(phase);
    } else {
      setActivePhaseTab("All Phases");
    }
    setHighlightedTaskId(task.id);
    setTimeout(() => {
      const card = document.getElementById(`task-card-${task.id}`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        kanbanRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
    window.setTimeout(() => setHighlightedTaskId(null), 4000);
  };

  return (
    <div className="space-y-6 relative pb-12 animate-in fade-in duration-500">
      {toastError && (
        <div className="fixed top-6 right-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-right-8 transition-all">
          <AlertCircle size={20} />
          <p className="font-medium text-sm pr-4">{toastError}</p>
          <button onClick={() => setToastError(null)} className="absolute top-2 right-2 text-red-400 hover:text-red-700 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Premium Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-900/20 relative overflow-hidden">
        {/* Abstract background graphics */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-20 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
               <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-xs font-bold text-indigo-200 tracking-wider flex items-center gap-1.5">
                 <Briefcase size={12} />
                 TASK BOARD
               </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">
              Project Execution
            </h1>
            <p className="text-indigo-100/80 font-medium text-lg">
              {taskCaps.viewOnly
                ? "View project tasks, deadlines, and crew assignments (read-only)."
                : "Manage phases, track subtasks, and auto-assign workforce."}
            </p>
          </div>
          {taskCaps.canCreateTask && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingTask(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-900 rounded-xl hover:bg-indigo-50 font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] hover:-translate-y-0.5"
              >
                <Plus size={18} className="stroke-[3]" />
                New Task
              </button>
            </div>
          )}
        </div>

        {/* Floating Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 relative z-20">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard size={16} className="text-indigo-300" />
              <span className="text-sm font-semibold text-indigo-100">Total Tasks</span>
            </div>
            <span className="text-3xl font-black text-white">{dashboardMetrics.total}</span>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-indigo-300" />
              <span className="text-sm font-semibold text-indigo-100">Pending</span>
            </div>
            <span className="text-3xl font-black text-white">{dashboardMetrics.pending}</span>
          </div>

          <div className="bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></span>
              <span className="text-sm font-semibold text-blue-100">In Progress</span>
            </div>
            <span className="text-3xl font-black text-blue-50">{dashboardMetrics.inProgress}</span>
          </div>

          <div className="bg-green-500/20 backdrop-blur-md border border-green-400/30 rounded-2xl p-4 flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-sm font-semibold text-green-100">Completed</span>
            </div>
            <div className="flex items-end gap-3 z-10 relative">
              <span className="text-3xl font-black text-green-50">{dashboardMetrics.completed}</span>
              <span className="text-sm font-bold text-green-300 mb-1.5">({dashboardMetrics.progressPercentage}%)</span>
            </div>
            <div 
              className="absolute bottom-0 left-0 h-1 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,1)] transition-all duration-1000 z-10" 
              style={{ width: `${dashboardMetrics.progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sticky Filters Bar */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/60 p-3 flex flex-col gap-3 sticky top-4 z-40">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: "All statuses" },
              { id: "pending" as const, label: "To Do" },
              { id: "in_progress" as const, label: "In Progress" },
              { id: "completed" as const, label: "Done" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                statusFilter === opt.id
                  ? opt.id === "pending"
                    ? "bg-slate-800 text-white"
                    : opt.id === "in_progress"
                      ? "bg-blue-600 text-white"
                      : opt.id === "completed"
                        ? "bg-green-600 text-white"
                        : "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50/50 hover:bg-slate-50 border-0 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 text-slate-800"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-48">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full pl-11 pr-8 py-3 bg-slate-50/50 hover:bg-slate-50 border-0 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all text-slate-700 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div className="relative w-full md:w-48">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full pl-11 pr-8 py-3 bg-slate-50/50 hover:bg-slate-50 border-0 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all text-slate-700 cursor-pointer"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned Only</option>
              {uniqueAssignees.map((u) => (
                <option key={u.id} value={u.id.toString()}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        </div>
      </div>

      {/* Phase Navigation Tabs */}
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex items-center gap-3 min-w-max">
          {phasesList.map((phase) => (
            <button
              key={phase}
              onClick={() => setActivePhaseTab(phase)}
              className={`px-5 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-300 ${
                activePhaseTab === phase
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60 shadow-sm"
              }`}
            >
              {phase}
              {phase !== "All Phases" && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded-md text-xs ${
                    activePhaseTab === phase
                      ? "bg-white/20 text-white"
                      : phase === "Other tasks"
                        ? "bg-amber-200 text-amber-900"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {groupedTasks[phase]?.length ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden animate-fade-in">
          <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-900">Critical Deadlines</h2>
                <p className="text-sm text-red-700 mt-0.5">
                  Click a count to filter the board and list those tasks below.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              {overdueCount > 0 && (
                <button
                  type="button"
                  onClick={() => applyDeadlineFilter("overdue")}
                  className={`px-4 py-2 rounded-lg border shadow-sm text-center min-w-[90px] transition-all cursor-pointer ${
                    deadlineFilter === "overdue"
                      ? "bg-red-600 border-red-700 text-white ring-2 ring-red-300"
                      : "bg-white border-red-200 hover:bg-red-50 hover:border-red-300"
                  }`}
                >
                  <p
                    className={`text-2xl font-black leading-none ${
                      deadlineFilter === "overdue" ? "text-white" : "text-red-600"
                    }`}
                  >
                    {overdueCount}
                  </p>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
                      deadlineFilter === "overdue" ? "text-red-100" : "text-red-500"
                    }`}
                  >
                    Overdue
                  </p>
                </button>
              )}
              {dueSoonCount > 0 && (
                <button
                  type="button"
                  onClick={() => applyDeadlineFilter("due_soon")}
                  className={`px-4 py-2 rounded-lg border shadow-sm text-center min-w-[90px] transition-all cursor-pointer ${
                    deadlineFilter === "due_soon"
                      ? "bg-orange-500 border-orange-600 text-white ring-2 ring-orange-300"
                      : "bg-white border-orange-200 hover:bg-orange-50 hover:border-orange-300"
                  }`}
                >
                  <p
                    className={`text-2xl font-black leading-none ${
                      deadlineFilter === "due_soon" ? "text-white" : "text-orange-600"
                    }`}
                  >
                    {dueSoonCount}
                  </p>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
                      deadlineFilter === "due_soon" ? "text-orange-100" : "text-orange-500"
                    }`}
                  >
                    Due Soon
                  </p>
                </button>
              )}
              {deadlineFilter && (
                <button
                  type="button"
                  onClick={() => setDeadlineFilter(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>

          {deadlineFilter && (
            <div className="px-6 py-4 border-t border-red-100 bg-white max-h-72 overflow-y-auto">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                {deadlineFilter === "overdue" ? "Overdue tasks" : "Due today or tomorrow"} (
                {criticalTasksToShow.length})
              </p>
              {criticalTasksToShow.length === 0 ? (
                <p className="text-sm text-slate-500">No matching tasks.</p>
              ) : (
                <ul className="space-y-2">
                  {criticalTasksToShow.map((task) => {
                    const { daysFromNow } = dateState(task);
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => goToTask(task)}
                          className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">
                              {task.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {getTaskBoardPhase(task)} · {task.status.replace("_", " ")}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={`text-xs font-bold ${
                                deadlineFilter === "overdue"
                                  ? "text-red-600"
                                  : "text-orange-600"
                              }`}
                            >
                              {task.date
                                ? new Date(task.date).toLocaleDateString()
                                : "No date"}
                            </p>
                            {daysFromNow !== null && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {daysFromNow < 0
                                  ? `${Math.abs(daysFromNow)}d overdue`
                                  : daysFromNow === 0
                                    ? "Due today"
                                    : "Due tomorrow"}
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {deadlineFilter && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
          <Filter size={16} />
          <span>
            Showing <strong>{deadlineFilter === "overdue" ? "overdue" : "due soon"}</strong>{" "}
            tasks on the board below
          </span>
          <button
            type="button"
            onClick={() => setDeadlineFilter(null)}
            className="ml-auto text-xs font-bold text-indigo-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Kanban Board Area */}
      <div ref={kanbanRef} className="animate-in fade-in duration-500 mt-2 scroll-mt-24">
        {(() => {
          let tasksToRender: any[] = [];
          
          if (activePhaseTab === "All Phases") {
            // Aggregate all tasks
            Object.values(groupedTasks).forEach(phaseTasks => {
              tasksToRender = [...tasksToRender, ...phaseTasks];
            });
          } else {
            // Only tasks for active phase
            tasksToRender = groupedTasks[activePhaseTab] || [];
          }

          const pending = tasksToRender.filter((t) => t.status === "pending");
          const inProgress = tasksToRender.filter((t) => t.status === "in_progress");
          const completed = tasksToRender.filter((t) => t.status === "completed");

          const allColumns = [
                { title: "To Do", tasks: pending, id: "pending" as const, count: pending.length, icon: "⭕️" },
                { title: "In Progress", tasks: inProgress, id: "in_progress" as const, count: inProgress.length, icon: "⏳" },
                { title: "Done", tasks: completed, id: "completed" as const, count: completed.length, icon: "✅" },
              ];
          const columns =
            statusFilter === "all"
              ? allColumns
              : allColumns.filter((c) => c.id === statusFilter);

          const isSingleStatusView = statusFilter !== "all";

          return (
            <div
              className={`grid gap-6 ${
                isSingleStatusView
                  ? "grid-cols-1"
                  : columns.length === 2
                    ? "grid-cols-1 lg:grid-cols-2"
                    : "grid-cols-1 lg:grid-cols-3"
              }`}
            >
              {columns.map((column) => {
                const sortedTasks = sortTasksForDisplay(
                  column.tasks,
                  column.id,
                  today,
                );
                const totalPages = Math.max(
                  1,
                  Math.ceil(sortedTasks.length / BOARD_PAGE_SIZE),
                );
                const safePage = Math.min(boardPage, totalPages);
                const visibleTasks = isSingleStatusView
                  ? sortedTasks.slice(
                      (safePage - 1) * BOARD_PAGE_SIZE,
                      safePage * BOARD_PAGE_SIZE,
                    )
                  : sortedTasks;

                return (
                <div
                  key={column.id}
                  className={`flex flex-col h-full ${
                    isSingleStatusView
                      ? "bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                      : "min-h-[400px] bg-slate-50/50 rounded-xl p-4 border border-slate-200/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-5 px-1">
                    <span className="text-base">{column.icon}</span>
                    <h3 className="font-bold text-slate-900 text-sm tracking-wide">
                      {column.title}
                    </h3>
                    <span className="ml-auto text-xs font-bold text-slate-500 bg-white shadow-sm border border-slate-200 px-2.5 py-0.5 rounded-full">
                      {column.count}
                    </span>
                  </div>

                  {isSingleStatusView && sortedTasks.length > 0 && (
                    <p className="text-xs text-slate-500 mb-4 px-1">
                      {column.id === "completed"
                        ? "Sorted by most recent due date first"
                        : "Sorted by overdue first, then due date and priority"}
                    </p>
                  )}

                  <div
                    className={
                      isSingleStatusView
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1"
                        : "space-y-3 flex-1"
                    }
                  >
                    {visibleTasks.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-center opacity-60">
                         <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center mb-2">
                            <Plus size={16} className="text-slate-400" />
                         </div>
                         <p className="text-xs font-bold text-slate-400">Empty List</p>
                      </div>
                    ) : (
                      visibleTasks.map((task) => {
                        const isCompleted = !isOpenTask(task.status);
                        const { isOverdue, isDueSoon } = dateState(task);

                        return (
                          <div
                            key={task.id}
                            id={`task-card-${task.id}`}
                            onClick={() => {
                              if (taskCaps.canEditTask) {
                                setEditingTask(task);
                                setIsModalOpen(true);
                              }
                            }}
                            className={`bg-white rounded-xl border p-4 transition-all group flex flex-col gap-3 relative overflow-hidden ${
                              highlightedTaskId === task.id
                                ? "border-indigo-500 ring-2 ring-indigo-400 ring-offset-2 shadow-lg"
                                : "border-slate-200"
                            } ${
                              taskCaps.canEditTask
                                ? "hover:border-indigo-300 hover:shadow-md cursor-pointer"
                                : "cursor-default"
                            }`}
                          >
                            {/* Accent Line for Priority */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                              task.priority === 'high' ? 'bg-red-500' :
                              task.priority === 'medium' ? 'bg-orange-400' :
                              'bg-blue-500'
                            }`} />

                            {/* Top Row: ID & Status */}
                            <div className="flex items-center justify-between pl-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider bg-slate-50 px-1.5 py-0.5 rounded">
                                  BW-{task.id}
                                </span>
                                {activePhaseTab === "All Phases" && task.phase_task_details && (
                                  <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate max-w-[120px]">
                                    {task.phase_task_details.phase_name}
                                  </span>
                                )}
                              </div>
                              
                              {taskCaps.canChangeStatus ? (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={task.status}
                                    onChange={(e) =>
                                      updateTaskStatus(task.id, e.target.value, task)
                                    }
                                    className="text-[10px] font-bold text-slate-400 bg-transparent border-none hover:text-indigo-600 focus:outline-none cursor-pointer appearance-none outline-none py-0 pl-0 pr-4 relative transition-colors"
                                    style={{
                                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                      backgroundRepeat: "no-repeat",
                                      backgroundPosition: "right center",
                                      backgroundSize: "12px",
                                    }}
                                  >
                                    <option value="pending">To Do</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Done</option>
                                  </select>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold uppercase text-slate-500">
                                  {task.status.replace("_", " ")}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h3 className={`font-bold text-[14px] leading-snug pl-1 transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                              {task.title}
                            </h3>

                            {(taskCaps.canEditTask ||
                              (task.photo_count ?? task.progress_photos?.length ?? 0) > 0) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPhotosViewTask(task);
                                }}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-1 rounded-lg w-fit ml-1 transition-colors"
                              >
                                <Camera size={12} />
                                {(task.photo_count ?? task.progress_photos?.length ?? 0) > 0
                                  ? `${task.photo_count ?? task.progress_photos?.length} photo${(task.photo_count ?? task.progress_photos?.length) !== 1 ? "s" : ""}`
                                  : "Add photos"}
                              </button>
                            )}

                            {/* Meta Info Row */}
                            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-50 pl-1">
                              <div className="flex items-center gap-3">
                                {/* Date */}
                                {task.date && (
                                   <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isOverdue && !isCompleted ? 'text-red-500 bg-red-50 px-1.5 py-0.5 rounded' : isDueSoon && !isCompleted ? 'text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                                     <Calendar size={12} />
                                     {new Date(task.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                   </div>
                                )}

                                {/* Subtasks */}
                                {task.subtasks && task.subtasks.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <CheckCircle2 size={12} className={task.status === "completed" ? "text-green-500" : ""} />
                                    {task.subtasks.filter((s:any) => s.is_completed).length}/{task.subtasks.length}
                                  </div>
                                )}
                              </div>

                              {/* Assignee */}
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const users = Array.isArray(task.assigned_to_details) ? task.assigned_to_details : task.assigned_to_details ? [task.assigned_to_details] : [];
                                  if (users.length === 0) {
                                    if (!taskCaps.canAutoAssign) {
                                      return (
                                        <span className="text-[10px] font-bold text-slate-400">
                                          Unassigned
                                        </span>
                                      );
                                    }
                                    return (
                                      <button onClick={(e) => openAutoAssignModal(e, task)} className="opacity-0 group-hover:opacity-100 text-[10px] font-bold border border-slate-200 text-slate-500 hover:border-indigo-600 hover:text-indigo-600 px-2 py-0.5 rounded transition-all" title="Auto Assign">
                                        Assign
                                      </button>
                                    );
                                  }
                                  return (
                                    <div className="flex -space-x-1.5 hover:-space-x-1 transition-all">
                                      {users.slice(0, 3).map((u: any, idx: number) => (
                                        <div key={idx} className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-[9px] font-bold uppercase border-2 border-white shadow-sm relative z-10" title={u.full_name}>
                                          {u.full_name ? u.full_name.charAt(0) : "?"}
                                        </div>
                                      ))}
                                      {users.length > 3 && (
                                        <div className="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white shadow-sm z-10">
                                          +{users.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {isSingleStatusView && sortedTasks.length > BOARD_PAGE_SIZE && (
                    <Pagination
                      currentPage={safePage}
                      totalPages={totalPages}
                      totalItems={sortedTasks.length}
                      onPageChange={setBoardPage}
                    />
                  )}
                </div>
              );
              })}
            </div>
          );
        })()}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">
            Active Team Workload
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Capacity tracking based on active and pending tasks
          </p>
        </div>

        <div className="p-6">
          {workload.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              No active tasks assigned to team members yet.
            </div>
          ) : (
            <div className="space-y-6">
              {workload.map((member, index) => (
                <div key={index} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 bg-blue-50 border border-blue-100 shadow-sm rounded-full flex items-center justify-center text-blue-700 font-bold text-lg transition-transform group-hover:scale-105">
                    {member.name
                      ? member.name
                          .split(" ")
                          .map((n: string) => n.charAt(0))
                          .join("")
                          .substring(0, 2)
                      : "?"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="font-bold text-slate-900 capitalize">
                          {member.name}
                        </p>
                        <p className="text-xs font-medium text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded inline-block mt-0.5">
                          {member.role}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {member.tasks} active tasks
                        </p>
                        <p
                          className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${
                            member.capacity >= 90
                              ? "text-red-500"
                              : member.capacity >= 70
                                ? "text-orange-500"
                                : "text-green-500"
                          }`}
                        >
                          {member.capacity}% capacity
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          member.capacity >= 90
                            ? "bg-gradient-to-r from-red-500 to-red-600"
                            : member.capacity >= 70
                              ? "bg-gradient-to-r from-orange-400 to-orange-500"
                              : "bg-gradient-to-r from-green-400 to-green-500"
                        }`}
                        style={{ width: `${member.capacity}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {photosViewTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Progress photos</h3>
                <p className="text-sm text-slate-500 truncate max-w-[280px]">
                  {photosViewTask.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotosViewTask(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <TaskProgressPhotos
                taskId={photosViewTask.id}
                photos={photosViewTask.progress_photos || []}
                canUpload={taskCaps.canEditTask}
                onPhotosChange={async () => {
                  try {
                    const resp = await api.get(`/projects/tasks/${photosViewTask.id}/`);
                    setPhotosViewTask((prev) =>
                      prev ? { ...prev, progress_photos: resp.data.progress_photos, photo_count: resp.data.photo_count } : null,
                    );
                    fetchTasks();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {taskCaps.canEditTask && (
        <AddTaskModal
          isOpen={isModalOpen}
          onClose={() => {
            fetchTasks();
            setIsModalOpen(false);
            setTimeout(() => setEditingTask(null), 200);
          }}
          taskData={editingTask}
          onSuccess={() => {
            fetchTasks();
            setIsModalOpen(false);
            setTimeout(() => setEditingTask(null), 200);
          }}
        />
      )}

      {taskCaps.canAutoAssign && isAutoAssignModalOpen && selectedTaskForAutoAssign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="text-lg font-bold text-slate-900">
                Auto Assign Workers
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {selectedTaskForAutoAssign.title}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Number of workers needed
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={workersNeededInput}
                onChange={(e) => setWorkersNeededInput(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter workers count"
              />
              <p className="text-xs text-slate-500">
                Workers will be assigned only if enough matching active workers
                are currently available.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsAutoAssignModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAutoAssign()}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Assign Now
              </button>
            </div>
          </div>
        </div>
      )}

      {autoAssignConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-amber-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-100 bg-amber-50">
              <h3 className="text-lg font-bold text-amber-900">
                Workers Already Busy
              </h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                {autoAssignConfirm.message}
              </p>
              <p className="text-xs text-slate-500">
                Proceeding will assign {autoAssignConfirm.workersNeeded} worker(s)
                even if they already have active tasks.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setAutoAssignConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAutoAssignConfirm(null);
                  handleAutoAssign(true);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {autoAssignResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div
              className={`px-6 py-4 border-b ${
                autoAssignResult.type === "success"
                  ? "bg-green-50 border-green-100"
                  : "bg-red-50 border-red-100"
              }`}
            >
              <h3
                className={`text-lg font-bold ${
                  autoAssignResult.type === "success"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                {autoAssignResult.type === "success"
                  ? "Assignment Complete"
                  : "Assignment Failed"}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 leading-relaxed">
                {autoAssignResult.message}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setAutoAssignResult(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
