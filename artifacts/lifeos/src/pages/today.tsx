import { useMemo } from 'react';
import { Check, Clock3, Flame, MoreHorizontal, Plus, RotateCcw, Sparkles, Target, TrendingUp } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetDashboardQueryKey, getGetTodayQueryKey, useGetDashboard, useGetToday, useUpdateDailyGoalProgress } from '@workspace/api-client-react';
import type { Category, DailyGoal } from '@workspace/api-client-react';
import { AppShell, ProfileChip } from '@/components/app-shell';
import { cn } from '@/lib/utils';

const categoryStyles: Record<Category, { label: string; color: string; dot: string }> = {
  career: { label: 'Career', color: 'bg-[#d8e99a]', dot: 'bg-[#88a52a]' },
  learning: { label: 'Learning', color: 'bg-[#c9e7e8]', dot: 'bg-[#438b8d]' },
  health: { label: 'Health', color: 'bg-[#f6c7aa]', dot: 'bg-[#cf734a]' },
  mind: { label: 'Mind', color: 'bg-[#ddd0ea]', dot: 'bg-[#8967a4]' },
  routine: { label: 'Routine', color: 'bg-[#e9ddad]', dot: 'bg-[#ad8e32]' },
  personal: { label: 'Personal', color: 'bg-[#cdd5e4]', dot: 'bg-[#667b9c]' },
};

function ProgressRing({ value }: { value: number }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  return <div className="relative size-[112px]"><svg viewBox="0 0 112 112" className="size-full -rotate-90"><circle cx="56" cy="56" r={radius} fill="none" stroke="hsl(var(--sidebar-accent))" strokeWidth="8" /><circle className="progress-draw" cx="56" cy="56" r={radius} fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - circumference * Math.min(value, 100) / 100} /></svg><div className="absolute inset-0 grid place-items-center text-center"><span className="text-2xl font-extrabold tracking-[-.06em] text-sidebar-foreground">{Math.round(value)}<small className="text-sm">%</small></span></div></div>;
}

