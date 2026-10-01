import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  Coffee,
  Compass,
  Dumbbell,
  Edit3,
  Minus,
  Pause,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetDashboardQueryKey,
  getGetGoalsQueryKey,
  getGetTodayQueryKey,
  useCreateGoal,
  useDeleteGoal,
  useGetGoals,
  useUpdateGoal,
} from '@workspace/api-client-react';
import type { Category, Frequency, Goal, GoalInput } from '@workspace/api-client-react';
import { AppShell, ProfileChip } from '@/components/app-shell';
import { ModalPortal } from '@/components/modal-portal';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sound } from '@/lib/sound';
import {
  SCHEDULE_PRESETS,
  formatTime12h,
  getGoalSchedule,
  saveGoalSchedule,
  requestNotificationPermission,
  triggerReminderAlert,
} from '@/lib/reminders';

interface CategoryConfig {
  value: Category;
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
  icon: typeof Briefcase;
  description: string;
}

const categories: CategoryConfig[] = [
  {
    value: 'career',
    label: 'Career',
    color: 'bg-[#d8e99a]',
    textColor: 'text-[#364b0f]',
    borderColor: 'border-[#b8d458]',
    icon: Briefcase,
    description: 'Professional runway & deep work',
  },
  {
    value: 'learning',
    label: 'Learning',
    color: 'bg-[#c9e7e8]',
    textColor: 'text-[#164344]',
    borderColor: 'border-[#92cbd0]',
    icon: BookOpen,
    description: 'Books, skills & research',
  },
  {
    value: 'health',
    label: 'Health',
    color: 'bg-[#f6c7aa]',
    textColor: 'text-[#6a2b0e]',
    borderColor: 'border-[#ea9d73]',
    icon: Dumbbell,
    description: 'Body, movement & vitality',
  },
  {
    value: 'mind',
    label: 'Mind',
    color: 'bg-[#ddd0ea]',
    textColor: 'text-[#442c5c]',
    borderColor: 'border-[#ba9ecd]',
    icon: Sparkles,
    description: 'Mindfulness & clear headspace',
  },
  {
    value: 'routine',
    label: 'Routine',
    color: 'bg-[#e9ddad]',
    textColor: 'text-[#50410f]',
    borderColor: 'border-[#ceba6f]',
    icon: Coffee,
    description: 'Foundations & operational rhythms',
  },
  {
    value: 'personal',
    label: 'Personal',
    color: 'bg-[#cdd5e4]',
    textColor: 'text-[#263750]',
    borderColor: 'border-[#9cb0cf]',
    icon: Compass,
    description: 'Relationships, passions & hobbies',
  },
];

