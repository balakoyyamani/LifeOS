import type { DailyGoal } from '@workspace/api-client-react';
import { getGoalSchedule, formatTime12h } from '@/lib/reminders';

export type DayPhase = 'morning' | 'afternoon' | 'evening';

export interface TacticalDirective {
  id: string;
  icon: string;
  title: string;
  detail: string;
  type: 'anchor' | 'pacing' | 'score' | 'winddown';
}

export interface DailyBriefing {
  phase: DayPhase;
  phaseLabel: string;
  phaseSubtitle: string;
  greeting: string;
  anchorGoal: DailyGoal | null;
  anchorScheduleTime?: string;
  isAnchorCompleted: boolean;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  directives: TacticalDirective[];
  eveningDebrief?: {
    scoreEstimate: number;
    scoreTier: string;
    focusMinutes: number;
    completedHighlights: string[];
    suggestedReflection: string;
  };
}

/**
 * Determine current daily phase based on local hour
 */
export function getCurrentDayPhase(): DayPhase {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Find the single highest-leverage Anchor Habit for today
 * Priority 1 goals come first, then lowest scheduled time, then highest target value
 */
export function findAnchorGoal(goals: DailyGoal[]): DailyGoal | null {
  if (goals.length === 0) return null;

  // First sort by priority (1 is highest), then by whether scheduled earlier in the day
  const sorted = [...goals].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const schedA = getGoalSchedule(a.id);
    const schedB = getGoalSchedule(b.id);
    if (schedA?.time && schedB?.time) {
      return schedA.time.localeCompare(schedB.time);
    }
    if (schedA?.time) return -1;
    if (schedB?.time) return 1;
    return b.targetValue - a.targetValue;
  });

  return sorted[0] || null;
}

/**
 * Generate context-aware 3-point tactical directives based on goals and day phase
 */
