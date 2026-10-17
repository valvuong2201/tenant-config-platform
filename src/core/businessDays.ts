/**
 * Business-day arithmetic on date-only strings (YYYY-MM-DD), always in UTC so the browser
 * preview and the server runtime agree regardless of the machine's timezone.
 *
 * Rules: Saturday and Sunday are non-business days; public holidays are not modelled.
 * Each counted day is the next weekday after the previous one, so the submission day itself is
 * never counted: Friday + 1 business day = Monday, and Saturday + 1 business day = Monday.
 */
export function addBusinessDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return d.toISOString().slice(0, 10);
}
