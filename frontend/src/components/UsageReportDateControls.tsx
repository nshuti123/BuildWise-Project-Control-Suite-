import { Calendar, FileText } from "lucide-react";
import {
  getCalendarDayRangeFromDateKey,
  getTodayDateKey,
  getYesterdayDateKey,
} from "../utils/inventoryDateRange";

interface UsageReportDateControlsProps {
  dateKey: string;
  onDateChange: (dateKey: string) => void;
  onPrint: () => void;
  printDisabled?: boolean;
  stats?: { count: number; units: number };
  statsLoading?: boolean;
  /** Header row vs allocation panel toolbar */
  layout?: "inline" | "stacked";
}

export function UsageReportDateControls({
  dateKey,
  onDateChange,
  onPrint,
  printDisabled = false,
  stats,
  statsLoading = false,
  layout = "inline",
}: UsageReportDateControlsProps) {
  const dayLabel = getCalendarDayRangeFromDateKey(dateKey)?.label ?? dateKey;
  const maxDate = getTodayDateKey();

  const setPreset = (preset: "yesterday" | "today") => {
    onDateChange(preset === "yesterday" ? getYesterdayDateKey() : getTodayDateKey());
  };

  const presets = (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-slate-500">Quick:</span>
      <button
        type="button"
        onClick={() => setPreset("yesterday")}
        className="font-medium text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline"
      >
        Yesterday
      </button>
      <span className="text-slate-300">|</span>
      <button
        type="button"
        onClick={() => setPreset("today")}
        className="font-medium text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline"
      >
        Today
      </button>
    </div>
  );

  const dateInput = (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <Calendar size={16} className="text-slate-400 shrink-0" />
      <span className="font-medium whitespace-nowrap">Usage date</span>
      <input
        type="date"
        value={dateKey}
        max={maxDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
      />
    </label>
  );

  const statsLine =
    statsLoading ? (
      <span className="text-xs text-slate-500">Loading usage…</span>
    ) : stats ? (
      <span className="text-xs text-slate-600">
        {stats.count} allocation{stats.count === 1 ? "" : "s"} ·{" "}
        {stats.units.toLocaleString()} units
      </span>
    ) : null;

  const printBtn = (
    <button
      type="button"
      onClick={onPrint}
      disabled={printDisabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
      title={`Download usage PDF for ${dayLabel}`}
    >
      <FileText size={16} />
      {printDisabled ? "Generating PDF…" : "Usage report (PDF)"}
    </button>
  );

  if (layout === "stacked") {
    return (
      <div className="flex flex-col gap-3 w-full sm:w-auto">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          {dateInput}
          {presets}
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          {statsLine}
          {printBtn}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {dateInput}
      {presets}
      {statsLine}
      {printBtn}
    </div>
  );
}
