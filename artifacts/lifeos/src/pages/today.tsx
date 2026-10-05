import { useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  HelpCircle,
  LayoutGrid,
  Map,
  Maximize2,
  Minus,
  Moon,
  MoreHorizontal,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetDashboardQueryKey,
  getGetTodayQueryKey,
  useGetDashboard,
  useGetToday,
  useUpdateDailyGoalProgress,
} from '@workspace/api-client-react';
import type { Category, DailyGoal, GoalStatus } from '@workspace/api-client-react';
import { AppShell, ProfileChip } from '@/components/app-shell';
import { DailyBriefingCard } from '@/components/daily-briefing-card';
import { DailyRoadmapView } from '@/components/daily-roadmap-view';
import { EveningReflectionModal } from '@/components/evening-reflection-modal';
import { HallOfFameModal } from '@/components/hall-of-fame-modal';
import { RapidReviewModal } from '@/components/rapid-review-modal';
import { ResilienceShieldModal } from '@/components/resilience-shield-modal';
import { RoutineFlowRunner } from '@/components/routine-flow-runner';
import { ZenFocusRoom } from '@/components/zen-focus-room';
import { ModalPortal } from '@/components/modal-portal';
import { ActivitySchedulePopover } from '@/components/activity-schedule-popover';
import { useNotifications } from '@/context/notification-context';


import { type UserStatsSnapshot, evaluateBadges } from '@/lib/badges';
import {
  type DailyReflection,
  ENERGY_LEVELS,
  getAllReflections,
  getReflectionForDate,
  getTodayDateKey,
  saveReflection,
} from '@/lib/reflections';
import {
  ROUTINE_CONFIGS,
  type RoutineType,
  getGoalRoutine,
  groupGoalsByRoutine,
  setGoalRoutine,
} from '@/lib/routines';
import {
  getShieldVaultState,
  isDateShielded,
  checkAndAwardShield,
  getStreakTier,
} from '@/lib/shields';
import {
  SCHEDULE_PRESETS,
  formatTime12h,
  getGoalSchedule,
  getGoalSchedules,
  getNotificationPermission,
  getTodayDateString,
  isNotificationSupported,
  isScheduleDueNow,
  markScheduleHandledToday,
  requestNotificationPermission,
  saveGoalSchedule,
  sortGoalsByScheduleTime,
  triggerReminderAlert,
} from '@/lib/reminders';
import { getWeekDetails, getWeeklyObjectives } from '@/lib/weekly';
import { Slider } from '@/components/ui/slider';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const categoryStyles: Record<
  Category,
  { label: string; color: string; dot: string; textColor: string }
> = {
  career: {
    label: 'Career',
    color: 'bg-[#d8e99a]',
    dot: 'bg-[#88a52a]',
    textColor: 'text-[#364b0f]',
  },
  learning: {
    label: 'Learning',
    color: 'bg-[#c9e7e8]',
    dot: 'bg-[#438b8d]',
    textColor: 'text-[#164344]',
  },
  health: {
    label: 'Health',
    color: 'bg-[#f6c7aa]',
    dot: 'bg-[#cf734a]',
    textColor: 'text-[#6a2b0e]',
  },
  mind: {
    label: 'Mind',
    color: 'bg-[#ddd0ea]',
    dot: 'bg-[#8967a4]',
    textColor: 'text-[#442c5c]',
  },
  routine: {
    label: 'Routine',
    color: 'bg-[#e9ddad]',
    dot: 'bg-[#ad8e32]',
    textColor: 'text-[#50410f]',
  },
  personal: {
    label: 'Personal',
    color: 'bg-[#cdd5e4]',
    dot: 'bg-[#667b9c]',
    textColor: 'text-[#263750]',
  },
};

function ProgressRing({ value }: { value: number }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className="relative size-[112px] cursor-pointer transition-transform hover:scale-105 active:scale-95">
      <svg viewBox="0 0 112 112" className="size-full -rotate-90">
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="hsl(var(--sidebar-accent))"
          strokeWidth="8"
        />
        <circle
          className="progress-draw"
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * clamped) / 100}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span className="text-2xl font-extrabold tracking-[-.06em] text-sidebar-foreground">
          {Math.round(clamped)}
          <small className="text-sm font-semibold">%</small>
        </span>
      </div>
    </div>
  );
}

