import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Flame,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { Category, DailyGoal, GoalStatus } from '@workspace/api-client-react';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';

interface RapidReviewModalProps {
  goals: DailyGoal[];
  onClose: () => void;
  onUpdateGoal: (goal: DailyGoal, value: number, status?: GoalStatus) => void;
  dailyScore: number;
  dailyCompletion: number;
  streak: number;
  focusMinutes: number;
}

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

function getSmartIncrement(goal: DailyGoal): { value: number; label: string } {
  const unitLower = goal.unit.toLowerCase();

  if (unitLower.includes('min')) {
    if (goal.targetValue >= 60) return { value: 15, label: '+15m' };
    if (goal.targetValue >= 30) return { value: 10, label: '+10m' };
    return { value: 5, label: '+5m' };
  }
  if (unitLower.includes('hr') || unitLower.includes('hour')) {
    if (goal.targetValue <= 2) return { value: 0.5, label: '+30m' };
    return { value: 1, label: '+1h' };
  }
  if (unitLower.includes('page') || unitLower.includes('rep')) {
    if (goal.targetValue >= 30) return { value: 5, label: '+5p' };
    if (goal.targetValue >= 10) return { value: 2, label: '+2p' };
    return { value: 1, label: '+1p' };
  }
  if (unitLower.includes('km') || unitLower.includes('mile')) {
    return { value: 1, label: '+1km' };
  }
  if (unitLower.includes('liter') || unitLower.includes('litre')) {
    return { value: 0.5, label: '+0.5L' };
  }
  if (unitLower.includes('ml')) {
    return { value: 250, label: '+250ml' };
  }
  if (goal.targetValue > 50) return { value: 10, label: '+10' };
  if (goal.targetValue > 20) return { value: 5, label: '+5' };
  if (goal.targetValue > 5) return { value: 2, label: '+2' };
  return { value: 1, label: '+1' };
}

