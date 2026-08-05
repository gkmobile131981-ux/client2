function getParts(d: Date, timeZone: string, includeTime: boolean): Record<string, string> {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hourCycle = 'h23';
  }
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', options).formatToParts(d)) {
    map[part.type] = part.value;
  }
  return map;
}

export function formatDateOnly(
  dateStr: string | number | Date | null | undefined,
  timeZone = 'Asia/Kolkata'
): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const m = getParts(d, timeZone, false);
  return `${m.day}-${m.month}-${m.year}`;
}

export function formatDateTime(
  dateStr: string | number | Date | null | undefined,
  timeZone = 'Asia/Kolkata'
): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const m = getParts(d, timeZone, true);
  return `${m.day}-${m.month}-${m.year}, ${m.hour}:${m.minute}`;
}