// Interactive modal for precise progress entry, sliders, quick delta chips, and timer
function ProgressAdjustModal({
  goal,
  onClose,
  onSave,
  onOpenZen,
  pending,
}: {
  goal: DailyGoal;
  onClose: () => void;
  onSave: (goal: DailyGoal, value: number, status?: GoalStatus) => void;
  onOpenZen?: (goal: DailyGoal) => void;
  pending: boolean;
}) {
  const style = categoryStyles[goal.category] ?? categoryStyles.career;
  const [val, setVal] = useState<number>(goal.currentValue);
  const [activeTab, setActiveTab] = useState<'adjust' | 'timer' | 'schedule' | 'notes'>('adjust');

  // Schedule and Reminder state
  const existingSchedule = getGoalSchedule(goal.id);
  const [schedTime, setSchedTime] = useState<string>(existingSchedule?.time || '08:00');
  const [schedEnabled, setSchedEnabled] = useState<boolean>(existingSchedule?.enabled ?? false);
  const [schedFollowUpInterval, setSchedFollowUpInterval] = useState<number>(existingSchedule?.followUpIntervalMinutes ?? 20);
  const [notifPerm, setNotifPerm] = useState(getNotificationPermission());
  const { toast } = useToast();
  const { updateGoalSchedule } = useNotifications();

  // Notes state
  interface GoalNoteItem {
    id: number;
    title: string;
    description: string;
    activityDate: string;
    createdAt: string;
  }
  const [notesList, setNotesList] = useState<GoalNoteItem[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const fetchNotes = async () => {
    try {
      setLoadingNotes(true);
      const res = await fetch(`/api/goals/${goal.id}/notes`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotesList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load goal notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'notes') {
      void fetchNotes();
    }
  }, [activeTab, goal.id]);

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    try {
      setSavingNote(true);
      sound.playClick();
      const res = await fetch(`/api/goals/${goal.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newNoteText.trim() }),
      });
      if (res.ok) {
        setNewNoteText('');
        markScheduleHandledToday(goal.id);
        toast({
          title: 'Note Recorded 📝',
          description: `Progress note saved for "${goal.name}".`,
        });
        await fetchNotes();
      } else {
        toast({
          title: 'Failed to Save Note',
          description: 'Could not record note. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveSchedule = () => {
    sound.playClick();
    updateGoalSchedule({
      goalId: goal.id,
      name: goal.name,
      time: schedTime,
      enabled: schedEnabled,
      followUpIntervalMinutes: schedFollowUpInterval,
    });

    toast({
      title: schedEnabled ? 'Reminder Scheduled ⏰' : 'Reminder Disabled',
      description: schedEnabled
        ? `LifeOS will alert you at ${formatTime12h(schedTime)} (follow-up every ${schedFollowUpInterval}m until handled) for "${goal.name}".`
        : `Schedule cleared for "${goal.name}".`,
    });
    onClose();
  };

  const handleTestNotification = async () => {
    if (notifPerm !== 'granted' && isNotificationSupported()) {
      const ok = await requestNotificationPermission();
      setNotifPerm(getNotificationPermission());
      if (!ok) {
        toast({
          title: 'Desktop Alerts Blocked',
          description: 'Browser blocked desktop alerts. In-app sound and toasts will still play.',
        });
      }
    }
    triggerReminderAlert(goal.name, formatTime12h(schedTime));
    toast({
      title: `⏰ Test Alert: ${goal.name}`,
      description: `Scheduled for ${formatTime12h(schedTime)}. Chime and notification triggered!`,
    });
  };

  // Focus timer states (for minute-based goals)
  const isTimeGoal =
    goal.unit.toLowerCase().includes('min') ||
    goal.unit.toLowerCase().includes('hr') ||
    goal.unit.toLowerCase().includes('hour');
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
        setElapsedMinutes((prev) => prev + 1 / 60);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerSeconds]);

  const setTimerPreset = (minutes: number) => {
    setTimerRunning(false);
    setTimerSeconds(minutes * 60);
    setElapsedMinutes(0);
  };

  const percent = Math.min(Math.round((val / goal.targetValue) * 100), 100);
  const step =
    goal.targetValue > 30 ? 5 : goal.targetValue > 10 ? 1 : goal.targetValue > 2 ? 0.5 : 0.1;

  const handleStep = (delta: number) => {
    setVal((prev) => {
      const next = Math.max(0, Math.round((prev + delta) * 10) / 10);
      return next;
    });
  };

  const handleSaveCurrent = (statusOverride?: GoalStatus) => {
    const finalStatus =
      statusOverride ??
      (val >= goal.targetValue
        ? 'completed'
        : val > 0
          ? 'in_progress'
          : 'not_started');
    if (val > 0 || finalStatus === 'completed') {
      markScheduleHandledToday(goal.id);
    }
    onSave(goal, val, finalStatus);
    onClose();
  };

  const handleCompleteNow = () => {
    markScheduleHandledToday(goal.id);
    onSave(goal, goal.targetValue, 'completed');
    onClose();
  };

  const handleSkipNow = () => {
    markScheduleHandledToday(goal.id);
    onSave(goal, 0, 'skipped');
    onClose();
  };

  const handleResetNow = () => {
    onSave(goal, 0, 'not_started');
    onClose();
  };

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-sidebar/50 p-0 backdrop-blur-sm sm:items-center sm:p-5">
        <div
          className="max-h-[88vh] sm:max-h-[85vh] w-full max-w-[520px] overflow-y-auto modal-scroll rounded-t-[32px] border border-border bg-background p-6 shadow-2xl sm:rounded-[32px] sm:p-7"
          role="dialog"
          aria-modal="true"
          data-testid="dialog-progress-adjust"
        >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'mt-0.5 grid size-10 place-items-center rounded-xl font-extrabold text-sidebar',
                style.color,
              )}
            >
              <Target className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    style.color,
                  )}
                >
                  {style.label}
                </span>
                {goal.status === 'skipped' && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    Skipped
                  </span>
                )}
                {goal.status === 'completed' && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    Complete
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-.03em] text-sidebar">
                {goal.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="mb-5 flex rounded-full border border-border bg-card p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('adjust')}
            className={cn(
              'flex-1 rounded-full py-1.5 font-bold transition-colors',
              activeTab === 'adjust'
                ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Log Progress
          </button>
          {isTimeGoal && (
            <button
              type="button"
              onClick={() => setActiveTab('timer')}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-bold transition-colors',
                activeTab === 'timer'
                  ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Timer className="size-3.5" />
              Focus Timer
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-bold transition-colors',
              activeTab === 'schedule'
                ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Clock3 className="size-3.5" />
            Schedule ⏰
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-bold transition-colors',
              activeTab === 'notes'
                ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <PenLine className="size-3.5" />
            Notes & Log 📝
          </button>
        </div>

        {activeTab === 'adjust' ? (
          <div className="space-y-6">
            {/* Big current vs target display */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 text-center">
              <div className="mono-label text-muted-foreground">Today's Progress</div>
              <div className="mt-2 flex items-baseline justify-center gap-1.5">
                <span className="font-mono text-4xl font-extrabold text-sidebar">{val}</span>
                <span className="text-xl font-bold text-muted-foreground">
                  / {goal.targetValue} {goal.unit}
                </span>
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-primary">
                {percent}% achieved
              </div>

              {/* Slider */}
              <div className="mt-5 px-2">
                <Slider
                  min={0}
                  max={Math.max(goal.targetValue, val * 1.1)}
                  step={step}
                  value={[val]}
                  onValueChange={(newVals) => setVal(newVals[0])}
                  className="cursor-pointer"
                />
              </div>

              {/* Number steppers */}
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleStep(-step)}
                  className="focus-ring grid size-10 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <Minus className="size-4" />
                </button>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={val}
                  onChange={(e) => setVal(Math.max(0, Number(e.target.value)))}
                  className="focus-ring h-10 w-24 rounded-xl border border-input bg-background text-center font-mono text-base font-bold outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => handleStep(step)}
                  className="focus-ring grid size-10 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* Quick delta chips */}
            <div>
              <span className="mb-2 block text-xs font-bold text-muted-foreground">
                Quick Increments:
              </span>
              <div className="flex flex-wrap gap-2">
                {(isTimeGoal
                  ? [10, 15, 25, 30, 45]
                  : [1, 2, 5, 10, Math.round(goal.targetValue / 2)]
                ).map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => handleStep(delta)}
                    className="focus-ring rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:bg-primary/10 active:scale-95"
                  >
                    +{delta} {goal.unit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setVal(goal.targetValue)}
                  className="focus-ring rounded-full bg-primary/20 px-3 py-1.5 text-xs font-extrabold text-sidebar hover:bg-primary/30 active:scale-95"
                >
                  Full Target ({goal.targetValue})
                </button>
              </div>
            </div>

            {/* Status actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSkipNow}
                  className="focus-ring rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                  title="Preserves honest tracking without penalty"
                >
                  Skip today
                </button>
                <button
                  type="button"
                  onClick={handleResetNow}
                  className="focus-ring rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCompleteNow}
                  disabled={pending}
                  className="focus-ring rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-extrabold text-sidebar hover:bg-primary/20"
                >
                  Mark Complete (100%)
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCurrent()}
                  disabled={pending}
                  className="focus-ring rounded-full bg-primary px-5 py-2 text-xs font-extrabold text-primary-foreground shadow-sm transition-transform active:scale-95"
                >
                  {pending ? 'Saving…' : 'Save progress'}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'timer' ? (
          /* Focus Timer Tab */
          <div className="space-y-6 text-center">
            <div className="rounded-2xl border border-border/80 bg-sidebar p-8 text-sidebar-foreground">
              <div className="mono-label text-sidebar-foreground/60">Live Focus Session</div>
              <div className="mt-4 font-mono text-5xl font-black tracking-tight text-primary">
                {formatTimer(timerSeconds)}
              </div>
              <p className="mt-2 text-xs text-sidebar-foreground/60">
                {timerRunning
                  ? 'Session in motion. Stay in flow.'
                  : 'Ready to begin your focus block.'}
              </p>

              {/* Timer controls */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="focus-ring inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-extrabold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95"
                >
                  {timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {timerRunning ? 'Pause' : 'Start focus'}
                </button>
                <button
                  type="button"
                  onClick={() => setTimerPreset(25)}
                  className="focus-ring rounded-full border border-sidebar-accent/50 p-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  title="Reset timer"
                >
                  <RotateCcw className="size-4" />
                </button>
                {onOpenZen && (
                  <button
                    type="button"
                    onClick={() => onOpenZen(goal)}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-sidebar-accent/50 bg-sidebar-accent/20 px-3.5 py-2.5 text-xs font-bold text-sidebar-foreground hover:bg-sidebar-accent"
                    title="Launch Zen Focus Room with ambient soundscapes"
                  >
                    <Moon className="size-3.5 text-accent" />
                    <span>Zen Room</span>
                  </button>
                )}
              </div>
            </div>

            {/* Presets */}
            <div className="flex justify-center gap-2">
              {[15, 25, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setTimerPreset(mins)}
                  className="focus-ring rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:bg-primary/10"
                >
                  {mins} min {mins === 25 ? '🍅' : ''}
                </button>
              ))}
            </div>

            {/* Log elapsed time button */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  const logged = Math.max(1, Math.round(elapsedMinutes));
                  const nextVal = Math.min(goal.targetValue, val + logged);
                  onSave(
                    goal,
                    nextVal,
                    nextVal >= goal.targetValue ? 'completed' : 'in_progress',
                  );
                  onClose();
                }}
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm"
              >
                Log {Math.max(1, Math.round(elapsedMinutes))} minutes to goal & close
              </button>
            </div>
          </div>
        ) : activeTab === 'schedule' ? (
          /* Schedule & Timed Reminders Tab */
          <div className="space-y-5 animate-fade-in">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Bell className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-sidebar">Daily Timed Reminder</div>
                  <p className="text-[11px] text-muted-foreground">Alert me when it's time to execute this habit</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={schedEnabled}
                onChange={(e) => setSchedEnabled(e.target.checked)}
                className="size-5 accent-primary rounded cursor-pointer"
              />
            </div>

            {/* Time Picker */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-sidebar">Target Execution Time</label>
                <span className="font-mono text-sm font-extrabold text-primary">
                  {formatTime12h(schedTime)}
                </span>
              </div>

              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="focus-ring w-full rounded-xl border border-input bg-background p-3 text-lg font-mono font-bold text-foreground text-center"
              />

              {/* Presets */}
              <div>
                <span className="mono-label text-[10px] text-muted-foreground">Quick Presets</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SCHEDULE_PRESETS.map((p) => (
                    <button
                      key={p.time}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setSchedTime(p.time);
                        setSchedEnabled(true);
                      }}
                      className={cn(
                        'focus-ring flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border transition-all active:scale-95',
                        schedTime === p.time
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                          : 'border-border/70 bg-card text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                      <span className="text-[10px] opacity-60">({p.hint})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Persistent Follow-Ups Settings */}
            {schedEnabled && (
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <RotateCcw className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-sidebar">Persistent Follow-Ups</div>
                    <p className="text-[11px] text-muted-foreground">
                      Follow up repeatedly once time arrives until completed or changed manually
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground font-semibold">Follow up every:</span>
                  {[15, 20, 30, 60].map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setSchedFollowUpInterval(interval)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-bold border transition-all active:scale-95',
                        schedFollowUpInterval === interval
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border/70 bg-card text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {interval}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Desktop Notification Banner */}
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sidebar flex items-center gap-1.5">
                  <Volume2 className="size-4 text-primary" /> Browser Alerts & Audio
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold border',
                    notifPerm === 'granted'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {notifPerm === 'granted' ? 'Desktop Alerts Active ✓' : 'In-App Audio Active'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {notifPerm === 'granted'
                  ? 'LifeOS will ring an uplifting procedural chime and display system notifications even when minimized.'
                  : 'Desktop notifications allow LifeOS to alert you when minimized. Click below to grant browser permission.'}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {notifPerm !== 'granted' && isNotificationSupported() && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await requestNotificationPermission();
                      setNotifPerm(getNotificationPermission());
                      if (ok) {
                        toast({
                          title: 'Desktop Alerts Enabled! 🔔',
                          description: 'System notifications are ready.',
                        });
                      }
                    }}
                    className="focus-ring rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-bold text-sidebar hover:bg-primary/20"
                  >
                    Allow Desktop Alerts
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-foreground hover:bg-muted"
                >
                  <Bell className="size-3 text-accent" />
                  <span>Test Reminder Alert</span>
                </button>
              </div>
            </div>

            {/* Save schedule button */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="focus-ring rounded-full bg-primary px-6 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95"
              >
                Save Schedule & Reminders
              </button>
            </div>
          </div>
        ) : (
          /* Notes & Execution Log Tab */
          <div className="space-y-5 animate-fade-in">
            {/* Input card */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
              <label className="text-xs font-bold text-sidebar flex items-center justify-between">
                <span>Add Progress Note / Log</span>
                <span className="text-[10px] text-muted-foreground font-normal">Recorded with timestamp</span>
              </label>
              <textarea
                rows={3}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="What did you accomplish, learn, or want to record for this task?"
                className="focus-ring w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/60 resize-none outline-none focus:border-primary"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={savingNote || !newNoteText.trim()}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-xs transition-transform active:scale-95 disabled:opacity-50"
                >
                  <PenLine className="size-3.5" />
                  {savingNote ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </div>

            {/* Previous notes timeline */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="mono-label text-[10px] text-muted-foreground">Notes & Work History ({notesList.length})</span>
                {notesList.length > 0 && (
                  <span className="text-[10px] text-primary font-bold">Newest first</span>
                )}
              </div>

              {loadingNotes ? (
                <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-center text-xs text-muted-foreground">
                  Loading notes history…
                </div>
              ) : notesList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <PenLine className="mx-auto size-6 text-muted-foreground/40 mb-1.5" />
                  <p className="text-xs font-semibold text-muted-foreground">No notes recorded yet</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Leave progress notes whenever you work on this habit to build your execution history.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto modal-scroll pr-1">
                  {notesList.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-border/70 bg-card p-3.5 text-xs space-y-1.5 shadow-2xs hover:border-border transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-sidebar">{n.title || goal.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{n.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

// Modal showing the breakdown of the Daily Score and category weights
function ScoreBreakdownModal({
  score,
  completion,
  streak,
  focusMinutes,
  contributions,
  onClose,
}: {
  score: number;
  completion: number;
  streak: number;
  focusMinutes: number;
  contributions: { category: Category; completion: number; weight: number; contribution: number }[];
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 p-4 sm:p-5 backdrop-blur-sm">
        <div
          className="max-h-[85vh] sm:max-h-[88vh] w-full max-w-[480px] overflow-y-auto modal-scroll rounded-[28px] border border-border bg-background p-6 shadow-2xl sm:p-7"
          role="dialog"
          aria-modal="true"
        >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mono-label text-accent">Scoring Engine</div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-sidebar">
              Daily Score Breakdown
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-5 rounded-2xl bg-sidebar p-5 text-sidebar-foreground">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-extrabold text-primary">{score} / 100</div>
              <div className="text-xs text-sidebar-foreground/60">
                {Math.round(completion)}% overall commitments fulfilled
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-primary font-extrabold">
                <Flame className="size-4" /> {streak} days
              </div>
              <div className="text-xs text-sidebar-foreground/60">{focusMinutes} focus mins</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <span className="mono-label text-muted-foreground">Category Pillar Contributions</span>
          <div className="space-y-2.5">
            {contributions.map((c) => {
              const style = categoryStyles[c.category] ?? categoryStyles.career;
              return (
                <div
                  key={c.category}
                  className="rounded-xl border border-border/80 bg-card p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-sidebar capitalize">{c.category}</span>
                    <span className="font-mono text-muted-foreground">
                      Weight: {Math.round(c.weight * 100)}% · Completed:{' '}
                      <span className="font-bold text-foreground">{Math.round(c.completion)}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', style.dot)}
                      style={{ width: `${Math.min(c.completion, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full bg-sidebar px-5 py-2.5 text-xs font-extrabold text-sidebar-foreground hover:bg-sidebar/90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function getSmartIncrement(goal: DailyGoal): { value: number; label: string } {
  const unitLower = goal.unit.toLowerCase();

  // Minutes
  if (unitLower.includes('min')) {
    if (goal.targetValue >= 60) return { value: 15, label: '+15m' };
    if (goal.targetValue >= 30) return { value: 10, label: '+10m' };
    return { value: 5, label: '+5m' };
  }

  // Hours
  if (unitLower.includes('hr') || unitLower.includes('hour')) {
    if (goal.targetValue <= 2) return { value: 0.5, label: '+30m' };
    return { value: 1, label: '+1h' };
  }

  // Pages / Chapters / Reps
  if (unitLower.includes('page') || unitLower.includes('rep')) {
    if (goal.targetValue >= 30) return { value: 5, label: '+5p' };
    if (goal.targetValue >= 10) return { value: 2, label: '+2p' };
    return { value: 1, label: '+1p' };
  }

  // Km / Distance
  if (unitLower.includes('km') || unitLower.includes('mile')) {
    return { value: 1, label: '+1km' };
  }

  // Liters / Water
  if (unitLower.includes('liter') || unitLower.includes('litre')) {
    return { value: 0.5, label: '+0.5L' };
  }
  if (unitLower.includes('ml')) {
    return { value: 250, label: '+250ml' };
  }

  // Default fallback based on target value
  if (goal.targetValue > 50) return { value: 10, label: '+10' };
  if (goal.targetValue > 20) return { value: 5, label: '+5' };
  if (goal.targetValue > 5) return { value: 2, label: '+2' };
  return { value: 1, label: '+1' };
}

function GoalRow({
  goal,
  onUpdate,
  onOpenDetails,
  isAnchor,
  onToggleAnchor,
  onCycleRoutine,
  pending,
}: {
  goal: DailyGoal;
  onUpdate: (goal: DailyGoal, value: number, status?: GoalStatus) => void;
  onOpenDetails: (goal: DailyGoal) => void;
  isAnchor: boolean;
  onToggleAnchor: (goalId: number) => void;
  onCycleRoutine?: (goalId: number) => void;
  pending: boolean;
}) {
  const style = categoryStyles[goal.category] ?? categoryStyles.career;
  const completed = goal.status === 'completed';
  const skipped = goal.status === 'skipped';
  const smartInc = getSmartIncrement(goal);
  const routine = getGoalRoutine(goal);
  const routineConfig = ROUTINE_CONFIGS[routine];

  return (
    <div
      className={cn(
        'group rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-primary/60 hover:shadow-xs sm:p-5',
        completed && 'bg-card/60 border-primary/30',
        skipped && 'opacity-60 bg-muted/30 border-dashed',
      )}
      data-testid={`card-daily-goal-${goal.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Quick check toggle */}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            onUpdate(
              goal,
              completed ? 0 : goal.targetValue,
              completed ? 'in_progress' : 'completed',
            )
          }
          className={cn(
            'focus-ring mt-0.5 grid size-6.5 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90',
            completed
              ? 'border-primary bg-primary text-primary-foreground'
              : skipped
                ? 'border-muted-foreground/40 bg-muted text-muted-foreground'
                : 'border-border hover:border-primary',
          )}
          data-testid={`button-complete-goal-${goal.id}`}
          title={completed ? 'Mark incomplete' : 'Mark completed'}
        >
          {completed && <Check className="size-4" strokeWidth={3} />}
        </button>

        {/* Goal Details Trigger */}
        <div
          onClick={() => onOpenDetails(goal)}
          className="min-w-0 flex-1 cursor-pointer"
          title="Click to adjust progress, set timer, or skip"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'font-extrabold tracking-[-.01em] text-sidebar transition-colors group-hover:text-primary',
                completed && 'text-muted-foreground line-through',
                skipped && 'text-muted-foreground italic',
              )}
            >
              {goal.name}
            </h3>
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
                title={`Routine: ${routineConfig.label} (Click to switch routine)`}
              >
                {routineConfig.icon} {routineConfig.label.split(' ')[0]}
              </button>
            )}

            {/* Direct Activity Scheduled Reminder Popover */}
            <ActivitySchedulePopover goal={goal} />


            {skipped && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                Skipped
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {goal.currentValue} / {goal.targetValue} {goal.unit} ·{' '}
            {completed
              ? 'Done for today'
              : skipped
                ? 'Skipped for today'
                : goal.currentValue > 0
                  ? 'In motion'
                  : 'Ready when you are'}
          </p>
        </div>

        {/* Anchor Pin Toggle */}
        <button
          type="button"
          onClick={() => onToggleAnchor(goal.id)}
          className={cn(
            'focus-ring rounded-lg p-1.5 transition-all',
            isAnchor
              ? 'bg-accent/15 text-accent opacity-100'
              : 'text-muted-foreground/40 opacity-0 hover:bg-accent/10 hover:text-accent group-hover:opacity-100',
          )}
          title={isAnchor ? "Today's Anchor (Click to unpin)" : "Pin as Today's Anchor (The One Big Thing)"}
        >
          <Anchor className="size-4" />
        </button>

        {/* More Options / Adjust Trigger */}
        <button
          type="button"
          onClick={() => onOpenDetails(goal)}
          className="focus-ring rounded-lg p-1.5 text-muted-foreground transition-opacity hover:bg-muted group-hover:opacity-100"
          data-testid={`button-more-goal-${goal.id}`}
          title="Adjust progress or timer"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {/* Progress bar + Quick increment stepper */}
      <div className="ml-9.5 mt-3 flex items-center gap-3">
        <div
          onClick={() => onOpenDetails(goal)}
          className="h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn('h-full rounded-full transition-all duration-500', style.dot)}
            style={{ width: `${Math.min(goal.percent, 100)}%` }}
          />
        </div>
        <span className="w-11 text-right font-mono text-[11px] font-semibold text-muted-foreground">
          {Math.round(goal.percent)}%
        </span>
        <button
          type="button"
          disabled={pending || completed || skipped}
          onClick={() =>
            onUpdate(
              goal,
              Math.min(
                goal.targetValue,
                Math.round((goal.currentValue + smartInc.value) * 10) / 10,
              ),
              'in_progress',
            )
          }
          className="focus-ring inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-xs font-extrabold text-foreground transition-all hover:border-primary hover:bg-primary/10 hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid={`button-increment-goal-${goal.id}`}
          title={`Quick add ${smartInc.label} towards ${goal.targetValue} ${goal.unit}`}
        >
          <Plus className="size-3 text-primary" strokeWidth={3} />
          <span>{smartInc.label.replace('+', '')}</span>
        </button>
      </div>
    </div>
  );
}

export default function Today() {
  const queryClient = useQueryClient();
  const dashboardQuery = useGetDashboard();
  const todayQuery = useGetToday();
  const progressMutation = useUpdateDailyGoalProgress();
  const { toast } = useToast();
  const { schedules } = useNotifications();

  const [viewMode, setViewMode] = useState<'roadmap' | 'category'>(() => {
    try {
      return (localStorage.getItem('lifeos_today_view_mode') as 'roadmap' | 'category') || 'roadmap';
    } catch {
      return 'roadmap';
    }
  });

  const handleSetViewMode = (mode: 'roadmap' | 'category') => {
    sound.playClick();
    setViewMode(mode);
    try {
      localStorage.setItem('lifeos_today_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const [inspectingGoal, setInspectingGoal] = useState<DailyGoal | undefined>();
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showRapidReview, setShowRapidReview] = useState(false);
  const [showZenRoom, setShowZenRoom] = useState(false);
  const [zenInitialGoal, setZenInitialGoal] = useState<DailyGoal | undefined>();
  const [showEveningReflection, setShowEveningReflection] = useState(false);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [todayReflection, setTodayReflection] = useState<DailyReflection | null>(() =>
    getReflectionForDate(getTodayDateKey()),
  );

  const dashboard = dashboardQuery.data;
  const today = todayQuery.data;
  const goals = today?.goals ?? [];
  const dailyScore = dashboard?.dailyScore ?? today?.dailyScore ?? 0;

  const handleDraftReflection = (suggestedText: string) => {
    const dateKey = getTodayDateKey();
    const existing = getReflectionForDate(dateKey);
    const updated: DailyReflection = {
      date: dateKey,
      energyLevel: existing?.energyLevel ?? 4,
      moodTags: existing?.moodTags ?? ['Peaceful 🌿', 'Focused ⚡'],
      wins:
        existing?.wins && existing.wins.some((w) => w.trim())
          ? existing.wins
          : [suggestedText, '', ''],
      lesson: existing?.lesson || 'Compounding daily habits creates momentum.',
      gratitude: existing?.gratitude || 'Clear mind and steady execution.',
      completedAt: new Date().toISOString(),
    };
    saveReflection(updated);
    setTodayReflection(updated);
    setShowEveningReflection(true);
  };

  // Anchor ("The One Big Thing") states
  const [anchorGoalId, setAnchorGoalId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('lifeos_anchor_goal_id');
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  const todayDateKey = dashboard?.date ? dashboard.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [anchorNote, setAnchorNote] = useState<string>(() => {
    try {
      return localStorage.getItem(`lifeos_anchor_note_${todayDateKey}`) || '';
    } catch {
      return '';
    }
  });
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState(anchorNote);

  // Resilience Shield & Streak Freeze states
  const [showShieldModal, setShowShieldModal] = useState(false);
  const [shieldVersion, setShieldVersion] = useState(0);

  const shieldVault = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    shieldVersion;
    return getShieldVaultState();
  }, [shieldVersion]);

  const isShieldedToday = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    shieldVersion;
    return isDateShielded(todayDateKey);
  }, [shieldVersion, todayDateKey]);

  const streakTier = getStreakTier(dashboard?.streak ?? 0);

  // Auto-award shield token for high daily scores (>= 70)
  useEffect(() => {
    if (dailyScore >= 70 && todayDateKey) {
      const awarded = checkAndAwardShield(todayDateKey, dailyScore);
      if (awarded) {
        sound.playCelebration();
        toast({
          title: 'Resilience Shield Earned! 🛡️',
          description: 'You unlocked a new Grace Shield in your bank for consistent score performance!',
        });
        setShieldVersion((v) => v + 1);
      }
    }
  }, [dailyScore, todayDateKey, toast]);

  const handleSaveNote = () => {
    setAnchorNote(noteInput);
    setIsEditingNote(false);
    try {
      localStorage.setItem(`lifeos_anchor_note_${todayDateKey}`, noteInput);
    } catch {
      // ignore
    }
  };

  const handleToggleAnchor = (id: number) => {
    setAnchorGoalId((prev) => {
      const next = prev === id ? null : id;
      try {
        if (next === null) {
          localStorage.removeItem('lifeos_anchor_goal_id');
        } else {
          localStorage.setItem('lifeos_anchor_goal_id', String(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [activeRoutineFilter, setActiveRoutineFilter] = useState<'all' | RoutineType>('all');
  const [runningRoutine, setRunningRoutine] = useState<RoutineType | null>(null);
  const [routineVersion, setRoutineVersion] = useState(0);

  // Global Escape key listener to dismiss any active modal overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showScoreModal) setShowScoreModal(false);
        else if (inspectingGoal) setInspectingGoal(undefined);
        else if (showRapidReview) setShowRapidReview(false);
        else if (showZenRoom) setShowZenRoom(false);
        else if (showEveningReflection) setShowEveningReflection(false);
        else if (showHallOfFame) setShowHallOfFame(false);
        else if (showShieldModal) setShowShieldModal(false);
        else if (runningRoutine) setRunningRoutine(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showScoreModal,
    inspectingGoal,
    showRapidReview,
    showZenRoom,
    showEveningReflection,
    showHallOfFame,
    showShieldModal,
    runningRoutine,
  ]);

  const routineGroups = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    routineVersion;
    return groupGoalsByRoutine(goals);
  }, [goals, routineVersion]);

  const displayedGoals = useMemo(() => {
    if (activeRoutineFilter === 'all') return goals;
    return routineGroups[activeRoutineFilter];
  }, [goals, activeRoutineFilter, routineGroups]);

  const handleCycleRoutine = (goalId: number) => {
    sound.playClick();
    const currentGoal = goals.find((g) => g.id === goalId);
    if (!currentGoal) return;
    const current = getGoalRoutine(currentGoal);
    const cycle: RoutineType[] = ['morning', 'deep_work', 'evening'];
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    setGoalRoutine(goalId, next);
    setRoutineVersion((v) => v + 1);
    toast({
      title: 'Routine Stack Updated',
      description: `Moved "${currentGoal.name}" to ${ROUTINE_CONFIGS[next].label}`,
    });
  };

  // Resolve active anchor goal
  const anchorGoal = useMemo(() => {
    if (goals.length === 0) return null;
    if (anchorGoalId !== null) {
      const match = goals.find((g) => g.id === anchorGoalId);
      if (match) return match;
    }
    return goals.find((g) => g.priority === 1) || goals[0];
  }, [goals, anchorGoalId]);

  const grouped = useMemo(
    () =>
      displayedGoals.reduce<Record<string, DailyGoal[]>>((acc, goal) => {
        (acc[goal.category] ??= []).push(goal);
        return acc;
      }, {}),
    [displayedGoals],
  );

  const updateGoal = (
    goal: DailyGoal,
    currentValue: number,
    status?: GoalStatus,
    showUndoToast = true,
  ) => {
    const prevValue = goal.currentValue;
    const prevStatus = goal.status;

    // Defensive clamping: values cannot be negative
    const nextValue = Math.max(0, Math.round(currentValue * 10) / 10);
    const resolvedStatus: GoalStatus =
      status ?? (nextValue >= goal.targetValue ? 'completed' : nextValue > 0 ? 'in_progress' : 'not_started');

    progressMutation.mutate(
      { id: goal.id, data: { currentValue: nextValue, status: resolvedStatus } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetTodayQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });

          if (showUndoToast) {
            const isFinished = resolvedStatus === 'completed' || nextValue >= goal.targetValue;
            if (isFinished) {
              sound.playComplete();
            } else {
              sound.playClick();
            }
            toast({
              title: isFinished
                ? `Completed: ${goal.name}`
                : resolvedStatus === 'skipped'
                  ? `Skipped: ${goal.name}`
                  : `Updated: ${goal.name}`,
              description: isFinished
                ? `100% complete! Score updated.`
                : `${nextValue} of ${goal.targetValue} ${goal.unit}`,
              action: (
                <button
                  type="button"
                  onClick={() => updateGoal(goal, prevValue, prevStatus, false)}
                  className="focus-ring inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted"
                >
                  <Undo2 className="size-3" />
                  Undo
                </button>
              ),
            });
          }
        },
      },
    );
  };

  const date = dashboard?.date ? new Date(dashboard.date) : new Date();
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const isLoading = dashboardQuery.isLoading || todayQuery.isLoading;

  const dailyCompletion = dashboard?.dailyCompletion ?? today?.dailyCompletion ?? 0;
  const contributions =
    today?.categoryContributions ?? dashboard?.categoryContributions ?? [];

  const userStats: UserStatsSnapshot = useMemo(() => {
    const completedGoals = goals.filter((g) => g.status === 'completed');
    const distinctCats = new Set(completedGoals.map((g) => g.category)).size;
    const weeklyOkrs = getWeeklyObjectives(getWeekDetails(new Date()).weekKey);
    const okrsDone = weeklyOkrs.filter((o) => o.completed).length;
    const reflectionsCount = getAllReflections().length;

    return {
      streak: dashboard?.streak ?? 0,
      dailyScore,
      dailyCompletion,
      focusMinutes: dashboard?.focusMinutes ?? 0,
      totalGoalsCount: goals.length,
      completedGoalsCount: completedGoals.length,
      distinctCategoriesCompleted: distinctCats,
      eveningReflectionsCount: reflectionsCount,
      weeklyOkrsCompleted: okrsDone,
    };
  }, [dashboard?.streak, dashboard?.focusMinutes, dailyScore, dailyCompletion, goals]);

  const evaluatedBadges = useMemo(() => evaluateBadges(userStats), [userStats]);
  const unlockedBadgesCount = evaluatedBadges.filter((b) => b.unlocked).length;

  return (
    <AppShell>
      <div className="animate-rise-in">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="mono-label text-muted-foreground" data-testid="text-today-date">
              {dateLabel}
            </div>
            <h1
              className="mt-3 text-4xl font-extrabold tracking-[-.07em] text-sidebar sm:text-5xl"
              data-testid="text-today-greeting"
            >
              {dashboard?.greeting || 'Good morning.'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Here is the shape of your day and honest progress.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowHallOfFame(true)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-extrabold text-amber-700 shadow-xs transition-transform hover:bg-amber-500/20 active:scale-95"
              data-testid="button-open-hall-of-fame"
              title="Open Hall of Milestones & Trophy Case"
            >
              <Trophy className="size-3.5 text-amber-600" />
              <span>Trophies ({unlockedBadgesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setZenInitialGoal(undefined);
                setShowZenRoom(true);
              }}
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-extrabold text-foreground shadow-xs transition-transform hover:border-primary/50 hover:bg-muted active:scale-95"
              data-testid="button-open-zen-room"
              title="Launch ambient full-screen Zen Focus Room with native soundscapes"
            >
              <Moon className="size-3.5 text-primary" />
              <span>Zen Focus</span>
            </button>
            <button
              type="button"
              onClick={() => setShowEveningReflection(true)}
              className={cn(
                'focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-extrabold shadow-xs transition-transform active:scale-95',
                todayReflection
                  ? 'border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted',
              )}
              data-testid="button-evening-reflection"
              title="Open Evening Wind-Down & Daily Reflection"
            >
              <Moon className="size-3.5 text-primary" />
              <span>{todayReflection ? 'Day Closed' : 'Wind Down'}</span>
              {todayReflection && <Check className="size-3 text-primary stroke-[3]" />}
            </button>
            {goals.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRapidReview(true)}
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-sidebar px-4 py-2.5 text-xs font-extrabold text-sidebar-foreground shadow-sm transition-transform hover:bg-sidebar/90 active:scale-95"
                data-testid="button-review-day"
                title="Launch rapid 30-second day review wizard"
              >
                <Sparkles className="size-3.5 text-accent" />
                <span>Review Day</span>
              </button>
            )}
            <ProfileChip onOpenTrophies={() => setShowHallOfFame(true)} />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-[28px] bg-muted" />
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : dashboardQuery.isError || todayQuery.isError ? (
          <div className="rounded-[28px] border border-accent/40 bg-accent/10 p-8 text-center">
            <RotateCcw className="mx-auto mb-3 size-6 text-accent" />
            <h2 className="font-bold">Today could not load</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Give it another try — your goals are safe.
            </p>
            <button
              type="button"
              onClick={() => {
                void dashboardQuery.refetch();
                void todayQuery.refetch();
              }}
              className="mt-5 rounded-full bg-sidebar px-5 py-2 text-xs font-bold text-sidebar-foreground"
              data-testid="button-retry-today"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Daily Signal Hero Banner */}
            <section className="relative overflow-hidden rounded-[28px] bg-sidebar p-6 text-sidebar-foreground shadow-sm sm:p-8">
              <div className="pointer-events-none absolute -right-8 -top-20 size-64 rounded-full border-[28px] border-sidebar-accent/60" />
              <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-sidebar-foreground/50">
                    <span className="mono-label">Daily signal</span>
                    <button
                      type="button"
                      onClick={() => setShowScoreModal(true)}
                      className="inline-flex items-center gap-1 rounded-full bg-sidebar-accent/40 px-2 py-0.5 text-[10px] font-bold text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      <HelpCircle className="size-3" />
                      How score works
                    </button>
                  </div>
                  <div className="mt-4 flex items-center gap-5">
                    <div onClick={() => setShowScoreModal(true)}>
                      <ProgressRing value={dailyCompletion} />
                    </div>
                    <div>
                      <div
                        onClick={() => setShowScoreModal(true)}
                        className="cursor-pointer text-3xl font-extrabold tracking-[-.06em] transition-opacity hover:opacity-90"
                        data-testid="text-daily-score"
                      >
                        {dailyScore}
                        <span className="ml-1 text-sm font-semibold text-sidebar-foreground/55">
                          score
                        </span>
                      </div>
                      <p className="mt-1 max-w-[200px] text-xs leading-5 text-sidebar-foreground/55">
                        {dashboard?.completedCount ??
                          goals.filter((g) => g.status === 'completed').length}{' '}
                        of {dashboard?.totalCount ?? goals.length} commitments complete
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 sm:gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 text-primary">
                      <Flame className="size-4" />
                      <span className="text-xl font-extrabold">{dashboard?.streak ?? 0}</span>
                      <button
                        type="button"
                        onClick={() => setShowShieldModal(true)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-all hover:scale-105 active:scale-95',
                          isShieldedToday
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs animate-pulse'
                            : 'border-border/80 bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent',
                        )}
                        title={isShieldedToday ? 'Streak is protected today' : 'Open Resilience Vault'}
                        data-testid="button-open-shield-vault"
                      >
                        <Shield className="size-3 fill-current" />
                        <span>{isShieldedToday ? 'Guarded' : `${shieldVault.availableShields} Shields`}</span>
                      </button>
                    </div>
                    <div className="mt-1 text-[10px] text-sidebar-foreground/50">
                      {streakTier.icon} {streakTier.name} streak
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-accent">
                      <Clock3 className="size-4" />
                      <span className="text-xl font-extrabold">
                        {dashboard?.focusMinutes ?? 0}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-sidebar-foreground/50">focus min</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-[#8dd7d8]">
                      <TrendingUp className="size-4" />
                      <span className="text-xl font-extrabold">
                        {Math.round(dailyCompletion)}%
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-sidebar-foreground/50">in motion</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Smart Daily Briefing & Coach Game Plan */}
            <div className="mt-8">
              <DailyBriefingCard
                goals={goals}
                dailyScore={dailyScore}
                focusMinutes={dashboard?.focusMinutes ?? 0}
                onSelectGoal={(goal) => setInspectingGoal(goal)}
                onOpenZen={(goal) => {
                  setZenInitialGoal(goal);
                  setShowZenRoom(true);
                }}
                onDraftReflection={handleDraftReflection}
              />
            </div>

            {/* Spotlight Banner: The One Big Thing (Daily Anchor) */}
            {anchorGoal && (
              <section className="relative mt-8 overflow-hidden rounded-[28px] border-2 border-accent/40 bg-gradient-to-br from-card via-card to-accent/5 p-6 shadow-sm transition-all sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-xs">
                      <Anchor className="size-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono-label font-extrabold tracking-wider text-accent">
                          TODAY'S ANCHOR · THE ONE BIG THING
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold',
                            categoryStyles[anchorGoal.category]?.color,
                          )}
                        >
                          {categoryStyles[anchorGoal.category]?.label}
                        </span>
                        {anchorGoal.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-sidebar">
                            <Check className="size-3" /> Anchor Secured!
                          </span>
                        )}
                      </div>
                      <h2
                        className={cn(
                          'mt-1 text-2xl font-black tracking-[-.03em] text-sidebar',
                          anchorGoal.status === 'completed' && 'line-through opacity-60',
                        )}
                      >
                        {anchorGoal.name}
                      </h2>
                    </div>
                  </div>

                  {/* Actions on Anchor Card */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        const isDone = anchorGoal.status === 'completed';
                        updateGoal(
                          anchorGoal,
                          isDone ? 0 : anchorGoal.targetValue,
                          isDone ? 'in_progress' : 'completed',
                        );
                        if (!isDone) sound.playCelebration();
                      }}
                      className={cn(
                        'focus-ring inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black shadow-xs transition-all active:scale-95',
                        anchorGoal.status === 'completed'
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-primary/50 bg-primary/10 text-sidebar hover:bg-primary/20',
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                      <span>{anchorGoal.status === 'completed' ? 'Secured' : 'Secure Anchor'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInspectingGoal(anchorGoal)}
                      className="focus-ring rounded-full border border-border bg-card p-2 text-muted-foreground hover:bg-muted"
                      title="Adjust anchor progress or focus timer"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Anchor Progress Bar */}
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        categoryStyles[anchorGoal.category]?.dot,
                      )}
                      style={{ width: `${Math.min(anchorGoal.percent, 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-bold text-sidebar">
                    {anchorGoal.currentValue} / {anchorGoal.targetValue} {anchorGoal.unit} ({Math.round(anchorGoal.percent)}%)
                  </span>
                </div>

                {/* Daily Intention Note */}
                <div className="mt-5 flex flex-col justify-between gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-2">
                    <Sparkles className="size-3.5 shrink-0 text-accent" />
                    {isEditingNote ? (
                      <div className="flex w-full max-w-md items-center gap-2">
                        <input
                          type="text"
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder="e.g. Complete architecture spec before lunch..."
                          className="focus-ring flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-semibold outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNote();
                            if (e.key === 'Escape') setIsEditingNote(false);
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          className="rounded-full bg-sidebar px-3 py-1 text-xs font-bold text-sidebar-foreground"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setNoteInput(anchorNote);
                          setIsEditingNote(true);
                        }}
                        className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        title="Click to edit intention note"
                      >
                        <span>
                          {anchorNote
                            ? `Intention: “${anchorNote}”`
                            : "Click to set today's intention note for this anchor..."}
                        </span>
                        <PenLine className="size-3 opacity-60" />
                      </div>
                    )}
                  </div>

                  {/* Switch Anchor Selector */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Change anchor:</span>
                    <select
                      value={anchorGoal.id}
                      onChange={(e) => handleToggleAnchor(Number(e.target.value))}
                      className="focus-ring rounded-lg border border-border bg-card px-2 py-1 text-xs font-bold text-sidebar outline-none"
                    >
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.targetValue} {g.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>
            )}

            {/* Main Runway + Sidebar */}
            <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
              <section>
                <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div>
                    <div className="mono-label text-muted-foreground">The runway</div>
                    <h2 className="mt-2 text-xl font-extrabold tracking-[-.04em] text-sidebar">
                      What matters today
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Mode Switcher: Daily Roadmap vs Category Groups */}
                    <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card p-1 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleSetViewMode('roadmap')}
                        className={cn(
                          'focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all',
                          viewMode === 'roadmap'
                            ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        title="View daily roadmap ordered chronologically by schedule time"
                        data-testid="button-view-roadmap"
                      >
                        <Map className="size-3.5" />
                        <span>Daily Roadmap</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetViewMode('category')}
                        className={cn(
                          'focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all',
                          viewMode === 'category'
                            ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        title="View habits grouped by life category"
                        data-testid="button-view-category"
                      >
                        <LayoutGrid className="size-3.5" />
                        <span>Categories</span>
                      </button>
                    </div>

                    <span className="hidden sm:inline text-xs font-semibold text-muted-foreground">
                      {displayedGoals.length} {displayedGoals.length === 1 ? 'commitment' : 'commitments'}
                    </span>
                  </div>
                </div>

                {/* Grace Day Rest Banner when Shield is Active */}
                {isShieldedToday && (
                  <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/[0.04] p-4 text-xs animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-sidebar">
                        <ShieldCheck className="size-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-extrabold text-sidebar flex items-center gap-1.5">
                          <span>Grace Day Shield Engaged</span>
                          <span className="rounded-full bg-primary/20 px-2 py-0.2 text-[10px] text-primary">
                            Guarded
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Your {dashboard?.streak ?? 0}-day streak will not break tonight. Rest, recover, or log any bonus habits freely without pressure.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowShieldModal(true)}
                      className="focus-ring inline-flex items-center gap-1.5 self-end sm:self-auto rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                    >
                      <Shield className="size-3" />
                      <span>Vault Settings</span>
                    </button>
                  </div>
                )}

                {/* Routine Stacks & Flow Mode Tabs */}
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-2 sm:p-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setActiveRoutineFilter('all');
                      }}
                      className={cn(
                        'focus-ring rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                        activeRoutineFilter === 'all'
                          ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      All Habits ({goals.length})
                    </button>
                    {(['morning', 'deep_work', 'evening'] as RoutineType[]).map((rKey) => {
                      const cfg = ROUTINE_CONFIGS[rKey];
                      const count = routineGroups[rKey].length;
                      const active = activeRoutineFilter === rKey;
                      return (
                        <button
                          key={rKey}
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setActiveRoutineFilter(rKey);
                          }}
                          className={cn(
                            'focus-ring flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                            active
                              ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <span>{cfg.icon}</span>
                          <span>{cfg.label.split(' ')[0]}</span>
                          <span className="text-[10px] opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Flow Mode Launcher */}
                  {activeRoutineFilter !== 'all' && routineGroups[activeRoutineFilter].length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setRunningRoutine(activeRoutineFilter);
                      }}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-extrabold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95"
                    >
                      <Play className="size-3.5 fill-current" />
                      <span>Start {ROUTINE_CONFIGS[activeRoutineFilter].label.split(' ')[0]} Flow</span>
                    </button>
                  )}
                </div>

                {displayedGoals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                    <Target className="mx-auto mb-2 size-6 text-muted-foreground/60" />
                    <h3 className="font-bold text-sm text-sidebar">No habits in this routine stack</h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                      Click the routine pill next to any habit to assign it to{' '}
                      {activeRoutineFilter !== 'all' ? ROUTINE_CONFIGS[activeRoutineFilter].label : 'this routine'}.
                    </p>
                  </div>
                ) : viewMode === 'roadmap' ? (
                  <DailyRoadmapView
                    goals={displayedGoals}
                    schedules={schedules}
                    anchorGoalId={anchorGoal?.id ?? null}
                    onUpdate={updateGoal}
                    onOpenDetails={(g) => setInspectingGoal(g)}
                    onToggleAnchor={handleToggleAnchor}
                    onCycleRoutine={handleCycleRoutine}
                    onOpenZen={(goal) => {
                      setZenInitialGoal(goal);
                      setShowZenRoom(true);
                    }}
                    categoryStyles={categoryStyles}
                    pending={progressMutation.isPending}
                  />
                ) : (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([category, categoryGoals]) => {
                      const sortedCategoryGoals = sortGoalsByScheduleTime(categoryGoals, schedules);
                      return (
                        <div key={category} className="space-y-3">
                          <div className="flex items-center gap-2 pt-2">
                            <span
                              className={cn(
                                'size-2 rounded-full',
                                categoryStyles[category as Category]?.dot,
                              )}
                            />
                            <span className="mono-label text-muted-foreground">
                              {categoryStyles[category as Category]?.label}
                            </span>
                          </div>
                          {sortedCategoryGoals.map((goal) => (
                            <GoalRow
                              key={goal.id}
                              goal={goal}
                              onUpdate={updateGoal}
                              onOpenDetails={(g) => setInspectingGoal(g)}
                              isAnchor={anchorGoal?.id === goal.id}
                              onToggleAnchor={handleToggleAnchor}
                              onCycleRoutine={handleCycleRoutine}
                              pending={progressMutation.isPending}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Sidebar */}
              <aside className="space-y-4">
                {/* Balance Card */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="mono-label text-muted-foreground">Today in balance</span>
                    <button
                      type="button"
                      onClick={() => setShowScoreModal(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Target className="size-4 text-accent" />
                    </button>
                  </div>
                  <div className="mt-6 space-y-4">
                    {contributions.slice(0, 6).map((item) => (
                      <div key={item.category}>
                        <div className="mb-1.5 flex justify-between text-xs">
                          <span className="font-semibold capitalize text-sidebar">
                            {item.category}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {Math.round(item.completion)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              categoryStyles[item.category]?.dot,
                            )}
                            style={{ width: `${Math.min(item.completion, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evening Wind-Down Card */}
                <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid size-7 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Moon className="size-4" />
                      </div>
                      <span className="mono-label text-muted-foreground">Evening Closing</span>
                    </div>
                    {todayReflection ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <Check className="size-3 stroke-[3]" /> Done
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-muted-foreground">Ritual</span>
                    )}
                  </div>

                  {todayReflection ? (
                    <div className="mt-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Energy state:</span>
                        <span className="font-bold text-sidebar">
                          {ENERGY_LEVELS.find((e) => e.level === todayReflection.energyLevel)?.icon}{' '}
                          {ENERGY_LEVELS.find((e) => e.level === todayReflection.energyLevel)?.label}
                        </span>
                      </div>
                      {todayReflection.wins.some(Boolean) && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Top Win:</span>
                          <p className="mt-0.5 font-semibold text-foreground line-clamp-2">
                            "{todayReflection.wins.find(Boolean)}"
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowEveningReflection(true)}
                        className="focus-ring mt-2 inline-flex w-full items-center justify-center rounded-xl border border-border py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                      >
                        Review / Edit Reflection
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Honor your honest progress today. Celebrate 3 wins and release remaining tensions.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowEveningReflection(true)}
                        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sidebar py-2 text-xs font-extrabold text-sidebar-foreground hover:bg-sidebar/90"
                      >
                        <Sparkles className="size-3.5 text-accent" />
                        <span>Begin Reflection</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Daily Signal Note */}
                <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="mono-label opacity-60">Daily anchor</span>
                    <Sparkles className="size-4" />
                  </div>
                  <p className="mt-4 text-sm font-bold leading-6">
                    {dashboard?.highlights?.[0] ||
                      'Consistency is not a mood. It is an honest practice you can always return to.'}
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

        {/* Progress Adjust Modal */}
        {inspectingGoal && (
          <ProgressAdjustModal
            goal={inspectingGoal}
            onClose={() => setInspectingGoal(undefined)}
            onSave={(goal, val, status) => {
              updateGoal(goal, val, status);
              setInspectingGoal(undefined);
            }}
            onOpenZen={(goal) => {
              setInspectingGoal(undefined);
              setZenInitialGoal(goal);
              setShowZenRoom(true);
            }}
            pending={progressMutation.isPending}
          />
        )}

        {/* Daily Score Breakdown Modal */}
        {showScoreModal && (
          <ScoreBreakdownModal
            score={dailyScore}
            completion={dailyCompletion}
            streak={dashboard?.streak ?? 0}
            focusMinutes={dashboard?.focusMinutes ?? 0}
            contributions={contributions}
            onClose={() => setShowScoreModal(false)}
          />
        )}
        {/* Rapid Day Review Wizard */}
        {showRapidReview && (
          <RapidReviewModal
            goals={goals}
            onClose={() => setShowRapidReview(false)}
            onUpdateGoal={updateGoal}
            dailyScore={dailyScore}
            dailyCompletion={dailyCompletion}
            streak={dashboard?.streak ?? 0}
            focusMinutes={dashboard?.focusMinutes ?? 0}
          />
        )}
        {/* Ambient Full-screen Zen Focus Room */}
        {showZenRoom && (
          <ZenFocusRoom
            goals={goals}
            initialGoal={zenInitialGoal}
            onClose={() => setShowZenRoom(false)}
            onLogProgress={(goal, minutes) => {
              const nextVal = Math.min(goal.targetValue, goal.currentValue + minutes);
              updateGoal(
                goal,
                nextVal,
                nextVal >= goal.targetValue ? 'completed' : 'in_progress',
              );
            }}
          />
        )}

        {/* Evening Wind-Down & Daily Reflection Modal */}
        {showEveningReflection && (
          <EveningReflectionModal
            onClose={() => setShowEveningReflection(false)}
            onSaved={(refl) => {
              setTodayReflection(refl);
            }}
            dailyScore={dailyScore}
            streak={dashboard?.streak ?? 0}
          />
        )}

        {/* Hall of Fame & Milestones Trophy Case Modal */}
        {showHallOfFame && (
          <HallOfFameModal
            stats={userStats}
            onClose={() => setShowHallOfFame(false)}
          />
        )}

        {/* Routine Stacking Sequential Flow Mode Runner */}
        {runningRoutine && (
          <RoutineFlowRunner
            routine={runningRoutine}
            goals={routineGroups[runningRoutine]}
            onClose={() => setRunningRoutine(null)}
            onUpdateGoal={updateGoal}
          />
        )}

        {/* Resilience Shield & Grace Day Vault Modal */}
        {showShieldModal && (
          <ResilienceShieldModal
            dateKey={todayDateKey}
            currentStreak={dashboard?.streak ?? 0}
            onClose={() => setShowShieldModal(false)}
            onShieldChanged={() => setShieldVersion((v) => v + 1)}
          />
        )}
    </AppShell>
  );
}