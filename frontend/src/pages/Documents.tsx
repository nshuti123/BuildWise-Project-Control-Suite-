import {
  FolderOpen,
  Upload,
  Search,
  MoreHorizontal,
  Clock,
  Shield,
  Download,
} from "lucide-react";
export function Documents() {
  const documents = [
    {
      name: "Architectural Blueprints v2.4",
      type: "PDF",
      size: "12.5 MB",
      modified: "2 hours ago",
      owner: "Sarah Johnson",
      status: "approved",
    },
    {
      name: "Structural Analysis Report",
      type: "DOCX",
      size: "4.2 MB",
      modified: "Yesterday",
      owner: "David Lee",
      status: "pending",
    },
    {
      name: "Site Safety Guidelines 2024",
      type: "PDF",
      size: "1.8 MB",
      modified: "Jun 10, 2024",
      owner: "Admin",
      status: "approved",
    },
    {
      name: "Material Cost Estimation",
      type: "XLSX",
      size: "850 KB",
      modified: "Jun 08, 2024",
      owner: "Mike Chen",
      status: "draft",
    },
    {
      name: "Contractor Agreement - Phase 2",
      type: "PDF",
      size: "2.1 MB",
      modified: "Jun 05, 2024",
      owner: "Legal Dept",
      status: "approved",
    },
  ];
  const folders = [
    {
      name: "Blueprints & Drawings",
      count: 24,
    },
    {
      name: "Contracts & Legal",
      count: 12,
    },
    {
      name: "Safety Reports",
      count: 45,
    },
    {
      name: "Financials",
      count: 18,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Document Management
          </h1>
          <p className="text-slate-600">
            Centralized storage for project documentation
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Shield size={18} />
            <span className="text-sm font-medium">Permissions</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Upload size={18} />
            <span className="text-sm font-medium">Upload File</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {folders.map((folder, idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
          >
            <FolderOpen
              className="text-blue-500 mb-3 group-hover:scale-110 transition-transform"
              size={32}
            />
            <h3 className="font-bold text-slate-900">{folder.name}</h3>
            <p className="text-sm text-slate-500">{folder.count} files</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Recent Files</h2>
          <div className="relative w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Filter files..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-6 text-sm font-semibold text-slate-700">
                  Name
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-slate-700">
                  Owner
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-slate-700">
                  Last Modified
                </th>
                <th className="text-center py-3 px-6 text-sm font-semibold text-slate-700">
                  Status
                </th>
                <th className="text-right py-3 px-6 text-sm font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, index) => (
                <tr
                  key={index}
                  className="border-b border-slate-100 hover:bg-slate-50 group"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded flex items-center justify-center text-xs font-bold ${doc.type === "PDF" ? "bg-red-100 text-red-600" : doc.type === "XLSX" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}
                      >
                        {doc.type}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                          {doc.name}
                        </p>
                        <p className="text-xs text-slate-500">{doc.size}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600">
                    {doc.owner}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600 flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    {doc.modified}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${doc.status === "approved" ? "bg-green-100 text-green-800" : doc.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-800"}`}
                    >
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Download size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
