import type { DailyGoal } from '@workspace/api-client-react';

export type RoutineType = 'morning' | 'deep_work' | 'evening';

export interface RoutineMeta {
  id: RoutineType;
  label: string;
  tagline: string;
  icon: string; // Emoji
  color: string;
  dotColor: string;
  bgColor: string;
  borderColor: string;
  timeHint: string;
  quote: string;
}

export const ROUTINE_CONFIGS: Record<RoutineType, RoutineMeta> = {
  morning: {
    id: 'morning',
    label: 'Morning Ignition',
    tagline: 'Prime your mind and body before distractions take hold.',
    icon: '🌅',
    color: 'text-amber-800',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-500/30',
    timeHint: '6:00 AM – 10:00 AM',
    quote: 'Win the morning, win the day.',
  },
  deep_work: {
    id: 'deep_work',
    label: 'Deep Work Block',
    tagline: 'High-leverage focus on your Daily Anchor and core craft.',
    icon: '⚡',
    color: 'text-indigo-800',
    dotColor: 'bg-indigo-500',
    bgColor: 'bg-indigo-400/10',
    borderColor: 'border-indigo-500/30',
    timeHint: '10:00 AM – 4:00 PM',
    quote: 'The ability to perform deep work is becoming increasingly rare and valuable.',
  },
  evening: {
    id: 'evening',
    label: 'Evening Wind-Down',
    tagline: 'Decompress, reflect on daily wins, and prepare for restful sleep.',
    icon: '🌙',
    color: 'text-purple-800',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-500/30',
    timeHint: '6:00 PM – 10:00 PM',
    quote: 'Let go of what is done. Honor the honest steps taken.',
  },
};

const STORAGE_KEY = 'lifeos_routine_mappings';

export function getCustomRoutineMappings(): Record<number, RoutineType> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setGoalRoutine(goalId: number, routine: RoutineType): void {
  try {
    const existing = getCustomRoutineMappings();
    existing[goalId] = routine;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to set goal routine:', err);
  }
}

// Smart default classifier if not explicitly set
export function inferDefaultRoutine(goal: DailyGoal): RoutineType {
  const name = goal.name.toLowerCase();
  const unit = goal.unit.toLowerCase();

  // Morning keywords
  if (
    name.includes('water') ||
    name.includes('hydrate') ||
    name.includes('morning') ||
    name.includes('sunlight') ||
    name.includes('wake') ||
    name.includes('stretch') ||
    name.includes('journal') ||
    goal.category === 'routine'
  ) {
    return 'morning';
  }

  // Deep work keywords
  if (
    name.includes('code') ||
    name.includes('project') ||
    name.includes('write') ||
    name.includes('focus') ||
    name.includes('study') ||
    name.includes('design') ||
    goal.category === 'career' ||
    goal.category === 'learning'
  ) {
    return 'deep_work';
  }

  // Evening keywords
  if (
    name.includes('read') ||
    name.includes('workout') ||
    name.includes('gym') ||
    name.includes('walk') ||
    name.includes('sleep') ||
    name.includes('wind') ||
    goal.category === 'health' ||
    goal.category === 'mind'
  ) {
    return 'evening';
  }

  return 'morning';
}

export function getGoalRoutine(goal: DailyGoal): RoutineType {
  const custom = getCustomRoutineMappings();
  if (custom[goal.id]) {
    return custom[goal.id];
  }
  return inferDefaultRoutine(goal);
}

export function groupGoalsByRoutine(goals: DailyGoal[]): Record<RoutineType, DailyGoal[]> {
  const groups: Record<RoutineType, DailyGoal[]> = {
    morning: [],
    deep_work: [],
    evening: [],
  };

  goals.forEach((goal) => {
    const routine = getGoalRoutine(goal);
    groups[routine].push(goal);
  });

  return groups;
}
