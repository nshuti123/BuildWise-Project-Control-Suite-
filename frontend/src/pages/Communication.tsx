import { useState, useEffect } from "react";
import {
  MessageSquare,
  Megaphone,
  Search,
  MoreVertical,
  Reply,
  Inbox,
  SendHorizontal,
} from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { NewMessageModal } from "../components/NewMessageModal";
import { NewAnnouncementModal } from "../components/NewAnnouncementModal";
import { canPostAnnouncements } from "../utils/announcementPermissions";

export function Communication() {
  const { user } = useAuth();
  const canPost = canPostAnnouncements(user?.role);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any>(null);
  const [viewState, setViewState] = useState<"inbox" | "sent">("inbox");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMessages = async () => {
    try {
      const resp = await api.get("/users/messages/");
      setMessages(resp.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const inv = setInterval(fetchMessages, 15000);
    return () => clearInterval(inv);
  }, []);

  const selectMessage = async (msg: any) => {
    setSelectedMessage(msg);
    if (!msg.is_read && msg.recipient === (user as any)?.id) {
      try {
        await api.patch(`/users/messages/${msg.id}/mark_read/`);
        setMessages(
          messages.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)),
        );
      } catch (err) {
        /* ignore */
      }
    }
  };

  const handleCompose = () => {
    setReplyTarget(null);
    setIsModalOpen(true);
  };

  const handleReply = () => {
    setReplyTarget(selectedMessage);
    setIsModalOpen(true);
  };

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.sender_name.toLowerCase().includes(searchTerm.toLowerCase());
    if (viewState === "inbox")
      return msg.recipient === (user as any)?.id && matchesSearch;
    return msg.sender === (user as any)?.id && matchesSearch;
  });

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col pt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            BuildChat
          </h1>
          <p className="text-slate-600">
            Direct system-wide messaging and alerts
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-white rounded-lg border border-slate-300 p-1">
            <button
              onClick={() => {
                setViewState("inbox");
                setSelectedMessage(null);
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewState === "inbox" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Inbox size={16} /> Inbox
            </button>
            <button
              onClick={() => {
                setViewState("sent");
                setSelectedMessage(null);
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewState === "sent" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <SendHorizontal size={16} /> Sent
            </button>
          </div>
          {canPost && (
            <button
              type="button"
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm transition-transform hover:scale-105 active:scale-95"
            >
              <Megaphone size={18} />
              <span className="text-sm font-medium">Post Announcement</span>
            </button>
          )}
          <button
            onClick={handleCompose}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-transform hover:scale-105 active:scale-95"
          >
            <MessageSquare size={18} />
            <span className="text-sm font-medium">New Message</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex relative">
        <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No messages found in your {viewState}.
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => selectMessage(msg)}
                  className={`p-4 cursor-pointer transition-colors border-l-4 ${selectedMessage?.id === msg.id ? "bg-white border-blue-500" : msg.is_read || viewState === "sent" ? "hover:bg-slate-100 border-transparent" : "bg-blue-50/50 hover:bg-blue-50 border-transparent"}`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span
                      className={`text-sm truncate pr-2 ${!msg.is_read && viewState === "inbox" ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}
                    >
                      {viewState === "inbox"
                        ? msg.sender_name
                        : msg.recipient_name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(msg.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    {msg.is_urgent && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded shadow-sm shrink-0 uppercase">
                        Urgent
                      </span>
                    )}
                    <p
                      className={`text-sm truncate ${!msg.is_read && viewState === "inbox" ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}
                    >
                      {msg.subject}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {msg.body.substring(0, 50)}...
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedMessage ? (
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-white">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {selectedMessage.subject}
                  </h2>
                  {selectedMessage.is_urgent && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded uppercase shadow-sm">
                      Urgent
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 mt-4 inline-flex">
                  <span className="font-bold text-slate-900">
                    {selectedMessage.sender_name}
                  </span>
                  <span className="text-xs text-slate-500">
                    &lt;{selectedMessage.sender_email}&gt;
                  </span>
                  <span className="text-slate-400 mx-1">to</span>
                  <span className="font-bold text-slate-900">
                    {selectedMessage.recipient_name}
                  </span>
                  <span className="text-xs text-slate-500">
                    &lt;{selectedMessage.recipient_email}&gt;
                  </span>
                  <span className="text-slate-400 ml-2">•</span>
                  <span className="font-mono text-xs">
                    {new Date(selectedMessage.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {viewState === "inbox" && (
                  <button
                    onClick={handleReply}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold transition-transform hover:scale-105 active:scale-95 text-sm cursor-pointer"
                  >
                    <Reply size={16} /> Reply
                  </button>
                )}
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
              <div className="prose max-w-none text-slate-800 whitespace-pre-wrap leading-relaxed text-[15px]">
                {selectedMessage.body}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <MessageSquare size={64} className="opacity-20 mb-4" />
            <h2 className="text-xl font-bold text-slate-500">
              No message selected
            </h2>
            <p className="text-sm mt-2 max-w-sm text-center">
              Select a message from the sidebar list to view its contents or
              compose a new one.
            </p>
          </div>
        )}
      </div>

      <NewMessageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchMessages();
          setViewState("sent");
        }}
        replyTo={replyTarget}
      />

      <NewAnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        onSuccess={() =>
          window.dispatchEvent(new Event("buildwise-announcements-refresh"))
        }
      />
    </div>
  );
}
