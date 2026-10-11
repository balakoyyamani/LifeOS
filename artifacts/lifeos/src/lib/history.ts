import { isDateShielded } from '@/lib/shields';
import { getReflectionForDate } from '@/lib/reflections';

export interface DailyHistoryRecord {
  date: string; // "YYYY-MM-DD"
  score: number;
  completedCount: number;
  totalCount: number;
  focusMinutes: number;
  isShielded?: boolean;
  hasReflection?: boolean;
}

const STORAGE_PREFIX = 'lifeos_daily_history_';
const ALL_DATES_KEY = 'lifeos_daily_history_dates';

export function getTodayDateKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/**
 * Retrieve the recorded activity for a given date.
 * If no activity was recorded on that date, it returns a true zero-state record.
 */
export function getDailyHistoryRecord(dateStr: string): DailyHistoryRecord {
  const isShielded = isDateShielded(dateStr);
  const hasReflection = getReflectionForDate(dateStr) !== null;

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${dateStr}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyHistoryRecord>;
      return {
        date: dateStr,
        score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
        completedCount: Math.max(0, parsed.completedCount ?? 0),
        totalCount: Math.max(0, parsed.totalCount ?? 0),
        focusMinutes: Math.max(0, parsed.focusMinutes ?? 0),
        isShielded: parsed.isShielded ?? isShielded,
        hasReflection: parsed.hasReflection ?? hasReflection,
      };
    }
  } catch {
    // ignore parse error, return zero state below
  }

  return {
    date: dateStr,
    score: 0,
    completedCount: 0,
    totalCount: 0,
    focusMinutes: 0,
    isShielded,
    hasReflection,
  };
}

/**
 * Persist or update a daily history record in storage.
 */
export function saveDailyHistoryRecord(record: DailyHistoryRecord): void {
  try {
    const sanitized: DailyHistoryRecord = {
      date: record.date,
      score: Math.max(0, Math.min(100, Math.round(record.score))),
      completedCount: Math.max(0, record.completedCount),
      totalCount: Math.max(0, record.totalCount),
      focusMinutes: Math.max(0, record.focusMinutes),
      isShielded: record.isShielded ?? isDateShielded(record.date),
      hasReflection: record.hasReflection ?? (getReflectionForDate(record.date) !== null),
    };

    localStorage.setItem(`${STORAGE_PREFIX}${record.date}`, JSON.stringify(sanitized));

    const rawDates = localStorage.getItem(ALL_DATES_KEY);
    const dates: string[] = rawDates ? JSON.parse(rawDates) : [];
    if (!dates.includes(record.date)) {
      dates.push(record.date);
      dates.sort().reverse();
      localStorage.setItem(ALL_DATES_KEY, JSON.stringify(dates));
    }
  } catch (err) {
    console.error('Failed to save daily history record:', err);
  }
}

/**
 * Helper to update today's activity snapshot.
 */
export function syncTodayRecord(snapshot: {
  score: number;
  completedCount: number;
  totalCount: number;
  focusMinutes: number;
}): void {
  const todayKey = getTodayDateKey();
  saveDailyHistoryRecord({
    date: todayKey,
    score: snapshot.score,
    completedCount: snapshot.completedCount,
    totalCount: snapshot.totalCount,
    focusMinutes: snapshot.focusMinutes,
  });
}

/**
 * Retrieve all dates with recorded history.
 */
export function getAllRecordedDates(): string[] {
  try {
    const rawDates = localStorage.getItem(ALL_DATES_KEY);
    return rawDates ? (JSON.parse(rawDates) as string[]) : [];
  } catch {
    return [];
  }
}
