/**
 * Maps notification `link` values and content to App.tsx `activeModule` ids per role.
 */

const ROLE_MENU_IDS: Record<string, string[]> = {
  "site-engineer": [
    "dashboard",
    "project-team",
    "tasks",
    "site-inventory",
    "safety",
    "logs",
    "workforce",
    "photos",
    "communication",
  ],
  "site-foreman": ["dashboard", "site-inventory", "workforce", "payrolls", "tasks", "communication"],
  "procurement-officer": [
    "dashboard",
    "orders",
    "inventory",
    "suppliers",
    "reports",
    "communication",
  ],
  "project-manager": [
    "dashboard",
    "technical-approvals",
    "planning",
    "tasks",
    "budget",
    "procurement",
    "site-inventory",
    "progress",
    "reports",
    "communication",
    "documents",
    "workforce",
  ],
  "technical-director": [
    "dashboard",
    "technical-approvals",
    "planning",
    "tasks",
    "budget",
    "procurement",
    "suppliers",
    "site-inventory",
    "progress",
    "reports",
    "workforce",
    "users",
    "documents",
    "communication",
  ],
  "managing-director": [
    "dashboard",
    "technical-approvals",
    "planning",
    "tasks",
    "budget",
    "procurement",
    "site-inventory",
    "progress",
    "reports",
    "payrolls",
    "workforce",
    "users",
    "communication",
    "documents",
  ],
  "director-finance": [
    "dashboard",
    "budget",
    "payrolls",
    "orders",
    "procurement",
    "reports",
    "communication",
  ],
  accountant: ["dashboard", "budget", "payrolls", "reports", "communication"],
  admin: [
    "dashboard",
    "technical-approvals",
    "planning",
    "tasks",
    "budget",
    "procurement",
    "orders",
    "suppliers",
    "site-inventory",
    "progress",
    "reports",
    "payrolls",
    "workforce",
    "users",
    "communication",
    "documents",
    "logs",
  ],
  client: ["dashboard", "milestones", "budget", "photos", "documents", "communication"],
  subcontractor: ["dashboard", "schedule", "photos", "communication"],
  "safety-officer": ["dashboard", "safety", "communication"],
};

/** Raw link or alias → canonical module id */
const MODULE_ALIASES: Record<string, string> = {
  budget: "budget",
  "/budget": "budget",
  procurement: "procurement",
  "/procurement": "procurement",
  orders: "orders",
  "/orders": "orders",
  "site-inventory": "site-inventory",
  "/site-inventory": "site-inventory",
  inventory: "procurement",
  "/inventory": "procurement",
  tasks: "tasks",
  "/tasks": "tasks",
  workforce: "workforce",
  "/workforce": "workforce",
  communication: "communication",
  "/communication": "communication",
  messages: "communication",
  "/messages": "communication",
  "technical-approvals": "technical-approvals",
  "/technical-approvals": "technical-approvals",
  approvals: "technical-approvals",
  "/approvals": "technical-approvals",
  payrolls: "payrolls",
  "/payrolls": "payrolls",
  planning: "planning",
  progress: "progress",
  reports: "reports",
  safety: "safety",
  logs: "logs",
  users: "users",
  suppliers: "suppliers",
  documents: "documents",
  "/documents": "documents",
};

/** When target module is not in role menu, try these substitutes */
const ROLE_SUBSTITUTES: Record<string, Record<string, string>> = {
  "site-engineer": {
    procurement: "site-inventory",
    orders: "site-inventory",
    inventory: "site-inventory",
    budget: "dashboard",
    "technical-approvals": "dashboard",
    payrolls: "dashboard",
  },
  "site-foreman": {
    procurement: "site-inventory",
    budget: "dashboard",
    "technical-approvals": "dashboard",
    payrolls: "workforce",
  },
  "project-manager": {
    orders: "procurement",
    inventory: "procurement",
    safety: "tasks",
  },
  "procurement-officer": {
    procurement: "orders",
    "site-inventory": "inventory",
    inventory: "inventory",
    tasks: "orders",
    "technical-approvals": "orders",
    budget: "reports",
  },
  client: {
    tasks: "milestones",
    procurement: "budget",
  },
  subcontractor: {
    tasks: "dashboard",
  },
  "director-finance": {
    procurement: "orders",
  },
};

