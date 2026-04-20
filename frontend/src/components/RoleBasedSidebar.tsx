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
  Briefcase,
  HelpCircle,
  FileCheck,
  Clock,
} from "lucide-react";
import { NotificationsPopover } from "./NotificationsPopover";

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
            id: "tasks",
            name: "Tasks",
            icon: CheckSquare,
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
            id: "deliveries",
            name: "Deliveries",
            icon: Truck,
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
      case "admin":
        return [
          {
            id: "dashboard",
            name: "System Admin",
            icon: Shield,
          },
          {
            id: "users",
            name: "User Management",
            icon: Users,
          },
          {
            id: "payrolls",
            name: "Payroll Approvals",
            icon: DollarSign,
          },
          {
            id: "settings",
            name: "System Settings",
            icon: HardHat, // Using HardHat as a placeholder for settings if Settings icon isn't imported, but I should check imports.
            // Wait, I didn't import Settings. I should probably use existing icons or add Settings to import.
            // I'll use AlertTriangle or something available, or just Users which is available.
            // Actually, let's stick to available icons from the import list I saw earlier.
            // Imports: LayoutDashboard, Calendar, CheckSquare, DollarSign, Package, TrendingUp, FileText, MessageSquare, FolderOpen, Users, HardHat, ClipboardCheck, AlertTriangle, Camera, ShoppingCart, Truck, Image, LogOut, Shield.
            // I'll use ClipboardCheck for logs maybe?
          },
          {
            id: "logs",
            name: "System Logs",
            icon: ClipboardCheck,
          },
          {
            id: "communication",
            name: "Communication",
            icon: MessageSquare,
          },
        ];
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
      case "project-manager":
      default:
        return [
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
            id: "change-orders",
            name: "Change Orders",
            icon: FileCheck,
          },
          {
            id: "rfi",
            name: "RFI Tracker",
            icon: HelpCircle,
          },
          {
            id: "bidding",
            name: "Bidding",
            icon: Briefcase,
          },
          {
            id: "quality-control",
            name: "Quality Control",
            icon: ClipboardCheck,
          },
          {
            id: "timesheets",
            name: "Timesheets",
            icon: Clock,
          },
          {
            id: "resources",
            name: "Resources",
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

      <nav className="flex-1 overflow-y-auto py-4 space-y-1">
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
               <NotificationsPopover />
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
