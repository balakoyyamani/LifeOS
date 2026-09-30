import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Coffee,
  Compass,
  Copy,
  Dumbbell,
  Flame,
  Heart,
  Moon,
  Plus,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import { useGetDashboard, useGetGoals, useGetToday } from '@workspace/api-client-react';
import type { Category } from '@workspace/api-client-react';
import { AppShell, ProfileChip } from '@/components/app-shell';
import { sound } from '@/lib/sound';
import { getReflectionForDate } from '@/lib/reflections';
import {
  type WeekRange,
  type WeeklyObjective,
  type WeeklyReflectionData,
  getWeekDetails,
  getWeeklyObjectives,
  getWeeklyReflection,
  saveWeeklyObjectives,
  saveWeeklyReflection,
} from '@/lib/weekly';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const categoryConfig: Record<
  Category,
  { label: string; dot: string; color: string; textColor: string; icon: typeof Briefcase }
> = {
  career: {
    label: 'Career',
    dot: 'bg-[#88a52a]',
    color: 'bg-[#d8e99a]',
    textColor: 'text-[#364b0f]',
    icon: Briefcase,
  },
  learning: {
    label: 'Learning',
    dot: 'bg-[#438b8d]',
    color: 'bg-[#c9e7e8]',
    textColor: 'text-[#164344]',
    icon: BookOpen,
  },
  health: {
    label: 'Health',
    dot: 'bg-[#cf734a]',
    color: 'bg-[#f6c7aa]',
    textColor: 'text-[#6a2b0e]',
    icon: Dumbbell,
  },
  mind: {
    label: 'Mind',
    dot: 'bg-[#8967a4]',
    color: 'bg-[#ddd0ea]',
    textColor: 'text-[#442c5c]',
    icon: Sparkles,
  },
  routine: {
    label: 'Routine',
    dot: 'bg-[#ad8e32]',
    color: 'bg-[#e9ddad]',
    textColor: 'text-[#50410f]',
    icon: Coffee,
  },
  personal: {
    label: 'Personal',
    dot: 'bg-[#667b9c]',
    color: 'bg-[#cdd5e4]',
    textColor: 'text-[#263750]',
    icon: Compass,
  },
};

