import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Compass,
  Copy,
  Dumbbell,
  Flame,
  Heart,
  HelpCircle,
  Info,
  Moon,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useGetDashboard, useGetGoals, useGetToday } from '@workspace/api-client-react';
import type { Category, DailyGoal, Today as TodayData } from '@workspace/api-client-react';
import { AppShell, ProfileChip } from '@/components/app-shell';
import { HallOfFameModal } from '@/components/hall-of-fame-modal';
import { ModalPortal } from '@/components/modal-portal';
import { useToast } from '@/hooks/use-toast';
import { type UserStatsSnapshot, evaluateBadges } from '@/lib/badges';
import { ENERGY_LEVELS, getAllReflections, getLocalDateKey, getReflectionForDate, getTodayDateKey } from '@/lib/reflections';
import { getWeekDetails, getWeeklyObjectives } from '@/lib/weekly';
import { getShieldVaultState, getStreakTier } from '@/lib/shields';
import { getDailyHistoryRecord, fetchHistoryApi } from '@/lib/history';
import { cn } from '@/lib/utils';

interface DayActivity {
  date: string;
  dayLabel: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ...
  score: number;
  completedCount: number;
  totalCount: number;
  focusMinutes: number;
  isShielded?: boolean;
  isToday: boolean;
  isDeload?: boolean;
}

const categoryMeta: Record<
  Category,
  { label: string; icon: typeof Briefcase; color: string; dot: string; textColor: string }
> = {
  career: {
    label: 'Career',
    icon: Briefcase,
    color: 'bg-[#d8e99a]',
    dot: 'bg-[#88a52a]',
    textColor: 'text-[#364b0f]',
  },
  learning: {
    label: 'Learning',
    icon: BookOpen,
    color: 'bg-[#c9e7e8]',
    dot: 'bg-[#438b8d]',
    textColor: 'text-[#164344]',
  },
  health: {
    label: 'Health',
    icon: Dumbbell,
    color: 'bg-[#f6c7aa]',
    dot: 'bg-[#cf734a]',
    textColor: 'text-[#6a2b0e]',
  },
  mind: {
    label: 'Mind',
    icon: Sparkles,
    color: 'bg-[#ddd0ea]',
    dot: 'bg-[#8967a4]',
    textColor: 'text-[#442c5c]',
  },
  routine: {
    label: 'Routine',
    icon: Coffee,
    color: 'bg-[#e9ddad]',
    dot: 'bg-[#ad8e32]',
    textColor: 'text-[#50410f]',
  },
  personal: {
    label: 'Personal',
    icon: Compass,
    color: 'bg-[#cdd5e4]',
    dot: 'bg-[#667b9c]',
    textColor: 'text-[#263750]',
  },
};

