import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../api";
import { asList } from "../utils/apiHelpers";
import { useAuth } from "./AuthContext";

export interface Project {
  id: number;
  name: string;
  location?: string | number;
  location_details?: {
    id: number;
    name: string;
    level: string;
  };
  address_line_2?: string;
  budget?: string;
  budget_amount?: number | string;
  deadline: string;
  progress: number;
  status: "on-track" | "at-risk" | "delayed" | "completed" | "pending";
  construction_type: string;
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
  subcontractor_details?: Record<string, unknown>[];
}

interface ProjectContextType {
  currentProjectId: number | null;
  setCurrentProjectId: (id: number | null) => void;
  projects: Project[];
  loadingProjects: boolean;
  refreshProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const fetchProjects = async () => {
    if (!user) return;
    try {
      setLoadingProjects(true);
      const response = await api.get("/projects/?page_size=500");
      const list = asList<Project>(response.data);
      setProjects(list);

      if (list.length > 0 && !currentProjectId) {
        setCurrentProjectId(list[0].id);
      } else if (list.length === 0) {
        setCurrentProjectId(null);
      }
    } catch (err) {
      console.error("Failed to fetch projects for context:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  // Keep selection valid if projects change
  useEffect(() => {
    if (projects.length > 0 && currentProjectId) {
      const exists = projects.some(p => p.id === currentProjectId);
      if (!exists) {
        setCurrentProjectId(projects[0].id);
      }
    }
  }, [projects, currentProjectId]);

  return (
    <ProjectContext.Provider
      value={{
        currentProjectId,
        setCurrentProjectId,
        projects,
        loadingProjects,
        refreshProjects: fetchProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
