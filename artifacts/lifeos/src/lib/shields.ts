export interface ShieldDeployment {
  date: string; // "YYYY-MM-DD"
  reason: string;
  reasonCategory: 'illness' | 'travel' | 'emergency' | 'rest';
  deployedAt: string;
}

export interface ShieldVaultState {
  availableShields: number; // 0 to 5
  maxShields: number;
  deployedShields: Record<string, ShieldDeployment>;
  consecutiveQualifyingDays: number; // counter to next shield (needs 5)
  daysNeededForNextShield: number;
}

export interface StreakTier {
  name: string;
  icon: string;
  minStreak: number;
  color: string;
  textColor: string;
  borderColor: string;
  multiplierHint: string;
}

export const STREAK_TIERS: StreakTier[] = [
  {
    name: 'Spark',
    icon: '🌱',
    minStreak: 1,
    color: 'bg-emerald-500/10',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-500/30',
    multiplierHint: 'Daily foundation established',
  },
  {
    name: 'Surge',
    icon: '🔥',
    minStreak: 4,
    color: 'bg-amber-500/10',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-500/30',
    multiplierHint: '1.2x Momentum bonus',
  },
  {
    name: 'Momentum',
    icon: '⚡',
    minStreak: 8,
    color: 'bg-sky-500/10',
    textColor: 'text-sky-700 dark:text-sky-300',
    borderColor: 'border-sky-500/30',
    multiplierHint: '1.5x Flow State multiplier',
  },
  {
    name: 'Mastery',
    icon: '👑',
    minStreak: 15,
    color: 'bg-purple-500/10',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-500/30',
    multiplierHint: '2.0x Mastery compounding',
  },
  {
    name: 'Diamond Anchor',
    icon: '💎',
    minStreak: 30,
    color: 'bg-indigo-500/10',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    borderColor: 'border-indigo-500/30',
    multiplierHint: 'Legendary habit immunity',
  },
];

export const SHIELD_REASONS = [
  {
    category: 'illness' as const,
    label: 'Illness & Physical Recovery',
    icon: '🤒',
    description: 'Prioritize deep physical healing over routine checkboxes.',
  },
  {
    category: 'travel' as const,
    label: 'Heavy Travel & Commute',
    icon: '✈️',
    description: 'Transit disruptions, timezone adjustments, and busy flights.',
  },
  {
    category: 'emergency' as const,
    label: 'Personal or Family Priority',
    icon: '🌿',
    description: 'Being present for family or unexpected critical matters.',
  },
  {
    category: 'rest' as const,
    label: 'Mindful Rest & Burnout Reset',
    icon: '☕',
    description: 'Scheduled deload day to recharge mental acuity.',
  },
];

const INVENTORY_KEY = 'lifeos_resilience_shields_inventory';
const DEPLOYMENTS_KEY = 'lifeos_resilience_shields_deployments';
const QUALIFYING_DAYS_KEY = 'lifeos_resilience_shields_qualifying_days';
const LAST_EVALUATED_DATE_KEY = 'lifeos_resilience_shields_last_eval';
const DEFAULT_STARTING_SHIELDS = 2;
const MAX_SHIELDS_CAP = 5;
const QUALIFYING_DAYS_PER_SHIELD = 5;

export function getShieldVaultState(): ShieldVaultState {
  try {
    const rawInv = localStorage.getItem(INVENTORY_KEY);
    const availableShields = rawInv !== null ? Math.min(MAX_SHIELDS_CAP, Math.max(0, Number(rawInv))) : DEFAULT_STARTING_SHIELDS;

    const rawDeployments = localStorage.getItem(DEPLOYMENTS_KEY);
    const deployedShields: Record<string, ShieldDeployment> = rawDeployments ? JSON.parse(rawDeployments) : {};

    const rawQualifying = localStorage.getItem(QUALIFYING_DAYS_KEY);
    const consecutiveQualifyingDays = rawQualifying !== null ? Number(rawQualifying) : 0;

    return {
      availableShields,
      maxShields: MAX_SHIELDS_CAP,
      deployedShields,
      consecutiveQualifyingDays,
      daysNeededForNextShield: Math.max(0, QUALIFYING_DAYS_PER_SHIELD - (consecutiveQualifyingDays % QUALIFYING_DAYS_PER_SHIELD)),
    };
  } catch {
    return {
      availableShields: DEFAULT_STARTING_SHIELDS,
      maxShields: MAX_SHIELDS_CAP,
      deployedShields: {},
      consecutiveQualifyingDays: 0,
      daysNeededForNextShield: QUALIFYING_DAYS_PER_SHIELD,
    };
  }
}

