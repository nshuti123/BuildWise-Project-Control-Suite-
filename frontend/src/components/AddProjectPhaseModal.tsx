import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Calendar } from "lucide-react";
import api from "../api";
import { formatApiError } from "../utils/apiHelpers";

export interface ProjectPhaseFormData {
  id: number;
  name: string;
  description?: string;
  order?: number;
  start_date?: string | null;
  end_date?: string | null;
}

interface AddProjectPhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  phase?: ProjectPhaseFormData | null;
  allPhases?: ProjectPhaseFormData[];
  onSuccess: () => void;
}

function dayAfter(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function AddProjectPhaseModal({
  isOpen,
  onClose,
  projectId,
  phase,
  allPhases = [],
  onSuccess,
}: AddProjectPhaseModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sortedPhases = useMemo(
    () => [...allPhases].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [allPhases],
  );

  const previousPhase = useMemo(() => {
    if (phase?.id) {
      const idx = sortedPhases.findIndex((p) => p.id === phase.id);
      return idx > 0 ? sortedPhases[idx - 1] : null;
    }
    return sortedPhases.length > 0 ? sortedPhases[sortedPhases.length - 1] : null;
  }, [phase, sortedPhases]);

  const minStartDate = previousPhase?.end_date ? dayAfter(previousPhase.end_date) : undefined;

  useEffect(() => {
    if (!isOpen) return;
    if (phase) {
      setName(phase.name);
      setDescription(phase.description || "");
      setStartDate(phase.start_date?.slice(0, 10) || "");
      setEndDate(phase.end_date?.slice(0, 10) || "");
    } else {
      setName("");
      setDescription("");
      setStartDate(minStartDate || "");
      setEndDate("");
    }
    setError("");
  }, [phase, isOpen, minStartDate]);

  useEffect(() => {
    if (!phase && minStartDate && !startDate) {
      setStartDate(minStartDate);
    }
  }, [minStartDate, phase, startDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Start date and end date are required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }
    if (minStartDate && startDate < minStartDate) {
      setError(`Start date must be on or after ${minStartDate} (after the previous phase ends).`);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const payload = {
        project: projectId,
        name: name.trim(),
        description: description.trim(),
        start_date: startDate,
        end_date: endDate,
      };
      if (phase?.id) {
        await api.patch(`/projects/phases/${phase.id}/`, payload);
      } else {
        await api.post("/projects/phases/", payload);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(formatApiError(err, "Failed to save phase"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!phase?.id) return;
    if (
      !window.confirm(
        "Delete this phase? All timeline tasks in this phase will also be removed.",
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.delete(`/projects/phases/${phase.id}/`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(formatApiError(err, "Failed to delete phase"));
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-slate-900">
            {phase ? "Edit Phase" : "Add Construction Phase"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {phase && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Extending this phase&apos;s end date shifts all later phases by the same number of days.
            </p>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Phase name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="e.g. Foundation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-1">
                <Calendar size={14} /> Start date
              </label>
              <input
                type="date"
                required
                min={minStartDate}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              />
              {minStartDate && (
                <p className="text-xs text-slate-500">Earliest: {minStartDate}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-1">
                <Calendar size={14} /> End date
              </label>
              <input
                type="date"
                required
                min={startDate || minStartDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none resize-none"
              placeholder="Scope notes for this phase…"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {phase ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="text-sm font-semibold text-red-600 hover:text-red-800"
              >
                Delete phase
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? "Saving…" : phase ? "Update" : "Create phase"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
