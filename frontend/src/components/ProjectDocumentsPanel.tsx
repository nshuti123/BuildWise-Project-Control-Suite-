import { useState, useEffect, useCallback, useRef, Fragment, useMemo } from "react";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Loader2,
  FolderOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import api from "../api";
import { asList, formatApiError } from "../utils/apiHelpers";
import { useAuth } from "../context/AuthContext";
import { canManageProjectDocuments } from "../utils/projectPermissions";
import { TableReportActions } from "./TableReportActions";
import type { TableReportData } from "../utils/tableReportExport";
import type { ProjectStaffData } from "./ProjectStaffPanel";

export interface ProjectDocumentAttachment {
  id: number | null;
  file_url?: string;
  file_name?: string;
  file_size_bytes?: number;
  original_name?: string;
  created_at?: string;
}

export interface ProjectDocumentItem {
  id: number;
  title: string;
  category: string;
  category_display: string;
  description?: string;
  attachments: ProjectDocumentAttachment[];
  file_count: number;
  total_size_bytes?: number;
  uploaded_by_name?: string;
  created_at: string;
}

const DOCUMENT_CATEGORIES = [
  { value: "construction_permit", label: "Construction Permit" },
  { value: "architectural_plan", label: "Architectural Plans" },
  { value: "structural_plan", label: "Structural / Engineering Plans" },
  { value: "contract", label: "Contracts & Agreements" },
  { value: "environmental", label: "Environmental / EIA" },
  { value: "survey", label: "Survey & Geotechnical" },
  { value: "other", label: "Other Supporting Document" },
];

function formatFileSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileBaseName(file: File): string {
  const name = file.name;
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

interface ProjectDocumentsPanelProps {
  project: ProjectStaffData;
  /** Full Documents module vs embedded project detail section */
  variant?: "embedded" | "page";
  /** Allow choosing target project in the upload form (Documents page) */
  allowProjectSelect?: boolean;
  projectOptions?: ProjectStaffData[];
  onUploadSuccess?: (projectId: number) => void;
}

export function ProjectDocumentsPanel({
  project,
  variant = "embedded",
  allowProjectSelect = false,
  projectOptions = [],
  onUploadSuccess,
}: ProjectDocumentsPanelProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<ProjectDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("construction_permit");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState<number>(project.id);

  useEffect(() => {
    setUploadProjectId(project.id);
  }, [project.id]);

  const uploadTargetProject =
    projectOptions.find((p) => p.id === uploadProjectId) ??
    (uploadProjectId === project.id ? project : undefined);

  const canManageView = canManageProjectDocuments(user, project);
  const canManageUpload = uploadTargetProject
    ? canManageProjectDocuments(user, uploadTargetProject)
    : canManageView;
  const canManageAnyUpload =
    allowProjectSelect &&
    projectOptions.some((p) => canManageProjectDocuments(user, p));
  const showUploadButton = allowProjectSelect ? canManageAnyUpload : canManageView;

  const filteredDocuments = documents.filter((doc) => {
    const matchesCategory = !categoryFilter || doc.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesCategory;
    const attachmentNames = (doc.attachments ?? [])
      .map((a) => a.file_name || a.original_name || "")
      .join(" ");
    const haystack = [
      doc.title,
      doc.description,
      attachmentNames,
      doc.category_display,
      doc.uploaded_by_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesCategory && haystack.includes(q);
  });

  const categoryCounts = DOCUMENT_CATEGORIES.map((cat) => ({
    ...cat,
    count: documents.filter((d) => d.category === cat.value).length,
  })).filter((cat) => cat.count > 0);

  const documentsReport = useMemo((): TableReportData => {
    const columns = ["Document set", "Category", "Files", "Total size", "Uploaded by", "Uploaded"];
    const rows = filteredDocuments.map((doc) => [
      doc.title,
      doc.category_display,
      String(doc.file_count ?? doc.attachments?.length ?? 0),
      formatFileSize(doc.total_size_bytes),
      doc.uploaded_by_name ?? "—",
      new Date(doc.created_at).toLocaleString(),
    ]);
    return {
      title: `Supporting Documents — ${project.name}`,
      subtitle: `${filteredDocuments.length} document sets`,
      filename: `Documents_${project.id}`,
      columns,
      rows,
    };
  }, [filteredDocuments, project.name, project.id]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/project-documents/?project=${project.id}`);
      setDocuments(asList(res.data));
      setError("");
    } catch (e) {
      console.error(e);
      setError("Could not load project documents.");
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const resetForm = () => {
    setTitle("");
    setCategory("construction_permit");
    setDescription("");
    setSelectedFiles([]);
    setShowForm(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList?.length) {
      setSelectedFiles([]);
      return;
    }
    setSelectedFiles(Array.from(fileList));
    setError("");
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current && selectedFiles.length <= 1) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError("Choose one or more files to upload.");
      return;
    }
    const bundleTitle =
      title.trim() ||
      (selectedFiles.length === 1 ? fileBaseName(selectedFiles[0]) : "");
    if (!bundleTitle) {
      setError("Enter a title for this document set.");
      return;
    }
    if (!canManageUpload) {
      setError("You cannot upload documents for the selected project.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("project", String(uploadProjectId));
      formData.append("title", bundleTitle);
      formData.append("category", category);
      if (description.trim()) formData.append("description", description.trim());
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      await api.post("/projects/project-documents/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      resetForm();
      onUploadSuccess?.(uploadProjectId);
      if (uploadProjectId === project.id) {
        await fetchDocuments();
      }
    } catch (err: unknown) {
      setError(formatApiError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: ProjectDocumentItem) => {
    if (!window.confirm(`Delete "${doc.title}" and all ${doc.file_count} file(s)? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/projects/project-documents/${doc.id}/`);
      if (expandedDocId === doc.id) setExpandedDocId(null);
      await fetchDocuments();
    } catch (err: unknown) {
      alert(formatApiError(err, "Could not delete document"));
    }
  };

  const toggleExpanded = (docId: number) => {
    setExpandedDocId((prev) => (prev === docId ? null : docId));
  };

  return (
    <section
      className={
        variant === "page"
          ? "space-y-6"
          : "bg-white rounded-xl border border-slate-200 p-6 shadow-sm lg:col-span-2"
      }
    >
      {variant === "page" && categoryCounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`text-left p-4 rounded-xl border transition-all ${
              categoryFilter === null
                ? "border-blue-400 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-blue-200"
            }`}
          >
            <FolderOpen className="text-blue-500 mb-2" size={28} />
            <h3 className="font-bold text-slate-900">All document sets</h3>
            <p className="text-sm text-slate-500">{documents.length} entries</p>
          </button>
          {categoryCounts.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() =>
                setCategoryFilter(categoryFilter === cat.value ? null : cat.value)
              }
              className={`text-left p-4 rounded-xl border transition-all ${
                categoryFilter === cat.value
                  ? "border-blue-400 bg-blue-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-blue-200"
              }`}
            >
              <FileText className="text-cyan-600 mb-2" size={28} />
              <h3 className="font-bold text-slate-900 text-sm leading-snug">{cat.label}</h3>
              <p className="text-sm text-slate-500">{cat.count} entries</p>
            </button>
          ))}
        </div>
      )}

      <div
        className={
          variant === "page"
            ? "bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
            : undefined
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            {variant === "embedded" && (
              <>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderOpen size={20} className="text-cyan-600" />
                  Supporting documents
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a set of files as one entry — click a row to view all files inside.
                </p>
              </>
            )}
            {variant === "page" && (
              <div className="relative w-full sm:max-w-xs">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search document sets…"
                  className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>
          {showUploadButton && (
            <button
              type="button"
              onClick={() => {
                setUploadProjectId(project.id);
                setShowForm((v) => !v);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium shrink-0"
            >
              <Upload size={16} />
              {showForm ? "Cancel upload" : "Upload documents"}
            </button>
          )}
          <TableReportActions
            report={documentsReport}
            projectId={project.id}
            disabled={filteredDocuments.length === 0}
          />
        </div>

        {showForm && showUploadButton && (
          <form
            onSubmit={handleUpload}
            className="mb-6 p-4 border border-cyan-100 bg-cyan-50/40 rounded-lg space-y-4"
          >
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}
            {allowProjectSelect && projectOptions.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Upload to project</label>
                <select
                  value={uploadProjectId}
                  onChange={(e) => setUploadProjectId(Number(e.target.value))}
                  className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-cyan-600 outline-none"
                >
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {!canManageProjectDocuments(user, p) ? " (view only)" : ""}
                    </option>
                  ))}
                </select>
                {!canManageUpload && (
                  <p className="text-xs text-amber-700">
                    You can view this project&apos;s documents but cannot upload to it. Choose another
                    project or contact the project manager.
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Document set title{" "}
                  <span className="text-slate-400 font-normal">
                    {selectedFiles.length > 1 ? "(required)" : "(optional)"}
                  </span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Building permit package — Phase 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-cyan-600 outline-none"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-cyan-600 outline-none"
                placeholder="Issuing authority, revision, expiry date…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Files</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.zip"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white file:text-cyan-700 file:font-medium hover:file:bg-cyan-50"
              />
              <p className="text-xs text-slate-500">
                Select multiple files — they will be saved together as one document entry.
              </p>
              {selectedFiles.length > 0 && (
                <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                  {selectedFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between gap-2 text-sm text-slate-700 py-1 px-1"
                    >
                      <span className="truncate min-w-0">
                        <span className="font-medium">{file.name}</span>
                        <span className="text-slate-400 ml-2">{formatFileSize(file.size)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        disabled={uploading}
                        className="shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-50"
                        title="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploading || selectedFiles.length === 0 || !canManageUpload}
                className="flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-60 text-sm font-medium"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading
                  ? "Uploading…"
                  : selectedFiles.length > 1
                    ? `Save ${selectedFiles.length} files as one entry`
                    : "Save document"}
              </button>
            </div>
          </form>
        )}

        {!showForm && error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <div className="py-10 text-center text-slate-500 text-sm">Loading documents…</div>
        ) : documents.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50">
            <FileText size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 text-sm">No supporting documents uploaded yet.</p>
            {canManageView && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 text-cyan-600 font-semibold text-sm hover:underline"
              >
                Upload the first document set
              </button>
            )}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            No document sets match your search or filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-semibold w-8" />
                  <th className="pb-3 font-semibold">Document set</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold hidden md:table-cell">Files</th>
                  <th className="pb-3 font-semibold hidden md:table-cell">Total size</th>
                  <th className="pb-3 font-semibold hidden lg:table-cell">Uploaded</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => {
                  const isExpanded = expandedDocId === doc.id;
                  const attachments = doc.attachments ?? [];
                  return (
                    <Fragment key={doc.id}>
                      <tr
                        onClick={() => toggleExpanded(doc.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? "bg-cyan-50/60" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="py-3 pl-1 text-slate-400">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-900">{doc.title}</div>
                          {doc.description && !isExpanded && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{doc.description}</p>
                          )}
                          {!isExpanded && attachments.length > 0 && (
                            <p className="text-xs text-cyan-700 mt-0.5">
                              Click to view {doc.file_count} file{doc.file_count === 1 ? "" : "s"}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {doc.category_display}
                          </span>
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell text-slate-600">
                          {doc.file_count}
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell text-slate-600">
                          {formatFileSize(doc.total_size_bytes)}
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell text-slate-600">
                          <div>{new Date(doc.created_at).toLocaleDateString()}</div>
                          {doc.uploaded_by_name && (
                            <div className="text-xs text-slate-400">{doc.uploaded_by_name}</div>
                          )}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {canManageView && (
                            <button
                              type="button"
                              onClick={() => handleDelete(doc)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded-md"
                              title="Delete entire set"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${doc.id}-files`} className="bg-cyan-50/30">
                          <td colSpan={7} className="px-4 pb-4 pt-0">
                            <div className="ml-6 rounded-lg border border-cyan-100 bg-white p-4 shadow-sm">
                              {doc.description && (
                                <p className="text-sm text-slate-600 mb-3 pb-3 border-b border-slate-100">
                                  {doc.description}
                                </p>
                              )}
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                Files in this set ({attachments.length})
                              </p>
                              <ul className="space-y-2">
                                {attachments.map((att, idx) => (
                                  <li
                                    key={att.id ?? `${doc.id}-att-${idx}`}
                                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 truncate">
                                        {att.file_name || att.original_name || "File"}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {formatFileSize(att.file_size_bytes)}
                                      </p>
                                    </div>
                                    {att.file_url && (
                                      <a
                                        href={att.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-md font-medium shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download size={14} />
                                        View
                                      </a>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
