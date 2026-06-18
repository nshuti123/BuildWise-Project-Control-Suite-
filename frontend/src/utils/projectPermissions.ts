/** Roles that may create new construction projects */
export function canCreateProject(role: string | undefined): boolean {
  return role === "technical-director" || role === "admin";
}

/** Roles that may assign or change the project manager */
export function canAssignProjectManager(role: string | undefined): boolean {
  return (
    role === "technical-director" ||
    role === "managing-director" ||
    role === "admin"
  );
}

export function canViewProjectFullDetail(role: string | undefined): boolean {
  return canAssignProjectManager(role);
}

export function canManageProjectDocuments(
  user: { id?: number; role?: string } | null | undefined,
  project: {
    manager_details?: { id: number } | null;
    site_engineer_details?: { id: number } | null;
  },
): boolean {
  if (!user) return false;
  const isPM = user.role === "project-manager" && project.manager_details?.id === user.id;
  const isSE = user.role === "site-engineer" && project.site_engineer_details?.id === user.id;
  return (
    canAssignProjectManager(user.role) ||
    user.role === "admin" ||
    isPM ||
    isSE
  );
}

export function canRequestProcurementOfficer(role: string | undefined): boolean {
  return role === "project-manager";
}

