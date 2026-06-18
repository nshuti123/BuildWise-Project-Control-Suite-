import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "bg-blue-500",
}: MetricCardProps) {
  const changeColors = {
    positive: "text-emerald-700 bg-emerald-100/80 border border-emerald-200",
    negative: "text-red-700 bg-red-100/80 border border-red-200",
    neutral: "text-slate-700 bg-slate-100/80 border border-slate-200",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 p-6 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
      {/* Decorative background glow */}
      <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 blur-2xl ${iconColor}`}></div>
      
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-500 mb-1.5 tracking-wider uppercase">{title}</p>
          <p className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">{value}</p>
          {change && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold shadow-sm ${changeColors[changeType]}`}>
              {change}
            </span>
          )}
        </div>
        <div className={`${iconColor} p-3.5 rounded-xl shadow-md text-white group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
