/** Shared deadline helpers for task management. */

export function normalizeTaskStatus(status?: string): string {
  return (status || "pending").toLowerCase().replace(/\s+/g, "_");
}

export function isOpenTask(status?: string): boolean {
  const s = normalizeTaskStatus(status);
  return s !== "completed" && s !== "done";
}

export function getTaskBoardPhase(task: {
  phase_task_details?: { phase?: string } | null;
}): string {
  const phase = task.phase_task_details?.phase;
  if (phase && phase !== "General Tasks") return phase;
  return "Other tasks";
}

export function parseTaskDateLocal(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Order tasks for board / filtered grid views. */
export function sortTasksForDisplay<
  T extends {
    id: number;
    title: string;
    date?: string;
    status?: string;
    priority?: string;
  },
>(tasks: T[], status: "pending" | "in_progress" | "completed" | "all", today: Date): T[] {
  return [...tasks].sort((a, b) => {
    if (status === "completed") {
      const da = parseTaskDateLocal(a.date)?.getTime() ?? 0;
      const db = parseTaskDateLocal(b.date)?.getTime() ?? 0;
      if (db !== da) return db - da;
      return b.id - a.id;
    }

    const stateA = getTaskDateState(a.date, a.status, today);
    const stateB = getTaskDateState(b.date, b.status, today);
    if (stateA.isOverdue !== stateB.isOverdue) return stateA.isOverdue ? -1 : 1;

    const daysA = stateA.daysFromNow ?? 9999;
    const daysB = stateB.daysFromNow ?? 9999;
    if (daysA !== daysB) return daysA - daysB;

    const pa = PRIORITY_RANK[a.priority ?? "low"] ?? 2;
    const pb = PRIORITY_RANK[b.priority ?? "low"] ?? 2;
    if (pa !== pb) return pa - pb;

    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

export function getTaskDateState(
  dateStr: string | undefined,
  status: string | undefined,
  today: Date,
): { isOverdue: boolean; isDueSoon: boolean; daysFromNow: number | null } {
  if (!isOpenTask(status)) {
    return { isOverdue: false, isDueSoon: false, daysFromNow: null };
  }
  const taskDate = parseTaskDateLocal(dateStr);
  if (!taskDate) {
    return { isOverdue: false, isDueSoon: false, daysFromNow: null };
  }
  const diffTime = taskDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return {
    isOverdue: diffDays < 0,
    isDueSoon: diffDays >= 0 && diffDays <= 1,
    daysFromNow: diffDays,
  };
}
