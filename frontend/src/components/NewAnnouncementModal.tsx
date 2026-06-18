import { useState, useEffect } from "react";
import { X, Megaphone } from "lucide-react";
import api from "../api";
import { asList } from "../utils/apiHelpers";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Everyone (all active users)" },
  { value: "roles", label: "By role" },
  { value: "departments", label: "By department" },
  { value: "projects", label: "By project" },
  { value: "users", label: "Specific users" },
];

const ROLE_OPTIONS = [
  { value: "managing-director", label: "Managing Director" },
  { value: "director-finance", label: "Director of Finance" },
  { value: "technical-director", label: "Technical Director" },
  { value: "accountant", label: "Accountant" },
  { value: "project-manager", label: "Project Manager" },
  { value: "procurement-officer", label: "Procurement Officer" },
  { value: "site-engineer", label: "Site Engineer" },
  { value: "site-foreman", label: "Site Foreman" },
  { value: "safety-officer", label: "Safety Officer" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "client", label: "Client" },
];

const DEPARTMENT_OPTIONS = [
  { value: "executive", label: "Executive" },
  { value: "finance", label: "Finance" },
  { value: "technical", label: "Technical" },
  { value: "site", label: "Site Operations" },
  { value: "external", label: "External" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function NewAnnouncementModal({ isOpen, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("System Announcement");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState("all");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<number[]>([]);
  const [targetProjectIds, setTargetProjectIds] = useState<number[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    const load = async () => {
      try {
        const [usersRes, projectsRes] = await Promise.all([
          api.get("/users/"),
          api.get("/projects/"),
        ]);
        setUsers(asList(usersRes.data).filter((u: any) => u.is_active !== false));
        setProjects(asList(projectsRes.data));
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleInList = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const toggleIdInList = (
    list: number[],
    value: number,
    setter: (v: number[]) => void,
  ) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError("Announcement message is required.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        title: title.trim() || "System Announcement",
        body: body.trim(),
        audience_type: audienceType,
        target_roles: audienceType === "roles" ? targetRoles : [],
        target_departments:
          audienceType === "departments" ? targetDepartments : [],
        target_user_ids: audienceType === "users" ? targetUserIds : [],
        target_project_ids: audienceType === "projects" ? targetProjectIds : [],
      };
      await api.post("/users/announcements/", payload);
      setBody("");
      setAudienceType("all");
      setTargetRoles([]);
      setTargetDepartments([]);
      setTargetUserIds([]);
      setTargetProjectIds([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        data?.body?.[0] ||
        data?.target_roles?.[0] ||
        data?.target_user_ids?.[0] ||
        "Failed to publish announcement.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <Megaphone size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Post announcement</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              placeholder="Write the announcement shown on the Communication page…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Who can see this?
            </label>
            <select
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {audienceType === "roles" && (
            <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
              {ROLE_OPTIONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={targetRoles.includes(r.value)}
                    onChange={() => toggleInList(targetRoles, r.value, setTargetRoles)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          )}

          {audienceType === "departments" && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-1">
              {DEPARTMENT_OPTIONS.map((d) => (
                <label key={d.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={targetDepartments.includes(d.value)}
                    onChange={() =>
                      toggleInList(targetDepartments, d.value, setTargetDepartments)
                    }
                  />
                  {d.label}
                </label>
              ))}
            </div>
          )}

          {audienceType === "projects" && (
            <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
              {projects.length === 0 ? (
                <p className="text-sm text-slate-500">No projects loaded.</p>
              ) : (
                projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={targetProjectIds.includes(p.id)}
                      onChange={() =>
                        toggleIdInList(targetProjectIds, p.id, setTargetProjectIds)
                      }
                    />
                    {p.name}
                  </label>
                ))
              )}
            </div>
          )}

          {audienceType === "users" && (
            <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={targetUserIds.includes(u.id)}
                    onChange={() =>
                      toggleIdInList(targetUserIds, u.id, setTargetUserIds)
                    }
                  />
                  {u.full_name || u.username}{" "}
                  <span className="text-slate-400">({u.role})</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-bold bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
            >
              {isSubmitting ? "Publishing…" : "Publish announcement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