function GoalRow({ goal, onUpdate, pending }: { goal: DailyGoal; onUpdate: (goal: DailyGoal, value: number, status?: 'completed' | 'in_progress' | 'skipped') => void; pending: boolean }) {
  const style = categoryStyles[goal.category];
  const completed = goal.status === 'completed';
  const increment = goal.targetValue > 10 ? Math.max(1, Math.round(goal.targetValue / 5)) : 1;
  return <div className={cn('group rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-primary/60 sm:p-5', completed && 'bg-card/60')} data-testid={`card-daily-goal-${goal.id}`}>
    <div className="flex items-start gap-3">
      <button type="button" disabled={pending} onClick={() => onUpdate(goal, completed ? 0 : goal.targetValue, completed ? 'in_progress' : 'completed')} className={cn('focus-ring mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors', completed ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary')} data-testid={`button-complete-goal-${goal.id}`}>{completed && <Check className="size-3.5" strokeWidth={3} />}</button>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={cn('font-bold text-sidebar', completed && 'text-muted-foreground line-through')}>{goal.name}</h3><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', style.color)}>{style.label}</span></div><p className="mt-1 text-xs text-muted-foreground">{goal.targetValue} {goal.unit} · {goal.status === 'not_started' ? 'Ready when you are' : goal.status === 'in_progress' ? 'In motion' : goal.status === 'skipped' ? 'Skipped for today' : 'Done for today'}</p></div>
      <button type="button" onClick={() => onUpdate(goal, Math.min(goal.targetValue, goal.currentValue + increment), 'in_progress')} className="focus-ring rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100" data-testid={`button-more-goal-${goal.id}`}><MoreHorizontal className="size-4" /></button>
    </div>
    <div className="ml-9 mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-all duration-500', style.dot)} style={{ width: `${Math.min(goal.percent, 100)}%` }} /></div><span className="w-10 text-right font-mono text-[11px] text-muted-foreground">{Math.round(goal.percent)}%</span><button type="button" disabled={pending || completed} onClick={() => onUpdate(goal, Math.min(goal.targetValue, goal.currentValue + increment), 'in_progress')} className="focus-ring grid size-7 place-items-center rounded-lg bg-muted text-foreground transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-increment-goal-${goal.id}`}><Plus className="size-3.5" /></button></div>
  </div>;
}

export default function Today() {
  const queryClient = useQueryClient();
  const dashboardQuery = useGetDashboard();
  const todayQuery = useGetToday();
  const progressMutation = useUpdateDailyGoalProgress();
  const dashboard = dashboardQuery.data;
  const today = todayQuery.data;
  const goals = today?.goals ?? [];
  const grouped = useMemo(() => goals.reduce<Record<string, DailyGoal[]>>((acc, goal) => { (acc[goal.category] ??= []).push(goal); return acc; }, {}), [goals]);
  const updateGoal = (goal: DailyGoal, currentValue: number, status?: 'completed' | 'in_progress' | 'skipped') => {
    progressMutation.mutate({ id: goal.id, data: { currentValue, status } }, {
      onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetTodayQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); },
    });
  };
  const date = dashboard?.date ? new Date(dashboard.date) : new Date();
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isLoading = dashboardQuery.isLoading || todayQuery.isLoading;
  return <AppShell><div className="animate-rise-in">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><div className="mono-label text-muted-foreground" data-testid="text-today-date">{dateLabel}</div><h1 className="mt-3 text-4xl font-extrabold tracking-[-.07em] text-sidebar sm:text-5xl" data-testid="text-today-greeting">{dashboard?.greeting || 'Good morning.'}</h1><p className="mt-2 text-sm text-muted-foreground">Here is the shape of your day.</p></div><ProfileChip /></div>
    {isLoading ? <div className="space-y-4"><div className="h-40 animate-pulse rounded-[24px] bg-muted" /><div className="h-24 animate-pulse rounded-2xl bg-muted" /><div className="h-24 animate-pulse rounded-2xl bg-muted" /></div> : dashboardQuery.isError || todayQuery.isError ? <div className="rounded-[24px] border border-accent/40 bg-accent/10 p-8 text-center"><RotateCcw className="mx-auto mb-3 size-6 text-accent" /><h2 className="font-bold">Today could not load</h2><p className="mt-1 text-sm text-muted-foreground">Give it another try — your goals are safe.</p><button type="button" onClick={() => { void dashboardQuery.refetch(); void todayQuery.refetch(); }} className="mt-5 rounded-full bg-sidebar px-4 py-2 text-xs font-bold text-sidebar-foreground" data-testid="button-retry-today">Try again</button></div> :
    <><section className="relative overflow-hidden rounded-[28px] bg-sidebar p-6 text-sidebar-foreground shadow-sm sm:p-8"><div className="pointer-events-none absolute -right-8 -top-20 size-64 rounded-full border-[28px] border-sidebar-accent/60" /><div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-center"><div><div className="mono-label text-sidebar-foreground/50">Daily signal</div><div className="mt-4 flex items-center gap-5"><ProgressRing value={dashboard?.dailyCompletion ?? today?.dailyCompletion ?? 0} /><div><div className="text-3xl font-extrabold tracking-[-.06em]" data-testid="text-daily-score">{dashboard?.dailyScore ?? today?.dailyScore ?? 0}<span className="ml-1 text-sm font-semibold text-sidebar-foreground/55">score</span></div><p className="mt-1 max-w-[180px] text-xs leading-5 text-sidebar-foreground/55">{dashboard?.completedCount ?? goals.filter(g => g.status === 'completed').length} of {dashboard?.totalCount ?? goals.length} commitments complete</p></div></div></div><div className="grid grid-cols-3 gap-2 sm:gap-6"><div><div className="flex items-center gap-1.5 text-primary"><Flame className="size-4" /><span className="text-xl font-extrabold">{dashboard?.streak ?? 0}</span></div><div className="mt-1 text-[10px] text-sidebar-foreground/50">day streak</div></div><div><div className="flex items-center gap-1.5 text-accent"><Clock3 className="size-4" /><span className="text-xl font-extrabold">{dashboard?.focusMinutes ?? 0}</span></div><div className="mt-1 text-[10px] text-sidebar-foreground/50">focus min</div></div><div><div className="flex items-center gap-1.5 text-[#8dd7d8]"><TrendingUp className="size-4" /><span className="text-xl font-extrabold">{Math.round(dashboard?.dailyCompletion ?? 0)}%</span></div><div className="mt-1 text-[10px] text-sidebar-foreground/50">in motion</div></div></div></div></section>
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_310px]"><section><div className="mb-4 flex items-end justify-between"><div><div className="mono-label text-muted-foreground">The runway</div><h2 className="mt-2 text-xl font-extrabold tracking-[-.04em] text-sidebar">What matters today</h2></div><span className="text-xs text-muted-foreground">{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</span></div>{goals.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Target className="mx-auto mb-3 size-7 text-primary" /><h3 className="font-bold">A blank runway</h3><p className="mt-1 text-sm text-muted-foreground">Add a recurring goal to give today a little shape.</p></div> : <div className="space-y-3">{Object.entries(grouped).map(([category, categoryGoals]) => <div key={category} className="space-y-3"><div className="flex items-center gap-2 pt-3"><span className={cn('size-2 rounded-full', categoryStyles[category as Category].dot)} /><span className="mono-label text-muted-foreground">{categoryStyles[category as Category].label}</span></div>{categoryGoals.map(goal => <GoalRow key={goal.id} goal={goal} onUpdate={updateGoal} pending={progressMutation.isPending} />)}</div>)}</div>}</section><aside className="space-y-4"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="mono-label text-muted-foreground">Today in balance</span><Target className="size-4 text-accent" /></div><div className="mt-6 space-y-4">{(today?.categoryContributions ?? dashboard?.categoryContributions ?? []).slice(0, 5).map(item => <div key={item.category}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold capitalize">{item.category}</span><span className="font-mono text-muted-foreground">{Math.round(item.completion)}%</span></div><div className="h-1.5 rounded-full bg-muted"><div className={cn('h-full rounded-full', categoryStyles[item.category].dot)} style={{ width: `${Math.min(item.completion, 100)}%` }} /></div></div>)}</div></div><div className="rounded-2xl bg-primary p-5 text-primary-foreground"><div className="flex items-center justify-between"><span className="mono-label opacity-60">A note for you</span><Sparkles className="size-4" /></div><p className="mt-4 text-sm font-bold leading-6">{dashboard?.highlights?.[0] || 'Consistency is not a mood. It is a practice you can return to.'}</p></div></aside></div></>}</div></AppShell>;
}