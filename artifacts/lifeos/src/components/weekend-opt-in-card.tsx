import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Plus,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Category, DailyGoal, Goal } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { sound } from '@/lib/sound';
import { useToast } from '@/hooks/use-toast';

interface WeekendOptInCardProps {
  restingGoals: Goal[];
  activeTodayGoals: DailyGoal[];
  onRefresh: () => Promise<void> | void;
  categoryStyles: Record<
    Category,
    { label: string; color: string; dot: string; textColor: string }
  >;
}

export function WeekendOptInCard({
  restingGoals,
  activeTodayGoals,
  onRefresh,
  categoryStyles,
}: WeekendOptInCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [loadingGoalId, setLoadingGoalId] = useState<number | null>(null);

  if (restingGoals.length === 0 && activeTodayGoals.length === 0) {
    return null;
  }

  const handleToggleOptIn = async (goal: Goal, currentlyActive: boolean) => {
    setLoadingGoalId(goal.id);
    sound.playClick();

    try {
      if (currentlyActive) {
        // Deactivate for today
        const res = await fetch(`/api/today/goals/${goal.id}/opt-in`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to deactivate');
        await onRefresh();
        toast({
          title: 'Habit Resting',
          description: `"${goal.name}" returned to resting state for today.`,
        });
      } else {
        // Activate for today
        const res = await fetch(`/api/today/goals/${goal.id}/opt-in`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to activate');
        sound.playCelebration();
        await onRefresh();
        toast({
          title: 'Activated for Today! ⚡',
          description: `"${goal.name}" is now on your runway for today. It will automatically disable tomorrow and next weekend.`,
        });
      }
    } catch {
      toast({
        title: 'Action Failed',
        description: 'Unable to update habit state. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingGoalId(null);
    }
  };

  const isRestingAll = activeTodayGoals.length === 0;

  return (
    <div className="mb-6 overflow-hidden rounded-[26px] border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.03] p-5 shadow-xs transition-all sm:p-6">
      {/* Header / Hero */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Coffee className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-label font-extrabold tracking-wider text-amber-700 dark:text-amber-300">
                WEEKEND DELOAD RHYTHMS
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                Streak Safe ✓
              </span>
            </div>
            <h3 className="mt-0.5 text-lg font-black tracking-[-.03em] text-sidebar">
              {isRestingAll
                ? 'Mindful Weekend Deload · Weekdays Resting'
                : 'Weekend Runway Active · Optional Weekday Habits'}
            </h3>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground leading-relaxed">
              Weekday habits pause on weekends to protect your recovery. Want to make progress today? Toggle any habit below—it applies strictly to today and automatically stays disabled tomorrow and next weekend.
            </p>
          </div>
        </div>

        {restingGoals.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="focus-ring self-end sm:self-center inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
          >
            <span>{isExpanded ? 'Hide' : 'Browse'} Resting Habits ({restingGoals.length})</span>
            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        )}
      </div>

      {/* Expandable Resting Goals List */}
      {isExpanded && restingGoals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/60">
          <div className="mb-2.5 flex items-center justify-between text-xs">
            <span className="mono-label text-muted-foreground">
              Single-Day Opt-In (Mon–Fri Cadence)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Turns on for today only
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {restingGoals.map((goal) => {
              const activeInstance = activeTodayGoals.find((g) => g.goalId === goal.id);
              const isActiveToday = Boolean(activeInstance);
              const style = categoryStyles[goal.category] ?? categoryStyles.career;
              const isLoading = loadingGoalId === goal.id;

              return (
                <div
                  key={goal.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all',
                    isActiveToday
                      ? 'border-primary/40 bg-primary/[0.04]'
                      : 'border-border/70 bg-card/60 hover:border-border hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        style.dot,
                      )}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-sidebar">
                        {goal.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {goal.targetValue} {goal.unit} · {style.label}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleToggleOptIn(goal, isActiveToday)}
                    className={cn(
                      'focus-ring shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50',
                      isActiveToday
                        ? 'border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                        : 'border border-border bg-card text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary',
                    )}
                    title={
                      isActiveToday
                        ? 'Deactivate for today'
                        : 'Activate for today only (will automatically disable tomorrow)'
                    }
                  >
                    {isLoading ? (
                      <RotateCcw className="size-3 animate-spin" />
                    ) : isActiveToday ? (
                      <>
                        <Check className="size-3 text-primary stroke-[3]" />
                        <span>Active Today</span>
                      </>
                    ) : (
                      <>
                        <Plus className="size-3" strokeWidth={2.5} />
                        <span>Turn On Today</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
