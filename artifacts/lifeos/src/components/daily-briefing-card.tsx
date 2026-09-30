import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Flame,
  Moon,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import type { DailyGoal } from '@workspace/api-client-react';
import {
  type DailyBriefing,
  generateDailyBriefing,
  isBriefingCollapsed,
  setBriefingCollapsed,
} from '@/lib/coach';
import { formatTime12h } from '@/lib/reminders';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DailyBriefingCardProps {
  goals: DailyGoal[];
  dailyScore: number;
  focusMinutes: number;
  onSelectGoal?: (goal: DailyGoal) => void;
  onOpenZen?: (goal?: DailyGoal) => void;
  onDraftReflection?: (text: string) => void;
}

export function DailyBriefingCard({
  goals,
  dailyScore,
  focusMinutes,
  onSelectGoal,
  onOpenZen,
  onDraftReflection,
}: DailyBriefingCardProps) {
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState<boolean>(() => isBriefingCollapsed());

  const briefing: DailyBriefing = useMemo(
    () => generateDailyBriefing(goals, dailyScore, focusMinutes),
    [goals, dailyScore, focusMinutes],
  );

  const toggleCollapse = () => {
    sound.playClick();
    const next = !collapsed;
    setCollapsed(next);
    setBriefingCollapsed(next);
  };

  // Aesthetic theme based on phase
  const themeStyles = {
    morning: {
      border: 'border-amber-500/25 dark:border-amber-400/20',
      badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      glow: 'from-amber-500/[0.06] via-transparent to-transparent',
      accentColor: 'text-amber-600 dark:text-amber-400',
    },
    afternoon: {
      border: 'border-sky-500/25 dark:border-sky-400/20',
      badgeBg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
      glow: 'from-sky-500/[0.06] via-transparent to-transparent',
      accentColor: 'text-sky-600 dark:text-sky-400',
    },
    evening: {
      border: 'border-indigo-500/25 dark:border-indigo-400/20',
      badgeBg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
      glow: 'from-indigo-500/[0.06] via-transparent to-transparent',
      accentColor: 'text-indigo-600 dark:text-indigo-400',
    },
  }[briefing.phase];

  const handleDraftReflection = () => {
    if (briefing.eveningDebrief?.suggestedReflection) {
      sound.playComplete();
      onDraftReflection?.(briefing.eveningDebrief.suggestedReflection);
      toast({
        title: 'Reflection Drafted! ✍️',
        description: 'Transferred today’s synthesis into your evening reflection.',
      });
    }
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[28px] border bg-gradient-to-b bg-card p-5 sm:p-6 transition-all duration-300 shadow-sm',
        themeStyles.border,
        themeStyles.glow,
      )}
      data-testid="daily-briefing-card"
    >
      {/* Top Header Bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'grid size-10 place-items-center rounded-2xl shadow-xs transition-transform group-hover:scale-105',
              briefing.phase === 'morning'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : briefing.phase === 'afternoon'
                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                  : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
            )}
          >
            {briefing.phase === 'morning' ? (
              <Sparkles className="size-5" />
            ) : briefing.phase === 'afternoon' ? (
              <Zap className="size-5" />
            ) : (
              <Moon className="size-5" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider',
                  themeStyles.badgeBg,
                )}
              >
                <span>{briefing.phaseLabel}</span>
                <span className="opacity-40">·</span>
                <span className="font-mono text-[10px]">
                  {briefing.completedCount}/{briefing.totalCount} Done ({briefing.completionPercent}%)
                </span>
              </span>

              {dailyScore > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                  <Flame className="size-3 text-primary" />
                  Score: <strong className="text-foreground">{dailyScore}</strong>
                </span>
              )}
            </div>

            <h3 className="mt-1 text-base sm:text-lg font-black tracking-tight text-sidebar">
              {briefing.greeting}
            </h3>
          </div>
        </div>

        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="focus-ring flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          data-testid="button-toggle-briefing"
          title={collapsed ? 'Expand briefing' : 'Collapse briefing'}
        >
          <span className="text-[11px] hidden sm:inline">
            {collapsed ? 'View Game Plan' : 'Collapse'}
          </span>
          {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </button>
      </div>

      {/* Collapsed summary pill */}
      {collapsed && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          <p className="line-clamp-1 flex-1 font-medium">{briefing.phaseSubtitle}</p>
          {briefing.anchorGoal && !briefing.isAnchorCompleted && (
            <button
              type="button"
              onClick={() => onSelectGoal?.(briefing.anchorGoal!)}
              className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline text-[11px]"
            >
              <span>Anchor: {briefing.anchorGoal.name}</span>
              <ArrowRight className="size-3" />
            </button>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {!collapsed && (
        <div className="mt-5 space-y-4 animate-fade-in">
          {/* Subtitle description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {briefing.phaseSubtitle}
          </p>

          {/* Anchor Habit Spotlight Card */}
          {briefing.anchorGoal && (
            <div
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 transition-all',
                briefing.isAnchorCompleted
                  ? 'border-primary/30 bg-primary/[0.04]'
                  : 'border-border/90 bg-background/60 hover:border-primary/50 shadow-2xs',
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl font-black text-sm',
                    briefing.isAnchorCompleted
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-sidebar text-sidebar-foreground',
                  )}
                >
                  {briefing.isAnchorCompleted ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Target className="size-4 text-accent" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="mono-label text-[10px] text-muted-foreground">
                      Today’s Anchor Commitment
                    </span>
                    {briefing.anchorScheduleTime && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                        <Clock className="size-2.5" />
                        {formatTime12h(briefing.anchorScheduleTime)}
                      </span>
                    )}
                  </div>
                  <div className="font-extrabold text-sm text-sidebar">
                    {briefing.anchorGoal.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Target: {briefing.anchorGoal.targetValue} {briefing.anchorGoal.unit} · Priority {briefing.anchorGoal.priority} (Essential)
                  </div>
                </div>
              </div>

              {/* Anchor Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {briefing.isAnchorCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-black text-primary">
                    <CheckCircle2 className="size-3.5" /> Secured
                  </span>
                ) : (
                  <>
                    {onOpenZen && (
                      <button
                        type="button"
                        onClick={() => onOpenZen(briefing.anchorGoal!)}
                        className="focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                        title="Enter Zen focus block with soundscapes"
                      >
                        <Moon className="size-3 text-accent" />
                        <span>Zen</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectGoal?.(briefing.anchorGoal!)}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-black text-primary-foreground shadow-xs hover:opacity-90 active:scale-95"
                    >
                      <span>Execute</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tactical 3-Point Checklist */}
          <div className="grid gap-2 sm:grid-cols-3">
            {briefing.directives.map((dir) => (
              <div
                key={dir.id}
                className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-3.5 transition-colors hover:bg-card"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-sidebar">
                    <span>{dir.icon}</span>
                    <span className="line-clamp-1">{dir.title}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {dir.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Evening Debrief Assistant Banner */}
          {briefing.eveningDebrief && (
            <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/[0.03] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/20 text-sidebar">
                    <Trophy className="size-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-sidebar">
                        Evening Synthesis: {briefing.eveningDebrief.scoreTier}
                      </span>
                      <span className="rounded-full bg-sidebar/10 px-2 py-0.5 text-[10px] font-bold text-sidebar">
                        {dailyScore}/100 Score
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed italic">
                      “{briefing.eveningDebrief.suggestedReflection}”
                    </p>
                  </div>
                </div>

                {onDraftReflection && (
                  <button
                    type="button"
                    onClick={handleDraftReflection}
                    className="focus-ring inline-flex shrink-0 items-center gap-1.5 self-end sm:self-auto rounded-full bg-sidebar px-4 py-2 text-xs font-extrabold text-sidebar-foreground shadow-sm hover:opacity-90 active:scale-95"
                    data-testid="button-draft-reflection"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Draft to Reflection</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
