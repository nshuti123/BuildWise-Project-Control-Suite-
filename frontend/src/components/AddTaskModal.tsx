import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, MapPin, AlertCircle, Briefcase, User } from 'lucide-react';
import api from '../api';

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
}

export function AddTaskModal({ isOpen, onClose, onSuccess, taskData }: AddTaskModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    project: '',
    title: '',
    description: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    time_str: '09:00 AM',
    priority: 'medium',
    status: 'pending',
    assigned_to: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      if (taskData) {
        setFormData({
          title: taskData.title || '',
          description: taskData.description || '',
          location: taskData.location || '',
          date: taskData.date || new Date().toISOString().split('T')[0],
          time_str: taskData.time_str || '09:00 AM',
          priority: taskData.priority || 'medium',
          status: taskData.status || 'pending',
          project: taskData.project_details ? taskData.project_details.id.toString() : '',
          assigned_to: taskData.assigned_to_details ? taskData.assigned_to_details.id.toString() : ''
        });
      } else {
        // Reset form on open
        setFormData(prev => ({
          ...prev,
          title: '',
          description: '',
          location: '',
          date: new Date().toISOString().split('T')[0],
          time_str: '09:00 AM',
          priority: 'medium',
          status: 'pending',
          project: projects.length > 0 ? projects[0].id.toString() : '',
          assigned_to: ''
        }));
      }
      setError('');
    }
  }, [isOpen, taskData]);

  const fetchProjects = async () => {
    try {
      const resp = await api.get('/projects/');
      setProjects(resp.data);
      if (resp.data.length > 0 && !formData.project) {
        setFormData(prev => ({ ...prev, project: resp.data[0].id.toString() }));
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  const getTeamMembers = () => {
    if (!formData.project) return [];
    const proj = projects.find(p => p.id.toString() === formData.project);
    if (!proj) return [];
    
    const users: UserDetails[] = [];
    if (proj.manager_details) users.push(proj.manager_details);
    if (proj.site_engineer_details) users.push(proj.site_engineer_details);
    if (proj.subcontractor_details) users.push(...proj.subcontractor_details);
    
    // Deduplicate by id
    return Array.from(new Map(users.map(u => [u.id, u])).values());
  };

  const teamMembers = getTeamMembers();

  // Reset assigned_to if it's not in the team members list
  useEffect(() => {
    if (formData.project && teamMembers.length > 0) {
      if (!formData.assigned_to || !teamMembers.find(u => u.id.toString() === formData.assigned_to)) {
        setFormData(prev => ({ ...prev, assigned_to: teamMembers[0].id.toString() }));
      }
    }
  }, [formData.project, projects]); // Re-run when project or projects change

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.project) {
      setError('Please select a project');
      setLoading(false);
      return;
    }

    try {
      // Create payload. If assigned_to is empty, we don't send it, letting backend use default.
      const payload: any = { ...formData };
      if (!payload.assigned_to) {
          delete payload.assigned_to;
      }

      if (taskData) {
        // Edit mode
        await api.patch(`/projects/tasks/${taskData.id}/`, payload);
      } else {
        // Create mode
        await api.post('/projects/tasks/', payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create task:', err);
      setError(err.response?.data?.detail || 'Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-slate-900">{taskData ? 'Edit Task' : 'Add New Task'}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                required
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
              >
                <option value="" disabled>Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              placeholder="e.g. Inspect scaffolding"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none h-24 resize-none transition-all"
              placeholder="Provide a detailed description or instructions..."
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                required
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
              >
                <option value="" disabled>Select Team Member</option>
                {teamMembers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role.replace('-',' ')})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Location / Zone</label>
             <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="e.g. Block B, Level 2"
              />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={formData.time_str}
                  onChange={(e) => setFormData({ ...formData, time_str: e.target.value })}
                  placeholder="e.g. 09:00 AM"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <div className="grid grid-cols-3 gap-3">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p })}
                  className={`py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                    formData.priority === p
                      ? p === 'high' ? 'bg-red-50 text-red-700 border-red-200'
                      : p === 'medium' ? 'bg-orange-50 text-orange-700 border-orange-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
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
              {loading ? 'Saving...' : taskData ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
