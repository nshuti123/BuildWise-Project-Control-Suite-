import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  HardHat,
  Users,
  Plus,
  Check,
  X as XIcon,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import api from "../api";
import { formatBudget } from "../utils/formatters";

interface Location {
  id: number;
  name: string;
  level: string;
  parent?: number;
}

interface Project {
  id: number;
  name: string;
  location: string | number;
  address_line_2?: string;
  location_details?: Location;
  budget: string;
  deadline: string;
  progress: number;
  construction_type: string;
  status: "on-track" | "at-risk" | "delayed" | "completed";
  manager_details?: {
    id: number;
    email: string;
    full_name: string;
    username: string;
  };
  site_engineer_details?: {
    id: number;
    email: string;
    full_name: string;
    username: string;
  };
  subcontractor_details?: any[];
}

interface ProjectWorkspaceProps {
  project: Project;
  onBack: () => void;
  onUpdate: (updatedProject: Project) => void;
}

export function ProjectWorkspace({ project, onBack, onUpdate }: ProjectWorkspaceProps) {
  const [engineersList, setEngineersList] = useState<{id: number, full_name: string, username: string, email: string}[]>([]);
  const [isAssigningEngineer, setIsAssigningEngineer] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>("");
  const [assigningError, setAssigningError] = useState("");

  useEffect(() => {
    api.get("/projects/site_engineers/")
      .then((res) => setEngineersList(res.data))
      .catch(console.error);
  }, []);

  const handleAssignEngineer = async () => {
    if (!selectedEngineerId) return;
    try {
      setAssigningError("");
      const response = await api.patch(`/projects/${project.id}/`, { site_engineer: parseInt(selectedEngineerId) });
      onUpdate(response.data);
      setIsAssigningEngineer(false);
    } catch (err) {
      setAssigningError("Failed to assign engineer");
    }
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
            <StatusBadge status={project.status} size="md" />
          </div>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Building2 size={16} />
            <span className="capitalize">{project.construction_type || "Unknown"} Construction</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Project Details
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <MapPin size={16} /> Location
                </span>
                <p className="text-slate-900 font-medium">
                  {project.location_details ? project.location_details.name : project.location}
                </p>
              </div>
              
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <MapPin size={16} /> Address Line 2
                </span>
                <p className="text-slate-900 font-medium">
                  {project.address_line_2 || "Not provided"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <DollarSign size={16} /> Budget
                </span>
                <p className="text-slate-900 font-medium">
                  {formatBudget(project.budget) || "TBD"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <Clock size={16} /> Target Deadline
                </span>
                <p className="text-slate-900 font-medium">
                  {project.deadline
                    ? new Date(project.deadline).toLocaleDateString()
                    : "Not set"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <HardHat size={16} /> Project Manager
                </span>
                <p className="text-slate-900 font-medium">
                  {project.manager_details
                    ? project.manager_details.full_name || project.manager_details.username || project.manager_details.email
                    : "Unassigned"}
                </p>
              </div>

              {/* Site Engineer Section */}
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <HardHat size={16} className="text-blue-500" /> Site Engineer
                </span>
                {isAssigningEngineer ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedEngineerId}
                        onChange={(e) => setSelectedEngineerId(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select Engineer</option>
                        {engineersList.map((eng) => (
                          <option key={eng.id} value={eng.id}>
                            {eng.full_name || eng.username || eng.email}
                          </option>
                        ))}
                      </select>
                      <button onClick={handleAssignEngineer} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setIsAssigningEngineer(false)} className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
                        <XIcon size={16} />
                      </button>
                    </div>
                    {assigningError && <p className="text-xs text-red-600">{assigningError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-slate-900 font-medium">
                      {project.site_engineer_details
                        ? project.site_engineer_details.full_name || project.site_engineer_details.username || project.site_engineer_details.email
                        : "Unassigned"}
                    </p>
                    <button
                      onClick={() => setIsAssigningEngineer(true)}
                      className="text-xs text-blue-600 font-medium hover:text-blue-700 px-2 py-1 bg-blue-50 rounded"
                    >
                      {project.site_engineer_details ? "Change" : "Assign"}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 col-span-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-500">Overall Progress</span>
                  <span className="font-bold text-slate-900">{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      project.status === "delayed"
                        ? "bg-red-500"
                        : project.status === "at-risk"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
             <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-blue-600"/>
                Subcontractors
              </h2>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors shadow-sm">
                <Plus size={16} />
                Assign Subcontractor
              </button>
            </div>
            
            {(!project.subcontractor_details || project.subcontractor_details.length === 0) ? (
              <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                <Users size={32} className="mx-auto text-slate-400 mb-3" />
                <p className="text-slate-600 font-medium">No Subcontractors Assigned</p>
                <p className="text-sm text-slate-500 mt-1">Assign subcontractors to divide the project workload.</p>
              </div>
            ) : (
              <div className="space-y-3">
                 {/* This will be populated in the next step */}
                 <p className="text-slate-500 italic text-sm">Subcontractors rendering pending...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-xl shadow-lg p-6 text-white text-center">
             <HardHat size={48} className="mx-auto text-blue-400 mb-4 opacity-80" />
             <h3 className="text-lg font-bold mb-2">Project Control Center</h3>
             <p className="text-slate-400 text-sm mb-6">Use this workspace to manage tasks, review financials, and orchestrate assignments efficiently.</p>
             <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-md">
                Add New Task
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
