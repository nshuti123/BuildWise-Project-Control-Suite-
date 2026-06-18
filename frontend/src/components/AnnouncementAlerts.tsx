import { useState, useEffect, useCallback } from "react";
import api from "../api";
import {
  AnnouncementBanner,
  type AnnouncementItem,
} from "./AnnouncementBanner";

/** Fixed bottom alerts for active announcements the user has not acknowledged. */
export function AnnouncementAlerts() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [ackingId, setAckingId] = useState<number | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const resp = await api.get("/users/announcements/");
      const list: AnnouncementItem[] = Array.isArray(resp.data) ? resp.data : [];
      setAnnouncements(list.filter((a) => !a.is_acknowledged));
    } catch {
      setAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    const inv = setInterval(fetchAnnouncements, 15000);
    const onRefresh = () => fetchAnnouncements();
    window.addEventListener("buildwise-announcements-refresh", onRefresh);
    return () => {
      clearInterval(inv);
      window.removeEventListener("buildwise-announcements-refresh", onRefresh);
    };
  }, [fetchAnnouncements]);

  const handleAcknowledge = async (id: number) => {
    setAckingId(id);
    try {
      await api.post(`/users/announcements/${id}/acknowledge/`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setAckingId(null);
    }
  };

  if (announcements.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-64 right-0 z-40 px-8 pb-4 pt-2 pointer-events-none"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-auto max-w-5xl space-y-3 max-h-[min(40vh,320px)] overflow-y-auto custom-scrollbar">
        {announcements.map((ann) => (
          <AnnouncementBanner
            key={ann.id}
            announcement={ann}
            onAcknowledge={handleAcknowledge}
            acknowledging={ackingId === ann.id}
            variant="alert"
          />
        ))}
      </div>
    </div>
  );
}
