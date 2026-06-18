import { useMemo, useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Plus, Filter, Edit2, Layout, CalendarDays, User, AlertTriangle, Trash2, Search, X, Layers, ChevronDown, ChevronRight, Sparkles, FileText, Mail, Sheet } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";
import { AddMilestoneModal } from "../components/AddMilestoneModal";
import { AddPhaseTaskModal } from "../components/AddPhaseTaskModal";
import { AddProjectPhaseModal } from "../components/AddProjectPhaseModal";
import { ProjectCalendar } from "../components/ProjectCalendar";
import api from "../api";
import { asList } from "../utils/apiHelpers";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { EmailReportModal } from "../components/EmailReportModal";
import { emailTimelineReportProject } from "../utils/tableReportExport";

const BASELINE_EDITOR_ROLES = new Set([
  "managing-director",
  "admin",
  "technical-director",
  "project-manager",
]);

export function ProjectPlanning() {
  const { user } = useAuth();
  const canEditBaseline = !!user?.role && BASELINE_EDITOR_ROLES.has(user.role);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any>(null);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [exportingTimeline, setExportingTimeline] = useState<"pdf" | "excel" | "email" | null>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Record<number, boolean>>({});
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [defaultPhaseId, setDefaultPhaseId] = useState<number | null>(null);
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<any>(null);
  const [isSeedingPhases, setIsSeedingPhases] = useState(false);

  const { currentProjectId: selectedProjectId } = useProject();

  const [viewMode, setViewMode] = useState<"gantt" | "calendar">("gantt");
  const [zoomLevel, setZoomLevel] = useState(100);

  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dragOffsetDays, setDragOffsetDays] = useState<number>(0);
  const dragStartRef = useRef<{ clientX: number, timelineWidth: number, percentPerDay: number, task: any } | null>(null);
  const isDraggingRef = useRef(false);

  const [baselines, setBaselines] = useState<any[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState<number | null>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Record<string, boolean>>({
    pending: true,
    "on-track": true,
    completed: true,
    delayed: true,
  });
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyConflicts, setOnlyConflicts] = useState(false);

  const fetchMilestones = async () => {
    if (!selectedProjectId) return;
    try {
      const response = await api.get(`/projects/milestones/?project=${selectedProjectId}`);
      setMilestones(response.data);
    } catch (err) {
      console.error("Failed to fetch milestones:", err);
    }
  };

  const fetchTasks = async () => {
    if (!selectedProjectId) return;
    try {
      const response = await api.get(`/projects/phase-tasks/?project=${selectedProjectId}&page_size=1000`);
      setTasks(asList(response.data));
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  const fetchPhases = async () => {
    if (!selectedProjectId) return;
    try {
      const response = await api.get(`/projects/phases/?project=${selectedProjectId}&page_size=100`);
      setPhases(asList(response.data));
    } catch (err) {
      console.error("Failed to fetch phases:", err);
    }
  };

  const fetchBaselines = async () => {
    if (!selectedProjectId) return;
    try {
      const response = await api.get(`/projects/baselines/?project=${selectedProjectId}`);
      setBaselines(response.data);
    } catch (err) {
      console.error("Failed to fetch baselines:", err);
    }
  };

  // Removed local fetchProjects useEffect

  useEffect(() => {
    if (selectedProjectId) {
      fetchMilestones();
      fetchPhases();
      fetchTasks();
      fetchBaselines();
    }
  }, [selectedProjectId]);

  const handleSaveSnapshot = async () => {
    if (!selectedProjectId) return;
    const name = window.prompt("Enter a name for this timeline snapshot:", `Snapshot ${new Date().toLocaleDateString()}`);
    if (!name) return;
    setIsSavingSnapshot(true);
    try {
      await api.post('/projects/baselines/save-snapshot/', { project: selectedProjectId, name });
      await fetchBaselines();
    } catch (err) {
      console.error("Failed to save snapshot", err);
      alert("Failed to save snapshot.");
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportTimelinePdf = async () => {
    if (!selectedProjectId) return;
    setExportingTimeline("pdf");
    try {
      const response = await api.get(
        `/projects/${selectedProjectId}/timeline-report/?export_as=pdf`,
        { responseType: "blob" },
      );
      downloadBlob(response.data, `Timeline_Report_${selectedProjectId}.pdf`);
    } catch (err) {
      console.error("Failed to export timeline PDF", err);
      alert("Failed to generate timeline PDF.");
    } finally {
      setExportingTimeline(null);
    }
  };

  const exportTimelineExcel = async () => {
    if (!selectedProjectId) return;
    setExportingTimeline("excel");
    try {
      const response = await api.get(
        `/projects/${selectedProjectId}/timeline-report/?export_as=excel`,
        { responseType: "blob" },
      );
      downloadBlob(response.data, `Timeline_Report_${selectedProjectId}.xlsx`);
    } catch (err) {
      console.error("Failed to export timeline Excel", err);
      alert("Failed to generate timeline Excel file.");
    } finally {
      setExportingTimeline(null);
    }
  };

  const sendTimelineEmail = async (payload: {
    email: string;
    message: string;
    attachments: File[];
  }) => {
    if (!selectedProjectId) return;
    setExportingTimeline("email");
    try {
      await emailTimelineReportProject(selectedProjectId, payload);
      alert("Timeline report sent successfully.");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      throw new Error(detail || "Failed to send timeline report email.");
    } finally {
      setExportingTimeline(null);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!selectedBaselineId) return;
    if (!window.confirm("Are you sure you want to delete this timeline snapshot?")) return;
    
    try {
      await api.delete(`/projects/baselines/${selectedBaselineId}/`);
      setSelectedBaselineId(null);
      await fetchBaselines();
    } catch (err) {
      console.error("Failed to delete snapshot", err);
      alert("Failed to delete snapshot.");
    }
  };

  const openAddMilestone = () => {
    setEditingMilestone(null);
    setIsMilestoneModalOpen(true);
  };

  const openEditMilestone = (milestone: any) => {
    setEditingMilestone(milestone);
    setIsMilestoneModalOpen(true);
  };

  const openAddTask = () => {
    setEditingTask(null);
    setDefaultPhaseId(null);
    setIsTaskModalOpen(true);
  };

  const openAddPhase = () => {
    setEditingPhase(null);
    setIsPhaseModalOpen(true);
  };

  const openEditPhase = (phase: any) => {
    setEditingPhase(phase);
    setIsPhaseModalOpen(true);
  };

  const handleSeedStandardPhases = async () => {
    if (!selectedProjectId) return;
    if (
      phases.length > 0 &&
      !window.confirm(
        "This will add any missing standard phases (existing phases are kept). Continue?",
      )
    ) {
      return;
    }
    setIsSeedingPhases(true);
    try {
      await api.post("/projects/phases/seed-standard/", { project: selectedProjectId });
      await fetchPhases();
      await fetchTasks();
    } catch (err) {
      console.error("Failed to seed phases", err);
      alert("Could not create standard phases. Try again.");
    } finally {
      setIsSeedingPhases(false);
    }
  };

  const togglePhaseExpanded = (phaseId: number) => {
    setExpandedPhaseIds((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const tasksByPhaseId = useMemo(() => {
    const map: Record<number, any[]> = {};
    const unassigned: any[] = [];
    for (const t of tasks) {
      const pid = t.project_phase;
      if (pid) {
        if (!map[pid]) map[pid] = [];
        map[pid].push(t);
      } else {
        unassigned.push(t);
      }
    }
    return { map, unassigned };
  }, [tasks]);

  const openEditTask = (task: any) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  // Compute timeline bounds dynamically
  let minDate = new Date();
  let maxDate = new Date();
  minDate.setMonth(minDate.getMonth() - 1);
  maxDate.setMonth(maxDate.getMonth() + 4);

  if (tasks.length > 0 || milestones.length > 0) {
    const allDates: number[] = [];
    tasks.forEach((t) => {
      if (t.start_date) allDates.push(new Date(t.start_date).getTime());
      if (t.end_date) allDates.push(new Date(t.end_date).getTime());
    });
    milestones.forEach((m) => {
      if (m.date) allDates.push(new Date(m.date).getTime());
    });

    if (allDates.length > 0) {
      const min = Math.min(...allDates);
      const max = Math.max(...allDates);
      minDate = new Date(min);
      maxDate = new Date(max);
      // Pad by 7 days
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 7);
    }
  }

  const totalDuration = Math.max(1, maxDate.getTime() - minDate.getTime());

  const getPercentage = (dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const diff = d.getTime() - minDate.getTime();
    const percent = (diff / totalDuration) * 100;
    return Math.max(0, Math.min(100, percent));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, task: any) => {
    if (e.button !== 0) return;
    
    const timelineEl = e.currentTarget.closest('.timeline-wrapper');
    if (!timelineEl) return;
    
    const _totalDays = Math.max(1, Math.ceil(totalDuration / (1000 * 60 * 60 * 24)));

    dragStartRef.current = {
      clientX: e.clientX,
      timelineWidth: timelineEl.getBoundingClientRect().width,
      percentPerDay: 100 / _totalDays,
      task
    };
    isDraggingRef.current = false;
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragStartRef.current) return;
    const { clientX, timelineWidth, percentPerDay, task } = dragStartRef.current;
    
    const deltaX = e.clientX - clientX;
    if (Math.abs(deltaX) > 2 && !isDraggingRef.current) {
      isDraggingRef.current = true;
      setDraggingTaskId(task.id);
    }
    
    if (isDraggingRef.current) {
      const deltaPercent = (deltaX / timelineWidth) * 100;
      setDragOffsetDays(Math.round(deltaPercent / percentPerDay));
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    
    if (!dragStartRef.current) return;
    
    if (isDraggingRef.current) {
      const { task, percentPerDay, timelineWidth, clientX } = dragStartRef.current;
      const deltaX = e.clientX - clientX;
      const deltaPercent = (deltaX / timelineWidth) * 100;
      const offsetDays = Math.round(deltaPercent / percentPerDay);
      
      if (offsetDays !== 0) {
         const oldStart = new Date(task.start_date);
         oldStart.setDate(oldStart.getDate() + offsetDays);
         const formattedStart = oldStart.toISOString().split('T')[0];
         
         api.patch(`/projects/phase-tasks/${task.id}/`, {
            start_date: formattedStart
         }).then(() => {
            fetchTasks();
         }).catch(err => {
            console.error("Failed to drag schedule", err);
         });
      }
      
      setDraggingTaskId(null);
      setDragOffsetDays(0);
      
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    } else {
      dragStartRef.current = null;
    }
  };

  const timeLabels = [];
  for (let i = 0; i <= 4; i++) {
    const d = new Date(minDate.getTime() + totalDuration * (i / 4));
    timeLabels.push(
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  }

  const getTaskUrgency = (task: any) => {
    // Red should mean "needs attention" (overdue/delayed), not "critical path".
    if (task?.status === "completed") return "ok";
    if (task?.status === "delayed") return "overdue";
    if (!task?.end_date) return "ok";
    const end = new Date(task.end_date);
    if (Number.isNaN(end.getTime())) return "ok";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return end.getTime() < today.getTime() ? "overdue" : "ok";
  };

  const analytics = useMemo(() => {
    const maxEndDateMs = Math.max(...tasks.map((t) => (t.end_date ? new Date(t.end_date).getTime() : 0)));
    const criticalTaskIds = new Set<number>();
    const conflictTaskIds = new Set<number>();

    // Identify resource conflicts (same worker in overlapping date ranges)
    tasks.forEach((t1, i) => {
      if (!t1.assigned_to_details || t1.assigned_to_details.length === 0) return;
      for (let j = i + 1; j < tasks.length; j++) {
        const t2 = tasks[j];
        if (!t2.assigned_to_details || t2.assigned_to_details.length === 0) continue;

        const t1Members = Array.isArray(t1.assigned_to_details)
          ? t1.assigned_to_details.map((u: any) => u.id)
          : [t1.assigned_to_details.id];
        const t2Members = Array.isArray(t2.assigned_to_details)
          ? t2.assigned_to_details.map((u: any) => u.id)
          : [t2.assigned_to_details.id];
        const hasCommonWorker = t1Members.some((id: number) => t2Members.includes(id));
        if (!hasCommonWorker) continue;

        const start1 = new Date(t1.start_date).getTime();
        const end1 = t1.end_date ? new Date(t1.end_date).getTime() : start1;
        const start2 = new Date(t2.start_date).getTime();
        const end2 = t2.end_date ? new Date(t2.end_date).getTime() : start2;

        if (Math.max(start1, start2) <= Math.min(end1, end2)) {
          conflictTaskIds.add(t1.id);
          conflictTaskIds.add(t2.id);
        }
      }
    });

    const tracePredecessors = (taskId: number) => {
      if (criticalTaskIds.has(taskId)) return;
      criticalTaskIds.add(taskId);
      const t = tasks.find((x) => x.id === taskId);
      if (t && t.depends_on) {
        tracePredecessors(t.depends_on);
      }
    };

    // Mark terminal tasks (latest end date) and trace back depends_on to get critical path
    if (tasks.length > 0) {
      tasks.forEach((t) => {
        if (t.end_date && new Date(t.end_date).getTime() >= maxEndDateMs - 24 * 60 * 60 * 1000) {
          tracePredecessors(t.id);
        }
      });
    }

    return { criticalTaskIds, conflictTaskIds };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      const statusOk = filterStatuses[String(t.status ?? "pending")] !== false;
      if (!statusOk) return false;

      if (q) {
        const hay = `${t.phase ?? ""} ${t.task_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const urgency = getTaskUrgency(t);
      if (onlyOverdue && urgency !== "overdue") return false;
      if (onlyCritical && !analytics.criticalTaskIds.has(t.id)) return false;
      if (onlyConflicts && !analytics.conflictTaskIds.has(t.id)) return false;
      return true;
    });
  }, [tasks, filterQuery, filterStatuses, onlyOverdue, onlyCritical, onlyConflicts, analytics.criticalTaskIds, analytics.conflictTaskIds]);

  const filteredMilestones = useMemo(() => {
    // Keep milestones filter lightweight: only apply text search on name.
    const q = filterQuery.trim().toLowerCase();
    if (!q) return milestones;
    return milestones.filter((m) => String(m.name ?? "").toLowerCase().includes(q));
  }, [milestones, filterQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">
              Project Planning
            </h1>
          </div>
          <p className="text-slate-600">
            Timeline & Milestones
          </p>
        </div>
        <div className="flex gap-3 relative">
          <button
            onClick={() => setIsFilterOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Filter size={18} />
            <span className="text-sm font-medium">Filter</span>
          </button>

          {isFilterOpen && (
            <div className="absolute left-0 top-12 w-[360px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="text-sm font-bold text-slate-900">Filters</div>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition-colors"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search</div>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Phase or task name..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "pending", label: "To Do", cls: "bg-slate-50 border-slate-200 text-slate-700" },
                      { key: "on-track", label: "In Progress", cls: "bg-blue-50 border-blue-200 text-blue-700" },
                      { key: "completed", label: "Completed", cls: "bg-green-50 border-green-200 text-green-700" },
                      { key: "delayed", label: "Delayed", cls: "bg-red-50 border-red-200 text-red-700" },
                    ].map((s) => (
                      <label
                        key={s.key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none ${s.cls}`}
                      >
                        <input
                          type="checkbox"
                          checked={filterStatuses[s.key] !== false}
                          onChange={(e) => setFilterStatuses((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        <span className="text-sm font-semibold">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Flags</div>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
                      <div className="text-sm font-semibold text-slate-700">Only overdue / delayed</div>
                      <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} className="accent-red-600" />
                    </label>
                    <label className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
                      <div className="text-sm font-semibold text-slate-700">Only critical path</div>
                      <input type="checkbox" checked={onlyCritical} onChange={(e) => setOnlyCritical(e.target.checked)} className="accent-purple-600" />
                    </label>
                    <label className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
                      <div className="text-sm font-semibold text-slate-700">Only resource conflicts</div>
                      <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} className="accent-orange-600" />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setFilterQuery("");
                      setFilterStatuses({ pending: true, "on-track": true, completed: true, delayed: true });
                      setOnlyOverdue(false);
                      setOnlyCritical(false);
                      setOnlyConflicts(false);
                    }}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Reset
                  </button>
                  <div className="text-xs text-slate-500">
                    Showing <span className="font-bold text-slate-700">{filteredTasks.length}</span> task(s)
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={openAddMilestone}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">Add Milestone</span>
          </button>
          <button
            onClick={openAddTask}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">Add Task</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="text-blue-600" size={22} />
              <h2 className="text-xl font-bold text-slate-900">Construction Phases</h2>
            </div>
            <p className="text-sm text-slate-600">
              Use the standard 8-phase template or add custom phases, then schedule tasks inside each phase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSeedStandardPhases}
              disabled={!selectedProjectId || isSeedingPhases}
              className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <Sparkles size={18} />
              <span className="text-sm font-medium">
                {isSeedingPhases ? "Creating…" : "Generate Standard Phases"}
              </span>
            </button>
            <button
              type="button"
              onClick={openAddPhase}
              disabled={!selectedProjectId}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">Add Phase</span>
            </button>
          </div>
        </div>

        {!selectedProjectId ? (
          <p className="text-slate-500 text-sm py-6 text-center">Select a project to manage phases.</p>
        ) : phases.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-300 rounded-lg bg-slate-50">
            <p className="text-slate-600 mb-3">No phases defined for this project yet.</p>
            <button
              type="button"
              onClick={handleSeedStandardPhases}
              disabled={isSeedingPhases}
              className="text-blue-600 font-semibold hover:underline"
            >
              Generate the standard construction phases
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {phases.map((phase) => {
              const phaseTasks = tasksByPhaseId.map[phase.id] ?? [];
              const expanded = expandedPhaseIds[phase.id] !== false;
              return (
                <div
                  key={phase.id}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <button
                      type="button"
                      onClick={() => togglePhaseExpanded(phase.id)}
                      className="p-1 text-slate-500"
                      aria-label={expanded ? "Collapse" : "Expand"}
                    >
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditPhase(phase)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-400 w-6">
                          {phase.order}.
                        </span>
                        <span className="font-semibold text-slate-900">{phase.name}</span>
                        {phase.is_standard && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            Standard
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {phaseTasks.length} task{phaseTasks.length === 1 ? "" : "s"}
                        </span>
                        {phase.start_date && phase.end_date && (
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(phase.start_date).toLocaleDateString()} –{" "}
                            {new Date(phase.end_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {phase.description && (
                        <p className="text-xs text-slate-500 mt-0.5 ml-8 truncate">
                          {phase.description}
                        </p>
                      )}
                    </button>
                  </div>
                  {expanded && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-white">
                      {phaseTasks.length === 0 ? (
                        <p className="text-sm text-slate-500 italic py-2">
                          No tasks in this phase yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {phaseTasks.map((t) => (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => openEditTask(t)}
                                className="w-full flex items-center justify-between py-2.5 text-left hover:bg-slate-50 rounded px-2 -mx-2"
                              >
                                <span className="text-sm font-medium text-slate-800">
                                  {t.task_name}
                                </span>
                                <StatusBadge status={t.status} size="sm" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {tasksByPhaseId.unassigned.length > 0 && (
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                <p className="text-sm font-semibold text-amber-900 mb-2">
                  Tasks without a linked phase ({tasksByPhaseId.unassigned.length})
                </p>
                <ul className="space-y-1">
                  {tasksByPhaseId.unassigned.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => openEditTask(t)}
                        className="text-sm text-amber-900 hover:underline"
                      >
                        {t.phase}: {t.task_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {filteredMilestones.length > 0 ? (
          filteredMilestones.map((milestone, index) => (
            <div
              key={index}
              onClick={() => openEditMilestone(milestone)}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="text-blue-600" size={20} />
                  <StatusBadge status={milestone.status} size="sm" />
                </div>
                <Edit2 size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">
                {milestone.name}
              </h3>
              <p className="text-sm text-slate-600">
                {new Date(milestone.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          ))
        ) : (
          <div className="col-span-1 lg:col-span-4 text-center py-8 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
            <p className="text-slate-500 mb-4">No milestones defined yet.</p>
            <button onClick={openAddMilestone} className="text-blue-600 font-medium hover:underline">
              Create your first milestone
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            Project Timeline
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportTimelinePdf}
              disabled={!selectedProjectId || exportingTimeline !== null}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <FileText size={16} />
              {exportingTimeline === "pdf" ? "Generating…" : "PDF"}
            </button>
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              disabled={!selectedProjectId || exportingTimeline !== null}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Mail size={16} />
              Email
            </button>
            <button
              type="button"
              onClick={exportTimelineExcel}
              disabled={!selectedProjectId || exportingTimeline !== null}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Sheet size={16} />
              {exportingTimeline === "excel" ? "Generating…" : "Excel"}
            </button>
          </div>
          <div className="flex items-center gap-4 flex-wrap lg:ml-auto">
            <div className="flex items-center gap-2">
              <select 
                className="text-sm border border-slate-300 rounded-md px-2 py-1.5 outline-none text-slate-700 max-w-[200px]"
                value={selectedBaselineId || ""}
                onChange={(e) => setSelectedBaselineId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Live Timeline</option>
                {baselines.map(b => (
                  <option key={b.id} value={b.id}>Compare: {b.name}</option>
                ))}
              </select>
              {canEditBaseline && selectedBaselineId && (
                <button
                  onClick={handleDeleteSnapshot}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="Delete this snapshot"
                >
                  <Trash2 size={16} />
                </button>
              )}
              {canEditBaseline ? (
                <button 
                  onClick={handleSaveSnapshot}  
                  disabled={isSavingSnapshot}
                  className="text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md border border-slate-200 transition-colors"
                  title="Freeze current tasks into a comparative baseline"
                >
                  {isSavingSnapshot ? 'Saving...' : 'Save Snapshot'}
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic px-2" title="Baselines are managed by PM or Technical Director">
                  Baseline view only
                </span>
              )}
            </div>
            {viewMode === "gantt" && (
              <div className="hidden md:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Zoom</span>
                <input 
                  type="range" 
                  min="10" 
                  max="3000" 
                  step="10" 
                  value={zoomLevel} 
                  onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                  className="w-32 accent-blue-600 cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-semibold w-10 text-right">{zoomLevel}%</span>
              </div>
            )}
            <div className="bg-slate-100 p-1 rounded-lg inline-flex items-center shadow-inner">
            <button
              onClick={() => setViewMode("gantt")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "gantt"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Layout size={16} />
              Gantt View
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "calendar"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <CalendarDays size={16} />
              Calendar View
            </button>
          </div>
          </div>
        </div>

        {viewMode === "calendar" ? (
          <ProjectCalendar 
            tasks={filteredTasks} 
            milestones={filteredMilestones} 
            onTaskClick={openEditTask} 
            onMilestoneClick={openEditMilestone} 
          />
        ) : (
        <div className="overflow-x-auto custom-scrollbar pb-6 timeline-wrapper">
          <div className="transition-all duration-300 ease-out" style={{ width: `${zoomLevel}%` }}>
            <div className="flex border-b border-slate-200 pb-2 mb-4 h-12">
              <div className="w-64 font-semibold text-sm text-slate-700 flex items-end pb-2 shrink-0">
                Task
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] uppercase rounded font-bold ml-2">Critical Path</span>
              </div>
              <div className="flex-1 relative h-full text-[10px] text-slate-500 select-none">
                {Array.from({ length: Math.ceil(totalDuration / (1000 * 60 * 60 * 24)) }).map((_, i) => {
                  const d = new Date(minDate.getTime() + i * (1000 * 60 * 60 * 24));
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isMonthStart = d.getDate() === 1;
                  return (
                    <div 
                      key={i} 
                      className={`absolute top-0 bottom-0 flex flex-col items-center justify-end pb-1 ${isWeekend ? 'text-slate-300' : 'text-slate-600'} ${isMonthStart ? 'border-l border-blue-200' : ''}`}
                      style={{
                        left: `${(i / Math.ceil(totalDuration / (1000 * 60 * 60 * 24))) * 100}%`,
                        width: `${100 / Math.ceil(totalDuration / (1000 * 60 * 60 * 24))}%`
                      }}
                    >
                      {isMonthStart && (
                        <div className="absolute top-0 left-1 font-bold text-xs text-blue-600 whitespace-nowrap z-10">
                          {d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </div>
                      )}
                      <span className="truncate w-full text-center inline-block" title={d.toLocaleDateString()}>{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative space-y-3 z-0">
              {/* Vertical shaded blocks for weekends */}
              <div className="absolute inset-0 pointer-events-none flex" style={{ zIndex: -1 }}>
                <div className="w-64 shrink-0 pr-4"></div>
                <div className="flex-1 relative">
                  {Array.from({ length: Math.ceil(totalDuration / (1000 * 60 * 60 * 24)) }).map((_, i) => {
                    const d = new Date(minDate.getTime() + i * (1000 * 60 * 60 * 24));
                    if (d.getDay() !== 0 && d.getDay() !== 6) return null;
                    return (
                      <div 
                        key={i} 
                        className="absolute top-0 bottom-0 bg-slate-100/60 border-x border-slate-200/50"
                        style={{
                          left: `${(i / Math.ceil(totalDuration / (1000 * 60 * 60 * 24))) * 100}%`,
                          width: `${100 / Math.ceil(totalDuration / (1000 * 60 * 60 * 24))}%`
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {filteredTasks.length > 0 ? (() => {
                return filteredTasks.map((task, index) => {
                  const startPercent = getPercentage(task.start_date);
                  const endPercent = getPercentage(task.end_date);
                  const durationPercent = Math.max(1, endPercent - startPercent);
                  const isCritical = analytics.criticalTaskIds.has(task.id);
                  const hasConflict = analytics.conflictTaskIds.has(task.id);
                  const urgency = getTaskUrgency(task);

                  let baselineTask = null;
                  if (selectedBaselineId) {
                    const bl = baselines.find(b => b.id === selectedBaselineId);
                    if (bl && bl.baseline_tasks) {
                       baselineTask = bl.baseline_tasks.find((bt: any) => bt.original_task === task.id);
                    }
                  }

                  return (
                    <div key={index} className="flex items-center group relative">
                      <div className="w-64 pr-4 flex-shrink-0">
                        <div className="text-xs font-medium text-slate-500 mb-0.5 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            {task.phase}
                            {isCritical && <div className="w-1.5 h-1.5 rounded-full bg-purple-600 ml-1 shadow-sm animate-pulse" title="On Critical Path" />}
                            {urgency === "overdue" && <div className="w-1.5 h-1.5 rounded-full bg-red-600 ml-1 shadow-sm" title="Overdue / delayed" />}
                          </span>
                          {hasConflict && (
                            <span className="text-orange-500 flex items-center" title={`Resource Conflict: ${task.assigned_to_details?.first_name || 'Worker'} is assigned to overlapping tasks.`}>
                              <AlertTriangle size={12} />
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-sm font-medium transition-colors truncate ${
                            urgency === "overdue"
                              ? "text-red-700 group-hover:text-red-800"
                              : hasConflict
                                ? "text-orange-700 group-hover:text-orange-800"
                                : "text-slate-900 group-hover:text-blue-600"
                          }`}
                        >
                          {task.task_name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                          {task.assigned_to_details && task.assigned_to_details.length > 0 ? (
                             <><User size={10} className={hasConflict ? "text-orange-500" : ""} /> <span className={hasConflict ? "text-orange-600 font-semibold" : ""}>{Array.isArray(task.assigned_to_details) ? task.assigned_to_details.map((u: any) => u.first_name).join(", ") : task.assigned_to_details.first_name}</span></>
                          ) : (
                             <span className="italic">Unassigned</span>
                          )}
                        </div>
                      </div>
                      <div
                        className="flex-1 relative h-10 bg-slate-50 rounded cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (isDraggingRef.current) return;
                          openEditTask(task);
                        }}
                      >
                        {baselineTask && (
                           <div
                              className="absolute top-1/2 -translate-y-1/2 h-8 rounded border-2 border-dashed border-slate-300 bg-slate-200/40 pointer-events-none z-0"
                              style={{
                                 left: `${getPercentage(baselineTask.start_date)}%`,
                                 width: `${Math.max(1, getPercentage(baselineTask.end_date) - getPercentage(baselineTask.start_date))}%`,
                              }}
                              title={`Baseline bounds: ${baselineTask.start_date} to ${baselineTask.end_date}`}
                           />
                        )}
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-6 rounded shadow-sm overflow-hidden border z-10 ${
                            urgency === "overdue"
                              ? "bg-red-200 border-red-300"
                              : task.status === "completed"
                                ? "bg-green-200 border-green-300/60"
                                : task.status === "on-track"
                                  ? "bg-blue-200 border-blue-300/60"
                                  : "bg-slate-200 border-slate-300/60"
                          } ${isCritical ? "ring-2 ring-purple-300" : ""}`}
                          style={{
                            left: `${startPercent + (draggingTaskId === task.id ? dragOffsetDays * (100 / Math.ceil(totalDuration / (1000 * 60 * 60 * 24))) : 0)}%`,
                            width: `${durationPercent}%`,
                            cursor: draggingTaskId === task.id ? 'grabbing' : 'grab',
                            transition: draggingTaskId === task.id ? 'none' : 'left 0.2s',
                          }}
                          onPointerDown={(e) => handlePointerDown(e, task)}
                          title={`${task.start_date} to ${task.end_date} (${task.duration_working_days || 'N/A'} working days)${
                            urgency === "overdue" ? " - OVERDUE/DELAYED" : ""
                          }${isCritical ? " - CRITICAL PATH" : ""}`}
                        >
                          <div 
                             className={`absolute top-0 left-0 h-full transition-all ${
                               urgency === "overdue"
                                 ? "bg-red-600"
                                 : task.status === "completed"
                                   ? "bg-green-500"
                                   : task.status === "on-track"
                                     ? "bg-blue-500"
                                     : "bg-slate-500"
                             }`}
                             style={{ width: `${task.progress || 0}%` }}
                          ></div>
                          <div className="absolute inset-0 flex items-center px-2">
                            {(task.progress > 0 || task.status === "completed") && (
                              <span className="text-[10px] sm:text-xs font-bold text-white drop-shadow-md z-10 whitespace-nowrap overflow-hidden text-ellipsis">
                                {task.tracking_method === 'units' && task.unit_name
                                  ? `${task.completed_units} / ${task.target_units} ${task.unit_name} (${task.progress}%)`
                                  : task.status === "completed"
                                    ? "Completed"
                                    : `${task.progress}%`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })() : (
                 <div className="text-center text-sm text-slate-500 py-6 border-2 border-dashed border-slate-200 rounded-lg">
                   No tasks match the selected filters.
                 </div>
              )}

              <div className="pt-4 pb-2 mt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Project Milestones Tracker</div>
                {filteredMilestones.map((milestone, index) => {
                  const percent = getPercentage(milestone.date);
                  return (
                    <div key={`ms-${index}`} className="flex items-center mb-3 group hover:bg-slate-50 rounded-lg transition-colors p-1 -mx-1">
                      <div className="w-64 pr-4">
                        <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                           <div className="w-2 h-2 rotate-45 bg-purple-500"></div>
                           {milestone.name}
                        </div>
                      </div>
                      <div className="flex-1 relative h-8 rounded border-x border-slate-100/50">
                        {/* Reference Line */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-full border-b border-dashed border-slate-200"></div>
                        
                        {/* Milestone Diamond Marker */}
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 border-2 border-white cursor-pointer hover:scale-125 transition-transform shadow-md z-10 ${
                            milestone.status === 'completed' ? 'bg-green-500' : 
                            milestone.status === 'on-track' ? 'bg-blue-500' : 'bg-slate-400'
                          }`}
                          style={{
                            left: `calc(${percent}% - 8px)`
                          }}
                          title={`${milestone.name} - ${milestone.date}`}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-slate-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-slate-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-500 rounded"></div>
              <span className="text-slate-600">To Do</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-slate-600">Overdue / Delayed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-purple-300 bg-purple-100"></div>
              <span className="text-slate-600">Critical Path</span>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            Project Initialized:{" "}
            <span className="font-semibold text-slate-900">{minDate.toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <AddMilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        projectId={selectedProjectId || 0}
        milestone={editingMilestone}
        onSuccess={fetchMilestones}
      />
      <AddProjectPhaseModal
        isOpen={isPhaseModalOpen}
        onClose={() => setIsPhaseModalOpen(false)}
        projectId={selectedProjectId || 0}
        phase={editingPhase}
        allPhases={phases}
        onSuccess={() => {
          fetchPhases();
          fetchTasks();
        }}
      />
      <AddPhaseTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setDefaultPhaseId(null);
        }}
        projectId={selectedProjectId || 0}
        task={editingTask}
        tasks={tasks}
        phases={phases}
        defaultPhaseId={defaultPhaseId}
        onSuccess={() => {
          fetchTasks();
          fetchPhases();
        }}
      />

      {isEmailModalOpen && (
        <EmailReportModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          title="Email timeline report"
          description="Send the full project timeline PDF (with verification QR code) to a recipient."
          sending={exportingTimeline === "email"}
          onSend={sendTimelineEmail}
        />
      )}

    </div>
  );
}
