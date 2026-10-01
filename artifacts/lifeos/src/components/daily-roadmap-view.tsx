import { useMemo, useState } from 'react';
import {
  Anchor,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  MapPin,
  Moon,
  MoreHorizontal,
  Navigation,
  Play,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Zap,
} from 'lucide-react';
import type { Category, DailyGoal, GoalStatus } from '@workspace/api-client-react';
import { ActivitySchedulePopover } from '@/components/activity-schedule-popover';
import {
  type DayStation,
  type GoalSchedule,
  type StationConfig,
  STATION_CONFIGS,
  formatTime12h,
  getCurrentTimeHHMM,
  getScheduleStation,
  isScheduleDueNow,
  sortGoalsByScheduleTime,
} from '@/lib/reminders';
import { ROUTINE_CONFIGS, getGoalRoutine } from '@/lib/routines';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';

interface DailyRoadmapViewProps {
  goals: DailyGoal[];
  schedules: Record<number, GoalSchedule>;
  anchorGoalId: number | null;
  onUpdate: (goal: DailyGoal, value: number, status?: GoalStatus) => void;
  onOpenDetails: (goal: DailyGoal) => void;
  onToggleAnchor: (goalId: number) => void;
  onCycleRoutine?: (goalId: number) => void;
  onOpenZen?: (goal: DailyGoal) => void;
  categoryStyles: Record<
    Category,
    { label: string; color: string; dot: string; textColor: string }
  >;
  pending: boolean;
}

const STATION_ORDER: DayStation[] = ['morning', 'midday', 'evening', 'night'];

