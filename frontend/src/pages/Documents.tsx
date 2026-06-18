import { useEffect, useMemo, useState } from "react";
import { FolderOpen } from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { ProjectDocumentsPanel } from "../components/ProjectDocumentsPanel";
import type { ProjectStaffData } from "../components/ProjectStaffPanel";

function toStaffProject(project: {
  id: number;
  name: string;
  manager_details?: ProjectStaffData["manager_details"];
  site_engineer_details?: ProjectStaffData["site_engineer_details"];
}): ProjectStaffData {
  return {
    id: project.id,
    name: project.name,
    manager_details: project.manager_details,
    site_engineer_details: project.site_engineer_details,
  };
}

export function Documents() {
  const { currentProjectId, projects } = useProject();
  const projectOptions = useMemo(
    () => projects.map((p) => toStaffProject(p)),
    [projects],
  );

  const [viewProjectId, setViewProjectId] = useState<number | null>(
    () => currentProjectId ?? projects[0]?.id ?? null,
  );

  useEffect(() => {
    if (currentProjectId) {
      setViewProjectId(currentProjectId);
    } else if (!viewProjectId && projects[0]?.id) {
      setViewProjectId(projects[0].id);
    }
  }, [currentProjectId, projects, viewProjectId]);

  const viewedProject = projectOptions.find((p) => p.id === viewProjectId);

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Documents</h1>
          <p className="text-slate-600">
            Supporting documents uploaded for each project — permits, plans, contracts, and more.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <FolderOpen size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600 font-medium">No projects available to show documents.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Documents</h1>
          <p className="text-slate-600">
            Supporting documents by project — construction permits, plans, contracts, and other files.
          </p>
        </div>
        <label className="flex flex-col gap-1.5 sm:min-w-[240px]">
          <span className="text-sm font-medium text-slate-700">View project</span>
          <select
            value={viewProjectId ?? ""}
            onChange={(e) => setViewProjectId(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {viewedProject && (
        <ProjectDocumentsPanel
          variant="page"
          allowProjectSelect
          projectOptions={projectOptions}
          project={viewedProject}
          onUploadSuccess={(projectId) => setViewProjectId(projectId)}
        />
      )}
    </div>
  );
}