function inferModuleFromText(title: string, message: string): string | null {
  const text = `${title} ${message}`.toLowerCase();

  if (
    text.includes("new message") ||
    text.includes("sent you a message") ||
    text.includes("message from")
  ) {
    return "communication";
  }
  if (
    text.includes("payroll") ||
    text.includes("pay roll")
  ) {
    return "payrolls";
  }
  if (
    (text.includes("material") || text.includes("inventory")) &&
    (text.includes("approved") ||
      text.includes("fulfilled") ||
      text.includes("transferred") ||
      text.includes("site inventory"))
  ) {
    return "site-inventory";
  }
  if (
    text.includes("purchase order") ||
    text.includes("po #") ||
    (text.includes("material") && text.includes("order"))
  ) {
    return "procurement";
  }
  if (
    text.includes("transaction") ||
    text.includes("expense") ||
    text.includes("budget")
  ) {
    return "budget";
  }
  if (text.includes("approved") || text.includes("rejected")) {
    if (text.includes("material")) return "site-inventory";
    if (text.includes("purchase order") || text.includes("purchase")) return "procurement";
    if (text.includes("task")) return "tasks";
    if (text.includes("transaction") || text.includes("expense")) return "budget";
  }
  if (text.includes("approval required") || text.includes("submitted:")) {
    if (
      text.includes("material request") ||
      (text.includes("material") &&
        (text.includes("requisition") || text.includes("confirm required")))
    ) {
      return "procurement";
    }
    if (text.includes("material")) return "procurement";
    if (text.includes("transaction")) return "budget";
    return "technical-approvals";
  }
  if (text.includes("task") || text.includes("overdue") || text.includes("due soon")) {
    return "tasks";
  }
  if (text.includes("incident") || text.includes("safety")) {
    return "safety";
  }
  if (text.includes("attendance")) {
    return "workforce";
  }

  return null;
}

export function getMenuIdsForRole(role: string): Set<string> {
  const ids = ROLE_MENU_IDS[role] ?? ROLE_MENU_IDS["project-manager"];
  return new Set(ids);
}

export function resolveNotificationModule(
  link: string | null | undefined,
  userRole: string,
  title = "",
  message = "",
): string {
  const allowed = getMenuIdsForRole(userRole);
  let module: string | null = null;

  if (link) {
    const normalized = link.trim().replace(/^\//, "").split("?")[0];
    if (normalized === "payrolls" || link.trim().toLowerCase().startsWith("payrolls")) {
      module = "payrolls";
    } else {
      module =
        MODULE_ALIASES[normalized] ??
        MODULE_ALIASES[link.trim()] ??
        (normalized || null);
    }
  }

  if (!module) {
    module = inferModuleFromText(title, message);
  }

  if (!module) {
    module = "dashboard";
  }

  if (!allowed.has(module)) {
    const sub = ROLE_SUBSTITUTES[userRole]?.[module];
    if (sub && allowed.has(sub)) {
      module = sub;
    } else {
      module = allowed.has("dashboard") ? "dashboard" : [...allowed][0];
    }
  }

  return module;
}

export function resolveNotificationProjectId(
  link: string | null | undefined,
  projectId: number | null | undefined,
  title: string,
  message: string,
  projects: { id: number; name: string }[],
): number | null {
  if (projectId) {
    return projectId;
  }

  if (link) {
    const match = link.match(/[?&]project=(\d+)/);
    if (match) {
      return Number(match[1]);
    }
  }

  const text = `${title} ${message}`.toLowerCase();
  const sorted = [...projects].sort((a, b) => b.name.length - a.name.length);
  for (const project of sorted) {
    const name = project.name?.trim();
    if (name && text.includes(name.toLowerCase())) {
      return project.id;
    }
  }

  return null;
}
