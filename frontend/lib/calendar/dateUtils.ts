export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 'YYYY-MM-DD' in local time (avoids UTC-shift bugs from toISOString()). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Decimal hour (e.g. 13.5) -> '1:30 PM'. */
export function fmtHour(t: number): string {
  const hh = Math.floor(t);
  const mm = Math.round((t - hh) * 60);
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${pad(mm)} ${suffix}`;
}

/** Decimal hour -> '13:30' for <input type="time"> value. */
export function decimalToTimeInput(t: number): string {
  const hh = Math.floor(t);
  const mm = Math.round((t - hh) * 60);
  return `${pad(hh)}:${pad(mm)}`;
}

/** '13:30' -> 13.5 */
export function timeInputToDecimal(str: string): number {
  const [h, m] = str.split(":").map(Number);
  return h + (m || 0) / 60;
}

/** Sunday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function getWeekDays(anchor: Date): Date[] {
  const sunday = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

/** 6 full weeks (42 cells) starting on the Sunday on/before the 1st of the month. */
export function getMonthGridDays(anchor: Date): Date[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
