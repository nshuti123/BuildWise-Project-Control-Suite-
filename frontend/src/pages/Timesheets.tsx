import { Calendar, Users, ChevronLeft, ChevronRight, Save } from "lucide-react";

export function Timesheets() {
  const workers = [
    {
      id: 1,
      name: "James Smith",
      role: "Foreman",
      mon: 8,
      tue: 8,
      wed: 8,
      thu: 8,
      fri: 8,
      total: 40,
    },
    {
      id: 2,
      name: "Robert Johnson",
      role: "Electrician",
      mon: 8,
      tue: 8,
      wed: 9,
      thu: 8,
      fri: 7,
      total: 40,
    },
    {
      id: 3,
      name: "Michael Brown",
      role: "Laborer",
      mon: 9,
      tue: 9,
      wed: 9,
      thu: 9,
      fri: 9,
      total: 45,
    },
    {
      id: 4,
      name: "David Wilson",
      role: "Carpenter",
      mon: 0,
      tue: 8,
      wed: 8,
      thu: 8,
      fri: 8,
      total: 32,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Labor Timesheets
          </h1>
          <p className="text-slate-500">Track workforce hours and attendance</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
            <Calendar size={18} />
            Week of Oct 14
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="p-1 rounded-full hover:bg-slate-100 transition-colors">
              <ChevronLeft size={20} className="text-slate-500" />
            </button>
            <h2 className="font-bold text-lg text-slate-900">
              October 14 - October 20, 2024
            </h2>
            <button className="p-1 rounded-full hover:bg-slate-100 transition-colors">
              <ChevronRight size={20} className="text-slate-500" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users size={16} />
            <span>4 Workers Active</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">
                  Worker
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Mon
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Tue
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Wed
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Thu
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Fri
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Sat
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                  Sun
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-900 uppercase tracking-wider text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map((worker) => (
                <tr
                  key={worker.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                        {worker.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {worker.name}
                        </p>
                        <p className="text-xs text-slate-500">{worker.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      defaultValue={worker.mon}
                      className="w-12 text-center border border-slate-200 rounded py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      defaultValue={worker.tue}
                      className="w-12 text-center border border-slate-200 rounded py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      defaultValue={worker.wed}
                      className="w-12 text-center border border-slate-200 rounded py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      defaultValue={worker.thu}
                      className="w-12 text-center border border-slate-200 rounded py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      defaultValue={worker.fri}
                      className="w-12 text-center border border-slate-200 rounded py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      defaultValue={0}
                      className="w-12 text-center border border-slate-200 rounded py-1 text-sm bg-slate-50 text-slate-400"
                      disabled
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      defaultValue={0}
                      className="w-12 text-center border border-slate-200 rounded py-1 text-sm bg-slate-50 text-slate-400"
                      disabled
                    />
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {worker.total}h
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
