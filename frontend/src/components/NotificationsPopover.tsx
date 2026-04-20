import { useState, useEffect, useRef } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import api from "../api";

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const resp = await api.get("/users/notifications/");
      setNotifications(resp.data);
    } catch (err) {
      console.error("Failed to fetch notifications");
    }
  };

  const markAsRead = async (id: number) => {
    try {
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      await api.patch(`/users/notifications/${id}/mark_read/`);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      await api.patch('/users/notifications/mark_all_read/');
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-slate-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-4 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[100] transform origin-bottom-left transition-all animate-in zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Check size={14} /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                You're all caught up!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div key={n.id} className={`p-4 transition-colors ${n.is_read ? 'bg-white opacity-70' : 'bg-blue-50/50'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm ${n.is_read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                        {n.title}
                      </h4>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(n.timestamp).toLocaleDateString()} {new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <div className="flex gap-3">
                         {n.link && (
                           <a href={n.link} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                             View <ExternalLink size={12} />
                           </a>
                         )}
                         {!n.is_read && (
                           <button onClick={() => markAsRead(n.id)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                             Dismiss
                           </button>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
