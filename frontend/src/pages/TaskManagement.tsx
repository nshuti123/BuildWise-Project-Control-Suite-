import { useState, useEffect, useMemo } from 'react';
import { Plus, User, Calendar, Briefcase, Search, Filter, AlertCircle, Clock } from "lucide-react";
import api from '../api';
import { AddTaskModal } from '../components/AddTaskModal';

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
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to_details?: UserDetails;
  project_details?: ProjectDetails;
}

export function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const resp = await api.get('/projects/tasks/');
      setTasks(resp.data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await api.patch(`/projects/tasks/${taskId}/`, { status: newStatus });
      fetchTasks();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // Derive unique assignees from tasks for the filter dropdown
  const uniqueAssignees = useMemo(() => {
    const assignees = new Map<number, { id: number; name: string }>();
    tasks.forEach(task => {
      if (task.assigned_to_details) {
        assignees.set(task.assigned_to_details.id, {
          id: task.assigned_to_details.id,
          name: task.assigned_to_details.full_name || 'Unknown'
        });
      }
    });
    return Array.from(assignees.values());
  }, [tasks]);

  // Apply filters linearly
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Text Search Match
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        task.title.toLowerCase().includes(searchLower) || 
        (task.description && task.description.toLowerCase().includes(searchLower));

      // 2. Priority Filter Match
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

      // 3. Assignee Filter Match
      const matchesAssignee = assigneeFilter === 'all' || 
        (assigneeFilter === 'unassigned' ? !task.assigned_to_details : task.assigned_to_details?.id.toString() === assigneeFilter);

      return matchesSearch && matchesPriority && matchesAssignee;
    });
  }, [tasks, searchQuery, priorityFilter, assigneeFilter]);

  const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');

  const columns = [
    { title: "To Do", id: 'pending', count: pendingTasks.length, tasks: pendingTasks },
    { title: "In Progress", id: 'in_progress', count: inProgressTasks.length, tasks: inProgressTasks },
    { title: "Completed", id: 'completed', count: completedTasks.length, tasks: completedTasks },
  ];

  const priorityColors = {
    high: "text-red-600 bg-red-50 border-red-200",
    medium: "text-orange-600 bg-orange-50 border-orange-200",
    low: "text-blue-600 bg-blue-50 border-blue-200",
  };

  const calculateWorkload = () => {
    const workloadMap = new Map<number, any>();
    
    tasks.forEach(task => {
      // Only count active tasks for workload against capacity
      if (task.status === 'completed') return;
      
      const user = task.assigned_to_details;
      if (!user) return;
      
      if (!workloadMap.has(user.id)) {
        workloadMap.set(user.id, {
          name: user.full_name || 'Unknown',
          role: user.role.replace('-', ' '),
          tasks: 0,
          capacity: 0
        });
      }
      
      const data = workloadMap.get(user.id);
      data.tasks += 1;
      // Rough capacity calc (10 tasks = 100%)
      data.capacity = Math.min(Math.round((data.tasks / 10) * 100), 100);
    });
    
    return Array.from(workloadMap.values()).sort((a, b) => b.tasks - a.tasks);
  };

  const workload = calculateWorkload();

  // Alert Summary Calcs (Only non-completed tasks)
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getTaskDateState = (dateStr?: string) => {
    if (!dateStr) return { isOverdue: false, isDueSoon: false };
    const taskDate = new Date(dateStr);
    taskDate.setHours(0, 0, 0, 0);
    
    const diffTime = taskDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      isOverdue: diffDays < 0,
      isDueSoon: diffDays === 0 || diffDays === 1
    };
  };

  const overdueCount = activeTasks.filter(t => getTaskDateState(t.date).isOverdue).length;
  const dueSoonCount = activeTasks.filter(t => getTaskDateState(t.date).isDueSoon).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Task Management
          </h1>
          <p className="text-slate-600">
            Company-wide Active Tasks Overview
          </p>
        </div>
        <button 
          onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">New Task</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks by title or description..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
          />
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <select 
               value={priorityFilter}
               onChange={(e) => setPriorityFilter(e.target.value)}
               className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 appearance-none transition-shadow"
             >
               <option value="all">All Priorities</option>
               <option value="high">High Priority</option>
               <option value="medium">Medium Priority</option>
               <option value="low">Low Priority</option>
             </select>
          </div>
          
          <div className="relative flex-1 md:w-48">
             <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <select
               value={assigneeFilter}
               onChange={(e) => setAssigneeFilter(e.target.value)}
               className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 appearance-none transition-shadow"
             >
               <option value="all">All Assignees</option>
               <option value="unassigned">Unassigned Only</option>
               {uniqueAssignees.map(u => (
                 <option key={u.id} value={u.id.toString()}>
                   {u.name}
                 </option>
               ))}
             </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                {column.title}
                <span className="text-xs font-semibold text-slate-500 bg-white shadow-sm border border-slate-200 px-2 py-0.5 rounded-full">
                  {column.count}
                </span>
              </h2>
            </div>

            <div className="space-y-3">
              {column.tasks.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white/50">
                  No tasks in this column
                </div>
              ) : column.tasks.map((task) => {
                const { isOverdue, isDueSoon } = getTaskDateState(task.date);
                const isCompleted = task.status === 'completed';
                
                const cardBorder = isCompleted ? 'border-slate-200' 
                                 : isOverdue ? 'border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)] bg-red-50/10' 
                                 : isDueSoon ? 'border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.3)] bg-orange-50/10' 
                                 : 'border-slate-200';

                return (
                <div
                  key={task.id}
                  onClick={() => { setEditingTask(task); setIsModalOpen(true); }}
                  className={`bg-white rounded-xl border p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer relative group ${cardBorder}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm leading-snug flex-1 pr-3 group-hover:text-blue-600 transition-colors">
                      {task.title}
                    </h3>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border font-bold shrink-0 ${priorityColors[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                      {(!isCompleted && (isOverdue || isDueSoon)) && (
                        <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          <Clock size={10} />
                          {isOverdue ? 'Overdue' : 'Due Soon'}
                        </div>
                      )}
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {task.project_details && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 bg-slate-50 py-1 px-2 rounded-md inline-flex border border-slate-100">
                      <Briefcase size={12} className="text-blue-500" />
                      <span className="font-medium truncate max-w-[180px]">{task.project_details.name}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 font-medium text-slate-700 bg-slate-100/80 px-2 py-1.5 rounded-md">
                      <div className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] uppercase shrink-0">
                        {task.assigned_to_details?.full_name ? task.assigned_to_details.full_name.charAt(0) : '?'}
                      </div>
                      <span className="truncate max-w-[100px]">
                        {task.assigned_to_details?.full_name || 'Unassigned'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        <span className="font-medium">
                          {task.date ? new Date(task.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : 'No date'}
                        </span>
                      </div>
                      
                      <div onClick={e => e.stopPropagation()}>
                        <select 
                          value={task.status}
                          onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                          className="text-[10px] font-semibold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 hover:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm transition-colors"
                        >
                          <option value="pending">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Complete</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden mb-6 animate-fade-in">
          <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-900">Critical Deadlines</h2>
                <p className="text-sm text-red-700 mt-0.5">Some tasks require immediate attention before they delay the project schedule.</p>
              </div>
            </div>
            <div className="flex gap-4">
              {overdueCount > 0 && (
                <div className="bg-white px-4 py-2 rounded-lg border border-red-200 shadow-sm text-center min-w-[90px]">
                  <p className="text-2xl font-black text-red-600 leading-none">{overdueCount}</p>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mt-1">Overdue</p>
                </div>
              )}
              {dueSoonCount > 0 && (
                <div className="bg-white px-4 py-2 rounded-lg border border-orange-200 shadow-sm text-center min-w-[90px]">
                  <p className="text-2xl font-black text-orange-600 leading-none">{dueSoonCount}</p>
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mt-1">Due Soon</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">Active Team Workload</h2>
          <p className="text-sm text-slate-500 mt-0.5">Capacity tracking based on active and pending tasks</p>
        </div>

        <div className="p-6">
          {workload.length === 0 ? (
            <div className="text-center py-6 text-slate-500">No active tasks assigned to team members yet.</div>
          ) : (
            <div className="space-y-6">
              {workload.map((member, index) => (
                <div key={index} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 bg-blue-50 border border-blue-100 shadow-sm rounded-full flex items-center justify-center text-blue-700 font-bold text-lg transition-transform group-hover:scale-105">
                    {member.name ? member.name.split(" ").map((n: string) => n.charAt(0)).join("").substring(0, 2) : '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="font-bold text-slate-900 capitalize">{member.name}</p>
                        <p className="text-xs font-medium text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded inline-block mt-0.5">{member.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {member.tasks} active tasks
                        </p>
                        <p className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${
                          member.capacity >= 90 ? "text-red-500" : member.capacity >= 70 ? "text-orange-500" : "text-green-500"
                        }`}>
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

      <AddTaskModal 
        isOpen={isModalOpen}
        onClose={() => {
           setIsModalOpen(false);
           setTimeout(() => setEditingTask(null), 200); // Wait for modal out-animation
        }}
        taskData={editingTask}
        onSuccess={() => {
          fetchTasks();
          setIsModalOpen(false);
          setTimeout(() => setEditingTask(null), 200);
        }}
      />
    </div>
  );
}
