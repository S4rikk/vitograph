/**
 * Returns UTC ISO strings for the start/end of a day in a target TZ.
 * Uses formatToParts for robust wall-clock synchronization.
 */
export function getTzDayBoundaries(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', { 
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit' 
  });
  const dateStr = fmt.format(date); // YYYY-MM-DD in this TZ

  // Anchor UTC Noon
  const dummyUtc = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
  }).formatToParts(dummyUtc);

  const p: any = {};
  parts.forEach(({type, value}) => p[type] = value);
  const tzDateLocal = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
  const offsetMs = tzDateLocal.getTime() - dummyUtc.getTime();

  const start = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs);
  const end = new Date(start.getTime() + 86400000 - 1);

  return { startIso: start.toISOString(), endIso: end.toISOString(), dateStr };
}

/**
 * Returns a Date object for "Now" relative to the target timezone.
 * Used for UI comparisons and initial states.
 */
export function getTzToday(timeZone: string): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(now);
  
  const p: Record<string, string> = {};
  parts.forEach(({type, value}) => p[type] = value);
  
  // Create a local date stripped of timezone info, solely to hold the Y/M/D values
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day));
}