function DayActivityModal({
  dateStr,
  onClose,
}: {
  dateStr: string;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');

  const dayGoalsQuery = useQuery({
    queryKey: ['goals-by-date', dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/today?date=${dateStr}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load day activities');
      return res.json() as Promise<TodayData>;
    },
  });

  const reflection = useMemo(() => getReflectionForDate(dateStr), [dateStr]);
  const data = dayGoalsQuery.data;
  const goals: DailyGoal[] = data?.goals ?? [];
  const score = data?.dailyScore ?? 0;
  const completedGoals = goals.filter((g: DailyGoal) => g.status === 'completed');
  const inProgressGoals = goals.filter((g: DailyGoal) => g.status === 'in_progress');

  const displayedGoals = useMemo(() => {
    if (filter === 'completed') return completedGoals;
    if (filter === 'in_progress') return inProgressGoals;
    return goals;
  }, [filter, goals, completedGoals, inProgressGoals]);

  const formattedDate = useMemo(() => {
    const d = new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [dateStr]);

  const handleOpenInToday = () => {
    onClose();
    setLocation(`/today?date=${dateStr}`);
  };

  const handleCopyReflection = () => {
    if (!reflection) return;
    const energyObj = ENERGY_LEVELS.find((e) => e.level === reflection.energyLevel);
    const md = `### 🌙 LifeOS Daily Reflection — ${reflection.date}
- **Score**: ${score}%
- **Energy**: ${energyObj?.icon} ${energyObj?.label} (${reflection.energyLevel}/5)
- **Mood**: ${reflection.moodTags?.join(', ') || 'None'}

#### 🏆 3 Daily Wins
${reflection.wins?.filter(Boolean).map((w, i) => `${i + 1}. ${w}`).join('\n') || 'None'}

#### 💡 Lesson / Friction
${reflection.lesson || 'None'}

#### 🙏 Gratitude
${reflection.gratitude || 'None'}
`;
    void navigator.clipboard.writeText(md);
    toast({
      title: 'Copied to clipboard',
      description: `Reflection for ${reflection.date} copied.`,
    });
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      >
        <div
          className="relative max-h-[85vh] sm:max-h-[88vh] w-full max-w-2xl overflow-y-auto modal-scroll rounded-3xl border border-border/80 bg-card p-6 shadow-2xl transition-all sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border/60 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="mono-label text-muted-foreground">{dateStr}</span>
                {dateStr === getTodayDateKey() && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    Today
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-sidebar">
                {formattedDate}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exact habits, execution logs, and reflections recorded on this day.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              title="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4 text-center">
            <div>
              <div className="mono-label text-[10px] text-muted-foreground">Daily Score</div>
              <div className="mt-1 font-mono text-2xl font-black text-primary">{score}%</div>
            </div>
            <div>
              <div className="mono-label text-[10px] text-muted-foreground">Commitments</div>
              <div className="mt-1 font-mono text-2xl font-black text-sidebar">
                {completedGoals.length} / {goals.length}
              </div>
            </div>
            <div>
              <div className="mono-label text-[10px] text-muted-foreground">Evening Reflection</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {reflection ? 'Recorded ✓' : 'Not recorded'}
              </div>
            </div>
          </div>

          {/* Goals Breakdown */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-sidebar">
                  Habits & Commitments ({goals.length})
                </h3>
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={cn(
                    'rounded-md px-2 py-0.5 transition-all cursor-pointer',
                    filter === 'all' ? 'bg-card text-foreground shadow-2xs font-extrabold' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  All ({goals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('completed')}
                  className={cn(
                    'rounded-md px-2 py-0.5 transition-all cursor-pointer',
                    filter === 'completed' ? 'bg-card text-foreground shadow-2xs font-extrabold' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Done ({completedGoals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('in_progress')}
                  className={cn(
                    'rounded-md px-2 py-0.5 transition-all cursor-pointer',
                    filter === 'in_progress' ? 'bg-card text-foreground shadow-2xs font-extrabold' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  In Motion ({inProgressGoals.length})
                </button>
              </div>
            </div>

            {dayGoalsQuery.isLoading ? (
              <div className="space-y-2 py-4">
                <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
                <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
                <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
              </div>
            ) : displayedGoals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                No commitments recorded under this filter for {dateStr}.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto modal-scroll pr-1">
                {displayedGoals.map((g: DailyGoal) => {
                  const meta = categoryMeta[g.category] || categoryMeta.career;
                  const Icon = meta.icon;
                  const isDone = g.status === 'completed';
                  const inProg = g.status === 'in_progress';
                  const pct = Math.min(100, Math.round((g.currentValue / Math.max(1, g.targetValue)) * 100));

                  return (
                    <div
                      key={g.id}
                      className={cn(
                        'flex flex-col gap-2 rounded-2xl border p-3.5 transition-all',
                        isDone
                          ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                          : inProg
                            ? 'border-primary/30 bg-primary/[0.04]'
                            : 'border-border/70 bg-card',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn('grid size-7 shrink-0 place-items-center rounded-lg text-sidebar', meta.color)}>
                            <Icon className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className={cn('text-xs font-bold text-sidebar truncate block', isDone && 'line-through opacity-70')}>
                              {g.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {meta.label} · Target: {g.targetValue} {g.unit}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs font-extrabold text-sidebar">
                            {g.currentValue} / {g.targetValue} {g.unit}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1',
                              isDone
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : inProg
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : g.status === 'skipped'
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-muted/60 text-muted-foreground',
                            )}
                          >
                            {isDone && <Check className="size-2.5 stroke-[3]" />}
                            {inProg && <Zap className="size-2.5" />}
                            <span>{isDone ? 'Completed' : inProg ? `${pct}%` : g.status === 'skipped' ? 'Skipped' : 'Not started'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Progress Track */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isDone ? 'bg-emerald-500' : inProg ? 'bg-primary' : 'bg-muted-foreground/30',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Evening Reflection & Wins Section */}
          {reflection && (
            <div className="mt-6 rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <Moon className="size-4 text-primary" />
                  <span className="text-xs font-bold text-sidebar">Evening Reflection & Wins</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyReflection}
                  className="focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <Copy className="size-3" />
                  <span>Copy Markdown</span>
                </button>
              </div>

              {/* Energy & Mood */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Energy state:</span>
                <span className="font-bold text-primary">
                  {ENERGY_LEVELS.find((e) => e.level === reflection.energyLevel)?.icon}{' '}
                  {ENERGY_LEVELS.find((e) => e.level === reflection.energyLevel)?.label} ({reflection.energyLevel}/5)
                </span>
              </div>

              {/* 3 Wins */}
              {reflection.wins?.some(Boolean) && (
                <div>
                  <span className="mono-label text-[10px] text-muted-foreground">3 Daily Wins:</span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs font-medium text-foreground">
                    {reflection.wins.map((w, i) => (
                      w ? <li key={i}>{w}</li> : null
                    ))}
                  </ul>
                </div>
              )}

              {/* Lesson */}
              {reflection.lesson && (
                <div className="text-xs">
                  <span className="mono-label text-[10px] text-muted-foreground">Lesson learned:</span>
                  <p className="mt-0.5 italic text-muted-foreground">"{reflection.lesson}"</p>
                </div>
              )}

              {/* Gratitude */}
              {reflection.gratitude && (
                <div className="flex items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  <Heart className="size-3 text-rose-500 shrink-0" />
                  <span className="italic">"{reflection.gratitude}"</span>
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4">
            <button
              type="button"
              onClick={handleOpenInToday}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-4 py-2 text-xs font-extrabold text-foreground shadow-2xs hover:border-primary hover:bg-muted active:scale-95 transition-all cursor-pointer"
            >
              <span>Open in Today Runway</span>
              <ArrowRight className="size-3.5 text-accent" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full bg-sidebar px-5 py-2 text-xs font-extrabold text-sidebar-foreground shadow-xs hover:bg-sidebar/90 active:scale-95 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function Analytics() {
  const dashboardQuery = useGetDashboard();
  const todayQuery = useGetToday();
  const goalsQuery = useGetGoals();

  const dashboard = dashboardQuery.data;
  const today = todayQuery.data;
  const goals = goalsQuery.data ?? [];

  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [hoveredDay, setHoveredDay] = useState<DayActivity | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [showShieldExplainer, setShowShieldExplainer] = useState(false);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const reflections = useMemo(() => getAllReflections(), []);

  const streak = dashboard?.streak ?? 0;
  const todayScore = dashboard?.dailyScore ?? today?.dailyScore ?? 0;

  const historyQuery = useQuery({
    queryKey: ['server-history-analytics'],
    queryFn: () => {
      const now = new Date();
      const past = new Date(now);
      past.setDate(past.getDate() - 45);
      const startStr = getLocalDateKey(past);
      const endStr = getLocalDateKey(now);
      return fetchHistoryApi(startStr, endStr);
    },
  });

  const focusMinutes = dashboard?.focusMinutes ?? 0;

  const userStats: UserStatsSnapshot = useMemo(() => {
    const todayGoals = today?.goals ?? [];
    const completedGoals = todayGoals.filter((g) => g.status === 'completed');
    const distinctCats = new Set(completedGoals.map((g) => g.category)).size;
    const weeklyOkrs = getWeeklyObjectives(getWeekDetails(new Date()).weekKey);
    const okrsDone = weeklyOkrs.filter((o) => o.completed).length;

    return {
      streak,
      dailyScore: todayScore,
      dailyCompletion: today?.dailyCompletion ?? 0,
      focusMinutes,
      totalGoalsCount: goals.length,
      completedGoalsCount: completedGoals.length,
      distinctCategoriesCompleted: distinctCats,
      eveningReflectionsCount: reflections.length,
      weeklyOkrsCompleted: okrsDone,
    };
  }, [streak, todayScore, today, focusMinutes, goals, reflections]);

  const badges = useMemo(() => evaluateBadges(userStats), [userStats]);
  const unlockedBadges = badges.filter((b) => b.unlocked);

  // Real Shield Vault State & Momentum Tier
  const shieldVault = useMemo(() => getShieldVaultState(), []);
  const streakTier = useMemo(() => getStreakTier(streak), [streak]);

  // Generate 35 days of activity matrix ending today
  const activityData: DayActivity[] = useMemo(() => {
    const days: DayActivity[] = [];
    const now = new Date();

    for (let i = 34; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isToday = i === 0;
      const dateKey = getLocalDateKey(d);
      const dayOfWeek = d.getDay();

      let dayScore = 0;
      let dayCompleted = 0;
      let dayTotal = Math.max(1, goals.length || 1);
      let dayFocus = 0;
      let isShielded = false;

      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      let isDeload = false;
      const serverRecord = historyQuery.data?.[dateKey];

      if (isToday) {
        dayScore = todayScore;
        dayCompleted = dashboard?.completedCount ?? today?.goals.filter((g) => g.status === 'completed').length ?? 0;
        const rawTodayTotal = dashboard?.totalCount ?? today?.goals.length ?? 0;
        dayTotal = rawTodayTotal > 0 ? rawTodayTotal : (isWeekendDay ? 0 : Math.max(1, goals.length || 1));
        dayFocus = focusMinutes;
        isShielded = Boolean(shieldVault.deployedShields[dateKey]);
        isDeload = isWeekendDay && dayTotal === 0 && dayScore === 0;
      } else {
        // Genuine recorded history from server and local storage
        const record = getDailyHistoryRecord(dateKey);
        const effectiveScore = serverRecord?.dailyScore !== undefined ? serverRecord.dailyScore : record.score;
        const effectiveCompleted = serverRecord?.completedCount !== undefined ? serverRecord.completedCount : record.completedCount;
        const effectiveTotal = serverRecord?.totalCount !== undefined ? serverRecord.totalCount : record.totalCount;
        const effectiveFocus = serverRecord?.focusMinutes !== undefined ? serverRecord.focusMinutes : record.focusMinutes;

        const isRestWeekend = isWeekendDay && effectiveTotal === 0;
        dayScore = effectiveScore;
        dayCompleted = effectiveCompleted;
        dayTotal = effectiveTotal > 0 ? effectiveTotal : (isRestWeekend ? 0 : Math.max(1, goals.length || 1));
        dayFocus = effectiveFocus;
        isShielded = record.isShielded ?? false;
        isDeload = isRestWeekend && dayScore === 0;
      }

      days.push({
        date: dateKey,
        dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayOfWeek,
        score: Math.round(dayScore),
        completedCount: dayCompleted,
        totalCount: dayTotal,
        focusMinutes: dayFocus,
        isShielded,
        isToday,
        isDeload,
      });
    }
    return days;
  }, [todayScore, focusMinutes, dashboard, today, goals, shieldVault.deployedShields, historyQuery.data]);

  // Aggregate monthly stats based on authentic recorded days
  const activeRecordedDays = activityData.filter((d) => d.score > 0 || d.focusMinutes > 0 || d.isShielded);
  const averageScore =
    activeRecordedDays.length > 0
      ? Math.round(activeRecordedDays.reduce((acc, d) => acc + d.score, 0) / activeRecordedDays.length)
      : 0;
  const totalFocusHours = Math.round((activityData.reduce((acc, d) => acc + d.focusMinutes, 0) / 60) * 10) / 10;
  const bestDay = useMemo(() => {
    return activityData.reduce((max, d) => (d.score > max.score ? d : max), activityData[activityData.length - 1]);
  }, [activityData]);

  // Day-of-week average rhythm (0 = Sun, 1 = Mon ... 6 = Sat)
  const dayOfWeekAverages = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);

    activityData.forEach((d) => {
      if (d.score > 0) {
        sums[d.dayOfWeek] += d.score;
        counts[d.dayOfWeek] += 1;
      }
    });

    return dayNames.map((name, idx) => ({
      name,
      dayIndex: idx,
      average: counts[idx] > 0 ? Math.round(sums[idx] / counts[idx]) : 0,
    }));
  }, [activityData]);

  const contributions = today?.categoryContributions ?? dashboard?.categoryContributions ?? [];

  return (
    <AppShell>
      <div className="animate-rise-in">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="mono-label text-muted-foreground">Long-Term Consistency</div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.07em] text-sidebar sm:text-5xl">
              Analytics<span className="text-accent">.</span>
            </h1>
            <p className="mt-2 max-w-[460px] text-sm leading-6 text-muted-foreground">
              Review your execution momentum, pillar balance, and streak protection history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                document.getElementById('evening-reflections-archive')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-extrabold text-foreground shadow-2xs hover:border-primary/50 hover:bg-muted active:scale-95 transition-all"
              title="Jump directly to Evening Reflections & Wins archive"
            >
              <Moon className="size-3.5 text-primary" />
              <span>Reflections Archive ({reflections.length})</span>
            </button>
            <ProfileChip onOpenTrophies={() => setShowHallOfFame(true)} />
          </div>
        </div>

        {/* Top Summary Metric Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Active Streak + Shields */}
          <div className="rounded-[24px] border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="mono-label">Rhythm Momentum</span>
              <span className="text-base" title={streakTier.name}>{streakTier.icon}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-sidebar">{streak}</span>
              <span className="text-sm font-bold text-muted-foreground">days streak ({streakTier.name})</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sidebar">
                <ShieldCheck className="size-3.5 text-accent" />
                <span>{shieldVault.availableShields} / {shieldVault.maxShields} Resilience Shields</span>
              </div>
              <button
                type="button"
                onClick={() => setShowShieldExplainer(true)}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Vault Info
              </button>
            </div>
          </div>

          {/* Average Consistency Score */}
          <div className="rounded-[24px] border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="mono-label">Monthly Average</span>
              <Award className="size-4 text-accent" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-sidebar">{averageScore}</span>
              <span className="text-sm font-bold text-muted-foreground">/ 100 score</span>
            </div>
            <div className="mt-4 border-t border-border/60 pt-3 text-[11px] font-semibold text-muted-foreground">
              {activeRecordedDays.length > 0
                ? `Across ${activeRecordedDays.length} active recorded ${activeRecordedDays.length === 1 ? 'day' : 'days'}`
                : 'No active rhythms recorded yet'}
            </div>
          </div>

          {/* Cumulative Focus Time */}
          <div className="rounded-[24px] border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="mono-label">Focus Volume</span>
              <Clock className="size-4 text-[#8dd7d8]" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-sidebar">{totalFocusHours}</span>
              <span className="text-sm font-bold text-muted-foreground">total hours</span>
            </div>
            <div className="mt-4 border-t border-border/60 pt-3 text-[11px] font-semibold text-muted-foreground">
              High-value deep work & practice
            </div>
          </div>

          {/* Peak Execution Day */}
          <div className="rounded-[24px] border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="mono-label">Peak Performance</span>
              <Zap className="size-4 text-primary" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-sidebar">{bestDay.score}</span>
              <span className="text-sm font-bold text-muted-foreground">
                pts · {bestDay.score > 0 ? bestDay.dayLabel : 'No peak yet'}
              </span>
            </div>
            <div className="mt-4 border-t border-border/60 pt-3 text-[11px] font-semibold text-muted-foreground">
              {bestDay.score > 0 ? 'Highest scoring day on record' : 'Complete goals to set your first peak'}
            </div>
          </div>
        </div>

        {/* 35-Day Punchcard Heatmap */}
        <section className="mb-8 rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-7">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="mono-label text-muted-foreground">Consistency Punchcard</div>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-.03em] text-sidebar">
                35-Day Activity Heatmap
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Click any day cell to inspect the exact commitments, habits, and reflections recorded.
              </p>
            </div>

            {/* Intensity legend */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Less</span>
              <span className="size-3 rounded-xs border border-border bg-muted/40" />
              <span className="size-3 rounded-xs bg-primary/25" />
              <span className="size-3 rounded-xs bg-primary/50" />
              <span className="size-3 rounded-xs bg-primary/80" />
              <span className="size-3 rounded-xs bg-primary" />
              <span>More</span>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[500px] grid-cols-7 gap-2.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="mono-label text-center text-[10px] text-muted-foreground/70">
                  {d}
                </div>
              ))}

              {activityData.map((day) => {
                const intensityClass =
                  day.score === 0
                    ? day.isShielded
                      ? 'border border-accent/40 bg-accent/20 text-accent font-semibold'
                      : day.isDeload
                        ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium'
                        : 'border border-border/60 bg-muted/30 text-muted-foreground/40'
                    : day.score < 50
                      ? 'border border-primary/20 bg-primary/20 text-sidebar font-semibold'
                      : day.score < 75
                        ? 'border border-primary/40 bg-primary/50 text-sidebar font-bold'
                        : day.score < 90
                          ? 'border border-primary/60 bg-primary/80 text-primary-foreground font-extrabold'
                          : 'border border-primary bg-primary text-primary-foreground font-black shadow-xs';

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDayDate(day.date)}
                    onMouseEnter={() => setHoveredDay(day)}
                    onFocus={() => setHoveredDay(day)}
                    className={cn(
                      'focus-ring group relative flex h-14 flex-col items-center justify-center rounded-2xl cursor-pointer transition-all hover:scale-105 active:scale-95',
                      intensityClass,
                      day.isToday && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
                      selectedDayDate === day.date && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 shadow-md',
                    )}
                    title={`Click to view habit and activity breakdown for ${day.dayLabel}`}
                  >
                    <span className="font-mono text-xs">
                      {day.isDeload && day.score === 0 ? '☕' : day.score}
                    </span>
                    <span className="text-[10px] opacity-75">{day.dayLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Hover Detail Inspector */}
          {hoveredDay && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sidebar">{hoveredDay.dayLabel}</span>
                {hoveredDay.isToday && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    Today
                  </span>
                )}
                {hoveredDay.isShielded && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    Shielded 🛡️
                  </span>
                )}
                {hoveredDay.isDeload && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    Weekend Deload ☕
                  </span>
                )}
                <span className="text-muted-foreground">· Daily Score:</span>
                <span className="font-mono font-bold text-sidebar">{hoveredDay.score} / 100</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-muted-foreground">
                <span>
                  Commitments: <strong className="text-foreground">{hoveredDay.completedCount} / {hoveredDay.totalCount}</strong>
                </span>
                <span>
                  Focus: <strong className="text-foreground">{hoveredDay.focusMinutes} mins</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDayDate(hoveredDay.date)}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-sidebar px-3 py-1 text-[11px] font-extrabold text-sidebar-foreground shadow-2xs hover:bg-sidebar/90 transition-all active:scale-95 cursor-pointer"
                  title="View full commitments and reflections for this day"
                >
                  <span>View Day Activities</span>
                  <ArrowRight className="size-3 text-accent" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Two-Column Insights Layout */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Day-of-Week Rhythm Trends */}
          <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mono-label text-muted-foreground">Execution Patterns</div>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-.03em] text-sidebar">
                  Day-of-Week Rhythm
                </h2>
              </div>
              <BarChart3 className="size-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {dayOfWeekAverages.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="w-8 font-mono text-xs font-bold text-sidebar">{item.name}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        item.average >= 80 ? 'bg-primary' : item.average >= 60 ? 'bg-primary/60' : 'bg-muted-foreground/40',
                      )}
                      style={{ width: `${Math.min(item.average, 100)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-xs font-bold text-sidebar">
                    {item.average}%
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-xs text-sidebar">
              💡 <strong>Rhythm Insight:</strong> Weekday mornings yield your highest execution consistency. Consider shifting lighter routines to recovery days.
            </div>
          </section>

          {/* Pillar Balance Breakdown */}
          <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mono-label text-muted-foreground">Holistic Harmony</div>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-.03em] text-sidebar">
                  Pillar Balance
                </h2>
              </div>
              <Compass className="size-5 text-muted-foreground" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(categoryMeta) as Category[]).map((catKey) => {
                const meta = categoryMeta[catKey];
                const Icon = meta.icon;
                const match = contributions.find((c) => c.category === catKey);
                const completion = match ? Math.round(match.completion) : 0;

                return (
                  <div
                    key={catKey}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/50 p-3.5"
                  >
                    <div
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-xl text-sidebar',
                        meta.color,
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-sidebar">{meta.label}</span>
                        <span className="font-mono font-bold text-muted-foreground">{completion}%</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', meta.dot)}
                          style={{ width: `${Math.min(completion, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              LifeOS balances scoring across career, vitality, and mind so that professional sprints do not erode personal well-being.
            </div>
          </section>
        </div>

        {/* Milestones & Hall of Fame Showcase Strip */}
        <section className="mt-8 rounded-[28px] border border-border/80 bg-sidebar p-6 text-sidebar-foreground shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-amber-400/20 text-amber-400">
                <Trophy className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-sidebar-foreground">Hall of Milestones</h2>
                <div className="mono-label text-sidebar-foreground/50">
                  {unlockedBadges.length} of {badges.length} Trophies Achieved
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHallOfFame(true)}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm transition-transform hover:opacity-90 active:scale-95"
            >
              <Trophy className="size-4" />
              <span>Explore Trophy Case</span>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {badges.slice(0, 6).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setShowHallOfFame(true)}
                className={cn(
                  'flex flex-col items-center justify-between rounded-2xl border p-3 text-center transition-all hover:scale-105 active:scale-95',
                  b.unlocked
                    ? 'border-amber-500/40 bg-sidebar-accent/50 shadow-xs'
                    : 'border-sidebar-accent/30 bg-sidebar-accent/15 opacity-50',
                )}
              >
                <div className="text-3xl my-1">{b.icon}</div>
                <div className="text-xs font-bold text-sidebar-foreground truncate w-full">
                  {b.title}
                </div>
                <span className="mt-1 text-[10px] font-semibold text-sidebar-foreground/60">
                  {b.unlocked ? 'Unlocked ✓' : 'In Progress'}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Evening Reflections & Mindset Archive */}
        <section id="evening-reflections-archive" className="mt-8 rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-8 scroll-mt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Moon className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-sidebar">Evening Reflections Archive</h2>
                <div className="mono-label text-muted-foreground">Personal History of Wins & Mindset</div>
              </div>
            </div>
            <div className="text-xs font-semibold text-muted-foreground">
              {reflections.length} {reflections.length === 1 ? 'reflection' : 'reflections'} recorded
            </div>
          </div>

          {reflections.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
              <Moon className="mx-auto mb-2 size-6 text-muted-foreground/60" />
              <div className="text-sm font-bold text-sidebar">No Evening Reflections Yet</div>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                Close your day intentionally from the Today dashboard using the "Wind Down" button to record your 3 daily wins and gratitude notes.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reflections.map((r) => {
                const energy = ENERGY_LEVELS.find((e) => e.level === r.energyLevel);
                return (
                  <div
                    key={r.date}
                    className="flex flex-col justify-between rounded-2xl border border-border/80 bg-muted/20 p-4 transition-all hover:border-primary/50 hover:bg-muted/30"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <span className="font-bold text-sidebar">{r.date}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          {energy?.icon} {energy?.label}
                        </span>
                      </div>

                      {/* Mood Tags */}
                      {r.moodTags?.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {r.moodTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 3 Wins */}
                      {r.wins?.some(Boolean) && (
                        <div className="mt-3">
                          <span className="mono-label text-muted-foreground text-[10px]">3 Wins</span>
                          <ul className="mt-1 space-y-1 text-xs font-medium text-foreground">
                            {r.wins.filter(Boolean).map((win, i) => (
                              <li key={i} className="flex items-start gap-1.5 line-clamp-2">
                                <span className="text-primary font-bold">✓</span>
                                <span>{win}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Lesson */}
                      {r.lesson && (
                        <div className="mt-3 text-xs">
                          <span className="mono-label text-muted-foreground text-[10px]">Lesson</span>
                          <p className="mt-0.5 italic text-muted-foreground line-clamp-2">
                            "{r.lesson}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Gratitude footer */}
                    {r.gratitude && (
                      <div className="mt-4 border-t border-border/60 pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Heart className="size-3 text-rose-500 shrink-0" />
                        <span className="italic line-clamp-1">"{r.gratitude}"</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

        {/* Streak Shield Explanation Modal */}
        {showShieldExplainer && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 p-4 sm:p-5 backdrop-blur-sm">
              <div
                className="max-h-[85vh] sm:max-h-[88vh] w-full max-w-[460px] overflow-y-auto modal-scroll rounded-[28px] border border-border bg-background p-6 shadow-2xl sm:p-7"
                role="dialog"
                aria-modal="true"
              >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Shield className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-sidebar">Streak Shields</h3>
                    <div className="mono-label text-muted-foreground">Compassionate Consistency</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShieldExplainer(false)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Most habit trackers punish you with anxiety: if you get sick or take a well-deserved rest day, your entire streak drops to zero.
                </p>
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 font-semibold text-sidebar space-y-1.5">
                  <div>🛡️ <strong>Current Inventory:</strong> {shieldVault.availableShields} of {shieldVault.maxShields} Resilience Shields available in your bank.</div>
                  <div className="text-xs text-muted-foreground">You start with 2 starter shields. Every 5 days of score ≥ 70 awards +1 bonus shield.</div>
                </div>
                <p>
                  Deploy a grace shield from the Today dashboard on illness or travel days to freeze your streak guilt-free.
                </p>
              </div>

              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowShieldExplainer(false)}
                  className="focus-ring rounded-full bg-sidebar px-5 py-2.5 text-xs font-extrabold text-sidebar-foreground hover:bg-sidebar/90"
                >
                  Got it
                </button>
              </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* Hall of Fame Modal */}
        {showHallOfFame && (
          <HallOfFameModal
            stats={userStats}
            onClose={() => setShowHallOfFame(false)}
          />
        )}

        {/* Day Activity Details Modal */}
        {selectedDayDate && (
          <DayActivityModal
            dateStr={selectedDayDate}
            onClose={() => setSelectedDayDate(null)}
          />
        )}
    </AppShell>
  );
}
