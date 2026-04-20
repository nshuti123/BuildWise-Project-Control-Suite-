import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, Trash2, FileSpreadsheet } from "lucide-react";
import api from "../api";

interface AddWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
  workerToEdit?: any;
}

const defaultWorker = {
  first_name: "",
  last_name: "",
  phone_number: "",
  role: "laborer",
  daily_rate: 0,
  start_date: "",
  end_date: "",
  is_active: true,
};

export function AddWorkerModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
  workerToEdit,
}: AddWorkerModalProps) {
  const [workersList, setWorkersList] = useState([{ ...defaultWorker }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadMode, setUploadMode] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  React.useEffect(() => {
    if (workerToEdit && isOpen) {
      setWorkersList([{ ...workerToEdit }]);
      setUploadMode(false);
    } else if (isOpen) {
      setWorkersList([{ ...defaultWorker }]);
      setUploadMode(false);
      setCsvFile(null);
    }
  }, [workerToEdit, isOpen]);

  if (!isOpen) return null;

  const updateWorker = (index: number, field: string, value: any) => {
    const newList = [...workersList];
    newList[index] = { ...newList[index], [field]: value };
    setWorkersList(newList);
  };

  const addRow = () => {
    setWorkersList([...workersList, { ...defaultWorker }]);
  };

  const removeRow = (index: number) => {
    if (workersList.length > 1) {
      setWorkersList(workersList.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (uploadMode) {
        if (!csvFile) throw new Error("Please select a CSV file first");
        const formPayload = new FormData();
        formPayload.append("file", csvFile);
        formPayload.append("project", projectId.toString());
        await api.post("/workforce/workers/bulk_upload/", formPayload, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setCsvFile(null);
      } else {
        const payload = workersList.map((w) => ({
          ...w,
          project: projectId,
          start_date: w.start_date ? w.start_date : null,
          end_date: w.end_date ? w.end_date : null,
        }));

        if (workerToEdit) {
            await api.put(`/workforce/workers/${workerToEdit.id}/`, payload[0]);
        } else {
            await Promise.all(
              payload.map((workerPayload) =>
                api.post("/workforce/workers/", workerPayload)
              )
            );
        }
        setWorkersList([{ ...defaultWorker }]);
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      const respData = err.response?.data;
      if (respData) {
         if (respData.detail) {
            setError(respData.detail);
         } else if (typeof respData === 'object') {
            const errorMessages = Object.entries(respData)
               .map(([key, val]) => `${key}: ${Array.isArray(val) ? val[0] : val}`)
               .join(" | ");
            setError(errorMessages);
         } else {
            setError("Failed to add one or more workers");
         }
      } else {
         setError("Network or server failure");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{workerToEdit ? "Edit Worker Profile" : "Add Site Workers"}</h2>
              <p className="text-xs text-slate-500 font-medium">{workerToEdit ? "Modify personnel constraints" : "Register one or multiple laborers at once"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {!workerToEdit && (
          <div className="flex bg-slate-100 p-1 m-6 mb-0 rounded-lg shrink-0">
            <button onClick={() => setUploadMode(false)} className={`flex-1 py-1.5 text-sm font-bold rounded-md ${!uploadMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Manual Entry</button>
            <button onClick={() => setUploadMode(true)} className={`flex-1 py-1.5 text-sm font-bold rounded-md ${uploadMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Excel / CSV Upload</button>
          </div>
        )}

        {uploadMode && !workerToEdit ? (
          <div className="p-6 min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl m-6 bg-slate-50">
            <FileSpreadsheet size={48} className="text-slate-400 mb-4" />
            <p className="text-slate-700 font-bold mb-2">Upload Worker Spreadsheet</p>
            <p className="text-xs text-slate-500 text-center max-w-sm mb-6">
              Export your Excel file as CSV. Headers must perfectly match: <br/>
              <b>first_name, last_name, phone_number, role, daily_rate, start_date, end_date</b>
            </p>
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)} 
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" 
            />
            {error && <p className="text-red-500 text-xs mt-4 font-medium">{error}</p>}
          </div>
        ) : (
          <div className="overflow-y-auto p-6 bg-slate-50 border-b border-slate-200">
            <form id="worker-form" onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

            {workersList.map((worker, index) => (
              <div
                key={index}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative group transition-all"
              >
                {workersList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                    title="Remove worker"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                  Worker #{index + 1}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">First Name</label>
                    <input
                      type="text"
                      required
                      value={worker.first_name}
                      onChange={(e) => updateWorker(index, "first_name", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                      placeholder="e.g. John"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Last Name</label>
                    <input
                      type="text"
                      required
                      value={worker.last_name}
                      onChange={(e) => updateWorker(index, "last_name", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                      placeholder="e.g. Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Phone</label>
                    <input
                      type="text"
                      value={worker.phone_number}
                      onChange={(e) => updateWorker(index, "phone_number", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                      placeholder="+250 78X..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Trade / Role</label>
                    <select
                      value={worker.role}
                      onChange={(e) => updateWorker(index, "role", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white transition-shadow"
                    >
                      <option value="mason">Mason</option>
                      <option value="carpenter">Carpenter</option>
                      <option value="plumber">Plumber</option>
                      <option value="electrician">Electrician</option>
                      <option value="laborer">Laborer</option>
                      <option value="welder">Welder</option>
                      <option value="painter">Painter</option>
                      <option value="driver">Driver</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Daily Pay (Rwf)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={worker.daily_rate}
                      onChange={(e) => updateWorker(index, "daily_rate", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Contract Start</label>
                    <input
                      type="date"
                      value={worker.start_date || ""}
                      onChange={(e) => updateWorker(index, "start_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Contract End</label>
                    <input
                      type="date"
                      value={worker.end_date || ""}
                      onChange={(e) => updateWorker(index, "end_date", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Account Status</label>
                    <div className="flex items-center gap-3 pt-2">
                       <input 
                         type="checkbox" 
                         id={`active-${index}`}
                         checked={worker.is_active} 
                         onChange={(e) => updateWorker(index, "is_active", e.target.checked)} 
                         className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                       />
                       <label htmlFor={`active-${index}`} className="text-sm font-bold text-slate-700 cursor-pointer">Worker isActive</label>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!workerToEdit && (
              <button
                type="button"
                onClick={addRow}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-white hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={16} />
                Add Another Worker
              </button>
            )}
          </form>
        </div>
        )}

        <div className="p-6 bg-white shrink-0 flex gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (uploadMode && !csvFile)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : workerToEdit ? "Update System" : uploadMode ? "Upload & Import" : `Save ${workersList.length} Worker${workersList.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
