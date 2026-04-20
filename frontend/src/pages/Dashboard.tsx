import { useState, useEffect } from "react";
import api from "../api";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { ProjectWorkspace } from "../components/ProjectWorkspace";
import { formatBudget } from "../utils/formatters";
import {
  Building2,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  Plus,
  HardHat,
} from "lucide-react";

interface Project {
  id: number;
  name: string;
  location: string | number;
  location_details?: {
    id: number;
    name: string;
    level: string;
  };
  address_line_2?: string;
  budget: string;
  deadline: string;
  progress: number;
  construction_type: string;
  status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  manager_details?: {
    id: number;
    email: string;
    full_name: string;
    username: string;
  };
  subcontractor_details?: any[];
}
export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects/');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects', error);
    } finally {
      setLoading(false);
    }
  };
  const recentActivities = [
    {
      action: "Budget approved",
      project: "Riverside Mall Complex",
      time: "2 hours ago",
      type: "success",
    },
    {
      action: "Delay reported",
      project: "Industrial Warehouse",
      time: "4 hours ago",
      type: "warning",
    },
    {
      action: "Milestone completed",
      project: "Residential Estate Phase 2",
      time: "1 day ago",
      type: "success",
    },
    {
      action: "Material delivered",
      project: "Corporate Office Tower",
      time: "1 day ago",
      type: "info",
    },
  ];

  if (selectedProject) {
    return (
      <ProjectWorkspace 
        project={selectedProject} 
        onBack={() => {
          setSelectedProject(null);
          fetchProjects(); // Refresh the list
        }} 
        onUpdate={(upd: Project) => {
          setSelectedProject(upd);
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Project Overview
        </h1>
        <p className="text-slate-600">
          Monitor all active construction projects and key metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Projects"
          value={projects.length.toString()}
          change="Live Sync"
          changeType="neutral"
          icon={Building2}
          iconColor="bg-blue-600"
        />
        <MetricCard
          title="Total Budget"
          value="Rwf1.2B"
          change="85% utilized"
          changeType="neutral"
          icon={DollarSign}
          iconColor="bg-green-600"
        />
        <MetricCard
          title="Team Members"
          value="156"
          change="+8 this week"
          changeType="positive"
          icon={Users}
          iconColor="bg-purple-600"
        />
        <MetricCard
          title="Avg. Completion"
          value="67%"
          change="+5% vs last month"
          changeType="positive"
          icon={TrendingUp}
          iconColor="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Active Projects
            </h2>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading projects...</div>
            ) : projects.length === 0 ? (
               <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">No projects found. Create one to get started!</div>
            ) : projects.map((project) => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="border border-slate-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all shadow-sm bg-white"
              >
                <div className="flex flex-col items-start justify-between mb-3 gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                      {project.name}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold capitalize tracking-wide shadow-sm border border-slate-200">
                        {project.construction_type || 'Unknown'}
                      </span>
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <DollarSign size={14} className="text-slate-400" />
                        {formatBudget(project.budget) || "TBD"}
                      </span>
                      <div className="flex items-center gap-1.5 opacity-80 mt-1 sm:mt-0 max-w-xs">
                      <HardHat size={14} className="shrink-0" />
                      <span className="text-xs truncate">
                        {project.manager_details ? project.manager_details.full_name || project.manager_details.username || project.manager_details.email : 'Unassigned'}
                      </span>
                    </div>
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-slate-400" />
                        Due {project.deadline ? new Date(project.deadline).toLocaleDateString() : "TBD"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={project.status} size="sm" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Progress</span>
                    <span className="font-semibold text-slate-900">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${project.status === "delayed" ? "bg-red-500" : project.status === "at-risk" ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{
                        width: `${project.progress}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Recent Activity
          </h2>

          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex gap-3">
                <div
                  className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${activity.type === "success" ? "bg-green-500" : activity.type === "warning" ? "bg-yellow-500" : "bg-blue-500"}`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {activity.action}
                  </p>
                  <p className="text-sm text-slate-600">{activity.project}</p>
                  <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full mt-6 text-sm text-blue-600 hover:text-blue-700 font-medium text-center py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            View All Activity
          </button>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle
          className="text-orange-600 flex-shrink-0 mt-0.5"
          size={20}
        />
        <div>
          <h3 className="font-semibold text-orange-900 mb-1">
            Attention Required
          </h3>
          <p className="text-sm text-orange-800">
            Industrial Warehouse project is behind schedule. Review task
            assignments and resource allocation.
          </p>
        </div>
      </div>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchProjects}
      />
    </div>
  );
}
