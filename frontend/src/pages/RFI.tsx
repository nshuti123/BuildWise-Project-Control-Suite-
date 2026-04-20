import { HelpCircle, MessageSquare, Paperclip, Clock, User, Search, Filter, ArrowRight } from 'lucide-react';

export function RFI() {
  const rfis = [
    {
      id: "RFI-042",
      subject: "Clarification on Beam Dimensions",
      sender: "Site Engineer",
      assignee: "Structural Engineer",
      status: "Open",
      date: "Oct 12, 2024",
      replies: 2,
      urgent: true
    },
    {
      id: "RFI-041",
      subject: "Paint Spec for Corridor B",
      sender: "Subcontractor",
      assignee: "Architect",
      status: "Closed",
      date: "Oct 10, 2024",
      replies: 4,
      urgent: false
    },
    {
      id: "RFI-040",
      subject: "Electrical Outlet Positioning",
      sender: "Site Engineer",
      assignee: "MEP Consultant",
      status: "Pending Review",
      date: "Oct 08, 2024",
      replies: 1,
      urgent: false
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requests for Information (RFI)</h1>
          <p className="text-slate-500">Track and manage technical queries</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <HelpCircle size={20} />
          Create RFI
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search RFIs..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2">
          <Filter size={18} />
          Filter
        </button>
      </div>

      <div className="grid gap-4">
        {rfis.map((rfi) => (
          <div key={rfi.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className={`mt-1 p-2 rounded-lg ${
                  rfi.status === 'Open' ? 'bg-blue-50 text-blue-600' :
                  rfi.status === 'Closed' ? 'bg-slate-100 text-slate-500' :
                  'bg-yellow-50 text-yellow-600'
                }`}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">{rfi.id}</span>
                    {rfi.urgent && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Urgent</span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">{rfi.subject}</h3>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  rfi.status === 'Open' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                  rfi.status === 'Closed' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                  'bg-yellow-50 text-yellow-800 border-yellow-200'
                }`}>
                  {rfi.status}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <User size={16} />
                  <span>From: {rfi.sender}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} className="text-slate-300" />
                  <span>To: {rfi.assignee}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Paperclip size={16} className="text-slate-400" />
                  <span>2</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={16} className="text-slate-400" />
                  <span>{rfi.date}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
