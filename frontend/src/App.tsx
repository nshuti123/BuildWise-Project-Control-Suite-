import { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { ProjectProvider } from "./context/ProjectContext";
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
import { SiteEngineerDashboard } from "./pages/SiteEngineerDashboard";
import { ProcurementOfficerDashboard } from "./pages/ProcurementOfficerDashboard";
import { ClientDashboard } from "./pages/ClientDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { UserManagement } from "./pages/UserManagement";
import { SubcontractorDashboard } from "./pages/SubcontractorDashboard";
import { Suppliers } from "./pages/Suppliers";
import { WorkforceManagement } from "./pages/WorkforceManagement";
import { SiteInventory } from "./pages/SiteInventory";
import { Inventory } from "./pages/Inventory";
import { PayrollApprovals } from "./pages/PayrollApprovals";
import { AccountantDashboard } from "./pages/AccountantDashboard";
import { ManagingDirectorDashboard } from "./pages/ManagingDirectorDashboard";
import { DirectorFinanceDashboard } from "./pages/DirectorFinanceDashboard";
import { TechnicalDirectorDashboard } from "./pages/TechnicalDirectorDashboard";
import { TechnicalApprovalInbox } from "./pages/TechnicalApprovalInbox";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { SiteForemanDashboard } from "./pages/SiteForemanDashboard";
import { SiteEngineerProjectTeam } from "./pages/SiteEngineerProjectTeam";
import { SystemLogs } from "./pages/SystemLogs";
import { ProfileModal } from "./components/ProfileModal";
import { AnnouncementAlerts } from "./components/AnnouncementAlerts";

export function App() {
  const { user, isLoading, logout, fetchUser } = useAuth();
  const [activeModule, setActiveModule] = useState("dashboard");
  const [detailProjectId, setDetailProjectId] = useState<number | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const openProjectDetail = (projectId: number) => {
    setDetailProjectId(projectId);
    setActiveModule("project-detail");
  };

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
          return <SiteEngineerDashboard setActiveModule={setActiveModule} />;
        case "procurement-officer":
          return <ProcurementOfficerDashboard setActiveModule={setActiveModule} />;
        case "client":
          return <ClientDashboard />;
        case "admin":
          return <AdminDashboard setActiveModule={setActiveModule} />;
        case "subcontractor":
          return <SubcontractorDashboard />;
        case "accountant":
          return <AccountantDashboard setActiveModule={setActiveModule} />;
        case "managing-director":
          return <ManagingDirectorDashboard setActiveModule={setActiveModule} />;
        case "director-finance":
          return <DirectorFinanceDashboard setActiveModule={setActiveModule} />;
        case "technical-director":
          return (
            <TechnicalDirectorDashboard
              setActiveModule={setActiveModule}
              onOpenProjectDetail={openProjectDetail}
            />
          );
        case "site-foreman":
          return <SiteForemanDashboard setActiveModule={setActiveModule} />;
        case "project-manager":
        default:
          return <Dashboard setActiveModule={setActiveModule} />;
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
        return <ProgressMonitoring setActiveModule={setActiveModule} />;
      case "reports":
        return <Reports />;
      case "communication":
        return <Communication />;
      case "documents":
        return <Documents />;
      case "users":
        return <UserManagement />;
      case "payrolls":
        return <PayrollApprovals setActiveModule={setActiveModule} />;
      // Role-specific aliases mapping to existing components
      case "orders":
        return <MaterialProcurement />;
      case "site-inventory":
        return <SiteInventory />;
      case "inventory":
        return <Inventory />;
      case "suppliers":
        return <Suppliers />;
      case "safety":
        return <SiteEngineerDashboard />;
      // Keep on dashboard for now
      case "logs":
        if (userRole === "admin") {
          return <SystemLogs />;
        }
        return <SiteEngineerDashboard />;
      case "photos":
        return <ClientDashboard />;
      // Reuse client view for photos
      case "milestones":
        return <ProjectPlanning />;
      case "workforce":
        return <WorkforceManagement />;
      case "project-team":
        return <SiteEngineerProjectTeam />;
      case "technical-approvals":
        return <TechnicalApprovalInbox />;
      case "project-detail":
        return detailProjectId ? (
          <ProjectDetailPage
            projectId={detailProjectId}
            onBack={() => {
              setDetailProjectId(null);
              setActiveModule("dashboard");
            }}
          />
        ) : (
          <div className="p-8 text-center text-slate-500">Select a project from the dashboard.</div>
        );
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            Module under construction
          </div>
        );
    }
  };
  return (
    <ProjectProvider>
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

        <div className="ml-64 p-8 pb-28 transition-all duration-300">
          {renderModule()}
        </div>

        <AnnouncementAlerts />

        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onUpdate={fetchUser}
        />
      </div>
    </ProjectProvider>
  );
}
