import { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { RoleBasedSidebar } from "./components/RoleBasedSidebar";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { ProjectPlanning } from "./pages/ProjectPlanning";
import { TaskManagement } from "./pages/TaskManagement";
import { BudgetControl } from "./pages/BudgetControl";
import { MaterialProcurement } from "./pages/MaterialProcurement";
import { ProgressMonitoring } from "./pages/ProgressMonitoring";
import { Reports } from "./pages/Reports";
import { Communication } from "./pages/Communication";
import { Documents } from "./pages/Documents";
import { Resources } from "./pages/Resources";
import { SiteEngineerDashboard } from "./pages/SiteEngineerDashboard";
import { ProcurementOfficerDashboard } from "./pages/ProcurementOfficerDashboard";
import { ClientDashboard } from "./pages/ClientDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { UserManagement } from "./pages/UserManagement";
import { SubcontractorDashboard } from "./pages/SubcontractorDashboard";
import { ChangeOrders } from "./pages/ChangeOrders";
import { RFI } from "./pages/RFI";
import { Bidding } from "./pages/Bidding";
import { QualityControl } from "./pages/QualityControl";
import { Timesheets } from "./pages/Timesheets";
import { Inventory } from "./pages/Inventory";
import { Suppliers } from "./pages/Suppliers";
import { WorkforceManagement } from "./pages/WorkforceManagement";
import { PayrollApprovals } from "./pages/PayrollApprovals";
import { AccountantDashboard } from "./pages/AccountantDashboard";
import { ProfileModal } from "./components/ProfileModal";

export function App() {
  const { user, isLoading, logout, fetchUser } = useAuth();
  const [activeModule, setActiveModule] = useState("dashboard");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Reset module to dashboard when logged out to ensure fresh state on next login
  useEffect(() => {
    if (!user) {
      setActiveModule("dashboard");
    }
  }, [user]);

  // Keep the user safe from flickering before JWT is verified
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const userRole = user.role;
  const renderModule = () => {
    // Role-specific dashboard routing
    if (activeModule === "dashboard") {
      switch (userRole) {
        case "site-engineer":
          return <SiteEngineerDashboard />;
        case "procurement-officer":
          return <ProcurementOfficerDashboard />;
        case "client":
          return <ClientDashboard />;
        case "admin":
          return <AdminDashboard />;
        case "subcontractor":
          return <SubcontractorDashboard />;
        case "accountant":
          return <AccountantDashboard />;
        case "project-manager":
        default:
          return <Dashboard />;
      }
    }
    // Common modules (accessible based on sidebar configuration)
    switch (activeModule) {
      case "planning":
        return <ProjectPlanning />;
      case "tasks":
        return <TaskManagement />;
      case "budget":
        return <BudgetControl />;
      case "procurement":
        return <MaterialProcurement />;
      case "progress":
        return <ProgressMonitoring />;
      case "reports":
        return <Reports />;
      case "communication":
        return <Communication />;
      case "documents":
        return <Documents />;
      case "resources":
        return <Resources />;
      case "change-orders":
        return <ChangeOrders />;
      case "rfi":
        return <RFI />;
      case "bidding":
        return <Bidding />;
      case "quality-control":
        return <QualityControl />;
      case "timesheets":
        return <Timesheets />;
      case "users":
        return <UserManagement />;
      case "payrolls":
        return <PayrollApprovals />;
      // Role-specific aliases mapping to existing components
      case "orders":
        return <MaterialProcurement />;
      // Reuse procurement for orders
      case "inventory":
        return <Inventory />;
      // Dedicated inventory page
      case "suppliers":
        return <Suppliers />;
      // Dedicated suppliers page
      case "deliveries":
        return <MaterialProcurement />;
      // Reuse procurement for deliveries
      case "safety":
        return <SiteEngineerDashboard />;
      // Keep on dashboard for now
      case "logs":
        return <SiteEngineerDashboard />;
      // Keep on dashboard for now
      case "photos":
        return <ClientDashboard />;
      // Reuse client view for photos
      case "milestones":
        return <ProjectPlanning />;
      case "workforce":
        return <WorkforceManagement />;
      // Reuse planning for milestones
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            Module under construction
          </div>
        );
    }
  };
  return (
    <div className="min-h-screen w-full bg-slate-100 font-sans">
      <RoleBasedSidebar
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        userRole={userRole}
        userName={user.full_name}
        userProfilePicture={user.profile_picture}
        onProfileClick={() => setIsProfileModalOpen(true)}
        onLogout={logout}
      />

      <div className="ml-64 p-8 transition-all duration-300">
        {renderModule()}
      </div>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdate={fetchUser}
      />
    </div>
  );
}
