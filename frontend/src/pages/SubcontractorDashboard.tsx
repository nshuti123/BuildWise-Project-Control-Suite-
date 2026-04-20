import {
  Calendar,
  CheckSquare,
  Clock,
  MapPin,
  AlertCircle,
  Camera,
  Upload,
  ArrowRight,
} from "lucide-react";

export function SubcontractorDashboard() {
  const tasks = [
    {
      id: "T-104",
      title: "Electrical Wiring - 2nd Floor",
      status: "In Progress",
      deadline: "Oct 15, 2024",
      priority: "High",
      location: "Building A, Floor 2",
    },
    {
      id: "T-109",
      title: "Install Light Fixtures",
      status: "Pending",
      deadline: "Oct 20, 2024",
      priority: "Medium",
      location: "Building A, Lobby",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome / Status Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              Welcome back, Electric Co.
            </h1>
            <p className="text-slate-300">
              You have{" "}
              <span className="text-white font-bold">2 active tasks</span> for
              Riverside Mall Complex.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
              <Camera size={18} />
              Upload Media
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-white/20">
              View Schedule
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Task List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="text-blue-600" size={24} />
              Assigned Tasks
            </h2>
            <button className="text-blue-600 text-sm font-medium hover:underline">
              View All Tasks
            </button>
          </div>

          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {task.id}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          task.priority === "High"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {task.priority} Priority
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                      {task.title}
                    </h3>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      task.status === "In Progress"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <span>Due: {task.deadline}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    <span>{task.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <span>Est: 8h remaining</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-2 rounded-lg transition-colors border border-slate-200">
                    Log Hours
                  </button>
                  <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                    Mark Complete
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-orange-500" />
              Site Notices
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-xs font-bold text-orange-800 mb-1">
                  Safety Protocols
                </p>
                <p className="text-sm text-orange-900/80">
                  Hard hats required in Zone B due to overhead crane work today.
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-bold text-blue-800 mb-1">
                  Site Access
                </p>
                <p className="text-sm text-blue-900/80">
                  Main gate will be closed from 2PM-3PM for delivery.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex flex-col items-center gap-2 text-center">
                <Upload className="text-blue-600" size={24} />
                <span className="text-xs font-medium text-slate-700">
                  Submit Invoice
                </span>
              </button>
              <button className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex flex-col items-center gap-2 text-center">
                <AlertCircle className="text-red-500" size={24} />
                <span className="text-xs font-medium text-slate-700">
                  Report Incident
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
