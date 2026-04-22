export function addWorkingDays(startDateStr: string, workingDays: number): Date | null {
  if (!startDateStr || workingDays <= 0) return null;
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return null;

  let daysToAdd = Math.floor(workingDays) - 1;
  while (daysToAdd > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 is Sunday, 6 is Saturday
    if (day !== 0 && day !== 6) {
      daysToAdd--;
    }
  }
  return d;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