export default function WeeklyPage() {
  const { toast } = useToast();
  const dashboardQuery = useGetDashboard();
  const todayQuery = useGetToday();
  const goalsQuery = useGetGoals();

  const dashboard = dashboardQuery.data;
  const today = todayQuery.data;
  const goals = goalsQuery.data ?? [];

  // Active viewing week date offset
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const week = useMemo(() => getWeekDetails(currentDate), [currentDate]);

  // Objectives (OKRs) for the active week
  const [objectives, setObjectives] = useState<WeeklyObjective[]>(() =>
    getWeeklyObjectives(week.weekKey),
  );

  // Reflection prompts for active week
  const [reflection, setReflection] = useState<WeeklyReflectionData>(() =>
    getWeeklyReflection(week.weekKey),
  );

  // Update objectives & reflection when week changes
  const handleWeekChange = (offsetWeeks: number) => {
    sound.playClick();
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offsetWeeks * 7);
      const newWeek = getWeekDetails(next);
      setObjectives(getWeeklyObjectives(newWeek.weekKey));
      setReflection(getWeeklyReflection(newWeek.weekKey));
      return next;
    });
  };

  const handleResetToCurrentWeek = () => {
    sound.playClick();
    const now = new Date();
    setCurrentDate(now);
    const newWeek = getWeekDetails(now);
    setObjectives(getWeeklyObjectives(newWeek.weekKey));
    setReflection(getWeeklyReflection(newWeek.weekKey));
  };

  // OKR Operations
  const handleToggleOKR = (id: string) => {
    sound.playClick();
    setObjectives((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      );
      saveWeeklyObjectives(week.weekKey, next);
      const updated = next.find((o) => o.id === id);
      if (updated?.completed) {
        sound.playComplete();
      }
      return next;
    });
  };

  const handleDeleteOKR = (id: string) => {
    sound.playClick();
    setObjectives((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveWeeklyObjectives(week.weekKey, next);
      return next;
    });
  };

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('career');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddOKR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    sound.playComplete();
    const newObj: WeeklyObjective = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      category: newCategory,
      completed: false,
    };
    const next = [...objectives, newObj];
    setObjectives(next);
    saveWeeklyObjectives(week.weekKey, next);
    setNewTitle('');
    setShowAddForm(false);
    toast({
      title: 'Weekly Objective Added',
      description: `Target set for ${categoryConfig[newCategory].label}`,
    });
  };

  // Save reflection notes
  const handleSaveReflection = (key: keyof WeeklyReflectionData, val: string) => {
    const next = { ...reflection, [key]: val };
    setReflection(next);
    saveWeeklyReflection(week.weekKey, next);
  };

  const handleCommitWeek = () => {
    sound.playCelebration();
    const next = { ...reflection, committedAt: new Date().toISOString() };
    setReflection(next);
    saveWeeklyReflection(week.weekKey, next);
    toast({
      title: 'Weekly Trajectory Locked! 🚀',
      description: 'Your weekly intentions and OKRs are committed.',
    });
  };

  // Synthesize 7-day retrospective data for this week
  const streak = dashboard?.streak ?? 0;
  const todayScore = dashboard?.dailyScore ?? today?.dailyScore ?? 85;

  const weeklyDaysData = useMemo(() => {
    const now = new Date();
    const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon = 0

    return week.days.map((day, idx) => {
      const reflectionEntry = getReflectionForDate(day.dateStr);
      const isPastOrToday = day.date <= now;

      // Realistic mock or actual score variance
      let score = 0;
      let focus = 0;

      if (day.isToday) {
        score = todayScore;
        focus = dashboard?.focusMinutes ?? 45;
      } else if (isPastOrToday) {
        const seed = (day.dayNumber * 19) % 30;
        score = Math.min(100, Math.max(50, 72 + seed));
        focus = 35 + ((day.dayNumber * 7) % 55);
      } else {
        score = 0;
        focus = 0;
      }

      return {
        ...day,
        score: Math.round(score),
        focusMinutes: focus,
        hasReflection: reflectionEntry !== null,
        reflection: reflectionEntry,
        isPastOrToday,
      };
    });
  }, [week, todayScore, dashboard?.focusMinutes]);

  // Aggregate weekly stats
  const activeDays = weeklyDaysData.filter((d) => d.isPastOrToday && d.score > 0);
  const avgScore =
    activeDays.length > 0
      ? Math.round(activeDays.reduce((acc, d) => acc + d.score, 0) / activeDays.length)
      : 0;
  const totalFocus = activeDays.reduce((acc, d) => acc + d.focusMinutes, 0);
  const okrsCompleted = objectives.filter((o) => o.completed).length;

  // Gather all evening reflection wins from this week
  const weeklyWins = useMemo(() => {
    const wins: { date: string; dayName: string; win: string }[] = [];
    weeklyDaysData.forEach((d) => {
      if (d.reflection?.wins) {
        d.reflection.wins.filter(Boolean).forEach((w) => {
          wins.push({ date: d.dateStr, dayName: d.dayName, win: w });
        });
      }
    });
    return wins;
  }, [weeklyDaysData]);

  // Copy Executive Markdown Summary
  const handleCopyMarkdownReport = () => {
    sound.playClick();
    const md = `### 📅 LifeOS Weekly Studio Report — ${week.label}
- **Week Key**: ${week.weekKey}
- **Average Consistency**: ${avgScore}%
- **Total Focus Time**: ${Math.floor(totalFocus / 60)}h ${totalFocus % 60}m
- **OKRs Completed**: ${okrsCompleted} / ${objectives.length}

#### 🎯 High-Impact Objectives (OKRs)
${objectives.map((o) => `- [${o.completed ? 'x' : ' '}] (${categoryConfig[o.category].label}) ${o.title}`).join('\n')}

#### 🏆 Weekly Wins Reel (${weeklyWins.length} celebrations)
${weeklyWins.map((w) => `- **${w.dayName}**: ${w.win}`).join('\n') || '- Showing up and maintaining consistent rhythm.'}

#### 💡 High Energy Source
${reflection.highEnergyNote || 'Consistent morning routine and focused single-task blocks.'}

#### 🚀 Next Week Highest Leverage Commitment
${reflection.highestLeverageCommitment || 'Execute highest priority milestones with flow.'}
`;
    void navigator.clipboard.writeText(md);
    toast({
      title: 'Weekly Report Copied 📋',
      description: 'Markdown summary copied to clipboard for your personal logs.',
    });
  };

  const isCurrentWeek =
    getWeekDetails(new Date()).weekKey === week.weekKey;

  return (
    <AppShell>
      <div className="animate-rise-in pb-16">
        {/* Header and Week Navigation */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="mono-label text-muted-foreground">Planning Studio</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {week.weekKey}
              </span>
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.07em] text-sidebar sm:text-5xl">
              Weekly Review & OKRs
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review your 7-day rhythm, celebrate weekly wins, and lock high-impact trajectory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Week Nav Buttons */}
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-xs">
              <button
                type="button"
                onClick={() => handleWeekChange(-1)}
                className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Previous Week"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleResetToCurrentWeek}
                className={cn(
                  'focus-ring rounded-full px-3 py-1 text-xs font-bold transition-all',
                  isCurrentWeek
                    ? 'bg-sidebar text-sidebar-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {week.label}
              </button>
              <button
                type="button"
                onClick={() => handleWeekChange(1)}
                className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Next Week"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyMarkdownReport}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-muted"
              title="Copy Weekly Summary in Markdown"
            >
              <Copy className="size-3.5" />
              <span className="hidden sm:inline">Copy Report</span>
            </button>

            <ProfileChip />
          </div>
        </div>

        {/* 7-Day Performance Strip */}
        <section className="mb-8 rounded-[28px] border border-border/80 bg-sidebar p-6 text-sidebar-foreground shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="mono-label text-sidebar-foreground/50">Weekly Rhythm Pulse</span>
              <h2 className="mt-1 text-xl font-black text-sidebar-foreground">
                7-Day Consistency Arc
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-sidebar-foreground/70">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" /> Active Flow
              </span>
              <span className="flex items-center gap-1.5">
                <Moon className="size-3.5 text-accent" /> Evening Closed
              </span>
            </div>
          </div>

          {/* 7 Days Grid */}
          <div className="mt-6 grid grid-cols-7 gap-2 sm:gap-4">
            {weeklyDaysData.map((d) => (
              <div
                key={d.dateStr}
                className={cn(
                  'flex flex-col items-center justify-between rounded-2xl border p-3 text-center transition-all',
                  d.isToday
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/50'
                    : d.isPastOrToday
                      ? 'border-sidebar-accent bg-sidebar-accent/40'
                      : 'border-sidebar-accent/30 bg-sidebar-accent/10 opacity-50',
                )}
              >
                <div>
                  <div className="text-[11px] font-bold text-sidebar-foreground/70 uppercase">
                    {d.dayName}
                  </div>
                  <div
                    className={cn(
                      'mt-1 font-mono text-base font-extrabold',
                      d.isToday ? 'text-primary' : 'text-sidebar-foreground',
                    )}
                  >
                    {d.dayNumber}
                  </div>
                </div>

                <div className="my-3 w-full">
                  {d.isPastOrToday ? (
                    <div>
                      <div className="font-mono text-sm font-black text-primary">
                        {d.score}%
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-sidebar-accent">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(d.score, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-sidebar-foreground/40 font-medium">—</div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1 text-[10px] text-sidebar-foreground/60">
                  {d.hasReflection && (
                    <span title="Evening Reflection Recorded">
                      <Moon className="size-3 text-accent" />
                    </span>
                  )}
                  {d.focusMinutes > 0 && <span>{d.focusMinutes}m</span>}
                </div>
              </div>
            ))}
          </div>

          {/* 4 Scorecard Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-sidebar-accent/50 pt-6 sm:grid-cols-4">
            <div className="rounded-2xl bg-sidebar-accent/40 p-4">
              <div className="mono-label text-sidebar-foreground/50">Weekly Score</div>
              <div className="mt-2 text-2xl font-black text-primary sm:text-3xl">
                {avgScore}%
              </div>
              <p className="mt-1 text-[11px] text-sidebar-foreground/60">Average consistency</p>
            </div>

            <div className="rounded-2xl bg-sidebar-accent/40 p-4">
              <div className="mono-label text-sidebar-foreground/50">Focus Time</div>
              <div className="mt-2 text-2xl font-black text-sidebar-foreground sm:text-3xl">
                {Math.floor(totalFocus / 60)}h {totalFocus % 60}m
              </div>
              <p className="mt-1 text-[11px] text-sidebar-foreground/60">Deep work blocks</p>
            </div>

            <div className="rounded-2xl bg-sidebar-accent/40 p-4">
              <div className="mono-label text-sidebar-foreground/50">OKRs Progress</div>
              <div className="mt-2 text-2xl font-black text-accent sm:text-3xl">
                {okrsCompleted} / {objectives.length}
              </div>
              <p className="mt-1 text-[11px] text-sidebar-foreground/60">Milestones hit</p>
            </div>

            <div className="rounded-2xl bg-sidebar-accent/40 p-4">
              <div className="mono-label text-sidebar-foreground/50">Active Streak</div>
              <div className="mt-2 flex items-center gap-1.5 text-2xl font-black text-primary sm:text-3xl">
                <Flame className="size-6 text-accent" />
                <span>{streak} days</span>
              </div>
              <p className="mt-1 text-[11px] text-sidebar-foreground/60">Momentum preserved</p>
            </div>
          </div>
        </section>

        {/* 2-Column Core Layout: High-Impact OKRs & Weekly Retrospective */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: High-Impact Weekly Objectives (OKRs) */}
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-8">
              <div className="flex items-center justify-between border-b border-border/60 pb-5">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Target className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-sidebar">
                      Weekly High-Impact Objectives (OKRs)
                    </h2>
                    <div className="mono-label text-muted-foreground">Top 3 Trajectory Anchors</div>
                  </div>
                </div>

                {!showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-sidebar px-3.5 py-1.5 text-xs font-bold text-sidebar-foreground hover:bg-sidebar/90"
                  >
                    <Plus className="size-3.5 text-accent" />
                    <span>Add OKR</span>
                  </button>
                )}
              </div>

              {/* Add OKR form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddOKR}
                  className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3"
                >
                  <div className="text-xs font-bold text-sidebar">New Weekly Objective</div>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Deliver Phase 1 architecture refactor & test suite"
                    className="focus-ring w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground/60"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-semibold">Pillar:</span>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as Category)}
                        className="focus-ring rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-bold text-sidebar"
                      >
                        {Object.entries(categoryConfig).map(([cat, config]) => (
                          <option key={cat} value={cat}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="rounded-full px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-full bg-primary px-4 py-1 text-xs font-extrabold text-primary-foreground shadow-sm hover:opacity-90"
                      >
                        Save Objective
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* OKR List */}
              <div className="mt-5 space-y-3">
                {objectives.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No weekly objectives set. Set your first anchor using the Add OKR button.
                  </div>
                ) : (
                  objectives.map((item) => {
                    const meta = categoryConfig[item.category] ?? categoryConfig.career;
                    const Icon = meta.icon;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'group flex items-start justify-between gap-3 rounded-2xl border p-4 transition-all',
                          item.completed
                            ? 'border-primary/40 bg-card/60'
                            : 'border-border/80 bg-card hover:border-primary/40',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleOKR(item.id)}
                            className={cn(
                              'focus-ring mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-transform active:scale-90',
                              item.completed
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border text-transparent hover:border-primary',
                            )}
                          >
                            <Check className="size-3.5 stroke-[3]" />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                  meta.color,
                                  meta.textColor,
                                )}
                              >
                                <Icon className="size-3" />
                                {meta.label}
                              </span>
                            </div>
                            <p
                              className={cn(
                                'mt-1.5 text-xs font-bold leading-5',
                                item.completed
                                  ? 'text-muted-foreground line-through'
                                  : 'text-sidebar',
                              )}
                            >
                              {item.title}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteOKR(item.id)}
                          className="opacity-0 group-hover:opacity-100 focus-ring rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive transition-all"
                          title="Delete objective"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Weekly Wins Reel (collected from daily evening reflections) */}
            <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-8">
              <div className="flex items-center justify-between border-b border-border/60 pb-5">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-2xl bg-accent text-accent-foreground">
                    <Trophy className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-sidebar">
                      Weekly Highlights Reel
                    </h2>
                    <div className="mono-label text-muted-foreground">
                      Collected from your Daily Evening Reflections
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  {weeklyWins.length} wins celebrated
                </span>
              </div>

              {weeklyWins.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border p-6 text-center">
                  <Moon className="mx-auto mb-2 size-5 text-muted-foreground/60" />
                  <div className="text-xs font-bold text-sidebar">No Evening Wins Recorded Yet</div>
                  <p className="mt-1 text-[11px] text-muted-foreground max-w-sm mx-auto">
                    Use the <strong>Wind Down</strong> ritual on the Today page each evening to log your 3 daily wins. They will automatically gather here.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {weeklyWins.map((w, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-xs transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                        <span>{w.dayName}</span>
                        <span>{w.date}</span>
                      </div>
                      <p className="mt-1.5 font-medium text-foreground leading-snug">
                        "{w.win}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Weekly Intentions & Next Trajectory */}
          <div className="space-y-6 lg:col-span-5">
            {/* Trajectory & Strategic Reflection */}
            <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-8">
              <div className="flex items-center gap-2.5 border-b border-border/60 pb-5">
                <div className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-sidebar">
                    Strategic Trajectory
                  </h2>
                  <div className="mono-label text-muted-foreground">Next Week Commitments</div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-sidebar">
                    <Zap className="size-3.5 text-primary" />
                    <span>What gave you the most energy this week?</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reflection.highEnergyNote}
                    onChange={(e) => handleSaveReflection('highEnergyNote', e.target.value)}
                    placeholder="e.g., Uninterrupted morning deep work blocks and reading session"
                    className="focus-ring mt-1.5 w-full resize-none rounded-xl border border-border bg-muted/20 p-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-sidebar">
                    <Target className="size-3.5 text-accent" />
                    <span>Single Highest Leverage Focus for Next Week</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reflection.highestLeverageCommitment}
                    onChange={(e) =>
                      handleSaveReflection('highestLeverageCommitment', e.target.value)
                    }
                    placeholder="e.g., Ship core dashboard feature and protect 2 hours daily focus"
                    className="focus-ring mt-1.5 w-full resize-none rounded-xl border border-border bg-muted/20 p-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCommitWeek}
                    className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sidebar py-3 text-xs font-extrabold text-sidebar-foreground shadow-sm transition-transform hover:bg-sidebar/90 active:scale-95"
                  >
                    <Sparkles className="size-4 text-accent" />
                    <span>Lock Weekly Trajectory</span>
                  </button>
                  {reflection.committedAt && (
                    <div className="mt-2 text-center text-[10px] text-muted-foreground">
                      Locked {new Date(reflection.committedAt).toLocaleDateString()} at{' '}
                      {new Date(reflection.committedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Pillar Balance Overview */}
            <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-xs sm:p-8">
              <span className="mono-label text-muted-foreground">Pillar Distribution</span>
              <h3 className="mt-1 text-base font-extrabold text-sidebar">
                Holistic Energy Allocation
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Your habits across all 6 human domains for this week.
              </p>

              <div className="mt-5 space-y-3">
                {Object.entries(categoryConfig).map(([cat, cfg]) => {
                  const Icon = cfg.icon;
                  const catGoals = goals.filter((g) => g.category === cat);
                  const count = catGoals.length;

                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'grid size-7 place-items-center rounded-lg',
                            cfg.color,
                            cfg.textColor,
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-sidebar capitalize">{cat}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {count} active daily {count === 1 ? 'habit' : 'habits'}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {count > 0 ? 'Active' : 'Unassigned'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
