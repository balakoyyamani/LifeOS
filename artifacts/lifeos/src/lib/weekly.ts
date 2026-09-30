import type { Category } from '@workspace/api-client-react';

export interface WeeklyObjective {
  id: string;
  title: string;
  category: Category;
  completed: boolean;
}

export interface WeeklyReflectionData {
  highEnergyNote: string;
  highestLeverageCommitment: string;
  committedAt?: string;
}

export interface WeekRange {
  weekKey: string; // e.g. "2026-W40"
  weekNumber: number;
  year: number;
  label: string; // e.g. "Sep 28 – Oct 4, 2026"
  days: {
    date: Date;
    dateStr: string; // "YYYY-MM-DD"
    dayName: string; // "Mon", "Tue", etc.
    dayNumber: number; // 28
    isToday: boolean;
  }[];
}

// Compute ISO 8601 week number
export function getISOWeekNumber(d: Date): { year: number; week: number } {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: target.getFullYear(), week: weekNumber };
}

// Get Monday of the week for a given date
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getWeekDetails(date: Date): WeekRange {
  const monday = getMondayOfWeek(date);
  const { year, week } = getISOWeekNumber(monday);
  const weekKey = `${year}-W${String(week).padStart(2, '0')}`;

  const todayStr = new Date().toISOString().slice(0, 10);
  const days = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dateStr = cur.toISOString().slice(0, 10);
    days.push({
      date: cur,
      dateStr,
      dayName: cur.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: cur.getDate(),
      isToday: dateStr === todayStr,
    });
  }

  const startMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const endDay = days[6].date;
  const endMonth = endDay.toLocaleDateString('en-US', { month: 'short' });
  const label =
    startMonth === endMonth
      ? `${startMonth} ${monday.getDate()} – ${endDay.getDate()}, ${endDay.getFullYear()}`
      : `${startMonth} ${monday.getDate()} – ${endMonth} ${endDay.getDate()}, ${endDay.getFullYear()}`;

  return {
    weekKey,
    weekNumber: week,
    year,
    label,
    days,
  };
}

const OKR_STORAGE_PREFIX = 'lifeos_weekly_okrs_';
const REFLECTION_STORAGE_PREFIX = 'lifeos_weekly_refl_';

export function getWeeklyObjectives(weekKey: string): WeeklyObjective[] {
  try {
    const raw = localStorage.getItem(`${OKR_STORAGE_PREFIX}${weekKey}`);
    if (!raw) {
      // Default starter objectives if empty
      return [
        {
          id: '1',
          title: 'Deep dive into highest leverage skill practice',
          category: 'career',
          completed: false,
        },
        {
          id: '2',
          title: 'Maintain consistency streak with healthy sleep & movement',
          category: 'health',
          completed: false,
        },
        {
          id: '3',
          title: 'Read 50+ pages and capture core insights',
          category: 'learning',
          completed: false,
        },
      ];
    }
    return JSON.parse(raw) as WeeklyObjective[];
  } catch {
    return [];
  }
}

export function saveWeeklyObjectives(weekKey: string, okrs: WeeklyObjective[]): void {
  try {
    localStorage.setItem(`${OKR_STORAGE_PREFIX}${weekKey}`, JSON.stringify(okrs));
  } catch (err) {
    console.error('Failed to save weekly objectives:', err);
  }
}

export function getWeeklyReflection(weekKey: string): WeeklyReflectionData {
  try {
    const raw = localStorage.getItem(`${REFLECTION_STORAGE_PREFIX}${weekKey}`);
    if (!raw) return { highEnergyNote: '', highestLeverageCommitment: '' };
    return JSON.parse(raw) as WeeklyReflectionData;
  } catch {
    return { highEnergyNote: '', highestLeverageCommitment: '' };
  }
}

export function saveWeeklyReflection(
  weekKey: string,
  data: WeeklyReflectionData,
): void {
  try {
    localStorage.setItem(`${REFLECTION_STORAGE_PREFIX}${weekKey}`, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save weekly reflection:', err);
  }
}