interface GoalTemplate {
  name: string;
  category: Category;
  targetValue: number;
  unit: string;
  frequency: Frequency;
  priority: number;
  icon: string;
  hint: string;
}

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    name: 'Deep Work Sprint',
    category: 'career',
    targetValue: 90,
    unit: 'minutes',
    frequency: 'weekdays',
    priority: 1,
    icon: '⚡',
    hint: '90m focused flow',
  },
  {
    name: 'Side Project Build',
    category: 'career',
    targetValue: 60,
    unit: 'minutes',
    frequency: 'weekdays',
    priority: 2,
    icon: '💻',
    hint: '60m building assets',
  },
  {
    name: 'Read Non-Fiction',
    category: 'learning',
    targetValue: 20,
    unit: 'pages',
    frequency: 'daily',
    priority: 2,
    icon: '📖',
    hint: '20 pages a day',
  },
  {
    name: 'Skill / Tech Practice',
    category: 'learning',
    targetValue: 25,
    unit: 'minutes',
    frequency: 'weekdays',
    priority: 3,
    icon: '🧠',
    hint: 'Micro-learning session',
  },
  {
    name: 'Daily Workout',
    category: 'health',
    targetValue: 45,
    unit: 'minutes',
    frequency: 'daily',
    priority: 1,
    icon: '🏋️',
    hint: 'Strength or cardio',
  },
  {
    name: 'Morning Walk / Run',
    category: 'health',
    targetValue: 3,
    unit: 'km',
    frequency: 'daily',
    priority: 2,
    icon: '👟',
    hint: 'Sunshine & steps',
  },
  {
    name: 'Hydration Target',
    category: 'health',
    targetValue: 2.5,
    unit: 'liters',
    frequency: 'daily',
    priority: 2,
    icon: '💧',
    hint: 'Baseline vitality',
  },
  {
    name: 'Mindfulness & Breath',
    category: 'mind',
    targetValue: 10,
    unit: 'minutes',
    frequency: 'daily',
    priority: 2,
    icon: '🧘',
    hint: 'Quiet mental reset',
  },
  {
    name: 'Evening Journaling',
    category: 'mind',
    targetValue: 1,
    unit: 'entry',
    frequency: 'daily',
    priority: 3,
    icon: '✍️',
    hint: 'Decompress before sleep',
  },
  {
    name: 'Inbox Zero & Triage',
    category: 'routine',
    targetValue: 1,
    unit: 'session',
    frequency: 'weekdays',
    priority: 2,
    icon: '📥',
    hint: 'Clear communications',
  },
  {
    name: 'Meaningful Connection',
    category: 'personal',
    targetValue: 30,
    unit: 'minutes',
    frequency: 'daily',
    priority: 2,
    icon: '☕',
    hint: 'Family or close friends',
  },
];

const CATEGORY_SMART_UNITS: Record<
  Category,
  { units: string[]; presets: number[]; defaultStep: number }
> = {
  career: {
    units: ['minutes', 'hours', 'sessions', 'tasks'],
    presets: [30, 45, 60, 90, 120],
    defaultStep: 15,
  },
  learning: {
    units: ['pages', 'minutes', 'chapters', 'cards'],
    presets: [10, 20, 30, 45, 60],
    defaultStep: 5,
  },
  health: {
    units: ['minutes', 'km', 'liters', 'reps', 'steps'],
    presets: [15, 30, 45, 60, 90],
    defaultStep: 15,
  },
  mind: {
    units: ['minutes', 'entries', 'sessions', 'pages'],
    presets: [5, 10, 15, 20, 30],
    defaultStep: 5,
  },
  routine: {
    units: ['sessions', 'tasks', 'checks', 'minutes'],
    presets: [1, 2, 3, 5, 15],
    defaultStep: 1,
  },
  personal: {
    units: ['minutes', 'sessions', 'activities', 'hours'],
    presets: [15, 30, 45, 60, 90],
    defaultStep: 15,
  },
};

type FormState = Omit<GoalInput, 'endDate'> & { endDate: string };

const emptyForm: FormState = {
  name: '',
  category: 'career',
  targetValue: 60,
  unit: 'minutes',
  frequency: 'daily',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  priority: 2,
};

function GoalForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Goal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(
    initial
      ? {
          name: initial.name,
          category: initial.category,
          targetValue: initial.targetValue,
          unit: initial.unit,
          frequency: initial.frequency,
          startDate: initial.startDate,
          endDate: initial.endDate ?? '',
          priority: initial.priority,
        }
      : emptyForm,
  );

  const initialSchedule = initial ? getGoalSchedule(initial.id) : null;
  const [scheduledTime, setScheduledTime] = useState<string>(initialSchedule?.time ?? '');
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(
    initialSchedule ? initialSchedule.enabled : true,
  );

  const set = (key: keyof FormState, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const currentCategory = categories.find((c) => c.value === form.category) ?? categories[0];
  const smartUnits = CATEGORY_SMART_UNITS[form.category] ?? CATEGORY_SMART_UNITS.career;

  const selectTemplate = (t: GoalTemplate) => {
    setForm({
      name: t.name,
      category: t.category,
      targetValue: t.targetValue,
      unit: t.unit,
      frequency: t.frequency,
      startDate: form.startDate,
      endDate: form.endDate,
      priority: t.priority,
    });
  };

  const handleCategorySelect = (cat: Category) => {
    const defaultSmart = CATEGORY_SMART_UNITS[cat];
    setForm((prev) => ({
      ...prev,
      category: cat,
      unit: defaultSmart.units[0],
      targetValue: defaultSmart.presets[1] ?? prev.targetValue,
    }));
  };

  const adjustTarget = (delta: number) => {
    setForm((prev) => {
      const next = Math.max(0.1, Math.round((Number(prev.targetValue) + delta) * 10) / 10);
      return { ...prev, targetValue: next };
    });
  };

  const saving = create.isPending || update.isPending;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast({
        title: 'Goal name required',
        description: 'Please describe what commitment you are making.',
        variant: 'destructive',
      });
      return;
    }

    const numericTarget = Number(form.targetValue);
    if (isNaN(numericTarget) || numericTarget <= 0) {
      toast({
        title: 'Valid target required',
        description: 'Target amount must be a number greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    const data: GoalInput = {
      ...form,
      name: form.name.trim(),
      targetValue: numericTarget,
      priority: Number(form.priority) || 2,
      endDate: form.endDate ? form.endDate : null,
    };

    const done = (goalId?: number) => {
      sound.playComplete();
      if (goalId && scheduledTime.trim()) {
        saveGoalSchedule({
          goalId,
          time: scheduledTime.trim(),
          enabled: reminderEnabled,
        });
      }
      void queryClient.invalidateQueries({ queryKey: getGetGoalsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetTodayQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      toast({
        title: initial ? 'Goal updated' : 'Goal added to runway',
        description: `“${data.name}” is now active in your daily commitments.`,
      });
      onSaved();
    };

    if (initial) {
      update.mutate({ id: initial.id, data }, { onSuccess: () => done(initial.id) });
    } else {
      create.mutate({ data }, { onSuccess: (created) => done(created.id) });
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-sidebar/50 p-0 backdrop-blur-sm sm:items-center sm:p-5">
        <div
          className="max-h-[88vh] sm:max-h-[85vh] w-full max-w-[640px] overflow-y-auto modal-scroll rounded-t-[32px] border border-border bg-background p-6 shadow-2xl sm:rounded-[32px] sm:p-8"
          role="dialog"
          aria-modal="true"
          data-testid="dialog-goal-form"
        >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mono-label text-accent">
              {initial ? 'Refine the signal' : 'Build your runway'}
            </div>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-.05em] text-sidebar">
              {initial ? 'Edit goal' : 'New recurring goal'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted"
            data-testid="button-close-goal-form"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick starter templates */}
        {!initial && (
          <div className="mb-6 rounded-2xl border border-border/70 bg-card/60 p-4">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Zap className="size-3.5 text-primary" />
              <span>Quick starter templates (click to auto-fill):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {GOAL_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => selectTemplate(tmpl)}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/10"
                >
                  <span>{tmpl.icon}</span>
                  <span>{tmpl.name}</span>
                  <span className="text-[10px] text-muted-foreground">({tmpl.targetValue}{tmpl.unit[0]})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          {/* Goal Name */}
          <div>
            <label className="mb-2 block text-xs font-bold tracking-wide text-foreground">
              What are you committing to?
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Deep Work Sprint, Morning Workout, Read Book"
              className="focus-ring w-full rounded-xl border border-input bg-card px-4 py-3.5 text-base font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm"
              data-testid="input-goal-name"
            />
          </div>

          {/* Visual Category Selection */}
          <div>
            <label className="mb-2.5 block text-xs font-bold tracking-wide text-foreground">
              Category Pillar
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = form.category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleCategorySelect(cat.value)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all',
                      isSelected
                        ? cn(cat.color, 'border-primary ring-2 ring-primary/40 font-extrabold shadow-sm')
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/50 text-foreground',
                    )}
                  >
                    <div
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-lg',
                        isSelected ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold">{cat.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target & Units with Smart Steppers */}
          <div className="rounded-2xl border border-border/80 bg-card/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground">Target & Measurable Unit</span>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>Suggested units:</span>
                {smartUnits.units.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set('unit', u)}
                    className={cn(
                      'rounded-md px-2 py-0.5 font-mono text-[10px] font-bold transition-colors',
                      form.unit === u
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-border text-foreground',
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
              {/* Stepper + Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustTarget(-smartUnits.defaultStep)}
                  className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <Minus className="size-4" />
                </button>
                <input
                  required
                  min="0.1"
                  type="number"
                  step="any"
                  value={form.targetValue}
                  onChange={(e) => set('targetValue', Number(e.target.value))}
                  className="focus-ring h-11 w-full rounded-xl border border-input bg-card px-3 text-center text-lg font-mono font-extrabold outline-none focus:border-primary"
                  data-testid="input-goal-target"
                />
                <button
                  type="button"
                  onClick={() => adjustTarget(smartUnits.defaultStep)}
                  className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {/* Unit Input */}
              <div>
                <input
                  required
                  value={form.unit}
                  onChange={(e) => set('unit', e.target.value)}
                  placeholder="e.g. minutes, pages"
                  className="focus-ring h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                  data-testid="input-goal-unit"
                />
              </div>
            </div>

            {/* Quick value chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2">
              <span className="text-[11px] text-muted-foreground">Quick targets:</span>
              {smartUnits.presets.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set('targetValue', val)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                    Number(form.targetValue) === val
                      ? 'bg-sidebar text-sidebar-foreground font-bold'
                      : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {val} {form.unit}
                </button>
              ))}
            </div>
          </div>

          {/* Cadence / Frequency */}
          <div>
            <label className="mb-2 block text-xs font-bold tracking-wide text-foreground">
              Cadence (When does this apply?)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'daily', label: 'Every day', sub: '7 days / week' },
                { value: 'weekdays', label: 'Weekdays', sub: 'Mon – Fri' },
                { value: 'weekly', label: 'Once a week', sub: 'Flexible day' },
              ].map((cad) => (
                <button
                  key={cad.value}
                  type="button"
                  onClick={() => set('frequency', cad.value as Frequency)}
                  className={cn(
                    'rounded-xl border p-3 text-center transition-all',
                    form.frequency === cad.value
                      ? 'border-primary bg-primary/10 text-primary-foreground font-extrabold ring-1 ring-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <div className="text-xs font-bold text-sidebar">{cad.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{cad.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Priority with Daily Weight Explanations */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold tracking-wide text-foreground">
                Priority & Daily Score Impact
              </label>
              <span className="text-[11px] text-muted-foreground">Determines weight in daily score</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  p: 1,
                  title: '1 · Essential',
                  desc: 'Anchor habit. High score weight (x1.5).',
                },
                {
                  p: 2,
                  title: '2 · Important',
                  desc: 'Standard commitment. Steady growth (x1.0).',
                },
                {
                  p: 3,
                  title: '3 · Nice to have',
                  desc: 'Bonus habit. Low penalty if missed (x0.6).',
                },
              ].map((item) => (
                <button
                  key={item.p}
                  type="button"
                  onClick={() => set('priority', item.p)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    Number(form.priority) === item.p
                      ? 'border-primary bg-card ring-2 ring-primary/40 font-bold'
                      : 'border-border bg-card/60 opacity-80 hover:opacity-100',
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-sidebar">
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        item.p === 1 ? 'bg-primary' : item.p === 2 ? 'bg-accent' : 'bg-muted-foreground',
                      )}
                    />
                    {item.title}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Scheduled Target Time & Timed Reminders */}
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid size-6 place-items-center rounded-lg bg-primary/20 text-sidebar">
                  <Clock className="size-3.5 text-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wide text-foreground">
                    Scheduled Time & Reminder
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Set what time of day you intend to do this habit
                  </p>
                </div>
              </div>
              {scheduledTime && (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-extrabold text-primary">
                  {formatTime12h(scheduledTime)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="focus-ring h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none focus:border-primary"
                  data-testid="input-goal-scheduled-time"
                />
              </div>

              {scheduledTime && (
                <button
                  type="button"
                  onClick={() => setScheduledTime('')}
                  className="focus-ring rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Clear time
                </button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-muted-foreground">Presets:</span>
              {SCHEDULE_PRESETS.map((p) => (
                <button
                  key={p.time}
                  type="button"
                  onClick={() => setScheduledTime(p.time)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                    scheduledTime === p.time
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-card border border-border/80 text-muted-foreground hover:border-primary/60 hover:text-foreground',
                  )}
                >
                  <span className="mr-1">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chime & Notification settings if time is set */}
            {scheduledTime && (
              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-accent" />
                  <span className="text-xs font-bold text-sidebar">Audio & Desktop Alerts</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void requestNotificationPermission();
                      void triggerReminderAlert(form.name || 'Your goal', scheduledTime);
                    }}
                    className="focus-ring inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-muted"
                  >
                    <Volume2 className="size-3 text-primary" />
                    Test alert
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderEnabled(!reminderEnabled)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                      reminderEnabled
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted text-muted-foreground border border-transparent',
                    )}
                  >
                    {reminderEnabled ? '🔔 Chime On' : '🔕 Muted'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold text-foreground">Starts</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className="focus-ring w-full rounded-xl border border-input bg-card py-3 pl-10 pr-3 text-sm outline-none focus:border-primary"
                  data-testid="input-goal-start-date"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold text-foreground">
                Ends <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className="focus-ring w-full rounded-xl border border-input bg-card px-3 py-3 text-sm outline-none focus:border-primary"
                data-testid="input-goal-end-date"
              />
            </div>
          </div>

          {/* Live Card Preview */}
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span className="mono-label">Live Runway Preview</span>
              <span className="text-[10px]">How it appears in your schedule</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'grid size-9 place-items-center rounded-lg font-extrabold text-sidebar',
                    currentCategory.color,
                  )}
                >
                  <currentCategory.icon className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sidebar">
                      {form.name || 'Untitled goal'}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-bold',
                        currentCategory.color,
                      )}
                    >
                      {currentCategory.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {form.targetValue} {form.unit} ·{' '}
                    {form.frequency === 'daily'
                      ? 'Every day'
                      : form.frequency === 'weekdays'
                        ? 'Weekdays'
                        : 'Weekly'}{' '}
                    · Priority {form.priority}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full px-5 py-3 text-sm font-bold text-muted-foreground hover:bg-muted"
              data-testid="button-cancel-goal"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              type="submit"
              className="focus-ring rounded-full bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              data-testid="button-save-goal"
            >
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Add goal to runway'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onToggle,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const category = categories.find((item) => item.value === goal.category) ?? categories[0];
  const Icon = category.icon;
  const schedule = getGoalSchedule(goal.id);

  return (
    <div
      className={cn(
        'group rounded-2xl border border-border/80 bg-card p-5 transition-all hover:border-primary/60 hover:shadow-sm',
        !goal.active && 'opacity-65',
      )}
      data-testid={`card-goal-${goal.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              'mt-0.5 grid size-10 place-items-center rounded-xl text-sidebar',
              category.color,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold tracking-[-.02em] text-sidebar">{goal.name}</h3>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  category.color,
                )}
              >
                {category.label}
              </span>
              {!goal.active && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  Paused
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {goal.targetValue} {goal.unit} ·{' '}
              {goal.frequency === 'daily'
                ? 'Every day'
                : goal.frequency === 'weekdays'
                  ? 'Weekdays'
                  : 'Once a week'}{' '}
              ·{' '}
              <span className="font-semibold text-sidebar">
                Priority {goal.priority === 1 ? '1 (Essential)' : goal.priority === 2 ? '2 (Important)' : '3 (Bonus)'}
              </span>
            </p>
            {schedule?.time && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <Clock className="size-3" />
                  {formatTime12h(schedule.time)}
                </span>
                {schedule.enabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <Bell className="size-3 text-accent" />
                    Chime active
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid={`button-edit-goal-${goal.id}`}
            title="Edit goal"
          >
            <Edit3 className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            data-testid={`button-delete-goal-${goal.id}`}
            title="Delete goal"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={cn(
              'size-1.5 rounded-full',
              goal.active ? 'bg-primary' : 'bg-muted-foreground',
            )}
          />
          {goal.active ? 'Active rhythm' : 'Paused'}
          <span className="mx-1 text-border">·</span>
          Started{' '}
          {new Date(goal.startDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted"
          data-testid={`button-toggle-goal-${goal.id}`}
        >
          {goal.active ? <Pause className="size-3" /> : <Check className="size-3" />}
          {goal.active ? 'Pause rhythm' : 'Resume'}
        </button>
      </div>
    </div>
  );
}

export default function Goals() {
  const queryClient = useQueryClient();
  const goalsQuery = useGetGoals();
  const update = useUpdateGoal();
  const remove = useDeleteGoal();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>();
  const [confirming, setConfirming] = useState<Goal | undefined>();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'paused'>('all');

  const rawGoals = goalsQuery.data ?? [];

  // Filter logic
  const filteredGoals = useMemo(() => {
    return rawGoals.filter((goal) => {
      // Category filter
      if (selectedCategory !== 'all' && goal.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'active' && !goal.active) return false;
      if (selectedStatus === 'paused' && goal.active) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = goal.name.toLowerCase().includes(q);
        const matchUnit = goal.unit.toLowerCase().includes(q);
        const matchCategory = goal.category.toLowerCase().includes(q);
        if (!matchName && !matchUnit && !matchCategory) return false;
      }
      return true;
    });
  }, [rawGoals, selectedCategory, selectedStatus, searchQuery]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetGoalsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetTodayQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const toggle = (goal: Goal) => {
    sound.playClick();
    update.mutate(
      { id: goal.id, data: { active: !goal.active } },
      {
        onSuccess: () => {
          toast({
            title: goal.active ? 'Rhythm paused' : 'Rhythm resumed',
            description: `“${goal.name}” ${goal.active ? 'will take a break from Today' : 'is back in your daily runway'}.`,
          });
          refresh();
        },
      },
    );
  };

  const deleteGoal = () => {
    if (!confirming) return;
    sound.playClick();
    remove.mutate(
      { id: confirming.id },
      {
        onSuccess: () => {
          toast({
            title: 'Goal removed',
            description: `“${confirming.name}” has been removed from your goals.`,
          });
          setConfirming(undefined);
          refresh();
        },
      },
    );
  };

  return (
    <AppShell>
      <div className="animate-rise-in">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="mono-label text-muted-foreground">Your direction</div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.07em] text-sidebar sm:text-5xl">
              Goals<span className="text-accent">.</span>
            </h1>
            <p className="mt-2 max-w-[460px] text-sm leading-6 text-muted-foreground">
              Define the recurring commitments and habits that turn your days into steady progress.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ProfileChip />
            <button
              type="button"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
              className="focus-ring inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm transition-transform active:scale-95"
              data-testid="button-add-goal"
            >
              <Plus className="mr-1.5 size-4" /> Add goal
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        {rawGoals.length > 0 && (
          <div className="mb-7 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search Box */}
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search goals by name or unit…"
                  className="focus-ring w-full rounded-full border border-border bg-card py-2 pl-9.5 pr-4 text-xs font-medium outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Status segmented toggle */}
              <div className="flex items-center rounded-full border border-border bg-card p-1 text-xs">
                {(['all', 'active', 'paused'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStatus(st)}
                    className={cn(
                      'rounded-full px-3 py-1 font-bold capitalize transition-colors',
                      selectedStatus === st
                        ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {st === 'all' ? `All (${rawGoals.length})` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'rounded-full px-3 py-1 font-bold transition-colors',
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                All Pillars
              </button>
              {categories.map((cat) => {
                const count = rawGoals.filter((g) => g.category === cat.value).length;
                if (count === 0 && selectedCategory !== cat.value) return null;
                const isSelected = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setSelectedCategory(cat.value)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold transition-colors',
                      isSelected
                        ? cn(cat.color, 'ring-2 ring-primary/40 font-extrabold text-sidebar')
                        : 'border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[10px] opacity-70 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Goals List Content */}
        {goalsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-44 animate-pulse rounded-2xl bg-muted" />
            <div className="h-44 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : goalsQuery.isError ? (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-8 text-center">
            <p className="text-sm font-bold">Your goals are taking a minute.</p>
            <button
              type="button"
              onClick={() => void goalsQuery.refetch()}
              className="mt-4 rounded-full bg-sidebar px-4 py-2 text-xs font-bold text-sidebar-foreground"
              data-testid="button-retry-goals"
            >
              Try again
            </button>
          </div>
        ) : rawGoals.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border bg-card p-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/20 text-sidebar">
              <Sparkles className="size-6 text-primary" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-sidebar">Start with your first commitment</h2>
            <p className="mx-auto mt-2 max-w-[380px] text-sm leading-6 text-muted-foreground">
              Choose one of our smart starter templates or design your own recurring rhythm.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-6 rounded-full bg-primary px-6 py-3 text-xs font-extrabold text-primary-foreground shadow-sm transition-transform active:scale-95"
              data-testid="button-empty-add-goal"
            >
              Create your first goal
            </button>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center">
            <p className="text-sm font-bold text-muted-foreground">No goals match your active filters.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSearchQuery('');
              }}
              className="mt-3 rounded-full bg-muted px-4 py-1.5 text-xs font-bold text-foreground hover:bg-border"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between text-xs font-bold text-muted-foreground">
              <div className="flex items-center gap-2 text-sidebar">
                <span className="size-2 rounded-full bg-primary" />
                <span>
                  {rawGoals.filter((g) => g.active).length} active rhythms (showing {filteredGoals.length})
                </span>
              </div>
              <span className="mono-label">Phase 01</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => {
                    setEditing(goal);
                    setFormOpen(true);
                  }}
                  onDelete={() => setConfirming(goal)}
                  onToggle={() => toggle(goal)}
                />
              ))}
            </div>
          </>
        )}
      </div>

        {/* Modal Form */}
        {formOpen && (
          <GoalForm
            initial={editing}
            onClose={() => setFormOpen(false)}
            onSaved={() => setFormOpen(false)}
          />
        )}

        {/* Confirmation Modal */}
        {confirming && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 p-4 sm:p-5 backdrop-blur-sm">
              <div className="w-full max-w-[400px] rounded-[28px] border border-border bg-background p-7 shadow-2xl">
                <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <Trash2 className="size-5" />
                </div>
                <h2 className="text-xl font-extrabold tracking-[-.04em] text-sidebar">
                  Remove this goal?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  “{confirming.name}” will stop appearing in your daily runway. Past logged history remains safe.
                </p>
                <div className="mt-7 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(undefined)}
                    className="focus-ring rounded-full px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                    data-testid="button-cancel-delete-goal"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={deleteGoal}
                    disabled={remove.isPending}
                    className="focus-ring rounded-full bg-destructive px-5 py-2.5 text-xs font-extrabold text-destructive-foreground disabled:opacity-50"
                    data-testid="button-confirm-delete-goal"
                  >
                    {remove.isPending ? 'Removing…' : 'Remove goal'}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
    </AppShell>
  );
}