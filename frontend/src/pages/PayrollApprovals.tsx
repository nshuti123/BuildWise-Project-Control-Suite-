import React, { useState, useEffect } from 'react';
import api from '../api';
import { CheckCircle2, XCircle, Search, DollarSign, Calendar, ChevronDown, ChevronUp, User } from 'lucide-react';
import { ConfirmActionModal } from '../components/ConfirmActionModal';

export function PayrollApprovals() {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPayroll, setExpandedPayroll] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; type: any; onConfirm: () => void}>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => {} });

  useEffect(() => {
    fetchPayrolls();
  }, []);

  const fetchPayrolls = async () => {
    try {
      const resp = await api.get('/workforce/payrolls/');
      setPayrolls(resp.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewClick = (id: number, status: 'approved' | 'rejected') => {
    setConfirmModal({
      isOpen: true,
      title: status === 'approved' ? "Approve Payroll" : "Reject Payroll",
      message: `Are you sure you want to mark this payroll run as ${status.toUpperCase()}? This action will freeze the transaction.`,
      type: status === 'approved' ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          await api.patch(`/workforce/payrolls/${id}/review/`, { status });
          fetchPayrolls();
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const filtered = payrolls.filter(p => p.date.includes(searchQuery));

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Payroll Approvals</h1>
          <p className="text-slate-600">Review and authorize daily manual workforce labor payments</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 relative">
           <Search size={16} className="absolute left-7 top-1/2 -translate-y-[1.2rem] text-slate-400" />
           <input 
             type="text" 
             placeholder="Search by date (YYYY-MM-DD)..." 
             value={searchQuery}
             onChange={e => setSearchQuery(e.target.value)}
             className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none w-64 md:w-80 shadow-sm transition-shadow"
           />
        </div>
        
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No payroll batches found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(payroll => (
              <div key={payroll.id} className="flex flex-col">
                <div 
                  className={`p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${expandedPayroll === payroll.id ? 'bg-blue-50/30' : ''}`}
                  onClick={() => setExpandedPayroll(expandedPayroll === payroll.id ? null : payroll.id)}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${payroll.status === 'pending' ? 'bg-orange-100 text-orange-600' : payroll.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg text-slate-900">Total Run: {payroll.total_amount} Rwf</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                           payroll.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                           payroll.status === 'approved' ? 'bg-green-100 text-green-700' : 
                           'bg-red-100 text-red-700'
                        }`}>
                          {payroll.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> {payroll.date}</span>
                        <span className="flex items-center gap-1.5"><User size={14} /> Initiator: {payroll.initiated_by_name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {payroll.status === 'pending' && (
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => handleReviewClick(payroll.id, 'approved')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
                        >
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button 
                          onClick={() => handleReviewClick(payroll.id, 'rejected')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium text-sm rounded-lg transition-colors"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    )}
                    <button className="text-slate-400 p-2 hover:bg-slate-100 rounded-full transition-colors">
                      {expandedPayroll === payroll.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>
                
                {/* Expandable Line Items */}
                {expandedPayroll === payroll.id && (
                  <div className="bg-slate-50 border-t border-slate-100 p-6 animate-fade-in shadow-inner">
                    <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Payroll Line Items ({payroll.records?.length || 0})</h4>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider">Worker Name</th>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider">Trade</th>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider">Calculation Details</th>
                            <th className="px-6 py-3 uppercase text-xs tracking-wider text-right">Amount (Rwf)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(payroll.records || []).map((record: any) => (
                            <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 font-bold text-slate-800">{record.worker_name}</td>
                              <td className="px-6 py-3 text-slate-600 capitalize">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold text-slate-700">{record.worker_role}</span>
                              </td>
                              <td className="px-6 py-3 text-slate-600">
                                {record.calculated_amount > 0 ? (
                                   <span className="text-green-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Paid based on attendance</span>
                                ) : (
                                   <span className="text-red-500 font-medium">Unpaid (Absent)</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-medium text-slate-900">{record.calculated_amount} Rwf</td>
                            </tr>
                          ))}
                          {(!payroll.records || payroll.records.length === 0) && (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No records found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
