/** Role-based UI capabilities (mirrors backend rules where enforced). */

/** Managing Director or System Admin — company-wide operations. */
export function hasFullAccess(role: string | undefined): boolean {
  return role === "admin" || role === "managing-director";
}

export function hasExecutiveAccess(role: string | undefined): boolean {
  return (
    hasFullAccess(role) ||
    role === "technical-director" ||
    role === "director-finance"
  );
}

export function isSiteForeman(role: string | undefined): boolean {
  return role === "site-foreman";
}

export function hasTechnicalOversight(role: string | undefined): boolean {
  return role === "technical-director";
}

/** May start daily worker payment (attendance → payroll batch). */
export function canInitiateWorkerPayment(role: string | undefined): boolean {
  return (
    isSiteForeman(role) ||
    role === "site-engineer" ||
    hasTechnicalOversight(role)
  );
}

export type WorkforceCapabilities = {
  canAddWorker: boolean;
  canEditWorker: boolean;
  canDeleteWorker: boolean;
  canMarkAttendance: boolean;
  canInitiatePayroll: boolean;
  canConfirmPayroll: boolean;
  canRejectPayroll: boolean;
  canEditAttendanceDuringPayrollReview: boolean;
};

export function getWorkforceCapabilities(role: string | undefined): WorkforceCapabilities {
  if (isSiteForeman(role)) {
    return {
      canAddWorker: true,
      canEditWorker: false,
      canDeleteWorker: false,
      canMarkAttendance: true,
      canInitiatePayroll: true,
      canConfirmPayroll: false,
      canRejectPayroll: false,
      canEditAttendanceDuringPayrollReview: false,
    };
  }
  if (role === "site-engineer" || hasTechnicalOversight(role)) {
    return {
      canAddWorker: true,
      canEditWorker: true,
      canDeleteWorker: true,
      canMarkAttendance: true,
      canInitiatePayroll: true,
      canConfirmPayroll: true,
      canRejectPayroll: true,
      canEditAttendanceDuringPayrollReview: true,
    };
  }
  return {
    canAddWorker: true,
    canEditWorker: true,
    canDeleteWorker: true,
    canMarkAttendance: true,
    canInitiatePayroll: false,
    canConfirmPayroll: false,
    canRejectPayroll: false,
    canEditAttendanceDuringPayrollReview: false,
  };
}

export type TaskBoardCapabilities = {
  viewOnly: boolean;
  canCreateTask: boolean;
  canEditTask: boolean;
  canChangeStatus: boolean;
  canAutoAssign: boolean;
};

export function getTaskBoardCapabilities(role: string | undefined): TaskBoardCapabilities {
  if (isSiteForeman(role)) {
    return {
      viewOnly: true,
      canCreateTask: false,
      canEditTask: false,
      canChangeStatus: false,
      canAutoAssign: false,
    };
  }
  return {
    viewOnly: false,
    canCreateTask: true,
    canEditTask: true,
    canChangeStatus: true,
    canAutoAssign: true,
  };
}