export function DailyRoadmapView({
  goals,
  schedules,
  anchorGoalId,
  onUpdate,
  onOpenDetails,
  onToggleAnchor,
  onCycleRoutine,
  onOpenZen,
  categoryStyles,
  pending,
}: DailyRoadmapViewProps) {
  const [showFlexible, setShowFlexible] = useState(true);
  const currentTime = getCurrentTimeHHMM();

  // Partition goals by station
  const { stationGroups, scheduledGoals, flexibleGoals, nextUpcomingGoalId } = useMemo(() => {
    const sorted = sortGoalsByScheduleTime(goals, schedules);

    const groups: Record<DayStation, DailyGoal[]> = {
      morning: [],
      midday: [],
      evening: [],
      night: [],
      flexible: [],
    };

    const scheduled: DailyGoal[] = [];
    const flexible: DailyGoal[] = [];

    for (const goal of sorted) {
      const sched = schedules[goal.id];
      if (sched?.enabled && sched.time) {
        const station = getScheduleStation(sched.time);
        groups[station].push(goal);
        scheduled.push(goal);
      } else {
        groups.flexible.push(goal);
        flexible.push(goal);
      }
    }

    // Determine next upcoming incomplete scheduled goal
    let nextId: number | null = null;
    const incompleteScheduled = scheduled.filter((g) => g.status !== 'completed' && g.status !== 'skipped');

    if (incompleteScheduled.length > 0) {
      // Find earliest incomplete goal scheduled at or after current time
      const upcoming = incompleteScheduled.find((g) => {
        const t = schedules[g.id]?.time;
        return t && t >= currentTime;
      });
      nextId = upcoming ? upcoming.id : incompleteScheduled[0].id;
    }

    return {
      stationGroups: groups,
      scheduledGoals: scheduled,
      flexibleGoals: flexible,
      nextUpcomingGoalId: nextId,
    };
  }, [goals, schedules, currentTime]);

  const completedScheduledCount = scheduledGoals.filter((g) => g.status === 'completed').length;
  const totalScheduledCount = scheduledGoals.length;
  const roadmapCompletion =
    totalScheduledCount > 0 ? Math.round((completedScheduledCount / totalScheduledCount) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in" data-testid="daily-roadmap-container">
      {/* Route Journey Status Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/[0.08] via-card to-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Navigation className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono-label font-extrabold text-sidebar">Daily Roadmap · Ordered Route</span>
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-sidebar">
                  {totalScheduledCount} Scheduled Stops
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalScheduledCount === 0
                  ? 'No scheduled times yet. Click the schedule pill on any habit below to build your day route!'
                  : `${completedScheduledCount} of ${totalScheduledCount} roadmap stops completed (${roadmapCompletion}%)`}
              </p>
            </div>
          </div>

          {/* Progress Mini Rail */}
          {totalScheduledCount > 0 && (
            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="h-2 w-32 sm:w-44 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${roadmapCompletion}%` }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-sidebar">{roadmapCompletion}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Empty State when no goals at all */}
      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Compass className="mx-auto mb-3 size-8 text-muted-foreground/60" />
          <h3 className="text-sm font-bold text-sidebar">No commitments found for today</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Add goals in the Goals tab to map out your daily rhythm.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Chronological Stations */}
          <div className="space-y-8">
            {STATION_ORDER.map((stationKey) => {
              const stationConfig = STATION_CONFIGS[stationKey];
              const stationGoals = stationGroups[stationKey];
              if (stationGoals.length === 0) return null;

              return (
                <div key={stationKey} className="relative">
                  {/* Station Header */}
                  <div className="sticky top-2 z-10 mb-4 flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/95 py-2 px-3 backdrop-blur-md shadow-xs">
                    <span className="text-base">{stationConfig.icon}</span>
                    <span className="text-xs font-extrabold tracking-tight text-sidebar">
                      {stationConfig.label}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                      {stationConfig.timeRange}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {stationGoals.filter((g) => g.status === 'completed').length} / {stationGoals.length} done
                    </span>
                  </div>

                  {/* Connected Stops */}
                  <div className="relative ml-4 sm:ml-6 border-l-2 border-primary/20 pl-5 sm:pl-7 space-y-4">
                    {stationGoals.map((goal, idx) => {
                      const sched = schedules[goal.id];
                      const timeStr = sched?.time || '08:00';
                      const formattedTime = formatTime12h(timeStr);
                      const isNextUp = goal.id === nextUpcomingGoalId;
                      const isDone = goal.status === 'completed';
                      const isSkipped = goal.status === 'skipped';
                      const isDue = sched?.enabled && isScheduleDueNow(timeStr) && !isDone && !isSkipped;
                      const isAnchor = anchorGoalId === goal.id;
                      const style = categoryStyles[goal.category] ?? categoryStyles.career;
                      const routine = getGoalRoutine(goal);
                      const routineConfig = ROUTINE_CONFIGS[routine];

                      return (
                        <div
                          key={goal.id}
                          className="relative group"
                          data-testid={`roadmap-stop-${goal.id}`}
                        >
                          {/* Waypoint Marker on Rail */}
                          <div
                            className={cn(
                              'absolute -left-[29px] sm:-left-[37px] top-4.5 size-5 sm:size-6 rounded-full border-2 transition-all flex items-center justify-center',
                              isDone
                                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                : isNextUp
                                  ? 'border-primary bg-primary/20 text-primary ring-4 ring-primary/20 animate-pulse'
                                  : isDue
                                    ? 'border-amber-500 bg-amber-400/20 text-amber-700 ring-4 ring-amber-500/20 animate-pulse'
                                    : 'border-border bg-card text-muted-foreground',
                            )}
                          >
                            {isDone ? (
                              <Check className="size-3 stroke-[3]" />
                            ) : isNextUp ? (
                              <div className="size-2 rounded-full bg-primary" />
                            ) : (
                              <div className="size-1.5 rounded-full bg-muted-foreground/60" />
                            )}
                          </div>

                          {/* Roadmap Stop Card */}
                          <div
                            className={cn(
                              'rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-primary/60 hover:shadow-xs sm:p-5',
                              isNextUp && 'border-primary/50 bg-gradient-to-r from-primary/[0.04] to-card shadow-xs ring-1 ring-primary/20',
                              isDone && 'border-primary/20 bg-card/60 opacity-85',
                              isSkipped && 'border-dashed border-border opacity-60 bg-muted/20',
                            )}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              {/* Left details */}
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Completion Toggle Button */}
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => {
                                    sound.playClick();
                                    onUpdate(
                                      goal,
                                      isDone ? 0 : goal.targetValue,
                                      isDone ? 'in_progress' : 'completed',
                                    );
                                  }}
                                  className={cn(
                                    'focus-ring mt-0.5 grid size-6.5 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90',
                                    isDone
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : isSkipped
                                        ? 'border-muted-foreground/40 bg-muted text-muted-foreground'
                                        : 'border-border hover:border-primary',
                                  )}
                                  title={isDone ? 'Mark incomplete' : 'Mark milestone reached'}
                                >
                                  {isDone && <Check className="size-3.5 stroke-[3]" />}
                                </button>

                                <div
                                  onClick={() => onOpenDetails(goal)}
                                  className="min-w-0 flex-1 cursor-pointer"
                                  title="Click to adjust progress or focus timer"
                                >
                                  {/* Badges Bar */}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {/* Scheduled Time Pill */}
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex"
                                    >
                                      <ActivitySchedulePopover goal={goal} />
                                    </div>

                                    {isNextUp && !isDone && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-sidebar animate-pulse">
                                        <Zap className="size-3" /> Next Up
                                      </span>
                                    )}

                                    {isAnchor && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-extrabold text-accent-foreground">
                                        <Anchor className="size-3" /> Anchor
                                      </span>
                                    )}

                                    <span
                                      className={cn(
                                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                                        style.color,
                                      )}
                                    >
                                      {style.label}
                                    </span>

                                    {onCycleRoutine && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onCycleRoutine(goal.id);
                                        }}
                                        className={cn(
                                          'rounded-full px-2 py-0.5 text-[10px] font-bold border transition-all hover:scale-105 active:scale-95',
                                          routineConfig.bgColor,
                                          routineConfig.color,
                                          routineConfig.borderColor,
                                        )}
                                        title={`Routine: ${routineConfig.label} (Click to switch)`}
                                      >
                                        {routineConfig.icon} {routineConfig.label.split(' ')[0]}
                                      </button>
                                    )}
                                  </div>

                                  {/* Habit Name */}
                                  <h3
                                    className={cn(
                                      'mt-1.5 font-extrabold tracking-[-.01em] text-sidebar transition-colors group-hover:text-primary text-base',
                                      isDone && 'text-muted-foreground line-through opacity-70',
                                      isSkipped && 'text-muted-foreground italic',
                                    )}
                                  >
                                    {goal.name}
                                  </h3>

                                  {/* Progress readout */}
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {goal.currentValue} / {goal.targetValue} {goal.unit} ·{' '}
                                    {isDone
                                      ? 'Stop completed'
                                      : isSkipped
                                        ? 'Skipped for today'
                                        : goal.currentValue > 0
                                          ? `${Math.round(goal.percent)}% in motion`
                                          : `Scheduled for ${formattedTime}`}
                                  </p>
                                </div>
                              </div>

                              {/* Right Actions */}
                              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                {onOpenZen && !isDone && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenZen(goal)}
                                    className="focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-sidebar hover:border-primary/50 hover:bg-muted active:scale-95"
                                    title="Start Zen Focus session for this roadmap stop"
                                  >
                                    <Moon className="size-3 text-primary" />
                                    <span>Focus</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onToggleAnchor(goal.id)}
                                  className={cn(
                                    'focus-ring rounded-lg p-1.5 transition-all',
                                    isAnchor
                                      ? 'bg-accent/15 text-accent opacity-100'
                                      : 'text-muted-foreground/40 opacity-0 hover:bg-accent/10 hover:text-accent group-hover:opacity-100',
                                  )}
                                  title={isAnchor ? "Today's Anchor (Click to unpin)" : "Pin as Anchor"}
                                >
                                  <Anchor className="size-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onOpenDetails(goal)}
                                  className="focus-ring rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Adjust progress or timer"
                                >
                                  <MoreHorizontal className="size-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flexible / Anytime Today Stash */}
          {flexibleGoals.length > 0 && (
            <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setShowFlexible(!showFlexible)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🎒</span>
                  <div>
                    <h3 className="text-xs font-extrabold text-sidebar">
                      Flexible / Anytime Today ({flexibleGoals.length})
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Habits without fixed reminder times. Click the schedule badge on any habit to add it to your day roadmap.
                    </p>
                  </div>
                </div>
                <div className="grid size-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground">
                  {showFlexible ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </div>
              </button>

              {showFlexible && (
                <div className="mt-4 space-y-3 pt-3 border-t border-border/60">
                  {flexibleGoals.map((goal) => {
                    const isDone = goal.status === 'completed';
                    const isSkipped = goal.status === 'skipped';
                    const isAnchor = anchorGoalId === goal.id;
                    const style = categoryStyles[goal.category] ?? categoryStyles.career;
                    const routine = getGoalRoutine(goal);
                    const routineConfig = ROUTINE_CONFIGS[routine];

                    return (
                      <div
                        key={goal.id}
                        className={cn(
                          'group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 transition-all hover:border-primary/50',
                          isDone && 'opacity-70 bg-card/40',
                          isSkipped && 'opacity-50 italic',
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              sound.playClick();
                              onUpdate(
                                goal,
                                isDone ? 0 : goal.targetValue,
                                isDone ? 'in_progress' : 'completed',
                              );
                            }}
                            className={cn(
                              'focus-ring grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all',
                              isDone
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:border-primary',
                            )}
                          >
                            {isDone && <Check className="size-3 stroke-[3]" />}
                          </button>

                          <div
                            onClick={() => onOpenDetails(goal)}
                            className="min-w-0 cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4
                                className={cn(
                                  'font-bold text-xs text-sidebar group-hover:text-primary transition-colors',
                                  isDone && 'line-through opacity-70',
                                )}
                              >
                                {goal.name}
                              </h4>
                              {isAnchor && (
                                <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[9px] font-extrabold text-accent-foreground">
                                  Anchor
                                </span>
                              )}
                              <span
                                className={cn(
                                  'rounded-full px-1.5 py-0.2 text-[9px] font-bold',
                                  style.color,
                                )}
                              >
                                {style.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {goal.currentValue} / {goal.targetValue} {goal.unit}
                            </p>
                          </div>
                        </div>

                        {/* Quick 1-click Schedule Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <ActivitySchedulePopover
                            goal={goal}
                            className="text-[10px] py-1 px-2.5 font-bold"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
