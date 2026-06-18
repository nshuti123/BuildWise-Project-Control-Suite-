/** Normalize DRF list responses (array or paginated `{ results }`). */
export function asList<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

export function withProjectQuery(
  url: string,
  projectId: number | null | undefined,
): string {
  if (!projectId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}project=${projectId}`;
}

/** Extract a user-facing message from a DRF / axios error payload. */
export function formatApiError(
  err: unknown,
  fallback = "An error occurred",
): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data) {
    return err instanceof Error ? err.message : fallback;
  }
  if (typeof data === "string") return data;
  if (typeof data !== "object" || data === null) return fallback;

  const payload = data as Record<string, unknown>;
  if (typeof payload.detail === "string") return payload.detail;

  for (const key of ["email", "username", "non_field_errors"]) {
    const value = payload[key];
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string") return value;
  }

  const firstKey = Object.keys(payload)[0];
  const firstVal = payload[firstKey];
  if (Array.isArray(firstVal) && typeof firstVal[0] === "string") {
    return firstVal[0];
  }
  if (typeof firstVal === "string") return firstVal;

  return fallback;
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}