export function generateDailyBriefing(
  goals: DailyGoal[],
  dailyScore: number = 0,
  focusMinutes: number = 0,
): DailyBriefing {
  const phase = getCurrentDayPhase();
  const anchorGoal = findAnchorGoal(goals);
  const anchorSched = anchorGoal ? getGoalSchedule(anchorGoal.id) : null;
  const isAnchorCompleted = Boolean(
    anchorGoal &&
      (anchorGoal.status === 'completed' || anchorGoal.currentValue >= anchorGoal.targetValue),
  );

  const completedCount = goals.filter(
    (g) => g.status === 'completed' || g.currentValue >= g.targetValue,
  ).length;
  const totalCount = goals.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Directives assembly
  const directives: TacticalDirective[] = [];

  // Directive 1: Anchor Directive
  if (anchorGoal) {
    if (isAnchorCompleted) {
      directives.push({
        id: 'anchor-done',
        icon: '💎',
        title: 'Anchor Habit Secured',
        detail: `“${anchorGoal.name}” is locked in. High-priority foundation established for the day.`,
        type: 'anchor',
      });
    } else {
      const timeHint = anchorSched?.time
        ? ` Scheduled for ${formatTime12h(anchorSched.time)}.`
        : '';
      directives.push({
        id: 'anchor-pending',
        icon: '⚡',
        title: `Execute Anchor: ${anchorGoal.name}`,
        detail: `Your highest priority commitment today (${anchorGoal.targetValue} ${anchorGoal.unit}).${timeHint} Knocking this out protects your daily runway.`,
        type: 'anchor',
      });
    }
  }

  // Directive 2: Phase-specific pacing directive
  if (phase === 'morning') {
    const upcomingSched = goals
      .filter((g) => g.status !== 'completed' && g.currentValue < g.targetValue)
      .map((g) => ({ goal: g, sched: getGoalSchedule(g.id) }))
      .filter((item) => item.sched?.time);

    if (upcomingSched.length > 0) {
      const nextOne = upcomingSched[0];
      directives.push({
        id: 'morning-pace',
        icon: '🌅',
        title: 'Morning Momentum Window',
        detail: `Next scheduled commitment is “${nextOne.goal.name}” at ${formatTime12h(nextOne.sched!.time)}. Protect this block from distractions.`,
        type: 'pacing',
      });
    } else {
      directives.push({
        id: 'morning-pace-general',
        icon: '🎯',
        title: 'Prime The Morning Block',
        detail: `You have ${totalCount} active habits on your runway. Aim for 2 completions before midday to create effortless momentum.`,
        type: 'pacing',
      });
    }
  } else if (phase === 'afternoon') {
    const remainingCount = totalCount - completedCount;
    if (remainingCount <= 2 && remainingCount > 0) {
      directives.push({
        id: 'afternoon-homestretch',
        icon: '🔥',
        title: 'Final Stretch in Sight',
        detail: `Just ${remainingCount} habits remaining to hit 100% completion today. Close the loop before the evening wind-down.`,
        type: 'pacing',
      });
    } else if (remainingCount > 2) {
      directives.push({
        id: 'afternoon-batch',
        icon: '⚡',
        title: 'Midday Re-Focus Sprint',
        detail: `${completedCount} of ${totalCount} completed. Stack your next 2 commitments in a single 25-minute focus session.`,
        type: 'pacing',
      });
    } else {
      directives.push({
        id: 'afternoon-crushed',
        icon: '🏆',
        title: 'Runway Conquered Early',
        detail: `All ${totalCount} habits completed before dusk! Use the afternoon for creative exploration or relaxed maintenance.`,
        type: 'pacing',
      });
    }
  } else {
    // Evening
    if (completionPercent >= 80) {
      directives.push({
        id: 'evening-celebrate',
        icon: '🌙',
        title: 'Evening Wind-Down & Transition',
        detail: `Superb execution today (${completionPercent}% finished). Dim blue light, log your daily reflection, and prepare for deep rest.`,
        type: 'winddown',
      });
    } else {
      directives.push({
        id: 'evening-wrapup',
        icon: '✨',
        title: 'Gentle Evening Wrap-Up',
        detail: `Prioritize mind & routine habits (reading, journaling, hydration). Even a 5-minute micro-session keeps your momentum alive.`,
        type: 'winddown',
      });
    }
  }

  // Directive 3: Score Trajectory & Psychology Directive
  if (dailyScore >= 80) {
    directives.push({
      id: 'score-tier-high',
      icon: '🌟',
      title: `Daily Score: ${dailyScore}/100 (Mastery Tier)`,
      detail: `Your weighted habits and consistency are performing at peak level. This builds compounding returns.`,
      type: 'score',
    });
  } else if (dailyScore >= 50) {
    directives.push({
      id: 'score-tier-mid',
      icon: '📈',
      title: `Daily Score: ${dailyScore}/100 (Growth Tier)`,
      detail: `Completing one more Priority 1 or 2 habit will elevate today into the 80+ Mastery Tier.`,
      type: 'score',
    });
  } else {
    directives.push({
      id: 'score-tier-low',
      icon: '🌱',
      title: `Daily Score: ${dailyScore}/100 (Initiation)`,
      detail: `Focus on progress over perfection. Even 1 logged habit moves the needle forward today.`,
      type: 'score',
    });
  }

  // Evening Debrief Synthesis
  let eveningDebrief: DailyBriefing['eveningDebrief'];
  if (phase === 'evening' || completionPercent >= 70) {
    const completedGoals = goals.filter(
      (g) => g.status === 'completed' || g.currentValue >= g.targetValue,
    );
    const highlights = completedGoals.slice(0, 3).map((g) => g.name);

    let scoreTier = 'Steady Builder';
    if (dailyScore >= 85) scoreTier = 'Mastery Flow';
    else if (dailyScore >= 70) scoreTier = 'Strong Execution';
    else if (dailyScore >= 50) scoreTier = 'Solid Momentum';

    // Synthesize reflection text
    let suggested = '';
    if (highlights.length > 0) {
      suggested = `Strong day locking in ${highlights.join(', ')}. Scored ${dailyScore}/100 with ${focusMinutes > 0 ? `${focusMinutes}m of focus` : 'consistent habit progress'}. Ready to recharge and carry momentum into tomorrow.`;
    } else {
      suggested = `Navigated today with honesty. Completed ${completedCount} commitments and maintained foundational presence. Looking forward to an energized reset tomorrow.`;
    }

    eveningDebrief = {
      scoreEstimate: dailyScore,
      scoreTier,
      focusMinutes,
      completedHighlights: highlights,
      suggestedReflection: suggested,
    };
  }

  // Phase metadata
  const phaseConfig = {
    morning: {
      label: 'Morning Ignition',
      subtitle: 'Set high intention while cognitive reserves are at peak.',
      greeting: 'Rise & Focus',
    },
    afternoon: {
      label: 'Afternoon Flow',
      subtitle: 'Maintain deliberate cadence and clear pending runway items.',
      greeting: 'Steady The Pace',
    },
    evening: {
      label: 'Dusk Debrief',
      subtitle: 'Celebrate daily accomplishments and decompress mindfully.',
      greeting: 'Harvest Today’s Wins',
    },
  }[phase];

  return {
    phase,
    phaseLabel: phaseConfig.label,
    phaseSubtitle: phaseConfig.subtitle,
    greeting: phaseConfig.greeting,
    anchorGoal,
    anchorScheduleTime: anchorSched?.time,
    isAnchorCompleted,
    completedCount,
    totalCount,
    completionPercent,
    directives,
    eveningDebrief,
  };
}

const STORAGE_COLLAPSED_KEY = 'lifeos_daily_briefing_collapsed';

export function isBriefingCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBriefingCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_COLLAPSED_KEY, String(collapsed));
  } catch (err) {
    console.error('Failed to set briefing collapse preference:', err);
  }
}
