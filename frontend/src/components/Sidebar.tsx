import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  DollarSign,
  Package,
  TrendingUp,
  FileText,
  MessageSquare,
  FolderOpen,
  Users,
} from "lucide-react";
interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}
export function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  const modules = [
    {
      id: "dashboard",
      name: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "planning",
      name: "Project Planning",
      icon: Calendar,
    },
    {
      id: "tasks",
      name: "Task Management",
      icon: CheckSquare,
    },
    {
      id: "budget",
      name: "Budget & Costs",
      icon: DollarSign,
    },
    {
      id: "procurement",
      name: "Procurement",
      icon: Package,
    },
    {
      id: "progress",
      name: "Progress Monitor",
      icon: TrendingUp,
    },
    {
      id: "reports",
      name: "Reports",
      icon: FileText,
    },
    {
      id: "communication",
      name: "Communication",
      icon: MessageSquare,
    },
    {
      id: "documents",
      name: "Documents",
      icon: FolderOpen,
    },
    {
      id: "resources",
      name: "Resources",
      icon: Users,
    },
  ];
  return (
    <div className="w-64 bg-slate-900 text-white h-[125vh] fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-xl">
            BW
          </div>
          <div>
            <h1 className="font-bold text-lg">BuildWise</h1>
            <p className="text-xs text-slate-400">Project Control Suite</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {modules.map((module) => {
          const Icon = module.icon;
          const isActive = activeModule === module.id;
          return (
            <button
              key={module.id}
              onClick={() => onModuleChange(module.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition-colors ${isActive ? "bg-blue-600 text-white border-l-4 border-orange-500" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{module.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
            <Users size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">John Manager</p>
            <p className="text-xs text-slate-400">Project Manager</p>
          </div>
        </div>
      </div>
    </div>
  );
}
