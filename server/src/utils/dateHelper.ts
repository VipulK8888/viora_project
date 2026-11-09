/**
 * Date and timezone helper utilities for Viora Bills.
 * Consistent business operations in Asia/Kolkata (IST, UTC+05:30).
 */

export function parseDateRangeIST(
  startDate?: string,
  endDate?: string
): { gte?: Date; lte?: Date } | undefined {
  if (!startDate && !endDate) return undefined;

  const res: { gte?: Date; lte?: Date } = {};

  if (startDate) {
    // Start of day in IST: YYYY-MM-DDT00:00:00+05:30
    res.gte = new Date(`${startDate}T00:00:00+05:30`);
  }

  if (endDate) {
    // End of day in IST: YYYY-MM-DDT23:59:59.999+05:30
    res.lte = new Date(`${endDate}T23:59:59.999+05:30`);
  }

  return res;
}

export function formatPeriodKeyIST(d: Date, groupBy: 'day' | 'month' = 'day'): string {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  if (groupBy === 'month') {
    return dateStr.slice(0, 7);
  }
  return dateStr;
}

export function formatDateDisplay(dateStrOrObj?: string | Date | null): string {
  if (!dateStrOrObj) return '';
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (Number.isNaN(d.getTime())) return String(dateStrOrObj);
  return d.toISOString().split('T')[0];
}

