import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Search,
  UserPlus,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Pagination } from "../components/Pagination";
import { TableReportActions } from "../components/TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";
import { asList, formatApiError, formatRelativeTime } from "../utils/apiHelpers";

interface UserData {
  id: number;
  username: string;
  full_name: string;
  role: string;
  email: string;
  department?: string;
  job_title?: string;
  reports_to?: number | null;
  reports_to_name?: string;
  is_active: boolean;
  last_login: string | null;
}

const ALL_ROLES = [
  { value: "managing-director", label: "Managing Director" },
  { value: "director-finance", label: "Director of Finance" },
  { value: "technical-director", label: "Technical Director" },
  { value: "accountant", label: "Accountant (HQ)" },
  { value: "project-manager", label: "Project Manager" },
  { value: "procurement-officer", label: "Procurement Officer" },
  { value: "site-engineer", label: "Site Engineer" },
  { value: "site-foreman", label: "Site Foreman" },
  { value: "safety-officer", label: "Safety Officer" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "client", label: "Client" },
  { value: "admin", label: "System Administrator" },
];

const TECHNICAL_DIRECTOR_ROLES = new Set([
  "project-manager",
  "procurement-officer",
  "site-engineer",
  "site-foreman",
  "safety-officer",
  "subcontractor",
]);

