/** Roles allowed to publish company announcements. */
export const ANNOUNCEMENT_PUBLISHER_ROLES = [
  "admin",
  "managing-director",
  "technical-director",
  "director-finance",
] as const;

export function canPostAnnouncements(role: string | undefined): boolean {
  return !!role && (ANNOUNCEMENT_PUBLISHER_ROLES as readonly string[]).includes(role);
}
