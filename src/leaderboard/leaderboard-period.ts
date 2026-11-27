/** Asia/Yangon calendar helpers for leaderboard period keys. */

export type LeaderboardPeriod = 'day' | 'week' | 'all';

export function yangonParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function yangonDateKey(d = new Date()): string {
  const { year, month, day } = yangonParts(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** ISO-like week key in Yangon local calendar date (Mon-based). */
export function yangonWeekKey(d = new Date()): string {
  const { year, month, day } = yangonParts(d);
  // Construct UTC noon for that Yangon calendar day to avoid DST issues
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  // Monday-based ISO week
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function currentPeriodKeys(d = new Date()): Array<{
  period: LeaderboardPeriod;
  periodKey: string;
}> {
  return [
    { period: 'day', periodKey: yangonDateKey(d) },
    { period: 'week', periodKey: yangonWeekKey(d) },
    { period: 'all', periodKey: 'all' },
  ];
}

export function resolvePeriodKey(
  period: LeaderboardPeriod,
  d = new Date(),
): string {
  if (period === 'day') return yangonDateKey(d);
  if (period === 'week') return yangonWeekKey(d);
  return 'all';
}
