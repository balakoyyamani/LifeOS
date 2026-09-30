export interface DailyReflection {
  date: string; // YYYY-MM-DD
  energyLevel: number; // 1 - 5
  moodTags: string[];
  wins: [string, string, string];
  lesson: string;
  gratitude: string;
  completedAt: string;
}

const STORAGE_PREFIX = 'lifeos_reflection_';
const ALL_KEYS_REGISTRY = 'lifeos_reflection_dates';

export const ENERGY_LEVELS = [
  { level: 1, label: 'Exhausted', icon: '🪫', desc: 'Depleted energy, needs deep rest' },
  { level: 2, label: 'Low', icon: '🔋', desc: 'Subdued rhythm, slow pace' },
  { level: 3, label: 'Steady', icon: '⚡', desc: 'Balanced, consistent focus' },
  { level: 4, label: 'Vibrant', icon: '✨', desc: 'Clear mind and high momentum' },
  { level: 5, label: 'Peak Flow', icon: '🔥', desc: 'Effortless deep work & mastery' },
];

export const SUGGESTED_MOODS = [
  'Peaceful 🌿',
  'Productive ⚡',
  'Grateful 🙏',
  'Focused 🎯',
  'Challenging 🧗',
  'Creative 💡',
  'Joyful ☀️',
  'Restorative 🧘',
];

export function getTodayDateKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function getReflectionForDate(dateStr: string): DailyReflection | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${dateStr}`);
    if (!raw) return null;
    return JSON.parse(raw) as DailyReflection;
  } catch {
    return null;
  }
}

export function saveReflection(reflection: DailyReflection): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${reflection.date}`,
      JSON.stringify(reflection),
    );

    // Track date in registry index
    const rawIndex = localStorage.getItem(ALL_KEYS_REGISTRY);
    const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    if (!index.includes(reflection.date)) {
      index.push(reflection.date);
      index.sort().reverse();
      localStorage.setItem(ALL_KEYS_REGISTRY, JSON.stringify(index));
    }
  } catch (err) {
    console.error('Failed to save reflection:', err);
  }
}

export function getAllReflections(): DailyReflection[] {
  try {
    const rawIndex = localStorage.getItem(ALL_KEYS_REGISTRY);
    const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    return index
      .map((date) => getReflectionForDate(date))
      .filter((r): r is DailyReflection => r !== null);
  } catch {
    return [];
  }
}

export function hasReflectedToday(): boolean {
  return getReflectionForDate(getTodayDateKey()) !== null;
}
