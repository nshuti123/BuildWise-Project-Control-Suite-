import { useState, useEffect } from "react";
import api from "../api";
import {
  CheckSquare,
  Users,
  ClipboardCheck,
  Clock,
  UserPlus,
  ArrowRight,
  FileText,
  Package,
  type LucideIcon,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { asList } from "../utils/apiHelpers";
import { SiteIncidentsPanel } from "../components/SiteIncidentsPanel";

interface SiteForemanDashboardProps {
  setActiveModule?: (module: string) => void;
}

export function SiteForemanDashboard({ setActiveModule }: SiteForemanDashboardProps) {
  const { currentProjectId, projects } = useProject();
  const [tasks, setTasks] = useState<any[]>([]);
  const [workerCount, setWorkerCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const projectName = projects.find((p) => p.id === currentProjectId)?.name;

  useEffect(() => {
    const load = async () => {
      if (!currentProjectId) {
        setTasks([]);
        setWorkerCount(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [tasksRes, workersRes] = await Promise.all([
          api.get(`/projects/tasks/?project=${currentProjectId}&page_size=500`),
          api.get(`/workforce/workers/?project=${currentProjectId}&page_size=500`),
        ]);
        const taskList = asList(tasksRes.data);
        setTasks(taskList.filter((t: any) => t.status !== "completed"));
        const workers = asList(workersRes.data);
        setWorkerCount(workers.filter((w: any) => w.is_active !== false).length);
      } catch (e) {
        console.error(e);
        setTasks([]);
        setWorkerCount(null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentProjectId]);

  const goTo = (module: string) => {
    setActiveModule?.(module);
  };

  if (!currentProjectId) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Retrieving project data...</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading site dashboard...</div>;
  }

  const inProgress = tasks.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Field Operations</h1>
        <p className="text-slate-500 mt-1">
          {projectName ? `${projectName} · ` : ""}
          Crew, attendance, and task visibility for the site
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={CheckSquare} label="Open tasks" value={tasks.length} />
        <Stat icon={Users} label="Active workers" value={workerCount ?? "—"} />
        <Stat icon={Clock} label="In progress" value={inProgress} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <QuickLink
          icon={Users}
          title="Workforce"
          description="View crew, add workers, and mark daily attendance"
          onClick={() => goTo("workforce")}
        />
        <QuickLink
          icon={CheckSquare}
          title="Task Management"
          description="View task board, deadlines, and assignments (read-only)"
          onClick={() => goTo("tasks")}
        />
        <QuickLink
          icon={UserPlus}
          title="Add worker"
          description="Register a new laborer on this project"
          onClick={() => goTo("workforce")}
        />
        <QuickLink
          icon={Package}
          title="Site Inventory"
          description="Request materials from warehouse — approved by Site Engineer then Procurement"
          onClick={() => goTo("site-inventory")}
        />
        <QuickLink
          icon={FileText}
          title="Payroll"
          description="Initiate daily payroll from attendance for your crew"
          onClick={() => goTo("payrolls")}
        />
      </div>

      <SiteIncidentsPanel
        projectId={currentProjectId}
        projectName={projectName}
        canLog
        maxOpenShown={5}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <ClipboardCheck size={20} /> Active tasks
          </h2>
          <button
            type="button"
            onClick={() => goTo("tasks")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            View all <ArrowRight size={16} />
          </button>
        </div>
        <ul className="space-y-2">
          {tasks.slice(0, 8).map((t) => (
            <li key={t.id} className="flex justify-between py-2 border-b border-slate-100 text-sm">
              <span className="font-medium text-slate-800">{t.title}</span>
              <span className="text-slate-500 capitalize">{t.status?.replace("_", " ")}</span>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="text-slate-500 text-sm">No open tasks on this project</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <Icon size={22} className="text-orange-500 mb-2" />
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-orange-300 hover:shadow-md transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:bg-orange-100">
        <Icon size={22} />
      </div>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 mt-3">
        Open <ArrowRight size={14} />
      </span>
    </button>
  );
}