export function RapidReviewModal({
  goals,
  onClose,
  onUpdateGoal,
  dailyScore,
  dailyCompletion,
  streak,
  focusMinutes,
}: RapidReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [soundActive, setSoundActive] = useState(sound.isEnabled());

  const currentGoal = goals[currentIndex];
  const total = goals.length;
  const isLast = currentIndex === total - 1;

  // Sound toggle
  const toggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    sound.setEnabled(next);
    if (next) sound.playClick();
  };

  // Trigger celebration sound upon reaching finish screen
  useEffect(() => {
    if (isFinished) {
      sound.playCelebration();
    }
  }, [isFinished]);

  // Actions
  const handleComplete = () => {
    if (!currentGoal) return;
    sound.playComplete();
    onUpdateGoal(currentGoal, currentGoal.targetValue, 'completed');
    if (isLast) {
      setIsFinished(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleIncrement = () => {
    if (!currentGoal) return;
    const smartInc = getSmartIncrement(currentGoal);
    const nextVal = Math.min(
      currentGoal.targetValue,
      Math.round((currentGoal.currentValue + smartInc.value) * 10) / 10,
    );
    sound.playClick();
    onUpdateGoal(
      currentGoal,
      nextVal,
      nextVal >= currentGoal.targetValue ? 'completed' : 'in_progress',
    );
  };

  const handleSkip = () => {
    if (!currentGoal) return;
    sound.playClick();
    onUpdateGoal(currentGoal, 0, 'skipped');
    if (isLast) {
      setIsFinished(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    sound.playClick();
    if (isLast) {
      setIsFinished(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    sound.playClick();
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleComplete();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleIncrement();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const style = currentGoal
    ? categoryStyles[currentGoal.category] ?? categoryStyles.career
    : categoryStyles.career;
  const smartInc = currentGoal ? getSmartIncrement(currentGoal) : { value: 1, label: '+1' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/60 p-4 backdrop-blur-md">
      <div
        className="relative w-full max-w-[560px] overflow-hidden rounded-[32px] border border-border bg-background p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Controls: Sound toggle, Progress bar & Close */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={toggleSound}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted"
            title={soundActive ? 'Mute sound effects' : 'Enable audio chimes'}
          >
            {soundActive ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5" />}
            <span>Sound {soundActive ? 'On' : 'Off'}</span>
          </button>

          {!isFinished && (
            <div className="mono-label text-muted-foreground">
              {currentIndex + 1} of {total} commitments
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Top Step Progress Bar */}
        {!isFinished && (
          <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            />
          </div>
        )}

        {/* Wizard Main Content */}
        {!isFinished && currentGoal ? (
          <div className="space-y-6">
            {/* Category Pillar Badge */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-extrabold',
                  style.color,
                  style.textColor,
                )}
              >
                {style.label} Pillar
              </span>
              {currentGoal.status === 'completed' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-sidebar">
                  <Check className="size-3" /> Done
                </span>
              )}
              {currentGoal.status === 'skipped' && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                  Skipped
                </span>
              )}
            </div>

            {/* Goal Card Main Display */}
            <div className="rounded-[24px] border border-border/80 bg-card p-6 sm:p-7">
              <h2 className="text-2xl font-black tracking-[-.04em] text-sidebar sm:text-3xl">
                {currentGoal.name}
              </h2>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-black text-primary">
                  {currentGoal.currentValue}
                </span>
                <span className="text-lg font-bold text-muted-foreground">
                  / {currentGoal.targetValue} {currentGoal.unit}
                </span>
                <span className="ml-auto font-mono text-sm font-bold text-muted-foreground">
                  {Math.round(currentGoal.percent)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', style.dot)}
                  style={{ width: `${Math.min(currentGoal.percent, 100)}%` }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Complete button */}
              <button
                type="button"
                onClick={handleComplete}
                className="focus-ring col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-sm transition-transform active:scale-95 sm:col-span-1"
                title="Shortcut: Space or Enter"
              >
                <Check className="size-4" strokeWidth={3} />
                <span>Mark Done</span>
              </button>

              {/* Quick Stepper */}
              <button
                type="button"
                onClick={handleIncrement}
                className="focus-ring flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3.5 text-sm font-extrabold text-foreground transition-all hover:border-primary hover:bg-primary/10 active:scale-95"
                title="Shortcut: +"
              >
                <Plus className="size-4 text-primary" strokeWidth={3} />
                <span>Add {smartInc.label}</span>
              </button>

              {/* Skip button */}
              <button
                type="button"
                onClick={handleSkip}
                className="focus-ring flex items-center justify-center gap-1.5 rounded-2xl border border-border/80 bg-muted/60 py-3.5 text-sm font-bold text-muted-foreground hover:bg-muted active:scale-95"
                title="Shortcut: S"
              >
                <SkipForward className="size-4" />
                <span>Skip Today</span>
              </button>
            </div>

            {/* Bottom Stepper Navigation & Shortcuts */}
            <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-bold hover:bg-muted disabled:opacity-30"
              >
                <ArrowLeft className="size-3.5" /> Previous
              </button>

              <div className="hidden items-center gap-2 text-[11px] sm:flex">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">Space</span> Done
                <span className="text-border">·</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">+</span> Step
                <span className="text-border">·</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">S</span> Skip
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="focus-ring inline-flex items-center gap-1 rounded-full bg-sidebar px-4 py-1.5 font-extrabold text-sidebar-foreground hover:bg-sidebar/90"
              >
                {isLast ? 'Finish Review' : 'Next'} <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Celebratory Finished Summary Screen */
          <div className="space-y-6 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/20 text-sidebar shadow-inner">
              <Trophy className="size-8 text-primary" />
            </div>

            <div>
              <div className="mono-label text-accent">Day Completed</div>
              <h2 className="mt-1 text-3xl font-black tracking-[-.05em] text-sidebar sm:text-4xl">
                Honest progress logged.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You took the time to review your day with clarity and without guilt.
              </p>
            </div>

            {/* Scoreboard summary card */}
            <div className="grid grid-cols-3 gap-3 rounded-[24px] bg-sidebar p-5 text-sidebar-foreground">
              <div>
                <div className="text-3xl font-black text-primary">{dailyScore}</div>
                <div className="mt-1 text-[11px] text-sidebar-foreground/60">daily score</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-3xl font-black text-accent">
                  <Flame className="size-6" /> {streak}
                </div>
                <div className="mt-1 text-[11px] text-sidebar-foreground/60">day streak</div>
              </div>
              <div>
                <div className="text-3xl font-black text-[#8dd7d8]">{focusMinutes}m</div>
                <div className="mt-1 text-[11px] text-sidebar-foreground/60">focus time</div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-xs font-bold text-sidebar">
              ✨ Consistency is built one honest day at a time. Rest well and return with fresh energy tomorrow.
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="focus-ring w-full rounded-full bg-primary py-3.5 text-sm font-black text-primary-foreground shadow-sm transition-transform active:scale-95"
              >
                Close Day with Honor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
