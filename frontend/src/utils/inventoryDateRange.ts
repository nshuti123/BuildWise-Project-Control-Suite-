export interface CalendarDayRange {
  start: Date;
  end: Date;
  dateKey: string;
  label: string;
}

function buildRangeFromDate(day: Date): CalendarDayRange {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;

  const label = start.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return { start, end, dateKey, label };
}

/** Calendar day in local timezone (midnight to 23:59:59.999). */
export function getCalendarDayRange(dayOffset = 0): CalendarDayRange {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + dayOffset);
  return buildRangeFromDate(day);
}

/** Parse `YYYY-MM-DD` (from &lt;input type="date"&gt;) in local timezone. */
export function getCalendarDayRangeFromDateKey(dateKey: string): CalendarDayRange | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const day = new Date(y, m - 1, d);
  if (
    day.getFullYear() !== y ||
    day.getMonth() !== m - 1 ||
    day.getDate() !== d
  ) {
    return null;
  }
  return buildRangeFromDate(day);
}

export function getTodayDateKey(): string {
  return getCalendarDayRange(0).dateKey;
}

export function getYesterdayDateKey(): string {
  return getCalendarDayRange(-1).dateKey;
}

export function getYesterdayRange() {
  return getCalendarDayRange(-1);
}

export function isWithinCalendarDay(isoDate: string, start: Date, end: Date): boolean {
  const t = new Date(isoDate).getTime();
  return t >= start.getTime() && t <= end.getTime();
}
