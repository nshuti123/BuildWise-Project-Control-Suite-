import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertOctagon, Loader2 } from "lucide-react";
import api from "../api";

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
}

export function IncidentModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
}: IncidentModalProps) {
  const [incidentType, setIncidentType] = useState("safety");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please provide a description of the incident.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post("/projects/incidents/", {
        project: projectId,
        incident_type: incidentType,
        severity: severity,
        description: description,
        status: "open",
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to submit incident report.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIncidentType("safety");
    setSeverity("medium");
    setDescription("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg shadow-sm">
              <AlertOctagon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Report Site Incident
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Log a safety or equipment issue
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Incident Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'safety', label: 'Safety Issue' },
                { id: 'equipment', label: 'Equipment Failure' },
                { id: 'quality', label: 'Quality Defect' },
                { id: 'other', label: 'Other Incident' }
              ].map(type => (
                <div 
                  key={type.id}
                  onClick={() => setIncidentType(type.id)}
                  className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                    incidentType === type.id 
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="text-sm">{type.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Severity Level
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-800"
              required
            >
              <option value="low">Low - Minor issue, no immediate risk</option>
              <option value="medium">Medium - Needs attention soon</option>
              <option value="high">High - Immediate attention required</option>
              <option value="critical">Critical - Work stoppage, severe risk</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Incident Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-800 h-28 resize-none"
              placeholder="Provide specific details about what happened, location, and involved parties..."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Submitting Report...
                </>
              ) : (
                "Submit Incident Report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
