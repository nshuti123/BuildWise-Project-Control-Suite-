import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProjectCalendarProps {
  tasks: any[];
  milestones: any[];
  onTaskClick: (task: any) => void;
  onMilestoneClick: (milestone: any) => void;
}

export function ProjectCalendar({
  tasks,
  milestones,
  onTaskClick,
  onMilestoneClick,
}: ProjectCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Generate padded days for grid (starting on Sunday)
  const days = [];
  
  // Previous month padding
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = 0; i < firstDay; i++) {
    days.push({
      date: new Date(year, month - 1, prevMonthDays - firstDay + i + 1),
      isCurrentMonth: false,
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  // Next month padding (to fill 6 rows if necessary, or just complete the week)
  const remainingCells = 42 - days.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingCells; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isDateBetween = (date: Date, startStr: string, endStr: string) => {
    if (!startStr || !endStr) return false;
    const current = date.getTime();
    const start = new Date(startStr).getTime();
    
    // Normalize end date to the end of that day (23:59:59) to include it fully
    const endObj = new Date(endStr);
    endObj.setHours(23, 59, 59, 999);
    const end = endObj.getTime();
    
    // Also normalize current date and start date for clean comparison
    const normCurrent = new Date(current).setHours(0,0,0,0);
    const normStart = new Date(start).setHours(0,0,0,0);

    return normCurrent >= normStart && normCurrent <= end;
  };

  const isSameDate = (date1: Date, dateStr: string) => {
    if (!dateStr) return false;
    const d2 = new Date(dateStr);
    return (
      date1.getDate() === d2.getDate() &&
      date1.getMonth() === d2.getMonth() &&
      date1.getFullYear() === d2.getFullYear()
    );
  };

  const getTasksForDay = (date: Date) => {
    return tasks.filter((t) => t.start_date && t.end_date && isDateBetween(date, t.start_date, t.end_date));
  };

  const getMilestonesForDay = (date: Date) => {
    return milestones.filter((m) => m.date && isSameDate(date, m.date));
  };

  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-700 border-green-200",
    "on-track": "bg-blue-100 text-blue-700 border-blue-200",
    delayed: "bg-red-100 text-red-700 border-red-200",
    "at-risk": "bg-yellow-100 text-yellow-700 border-yellow-200",
    pending: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px] animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-900">
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={jumpToToday}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors mr-2 shadow-sm"
          >
            Today
          </button>
          
          <div className="flex rounded-lg shadow-sm border border-slate-300 overflow-hidden bg-white">
            <button
              onClick={prevMonth}
              className="p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors border-r border-slate-200"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {days.map((dayObj, index) => {
          const dayTasks = getTasksForDay(dayObj.date);
          const dayMilestones = getMilestonesForDay(dayObj.date);
          const isTodayHighlight = isToday(dayObj.date);
          const isWeekend = dayObj.date.getDay() === 0 || dayObj.date.getDay() === 6;

          return (
            <div
              key={index}
              className={`min-h-[100px] p-1.5 border-b border-r border-slate-100 transition-colors hover:bg-slate-50/50 flex flex-col relative ${
                !dayObj.isCurrentMonth ? "bg-slate-50/80" : isWeekend ? "bg-slate-50/30" : "bg-white"
              } ${index % 7 === 6 ? "!border-r-0" : ""}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-semibold ${
                    isTodayHighlight
                      ? "bg-blue-600 text-white shadow-sm"
                      : !dayObj.isCurrentMonth
                      ? "text-slate-400"
                      : "text-slate-700"
                  }`}
                >
                  {dayObj.date.getDate()}
                </span>
                
                {dayMilestones.map((m, mIndex) => (
                  <div
                    key={`m-${mIndex}`}
                    onClick={() => onMilestoneClick(m)}
                    className="cursor-pointer group relative"
                    title={m.name}
                  >
                    <div className="w-3 h-3 rotate-45 border-2 border-white bg-purple-500 shadow-sm group-hover:scale-125 transition-transform" />
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {dayTasks.map((t, tIndex) => {
                   // Calculate if this is the start or end of the task to show labels
                   const isStart = isSameDate(dayObj.date, t.start_date);
                   const isEnd = isSameDate(dayObj.date, t.end_date);
                   
                   return (
                    <div
                      key={`t-${tIndex}`}
                      onClick={() => onTaskClick(t)}
                      className={`text-[10px] leading-tight px-1.5 py-1 rounded border shadow-sm cursor-pointer truncate transition-all hover:brightness-95 ${
                        statusColors[t.status || "pending"]
                      } ${isStart ? "rounded-l-md" : "border-l-0"} ${isEnd ? "rounded-r-md" : "border-r-0"}`}
                      title={`${t.task_name} (${t.progress}%)`}
                    >
                      <span className={`${!isStart && !isEnd ? "opacity-0" : ""}`}>
                         {t.task_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
