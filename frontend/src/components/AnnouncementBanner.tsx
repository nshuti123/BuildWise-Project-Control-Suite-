import { Megaphone } from "lucide-react";

export type AnnouncementItem = {
  id: number;
  title: string;
  body: string;
  audience_summary?: string;
  is_acknowledged?: boolean;
  created_by_name?: string;
};

type Props = {
  announcement: AnnouncementItem;
  onAcknowledge?: (id: number) => void;
  acknowledging?: boolean;
  /** Bottom-of-screen alert strip (global overlay). */
  variant?: "default" | "alert";
};

export function AnnouncementBanner({
  announcement,
  onAcknowledge,
  acknowledging = false,
  variant = "default",
}: Props) {
  const isAlert = variant === "alert";
  return (
    <div
      className={`bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between shadow-sm gap-4 ${
        isAlert
          ? "p-4 shadow-lg shadow-orange-900/10 ring-1 ring-orange-200/80"
          : "p-5"
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 shrink-0">
          <Megaphone size={24} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-orange-900 text-lg">
            {announcement.title || "System Announcement"}
          </h3>
          <p className="text-sm text-orange-800 mt-1 whitespace-pre-wrap">
            {announcement.body}
          </p>
          {announcement.created_by_name && (
            <p className="text-xs text-orange-700/80 mt-2">
              Posted by {announcement.created_by_name}
            </p>
          )}
        </div>
      </div>
      {onAcknowledge && !announcement.is_acknowledged && (
        <button
          type="button"
          onClick={() => onAcknowledge(announcement.id)}
          disabled={acknowledging}
          className="text-sm font-bold bg-white text-orange-700 px-4 py-2 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer shadow-sm shrink-0 disabled:opacity-60"
        >
          {acknowledging ? "Saving…" : "Acknowledge"}
        </button>
      )}
      {announcement.is_acknowledged && (
        <span className="text-xs font-bold text-green-800 bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg shrink-0">
          Acknowledged
        </span>
      )}
    </div>
  );
}
