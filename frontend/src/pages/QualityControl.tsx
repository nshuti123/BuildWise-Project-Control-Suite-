import { Camera, AlertCircle, CheckCircle2, Filter, Plus } from "lucide-react";

export function QualityControl() {
  const issues = [
    {
      id: "QC-204",
      title: "Paint Peeling in Corridor",
      location: "Block A - 2nd Floor",
      assignedTo: "Paint Subcontractor",
      status: "Open",
      priority: "Medium",
      date: "Oct 12, 2024",
      image:
        "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=200&h=150",
    },
    {
      id: "QC-203",
      title: "Cracked Tile",
      location: "Lobby Entrance",
      assignedTo: "Tile Team",
      status: "Resolved",
      priority: "Low",
      date: "Oct 10, 2024",
      image:
        "https://images.unsplash.com/photo-1600607686527-6fb886090705?auto=format&fit=crop&q=80&w=200&h=150",
    },
    {
      id: "QC-201",
      title: "Exposed Wiring",
      location: "Server Room",
      assignedTo: "Electric Co.",
      status: "Open",
      priority: "High",
      date: "Oct 08, 2024",
      image:
        "https://images.unsplash.com/photo-1565514020125-636c0757754f?auto=format&fit=crop&q=80&w=200&h=150",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Control</h1>
          <p className="text-slate-500">
            Snag lists, inspections, and defect tracking
          </p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus size={20} />
          Report Issue
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Filter issues..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow"
          >
            <div className="w-full md:w-48 h-32 shrink-0 rounded-lg overflow-hidden bg-slate-100 relative">
              <img
                src={issue.image}
                alt={issue.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full text-white">
                <Camera size={14} />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {issue.id}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        issue.priority === "High"
                          ? "bg-red-100 text-red-700"
                          : issue.priority === "Medium"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {issue.priority}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {issue.title}
                  </h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    issue.status === "Resolved"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {issue.status}
                </span>
              </div>

              <p className="text-sm text-slate-600 mb-4 flex items-center gap-2">
                <AlertCircle size={14} className="text-slate-400" />
                {issue.location}
              </p>

              <div className="flex items-center gap-6 text-sm text-slate-500 border-t border-slate-100 pt-3">
                <span>
                  Assigned:{" "}
                  <span className="text-slate-900 font-medium">
                    {issue.assignedTo}
                  </span>
                </span>
                <span>Date: {issue.date}</span>
              </div>
            </div>

            <div className="flex flex-col justify-center border-l-0 md:border-l border-slate-100 md:pl-6 gap-3">
              <button className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1">
                View Details
              </button>
              {issue.status !== "Resolved" && (
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
