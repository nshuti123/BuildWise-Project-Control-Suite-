import { useEffect, useState } from "react";
import api from "../api";
import { useProject } from "../context/ProjectContext";
import {
  ProjectStaffPanel,
  type ProjectStaffData,
} from "../components/ProjectStaffPanel";

export function SiteEngineerProjectTeam() {
  const { currentProjectId, projects } = useProject();
  const [project, setProject] = useState<ProjectStaffData | null>(null);
  const [loading, setLoading] = useState(false);

  const projectName = projects.find((p) => p.id === currentProjectId)?.name;

  useEffect(() => {
    if (!currentProjectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get(`/projects/${currentProjectId}/`)
      .then((res) => {
        if (!cancelled) setProject(res.data);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setProject(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentProjectId]);

  if (!currentProjectId) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Select a project from the sidebar to manage site staff.</p>
      </div>
    );
  }

  if (loading || !project) {
    return <div className="p-8 text-center text-slate-500">Loading project team…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Project Team</h1>
        <p className="text-slate-600 mt-1">
          {projectName ? `${projectName} · ` : ""}
          Assign procurement officer and site foreman for this site
        </p>
      </div>
      <ProjectStaffPanel project={project} onUpdate={setProject} />
    </div>
  );
}
