export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type BadgeCategory = 'streak' | 'focus' | 'mastery' | 'mind' | 'discipline';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  icon: string; // Emoji representation
  quote: string;
  maxProgress: number;
}

export interface UserStatsSnapshot {
  streak: number;
  dailyScore: number;
  dailyCompletion: number;
  focusMinutes: number;
  totalGoalsCount: number;
  completedGoalsCount: number;
  distinctCategoriesCompleted: number;
  eveningReflectionsCount: number;
  weeklyOkrsCompleted: number;
}

export interface EvaluatedBadge extends BadgeDefinition {
  unlocked: boolean;
  currentProgress: number;
  unlockedAt?: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'century_club',
    title: 'Century Club',
    description: 'Score 100% daily score in a single day.',
    category: 'mastery',
    tier: 'gold',
    icon: '🥇',
    quote: 'Perfection is not attainable, but if we chase perfection we can catch excellence.',
    maxProgress: 100,
  },
  {
    id: 'shield_bearer',
    title: 'Shield Bearer',
    description: 'Maintain a 7-day streak and bank your first Streak Shield.',
    category: 'streak',
    tier: 'silver',
    icon: '🛡️',
    quote: 'True momentum is protected not by rigid anxiety, but by resilient discipline.',
    maxProgress: 7,
  },
  {
    id: 'zen_master',
    title: 'Zen Master',
    description: 'Accumulate 120+ minutes of focused deep work in the Zen Focus Room.',
    category: 'focus',
    tier: 'gold',
    icon: '🧘',
    quote: 'Silence is not the absence of sound, but the presence of clear awareness.',
    maxProgress: 120,
  },
  {
    id: 'pillar_harmony',
    title: 'Pillar Harmony',
    description: 'Complete daily habits across 4 or more distinct life pillars.',
    category: 'discipline',
    tier: 'silver',
    icon: '⚖️',
    quote: 'A full life flourishes across body, mind, career, and craft in balance.',
    maxProgress: 4,
  },
  {
    id: 'mindful_closer',
    title: 'Mindful Closer',
    description: 'Complete 3 or more Evening Wind-Down reflections.',
    category: 'mind',
    tier: 'bronze',
    icon: '🌙',
    quote: 'The day ends well when we release finished effort and enter sleep with peace.',
    maxProgress: 3,
  },
  {
    id: 'iron_will',
    title: 'Iron Will',
    description: 'Build an unbroken 14-day consistency streak.',
    category: 'streak',
    tier: 'diamond',
    icon: '🔥',
    quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    maxProgress: 14,
  },
  {
    id: 'flow_initiate',
    title: 'Flow Initiate',
    description: 'Complete your first 25-minute Zen Focus timer block.',
    category: 'focus',
    tier: 'bronze',
    icon: '⚡',
    quote: 'The journey of a thousand deep work sessions begins with 25 minutes.',
    maxProgress: 25,
  },
  {
    id: 'grand_architect',
    title: 'Grand Architect',
    description: 'Set up 5 or more active daily goals across your workspace.',
    category: 'mastery',
    tier: 'bronze',
    icon: '🏛️',
    quote: 'You do not rise to the level of your goals; you fall to the level of your systems.',
    maxProgress: 5,
  },
  {
    id: 'okr_finisher',
    title: 'OKR Finisher',
    description: 'Complete at least 2 High-Impact Weekly Objectives in the Weekly Studio.',
    category: 'discipline',
    tier: 'gold',
    icon: '🎯',
    quote: 'Focus is a matter of deciding what things you are not going to do.',
    maxProgress: 2,
  },
];

const UNLOCKED_STORAGE_KEY = 'lifeos_badges_unlocked_registry';

export function getUnlockedTimestamps(): Record<string, string> {
  try {
    const raw = localStorage.getItem(UNLOCKED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUnlockedTimestamp(badgeId: string): void {
  try {
    const existing = getUnlockedTimestamps();
    if (!existing[badgeId]) {
      existing[badgeId] = new Date().toISOString();
      localStorage.setItem(UNLOCKED_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch (err) {
    console.error('Failed to save badge unlock timestamp:', err);
  }
}

export function evaluateBadges(stats: UserStatsSnapshot): EvaluatedBadge[] {
  const timestamps = getUnlockedTimestamps();

  return BADGE_DEFINITIONS.map((def) => {
    let currentProgress = 0;
    let unlocked = Boolean(timestamps[def.id]);

    switch (def.id) {
      case 'century_club':
        currentProgress = Math.min(100, Math.round(stats.dailyScore));
        if (currentProgress >= 100) unlocked = true;
        break;

      case 'shield_bearer':
        currentProgress = Math.min(7, stats.streak);
        if (currentProgress >= 7) unlocked = true;
        break;

      case 'zen_master':
        currentProgress = Math.min(120, stats.focusMinutes);
        if (currentProgress >= 120) unlocked = true;
        break;

      case 'pillar_harmony':
        currentProgress = Math.min(4, stats.distinctCategoriesCompleted);
        if (currentProgress >= 4) unlocked = true;
        break;

      case 'mindful_closer':
        currentProgress = Math.min(3, stats.eveningReflectionsCount);
        if (currentProgress >= 3) unlocked = true;
        break;

      case 'iron_will':
        currentProgress = Math.min(14, stats.streak);
        if (currentProgress >= 14) unlocked = true;
        break;

      case 'flow_initiate':
        currentProgress = Math.min(25, stats.focusMinutes);
        if (currentProgress >= 25) unlocked = true;
        break;

      case 'grand_architect':
        currentProgress = Math.min(5, stats.totalGoalsCount);
        if (currentProgress >= 5) unlocked = true;
        break;

      case 'okr_finisher':
        currentProgress = Math.min(2, stats.weeklyOkrsCompleted);
        if (currentProgress >= 2) unlocked = true;
        break;

      default:
        break;
    }

    if (unlocked && !timestamps[def.id]) {
      saveUnlockedTimestamp(def.id);
    }

    return {
      ...def,
      unlocked,
      currentProgress,
      unlockedAt: timestamps[def.id],
    };
  });
}
