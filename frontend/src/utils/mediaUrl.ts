const API_ORIGIN = "http://127.0.0.1:8000";

/** Resolve DRF media paths to a full URL for img src. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_ORIGIN}${normalized}`;
}