const REPORTS_TO_PRIORITY = [
  "managing-director",
  "director-finance",
  "technical-director",
  "admin",
  "accountant",
  "project-manager",
  "site-engineer",
  "site-foreman",
  "procurement-officer",
  "safety-officer",
  "subcontractor",
  "client",
];

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [managerOptions, setManagerOptions] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    email: "",
    role: "site-engineer",
    department: "site",
    job_title: "",
    reports_to: "" as string | number,
    password: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles = useMemo(() => {
    if (currentUser?.role === "technical-director") {
      return ALL_ROLES.filter((r) => TECHNICAL_DIRECTOR_ROLES.has(r.value));
    }
    return ALL_ROLES;
  }, [currentUser?.role]);

  const isTechnicalDirectorViewOnly =
    currentUser?.role === "technical-director";

  const canManageUsers =
    currentUser?.role === "admin" ||
    currentUser?.role === "managing-director";

  const departmentForRole = (role: string) => {
    if (["managing-director"].includes(role)) return "executive";
    if (["director-finance", "accountant"].includes(role)) return "finance";
    if (["technical-director", "project-manager"].includes(role)) return "technical";
    if (["client", "subcontractor"].includes(role)) return "external";
    return "site";
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const reportsToOptions = useMemo(() => {
    const priority = new Map(
      REPORTS_TO_PRIORITY.map((role, index) => [role, index]),
    );
    return managerOptions
      .filter((u) => u.id !== editingUser?.id && u.is_active !== false)
      .sort((a, b) => {
        const aRank = priority.get(a.role) ?? 99;
        const bRank = priority.get(b.role) ?? 99;
        if (aRank !== bRank) return aRank - bRank;
        return (a.full_name || a.username).localeCompare(
          b.full_name || b.username,
        );
      });
  }, [managerOptions, editingUser?.id]);

  const fetchManagerOptions = async () => {
    try {
      const response = await api.get("/users/?page_size=1000");
      setManagerOptions(asList(response.data));
    } catch (err) {
      console.error("Failed to fetch manager options", err);
    }
  };

  const fetchUsers = async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await api.get(`/users/?page=${page}`);
      setUsers(response.data);
      
      const authResp = response as any;
      if (authResp.pagination) {
        setTotalItems(authResp.pagination.count);
        setTotalPages(Math.ceil(authResp.pagination.count / 10)); // Matching PAGE_SIZE=10
      } else {
        setTotalItems(response.data.length);
        setTotalPages(1);
      }
    } catch (err: any) {
      console.error("Failed to fetch users", err);
      setError("Could not load user data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage]);

  useEffect(() => {
    fetchManagerOptions();
  }, []);

  const openAddModal = () => {
    setModalMode("add");
    setEditingUser(null);
    const defaultRole =
      currentUser?.role === "technical-director" ? "project-manager" : "site-engineer";
    setFormData({
      username: "",
      full_name: "",
      email: "",
      role: defaultRole,
      department: departmentForRole(defaultRole),
      job_title: "",
      reports_to: currentUser?.id ?? "",
      password: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserData) => {
    setModalMode("edit");
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department || departmentForRole(user.role),
      job_title: user.job_title || "",
      reports_to: user.reports_to ?? "",
      password: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      if (modalMode === "add") {
        if (!formData.password)
          throw new Error("Password is required for new users.");
        const payload = {
          ...formData,
          reports_to: formData.reports_to ? Number(formData.reports_to) : null,
          department: formData.department || departmentForRole(formData.role),
        };
        await api.post("/users/", payload);
      } else if (modalMode === "edit" && editingUser) {
        const { password, ...restPayload } = formData;
        const payload: Record<string, unknown> = {
          ...(password ? formData : restPayload),
          reports_to: formData.reports_to ? Number(formData.reports_to) : null,
          department: formData.department || departmentForRole(formData.role),
        };
        await api.patch(`/users/${editingUser.id}/`, payload);
      }
      setIsModalOpen(false);
      fetchUsers(currentPage);
      fetchManagerOptions();
    } catch (err: unknown) {
      setFormError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: UserData) => {
    try {
      await api.patch(`/users/${user.id}/`, { is_active: !user.is_active });
      fetchUsers(currentPage);
      fetchManagerOptions();
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update user status");
    }
  };

  const deleteUser = (user: UserData) => {
    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete.id}/`);
      setUserToDelete(null);
      fetchUsers(currentPage);
      fetchManagerOptions();
    } catch (err) {
      console.error("Failed to delete user", err);
      alert("Failed to delete user.");
    }
  };

  const usersReport = useMemo((): TableReportData => {
    const columns = ["Name", "Username", "Email", "Role", "Reports to", "Status", "Last active"];
    const rows = users.map((u) => [
      u.full_name || "Unnamed",
      u.username,
      u.email,
      u.role.replace(/-/g, " "),
      u.reports_to_name ?? "—",
      u.is_active ? "Active" : "Inactive",
      u.last_login ? new Date(u.last_login).toLocaleString() : "Never",
    ]);
    return {
      title: isTechnicalDirectorViewOnly ? "All Users" : "User Directory",
      subtitle: `${users.length} accounts on this page`,
      filename: "User_Directory",
      columns,
      rows,
    };
  }, [users, isTechnicalDirectorViewOnly]);

  return (
    <div className="space-y-8 animate-fade-in text-left">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isTechnicalDirectorViewOnly ? "All Users" : "User Management"}
          </h1>
          <p className="text-slate-500">
            {isTechnicalDirectorViewOnly
              ? "View-only directory of every account in the organization."
              : "Add, edit, and safely manage system access accounts."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            {canManageUsers && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <UserPlus size={18} />
              Add User
            </button>
            )}
            <TableReportActions
              report={usersReport}
              disabled={users.length === 0 || isLoading}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reports to
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Last Active
                </th>
                {canManageUsers && (
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={canManageUsers ? 6 : 5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={canManageUsers ? 6 : 5}
                    className="px-6 py-8 text-center text-red-500"
                  >
                    {error}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-semibold text-slate-600">
                          {user.full_name.charAt(0).toUpperCase() ||
                            user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {user.full_name || "Unnamed User"}
                          </p>
                          <p className="text-xs text-slate-500">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {user.role.replace(/-/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.reports_to_name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            user.is_active ? "bg-green-600" : "bg-red-600"
                          }`}
                        ></span>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {user.last_login ? (
                        <span
                          title={new Date(user.last_login).toLocaleString()}
                          className="tabular-nums"
                        >
                          {formatRelativeTime(user.last_login)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Never</span>
                      )}
                    </td>
                    {canManageUsers && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit User"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => toggleUserStatus(user)}
                            className={`p-1.5 rounded transition-colors ${
                              user.is_active
                                ? "text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                                : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                            }`}
                            title={
                              user.is_active ? "Deactivate User" : "Activate User"
                            }
                          >
                            {user.is_active ? (
                              <XCircle size={18} />
                            ) : (
                              <CheckCircle size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => deleteUser(user)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
        />
      </div>

      {/* Add/Edit User Modal */}
      {isModalOpen &&
        createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm min-h-[125vh] w-full"
            aria-hidden
          />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-900">
                {modalMode === "add"
                  ? "Add New System User"
                  : "Edit User Profile"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      username: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, ""),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. jdoe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  System Role
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setFormData({
                      ...formData,
                      role,
                      department: departmentForRole(role),
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reports to
                </label>
                <select
                  value={formData.reports_to}
                  onChange={(e) =>
                    setFormData({ ...formData, reports_to: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— None —</option>
                  {reportsToOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username} ({u.role.replace(/-/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {modalMode === "add"
                    ? "Initial Password"
                    : "New Password (Leave blank to keep current)"}
                </label>
                <input
                  type="password"
                  required={modalMode === "add"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : modalMode === "add"
                      ? "Create User"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      <ConfirmActionModal
        isOpen={!!userToDelete}
        title="Delete User"
        message={
          userToDelete
            ? `Are you sure you want to permanently delete ${userToDelete.full_name || userToDelete.username}? This action cannot be undone.`
            : ""
        }
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
}
