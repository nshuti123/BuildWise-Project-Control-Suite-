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
  HardHat,
  ClipboardCheck,
  AlertTriangle,
  Camera,
  ShoppingCart,
  Truck,
  Image,
  LogOut,
  Shield,
  Crown,
  Landmark,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import { NotificationsPopover } from "./NotificationsPopover";
import { useProject } from "../context/ProjectContext";

interface RoleBasedSidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  userRole: string;
  userName?: string;
  userProfilePicture?: string;
  onProfileClick?: () => void;
  onLogout: () => void;
}
export function RoleBasedSidebar({
  activeModule,
  onModuleChange,
  userRole,
  userName = "Employee",
  userProfilePicture,
  onProfileClick,
  onLogout,
}: RoleBasedSidebarProps) {
  const { currentProjectId, setCurrentProjectId, projects } = useProject();

  const operationsMenu = (
    dashboard: { id: string; name: string; icon: typeof LayoutDashboard },
  ) => [
    dashboard,
    { id: "planning", name: "Project Planning", icon: Calendar },
    { id: "tasks", name: "Task Management", icon: CheckSquare },
    { id: "budget", name: "Budget & Costs", icon: DollarSign },
    { id: "procurement", name: "Procurement", icon: Package },
    { id: "site-inventory", name: "Site Inventory", icon: Package },
    { id: "progress", name: "Progress Monitor", icon: TrendingUp },
    { id: "reports", name: "Reports", icon: FileText },
    { id: "payrolls", name: "Payroll Operations", icon: FileText },
    { id: "workforce", name: "Workforce", icon: Users },
    { id: "users", name: "Team & Users", icon: Users },
    { id: "communication", name: "Communication", icon: MessageSquare },
    { id: "documents", name: "Documents", icon: FolderOpen },
  ];

  // Define menu items based on role
  const getMenuItems = () => {
    switch (userRole) {
      case "site-engineer":
        return [
          {
            id: "dashboard",
            name: "Site Operations",
            icon: HardHat,
          },
          {
            id: "project-team",
            name: "Project Team",
            icon: Users,
          },
          {
            id: "tasks",
            name: "Tasks",
            icon: CheckSquare,
          },
          {
            id: "site-inventory",
            name: "Site Inventory",
            icon: Package,
          },
          {
            id: "safety",
            name: "Safety Checks",
            icon: AlertTriangle,
          },
          {
            id: "logs",
            name: "Site Logs",
            icon: ClipboardCheck,
          },
          {
            id: "workforce",
            name: "Workforce Tracker",
            icon: Users,
          },
          {
            id: "photos",
            name: "Photo Gallery",
            icon: Camera,
          },
          {
            id: "communication",
            name: "Communication",
            icon: MessageSquare,
          },
        ];
      case "procurement-officer":
        return [
          {
            id: "dashboard",
            name: "Procurement",
            icon: ShoppingCart,
          },
          {
            id: "orders",
            name: "Purchase Orders",
            icon: FileText,
          },
          {
            id: "inventory",
            name: "Inventory",
            icon: Package,
          },
          {
            id: "suppliers",
            name: "Suppliers",
            icon: Users,
          },
          {
            id: "reports",
            name: "Cost Reports",
            icon: TrendingUp,
          },
          {
            id: "communication",
            name: "Communication",
            icon: MessageSquare,
          },
        ];
      case "client":
        return [
          {
            id: "dashboard",
            name: "Project Overview",
            icon: LayoutDashboard,
          },
          {
            id: "milestones",
            name: "Milestones",
            icon: Calendar,
          },
          {
            id: "budget",
            name: "Budget Summary",
            icon: DollarSign,
          },
          {
            id: "photos",
            name: "Progress Photos",
            icon: Image,
          },
          {
            id: "documents",
            name: "Documents",
            icon: FolderOpen,
          },
          {
            id: "communication",
            name: "Messages",
            icon: MessageSquare,
          },
        ];
      case "admin": {
        const adminOps = operationsMenu({
          id: "dashboard",
          name: "System Admin",
          icon: Shield,
        });
        return [
          adminOps[0],
          { id: "technical-approvals", name: "Approvals", icon: ShieldCheck },
          ...adminOps.slice(1),
          { id: "orders", name: "Purchase Orders", icon: ShoppingCart },
          { id: "suppliers", name: "Suppliers", icon: Users },
          { id: "logs", name: "System Logs", icon: ClipboardCheck },
        ];
      }
      case "subcontractor":
        return [
          {
            id: "dashboard",
            name: "My Tasks",
            icon: CheckSquare,
          },
          {
            id: "schedule",
            name: "Schedule",
            icon: Calendar,
          },
          {
            id: "photos",
            name: "Upload Work",
            icon: Camera,
          },
          {
            id: "communication",
            name: "Site Messages",
            icon: MessageSquare,
          },
        ];
      case "managing-director": {
        const execMenu = operationsMenu({
          id: "dashboard",
          name: "Executive Overview",
          icon: Crown,
        });
        return [
          execMenu[0],
          { id: "technical-approvals", name: "Technical Approvals", icon: ShieldCheck },
          ...execMenu.slice(1),
        ];
      }
      case "director-finance":
        return [
          { id: "dashboard", name: "Finance Overview", icon: Landmark },
          { id: "budget", name: "Budget Master", icon: DollarSign },
          { id: "payrolls", name: "Payroll Operations", icon: FileText },
          { id: "orders", name: "Purchase Orders", icon: Package },
          { id: "reports", name: "Cost Reports", icon: TrendingUp },
          { id: "communication", name: "Communication", icon: MessageSquare },
        ];
      case "technical-director":
        return [
          { id: "dashboard", name: "Technical Portfolio", icon: Wrench },
          { id: "technical-approvals", name: "Procurement Activity", icon: ShieldCheck },
          { id: "planning", name: "Project Planning", icon: Calendar },
          { id: "tasks", name: "Task Management", icon: CheckSquare },
          { id: "budget", name: "Budget & Costs", icon: DollarSign },
          { id: "procurement", name: "Procurement", icon: Package },
          { id: "suppliers", name: "Suppliers", icon: Truck },
          { id: "site-inventory", name: "Site Inventory", icon: Package },
          { id: "progress", name: "Progress Monitor", icon: TrendingUp },
          { id: "reports", name: "Reports", icon: FileText },
          { id: "workforce", name: "Workforce & Payroll", icon: Users },
          { id: "users", name: "All Users", icon: Users },
          { id: "documents", name: "Documents", icon: FolderOpen },
          { id: "communication", name: "Communication", icon: MessageSquare },
        ];
      case "site-foreman":
        return [
          { id: "dashboard", name: "Field Operations", icon: HardHat },
          { id: "site-inventory", name: "Site Inventory", icon: Package },
          { id: "workforce", name: "Workforce", icon: Users },
          { id: "payrolls", name: "Payroll", icon: FileText },
          { id: "tasks", name: "Task Management", icon: CheckSquare },
          { id: "communication", name: "Communication", icon: MessageSquare },
        ];
      case "accountant":
        return [
          {
            id: "dashboard",
            name: "Overview",
            icon: LayoutDashboard,
          },
          {
            id: "budget",
            name: "Budget Master",
            icon: DollarSign,
          },
          {
            id: "payrolls",
            name: "Payroll Operations",
            icon: FileText,
          },
          {
            id: "reports",
            name: "Cost Reports",
            icon: TrendingUp,
          },
          {
            id: "communication",
            name: "Communication",
            icon: MessageSquare,
          },
        ];
      case "safety-officer":
        return [
          { id: "dashboard", name: "Safety Overview", icon: AlertTriangle },
          { id: "safety", name: "Safety Checks", icon: Shield },
          { id: "communication", name: "Communication", icon: MessageSquare },
        ];
      case "project-manager":
      default:
        return [
          {
            id: "dashboard",
            name: "Overview",
            icon: LayoutDashboard,
          },
          {
            id: "technical-approvals",
            name: "Technical Approvals",
            icon: ShieldCheck,
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
            id: "site-inventory",
            name: "Site Inventory",
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
            id: "workforce",
            name: "Workforce",
            icon: Users,
          },
        ];
    }
  };
  const menuItems = getMenuItems();
  const getRoleLabel = () => {
    switch (userRole) {
      case "site-engineer":
        return "Site Engineer";
      case "procurement-officer":
        return "Procurement Officer";
      case "client":
        return "Client";
      case "admin":
        return "System Administrator";
      case "subcontractor":
        return "Subcontractor";
      case "accountant":
        return "Accountant";
      case "managing-director":
        return "Managing Director";
      case "director-finance":
        return "Director of Finance";
      case "technical-director":
        return "Technical Director";
      case "site-foreman":
        return "Site Foreman";
      case "safety-officer":
        return "Safety Officer";
      case "project-manager":
        return "Project Manager";
      default:
        return "User";
    }
  };
  return (
    <div className="w-64 bg-slate-900 text-white h-[125vh] fixed left-0 top-0 flex flex-col shadow-xl z-50">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-orange-500/20">
            BW
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">BuildWise</h1>
            <p className="text-xs text-slate-400">Project Control Suite</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar flex flex-col">
        {projects.length > 0 && (
          <div className="mb-6 pb-6 border-b border-slate-800">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block px-6">
              Active Project
            </label>
            <div className="px-4">
              <select
                value={currentProjectId || ""}
                onChange={(e) => setCurrentProjectId(Number(e.target.value))}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none relative font-medium"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right .7rem top 50%",
                  backgroundSize: ".65rem auto"
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition-all duration-200 relative group ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-r"></div>
              )}
              <Icon
                size={20}
                className={
                  isActive
                    ? "text-white"
                    : "text-slate-400 group-hover:text-white"
                }
              />
              <span className="text-sm font-medium">{item.name}</span>
            </button>
          );
        })}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between mb-4 gap-2">
            <div
              onClick={onProfileClick}
              className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors group flex-1 min-w-0"
            >
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center border-2 border-slate-600 overflow-hidden relative shrink-0">
                {userProfilePicture ? (
                  <img
                    src={userProfilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users size={20} className="text-slate-300" />
                )}
                <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                  <Camera size={16} className="text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-slate-400 truncate">{getRoleLabel()}</p>
              </div>
            </div>
            
            <div className="shrink-0">
               <NotificationsPopover onNavigate={onModuleChange} />
            </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 transition-colors text-sm font-medium border border-slate-700 hover:border-red-900/50"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
