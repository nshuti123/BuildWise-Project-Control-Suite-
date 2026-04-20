import { Calendar, CheckCircle2, Image, MessageSquare } from "lucide-react";

export function ClientDashboard() {
  const milestones = [
    {
      name: "Foundation Complete",
      date: "Mar 15, 2024",
      status: "completed",
    },
    {
      name: "Structural Framework",
      date: "May 20, 2024",
      status: "in-progress",
    },
    {
      name: "Roofing & Exterior",
      date: "Jul 10, 2024",
      status: "upcoming",
    },
    {
      name: "Interior Finishing",
      date: "Sep 30, 2024",
      status: "upcoming",
    },
  ];
  const photos = [
    {
      url: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=300&h=200",
      caption: "Site Overview",
    },
    {
      url: "https://images.unsplash.com/photo-1590644258861-94285fe315ab?auto=format&fit=crop&q=80&w=300&h=200",
      caption: "Foundation Work",
    },
    {
      url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=300&h=200",
      caption: "Structural Steel",
    },
  ];
  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Riverside Mall Complex
            </h1>
            <p className="text-slate-600">
              Project Dashboard for Adroit Construction Company Ltd.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">Project Status</p>
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800 font-bold text-sm">
              On Schedule
            </span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Overall Completion</p>
            <p className="text-3xl font-bold text-blue-600">67%</p>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{
                  width: "67%",
                }}
              ></div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Budget Utilized</p>
            <p className="text-3xl font-bold text-slate-900">Rwf850M</p>
            <p className="text-xs text-slate-500 mt-1">
              of Rwf1.2B Total Budget
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Days Remaining</p>
            <p className="text-3xl font-bold text-slate-900">145</p>
            <p className="text-xs text-slate-500 mt-1">Target: Dec 20, 2024</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Safety Record</p>
            <p className="text-3xl font-bold text-green-600">120</p>
            <p className="text-xs text-slate-500 mt-1">Days without incident</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="text-blue-600" size={24} />
              Project Milestones
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="flex items-center p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${milestone.status === "completed" ? "bg-green-100 text-green-600" : milestone.status === "in-progress" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"}`}
                  >
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-bold text-slate-900">
                      {milestone.name}
                    </h3>
                    <p className="text-sm text-slate-500">{milestone.date}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${milestone.status === "completed" ? "bg-green-100 text-green-800" : milestone.status === "in-progress" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-800"}`}
                  >
                    {milestone.status === "completed"
                      ? "Completed"
                      : milestone.status === "in-progress"
                        ? "In Progress"
                        : "Upcoming"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Image className="text-blue-600" size={24} />
              Recent Site Photos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="group relative rounded-lg overflow-hidden shadow-sm border border-slate-200 aspect-video"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p className="text-white font-medium text-sm">
                      {photo.caption}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-lg mb-2">Project Manager Contact</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold text-xl">
                JM
              </div>
              <div>
                <p className="font-semibold">John Manager</p>
                <p className="text-blue-100 text-sm">Project Lead</p>
              </div>
            </div>
            <button className="w-full bg-white text-blue-600 font-semibold py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              <MessageSquare size={18} />
              Send Message
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Recent Updates</h3>
            <div className="space-y-4">
              <div className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <p className="text-xs text-slate-500 mb-1">Today, 10:30 AM</p>
                <p className="text-sm text-slate-800">
                  Structural framework for Block B has commenced ahead of
                  schedule.
                </p>
              </div>
              <div className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <p className="text-xs text-slate-500 mb-1">
                  Yesterday, 4:15 PM
                </p>
                <p className="text-sm text-slate-800">
                  Monthly progress report for May is now available for download.
                </p>
              </div>
              <div className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <p className="text-xs text-slate-500 mb-1">Jun 10, 2024</p>
                <p className="text-sm text-slate-800">
                  Material delivery for roofing phase has been confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
