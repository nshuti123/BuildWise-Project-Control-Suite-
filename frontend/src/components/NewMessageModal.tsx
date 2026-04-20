import { useState, useEffect } from "react";
import { X, Send, AlertCircle } from "lucide-react";
import api from "../api";

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  replyTo?: any;
}

export function NewMessageModal({ isOpen, onClose, onSuccess, replyTo }: NewMessageModalProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (replyTo) {
         setRecipientEmail(replyTo.sender_email || replyTo.sender_username);
         setSubject(`Re: ${replyTo.subject}`);
      } else {
         setRecipientEmail("");
         setSubject("");
         setBody("");
         setIsUrgent(false);
      }
      setError("");
    }
  }, [isOpen, replyTo]);

  const fetchUsers = async () => {
    try {
      const resp = await api.get('/users/');
      setUsers(Array.isArray(resp.data) ? resp.data : (resp.data.results || []));
    } catch(err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !subject || !body) {
       setError("Please fill out all fields.");
       return;
    }
    
    // Find the mapped user target
    const searchString = recipientEmail.trim().toLowerCase();
    const targetUser = users.find(u => 
        (u.email && u.email.toLowerCase().trim() === searchString) || 
        (u.username && u.username.toLowerCase().trim() === searchString)
    );

    if (!targetUser) {
        setError("Could not find any system user registered with that email or username.");
        return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      await api.post("/users/messages/", {
         recipient: targetUser.id,
         subject,
         body,
         is_urgent: isUrgent
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900">
            {replyTo ? "Reply Message" : "New Message"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
             <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-center gap-2">
                 <AlertCircle size={16} />
                 {error}
             </div>
          )}
          
          <div className="grid grid-cols-2 gap-6">
             <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Email or Username</label>
                <input
                  type="text"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="e.g. manager@buildwise.com"
                  disabled={!!replyTo}
                />
             </div>
             
             <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="Message subject..."
                />
             </div>
             
             <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="Type your message here..."
                ></textarea>
             </div>
             
             <div className="col-span-2 flex items-center gap-2">
                 <input 
                    type="checkbox" 
                    id="urgent"
                    checked={isUrgent}
                    onChange={e => setIsUrgent(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500" 
                 />
                 <label htmlFor="urgent" className="text-sm font-bold text-red-700 uppercase cursor-pointer">Mark as Urgent</label>
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Send size={16} />
              {isSubmitting ? "Sending..." : "Send Message"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
