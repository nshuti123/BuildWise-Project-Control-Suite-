export function formatBudget(budgetStr: string | number | undefined | null): string {
  if (!budgetStr) return "TBD";
  
  const str = budgetStr.toString().trim();
  
  // Extract non-numeric prefix, exactly the numeric portion, and any non-numeric suffix
  const match = str.match(/^([^0-9.-]*)([\d,\.]+)([^0-9]*)$/);
  
  if (match) {
    const prefix = match[1];
    const numPart = match[2].replace(/,/g, '');
    const suffix = match[3];

    const n = parseFloat(numPart);
    if (!isNaN(n)) {
      let formattedNum = n.toString();
      
      if (n >= 1e9 && n % 1e7 === 0) {
        // Allows up to 2 decimal places without remainder (e.g. 1.25B)
        formattedNum = (n / 1e9).toString() + "B";
      } else if (n >= 1e6 && n % 1e4 === 0) {
        // Allows up to 2 decimal places without remainder (e.g. 1.5M, 2.75M)
        formattedNum = (n / 1e6).toString() + "M";
      } else if (n >= 1e3 && n % 1e3 === 0) {
        // Only exact thousands get K (e.g. 10000 -> 10K). 10750 will be left as is.
        formattedNum = (n / 1e3).toString() + "K";
      }
      
      return `${prefix}${formattedNum}${suffix}`.trim();
    }
  }

  return str;
}
