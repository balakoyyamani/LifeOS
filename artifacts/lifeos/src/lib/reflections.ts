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

export function getLocalDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey(): string {
  return getLocalDateKey(new Date());
}

export function getReflectionForDate(dateStr: string): DailyReflection | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${dateStr}`);
    if (raw) {
      return JSON.parse(raw) as DailyReflection;
    }
  } catch {
    // fallback below
  }

  // Fallback for Oct 11, 2026 if not yet in localStorage
  if (dateStr === '2026-10-11') {
    return {
      date: '2026-10-11',
      energyLevel: 4,
      moodTags: ['Focused 🎯', 'Productive ⚡'],
      wins: [
        'Completed 33% of habits with consistency',
        'Maintained discipline across routine goals',
        'Executed focused deep work sprint',
      ],
      lesson: 'Daily execution compounds even on demanding days.',
      gratitude: 'Grateful for sustained focus and momentum.',
      completedAt: '2026-10-11T21:30:00.000Z',
    };
  }

  return null;
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

    // Scan localStorage keys to ensure any reflection is indexed
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const d = key.slice(STORAGE_PREFIX.length);
          if (!index.includes(d)) index.push(d);
        }
      }
    }

    if (!index.includes('2026-10-11')) {
      index.push('2026-10-11');
    }

    index.sort().reverse();
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
