interface StatusBadgeProps {
  status: "on-track" | "at-risk" | "delayed" | "completed" | "pending";
  size?: "sm" | "md";
}
export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const styles = {
    "on-track": "bg-green-100 text-green-800 border-green-200",
    "at-risk": "bg-yellow-100 text-yellow-800 border-yellow-200",
    delayed: "bg-red-100 text-red-800 border-red-200",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
    pending: "bg-slate-100 text-slate-800 border-slate-200",
  };
  const labels = {
    "on-track": "On Track",
    "at-risk": "At Risk",
    delayed: "Delayed",
    completed: "Completed",
    pending: "Pending",
  };
  const sizeClasses = size === "sm" ? "text-xs px-2 py-1" : "text-sm px-3 py-1";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${styles[status]} ${sizeClasses}`}
    >
      {labels[status]}
    </span>
  );
}
