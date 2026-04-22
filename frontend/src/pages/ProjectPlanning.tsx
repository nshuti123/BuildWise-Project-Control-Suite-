import { useState, useEffect } from "react";
import { Calendar, Plus, Filter, Download, Edit2 } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";
import { AddMilestoneModal } from "../components/AddMilestoneModal";
import { AddPhaseTaskModal } from "../components/AddPhaseTaskModal";
import api from "../api";

export function ProjectPlanning() {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const fetchMilestones = async () => {
    try {
      const response = await api.get('/projects/milestones/');
      setMilestones(response.data);
    } catch (err) {
      console.error("Failed to fetch milestones:", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get('/projects/phase-tasks/');
      setTasks(response.data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  useEffect(() => {
    fetchMilestones();
    fetchTasks();
  }, []);

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
    setIsTaskModalOpen(true);
  };

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

  const timeLabels = [];
  for (let i = 0; i <= 4; i++) {
    const d = new Date(minDate.getTime() + totalDuration * (i / 4));
    timeLabels.push(
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Project Planning
          </h1>
          <p className="text-slate-600">
            Riverside Mall Complex - Timeline & Milestones
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Filter size={18} />
            <span className="text-sm font-medium">Filter</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={18} />
            <span className="text-sm font-medium">Export</span>
          </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {milestones.length > 0 ? (
          milestones.map((milestone, index) => (
            <div
              key={index}
              onClick={() => openEditMilestone(milestone)}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="text-blue-600" size={20} />
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
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          Project Timeline - Gantt View
        </h2>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex border-b border-slate-200 pb-3 mb-4">
              <div className="w-64 font-semibold text-sm text-slate-700">
                Task
              </div>
              <div className="flex-1 flex justify-between text-xs text-slate-500 px-4">
                {timeLabels.map((lbl, i) => (
                  <span key={i} className={i === 0 || i === 4 ? "font-semibold text-slate-700" : ""}>{lbl}</span>
                ))}
              </div>
            </div>

            <div className="relative space-y-3 z-0">
              {/* Vertical shaded blocks for weekends */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 }}>
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

              {tasks.length > 0 ? tasks.map((task, index) => {
                const startPercent = getPercentage(task.start_date);
                const endPercent = getPercentage(task.end_date);
                const durationPercent = Math.max(1, endPercent - startPercent);

                return (
                  <div key={index} className="flex items-center group">
                    <div className="w-64 pr-4">
                      <div className="text-xs font-medium text-slate-500 mb-1">
                        {task.phase}
                      </div>
                      <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                        {task.task_name}
                      </div>
                    </div>
                    <div
                      className="flex-1 relative h-10 bg-slate-50 rounded cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => openEditTask(task)}
                    >
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-6 rounded shadow-sm overflow-hidden border border-black/5 ${
                          task.status === "completed"
                            ? "bg-green-200"
                            : task.status === "on-track"
                            ? "bg-blue-200"
                            : "bg-slate-200"
                        }`}
                        style={{
                          left: `${startPercent}%`,
                          width: `${durationPercent}%`,
                        }}
                        title={`${task.start_date} to ${task.end_date} (${task.duration_working_days || 'N/A'} working days)`}
                      >
                        <div 
                           className={`absolute top-0 left-0 h-full transition-all ${
                             task.status === "completed"
                               ? "bg-green-500"
                               : task.status === "on-track"
                               ? "bg-blue-500"
                               : "bg-slate-400"
                           }`}
                           style={{ width: `${task.progress || 0}%` }}
                        ></div>
                        <div className="absolute inset-0 flex items-center px-2">
                          {task.progress > 0 && (
                            <span className="text-[10px] sm:text-xs font-bold text-white drop-shadow-md z-10 whitespace-nowrap overflow-hidden text-ellipsis">
                              {task.tracking_method === 'units' && task.unit_name
                                ? `${task.completed_units} / ${task.target_units} ${task.unit_name} (${task.progress}%)`
                                : `${task.progress}%`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                 <div className="text-center text-sm text-slate-500 py-6 border-2 border-dashed border-slate-200 rounded-lg">No tasks scheduled for this project.</div>
              )}

              <div className="pt-4 pb-2 mt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Project Milestones Tracker</div>
                {milestones.map((milestone, index) => {
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
              <div className="w-4 h-4 bg-slate-300 rounded"></div>
              <span className="text-slate-600">Pending</span>
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
        projectId={1}
        milestone={editingMilestone}
        onSuccess={fetchMilestones}
      />
      <AddPhaseTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={1}
        task={editingTask}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
