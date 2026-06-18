export type LayoutState = {
  order: string[];
  hidden?: string[];
};

export function arrayMove<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function safeParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadLayout(storageKey: string, defaultOrder: string[]): LayoutState {
  if (typeof window === "undefined") return { order: defaultOrder.slice(), hidden: [] };
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return { order: defaultOrder.slice(), hidden: [] };
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return { order: defaultOrder.slice(), hidden: [] };

  const savedOrder = Array.isArray(parsed.order) ? parsed.order.filter((x: any) => typeof x === "string") : [];
  const savedHidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter((x: any) => typeof x === "string") : [];

  const filteredOrder = savedOrder.filter((id: string) => defaultOrder.includes(id));
  const missing = defaultOrder.filter((id) => !filteredOrder.includes(id));
  const order = [...filteredOrder, ...missing];

  const hidden = savedHidden.filter((id: string) => defaultOrder.includes(id));
  return { order, hidden };
}

export function saveLayout(storageKey: string, layout: LayoutState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch {
    // ignore storage failures (quota/private mode)
  }
}

