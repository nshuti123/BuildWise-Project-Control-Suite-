import { Users, Clock, Plus, DollarSign } from "lucide-react";

export function Bidding() {
  const bids = [
    {
      id: "BID-2024-001",
      title: "Electrical Works - Phase 2",
      package: "MEP Package B",
      status: "Active",
      deadline: "Oct 30, 2024",
      bidders: 4,
      lowestBid: 1250000,
    },
    {
      id: "BID-2024-002",
      title: "Landscaping & Exterior",
      package: "Ext. Finishes",
      status: "Review",
      deadline: "Oct 10, 2024",
      bidders: 6,
      lowestBid: 850000,
    },
    {
      id: "BID-2024-003",
      title: "Security System Installation",
      package: "Security",
      status: "Draft",
      deadline: "Nov 15, 2024",
      bidders: 0,
      lowestBid: 0,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bidding & Tendering
          </h1>
          <p className="text-slate-500">
            Manage subcontractor tenders and proposals
          </p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus size={20} />
          Create Tender Package
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {bids.map((bid) => (
          <div
            key={bid.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {bid.id}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  bid.status === "Active"
                    ? "bg-green-100 text-green-700"
                    : bid.status === "Review"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {bid.status}
              </span>
            </div>

            <h3 className="font-bold text-slate-900 text-lg mb-1">
              {bid.title}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{bid.package}</p>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-2">
                  <Clock size={16} /> Deadline
                </span>
                <span className="font-medium text-slate-900">
                  {bid.deadline}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-2">
                  <Users size={16} /> Bidders
                </span>
                <span className="font-medium text-slate-900">
                  {bid.bidders}
                </span>
              </div>
              {bid.lowestBid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2">
                    <DollarSign size={16} /> Lowest Bid
                  </span>
                  <span className="font-medium text-green-600">
                    Rwf{bid.lowestBid.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-lg text-sm transition-colors">
                View Docs
              </button>
              <button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
