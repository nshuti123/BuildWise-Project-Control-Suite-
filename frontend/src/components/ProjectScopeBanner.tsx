import { Building2 } from "lucide-react";

export function ProjectScopeBanner({
  projectName,
  context = "this page",
}: {
  projectName: string;
  context?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-900">
      <Building2 size={16} className="shrink-0 text-cyan-700" />
      <span>
        Showing {context} for{" "}
        <span className="font-semibold">{projectName}</span> only. Change project
        in the sidebar to switch context.
      </span>
    </div>
  );
}