export function isDateShielded(dateKey: string): boolean {
  const state = getShieldVaultState();
  return Boolean(state.deployedShields[dateKey]);
}

export function getShieldDeploymentForDate(dateKey: string): ShieldDeployment | null {
  const state = getShieldVaultState();
  return state.deployedShields[dateKey] || null;
}

export function activateShield(
  dateKey: string,
  reasonCategory: 'illness' | 'travel' | 'emergency' | 'rest' = 'rest',
  customReason?: string,
): boolean {
  const state = getShieldVaultState();
  if (state.availableShields <= 0 && !state.deployedShields[dateKey]) {
    return false;
  }

  try {
    const reasonObj = SHIELD_REASONS.find((r) => r.category === reasonCategory);
    const reasonText = customReason?.trim() || reasonObj?.label || 'Planned Grace Day';

    const wasAlreadyDeployed = Boolean(state.deployedShields[dateKey]);
    const updatedDeployments = {
      ...state.deployedShields,
      [dateKey]: {
        date: dateKey,
        reason: reasonText,
        reasonCategory,
        deployedAt: new Date().toISOString(),
      },
    };

    localStorage.setItem(DEPLOYMENTS_KEY, JSON.stringify(updatedDeployments));

    // Deduct inventory only if this date wasn't already shielded
    if (!wasAlreadyDeployed) {
      const nextInv = Math.max(0, state.availableShields - 1);
      localStorage.setItem(INVENTORY_KEY, String(nextInv));
    }

    return true;
  } catch (err) {
    console.error('Failed to activate shield:', err);
    return false;
  }
}

export function deactivateShield(dateKey: string): boolean {
  const state = getShieldVaultState();
  if (!state.deployedShields[dateKey]) return false;

  try {
    const updatedDeployments = { ...state.deployedShields };
    delete updatedDeployments[dateKey];
    localStorage.setItem(DEPLOYMENTS_KEY, JSON.stringify(updatedDeployments));

    // Refund 1 shield back into inventory
    const nextInv = Math.min(MAX_SHIELDS_CAP, state.availableShields + 1);
    localStorage.setItem(INVENTORY_KEY, String(nextInv));
    return true;
  } catch (err) {
    console.error('Failed to deactivate shield:', err);
    return false;
  }
}

/**
 * Evaluates whether today's score qualifies to earn a new shield
 * Returns true if a new shield was earned and added to the vault
 */
export function checkAndAwardShield(dateKey: string, dailyScore: number): boolean {
  if (dailyScore < 70) return false;

  try {
    const lastEval = localStorage.getItem(LAST_EVALUATED_DATE_KEY);
    if (lastEval === dateKey) {
      // Already evaluated for this date
      return false;
    }

    localStorage.setItem(LAST_EVALUATED_DATE_KEY, dateKey);
    const state = getShieldVaultState();

    const nextQualifying = state.consecutiveQualifyingDays + 1;
    localStorage.setItem(QUALIFYING_DAYS_KEY, String(nextQualifying));

    // Check if reached threshold (every 5 qualifying days)
    if (nextQualifying % QUALIFYING_DAYS_PER_SHIELD === 0) {
      if (state.availableShields < MAX_SHIELDS_CAP) {
        localStorage.setItem(INVENTORY_KEY, String(state.availableShields + 1));
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function getStreakTier(streak: number): StreakTier {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].minStreak) {
      return STREAK_TIERS[i];
    }
  }
  return STREAK_TIERS[0];
}
