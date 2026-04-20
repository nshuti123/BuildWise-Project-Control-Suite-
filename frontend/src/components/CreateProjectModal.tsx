import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  AlertCircle,
  HardHat,
} from "lucide-react";

import api from "../api";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [sector, setSector] = useState("");
  const [cell, setCell] = useState("");
  const [village, setVillage] = useState("");

  const [provincesList, setProvincesList] = useState<{id: number, name: string}[]>([]);
  const [districtsList, setDistrictsList] = useState<{id: number, name: string}[]>([]);
  const [sectorsList, setSectorsList] = useState<{id: number, name: string}[]>([]);
  const [cellsList, setCellsList] = useState<{id: number, name: string}[]>([]);
  const [villagesList, setVillagesList] = useState<{id: number, name: string}[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    budget: "",
    deadline: "",
    status: "on-track",
    construction_type: "commercial",
    address_line_2: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        budget: "",
        deadline: "",
        status: "on-track",
        construction_type: "commercial",
        address_line_2: "",
      });
      setProvince("");
      setDistrict("");
      setSector("");
      setCell("");
      setVillage("");
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      api.get("/projects/locations/?parent=null").then((res) => setProvincesList(res.data));
    }
  }, [isOpen]);

  useEffect(() => {
    if (province) {
      api.get(`/projects/locations/?parent=${province}`).then((res) => setDistrictsList(res.data));
    } else {
      setDistrictsList([]);
    }
  }, [province]);

  useEffect(() => {
    if (district) {
      api.get(`/projects/locations/?parent=${district}`).then((res) => setSectorsList(res.data));
    } else {
      setSectorsList([]);
    }
  }, [district]);

  useEffect(() => {
    if (sector) {
      api.get(`/projects/locations/?parent=${sector}`).then((res) => setCellsList(res.data));
    } else {
      setCellsList([]);
    }
  }, [sector]);

  useEffect(() => {
    if (cell) {
      api.get(`/projects/locations/?parent=${cell}`).then((res) => setVillagesList(res.data));
    } else {
      setVillagesList([]);
    }
  }, [cell]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/projects/", { ...formData, location: village });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create project:", err);
      setError(
        err.response?.data?.detail ||
          "Failed to create project. Please ensure all fields are properly formatted.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm shadow-2xl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Create New Project
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Initialize a new construction project workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mt-4 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2 border border-red-100">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Project Name
            </label>
            <div className="relative">
              <Building2
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g. Kigali Heights Phase 2"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              <MapPin size={16} className="text-slate-400" />
              Administrative Location
            </label>
            <div className="grid grid-cols-2 gap-3">
              <select
                required
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setDistrict("");
                  setSector("");
                  setCell("");
                  setVillage("");
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
              >
                <option value="">Select Province</option>
                {provincesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                required
                disabled={!province}
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setSector("");
                  setCell("");
                  setVillage("");
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select District</option>
                {districtsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                required
                disabled={!district}
                value={sector}
                onChange={(e) => {
                  setSector(e.target.value);
                  setCell("");
                  setVillage("");
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Sector</option>
                {sectorsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                required
                disabled={!sector}
                value={cell}
                onChange={(e) => {
                  setCell(e.target.value);
                  setVillage("");
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Cell</option>
                {cellsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                required
                disabled={!cell}
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Village</option>
                {villagesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              <MapPin size={16} className="text-slate-400" />
              Address Line 2 (Street / Code)
            </label>
            <input
              type="text"
              value={formData.address_line_2}
              onChange={(e) =>
                setFormData({ ...formData, address_line_2: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g. KK 509 St"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Total Budget
              </label>
              <div className="relative">
                <DollarSign
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  required
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: e.target.value })
                  }
                  placeholder="e.g. Rwf 850M"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Target Deadline
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="date"
                  required
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              Initial Status Indicator
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["on-track", "at-risk"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: s })}
                  className={`py-2 text-sm font-semibold rounded-lg border transition-all flex items-center justify-center gap-2 ${
                    formData.status === s
                      ? s === "on-track"
                        ? "bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-100"
                        : "bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm shadow-yellow-100"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s === "on-track" ? "✅ On Track" : "⚠️ At Risk"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              Construction Type
            </label>
            <div className="relative">
              <HardHat
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <select
                required
                value={formData.construction_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    construction_type: e.target.value,
                  })
                }
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none capitalize"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
                <option value="infrastructure">Infrastructure</option>
              </select>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? "Initializing Project..." : "Initialize Project"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
