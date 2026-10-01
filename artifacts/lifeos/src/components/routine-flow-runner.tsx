import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Flame,
  Layers,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import type { DailyGoal, GoalStatus } from '@workspace/api-client-react';
import { ROUTINE_CONFIGS, type RoutineType } from '@/lib/routines';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ModalPortal } from '@/components/modal-portal';

interface RoutineFlowRunnerProps {
  routine: RoutineType;
  goals: DailyGoal[];
  onClose: () => void;
  onUpdateGoal: (goal: DailyGoal, value: number, status?: GoalStatus) => void;
}

export function RoutineFlowRunner({
  routine,
  goals,
  onClose,
  onUpdateGoal,
}: RoutineFlowRunnerProps) {
  const { toast } = useToast();
  const config = ROUTINE_CONFIGS[routine];

  // Start with the first incomplete habit if possible
  const initialIndex = useMemo(() => {
    const firstIncomplete = goals.findIndex((g) => g.status !== 'completed');
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  }, [goals]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [localValues, setLocalValues] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    goals.forEach((g) => {
      map[g.id] = g.currentValue;
    });
    return map;
  });

  const [isCompleted, setIsCompleted] = useState(false);

  const currentGoal = goals[currentIndex];
  const nextGoal = currentIndex < goals.length - 1 ? goals[currentIndex + 1] : null;

  // Keyboard navigation: Space = complete & next, Right = next, Left = prev
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, goals.length, isCompleted]);

  const handleAdjustValue = (delta: number) => {
    if (!currentGoal) return;
    sound.playClick();
    const cur = localValues[currentGoal.id] ?? currentGoal.currentValue;
    const nextVal = Math.min(
      currentGoal.targetValue,
      Math.max(0, Math.round((cur + delta) * 10) / 10),
    );
    setLocalValues((prev) => ({ ...prev, [currentGoal.id]: nextVal }));
    onUpdateGoal(
      currentGoal,
      nextVal,
      nextVal >= currentGoal.targetValue ? 'completed' : 'in_progress',
    );
  };

  const handleCompleteCurrentAndNext = () => {
    if (!currentGoal) return;
    sound.playComplete();

    // Mark current complete
    const targetVal = currentGoal.targetValue;
    setLocalValues((prev) => ({ ...prev, [currentGoal.id]: targetVal }));
    onUpdateGoal(currentGoal, targetVal, 'completed');

    // Advance to next or finish
    if (currentIndex < goals.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      sound.playCelebration();
      setIsCompleted(true);
    }
  };

  const handleNext = () => {
    sound.playClick();
    if (currentIndex < goals.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      sound.playClick();
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const completedGoalsCount = goals.filter((g) => {
    const val = localValues[g.id] ?? g.currentValue;
    return val >= g.targetValue || g.status === 'completed';
  }).length;

  const routineProgressPct = Math.round((completedGoalsCount / goals.length) * 100);

  if (!currentGoal) {
    return null;
  }

  const currentVal = localValues[currentGoal.id] ?? currentGoal.currentValue;
  const isGoalDone = currentVal >= currentGoal.targetValue || currentGoal.status === 'completed';
  const goalProgressPct = Math.min(100, Math.round((currentVal / currentGoal.targetValue) * 100));

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-6 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
      >
        <div
          className="relative flex max-h-[85vh] sm:max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Top Routine Status Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-2xl">
              {config.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono-label text-muted-foreground">{config.label}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                  Flow Mode
                </span>
              </div>
              <h2 className="text-lg font-black text-sidebar">
                Step {currentIndex + 1} of {goals.length}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-sidebar">
                {completedGoalsCount} of {goals.length} Completed
              </div>
              <div className="mt-1 h-1.5 w-28 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${routineProgressPct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Exit Flow Mode"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {!isCompleted ? (
          /* Center Stage: Active Habit Card */
          <div className="flex flex-1 flex-col justify-between p-6 sm:p-8 space-y-6 overflow-y-auto modal-scroll">
            {/* Philosophical Prompt */}
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 text-xs text-muted-foreground italic flex items-center justify-between">
              <span>"{config.quote}"</span>
              <span className="text-[10px] font-mono opacity-60 not-italic">
                {config.timeHint}
              </span>
            </div>

            {/* Current Active Habit Spotlight */}
            <div className="space-y-4 rounded-3xl border border-primary/30 bg-primary/5 p-6 sm:p-8 text-center shadow-xs">
              <div className="flex items-center justify-center gap-2">
                <span className="mono-label text-primary font-bold uppercase tracking-wider">
                  Active Focus
                </span>
                <span className="rounded-full bg-sidebar px-2.5 py-0.5 text-[10px] font-extrabold text-sidebar-foreground capitalize">
                  {currentGoal.category}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-sidebar tracking-tight">
                {currentGoal.name}
              </h3>

              {/* Progress Metric Ring / Big Display */}
              <div className="py-2">
                <div className="font-mono text-4xl sm:text-5xl font-black text-primary">
                  {currentVal}{' '}
                  <span className="text-lg sm:text-xl font-bold text-muted-foreground">
                    / {currentGoal.targetValue} {currentGoal.unit}
                  </span>
                </div>
                <div className="mt-3 mx-auto max-w-sm">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${goalProgressPct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] font-mono text-muted-foreground">
                    <span>{goalProgressPct}% achieved</span>
                    <span>Target: {currentGoal.targetValue} {currentGoal.unit}</span>
                  </div>
                </div>
              </div>

              {/* Tactile Delta Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleAdjustValue(-1)}
                  disabled={currentVal <= 0}
                  className="focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted active:scale-95 disabled:opacity-40"
                >
                  <Minus className="size-3.5" />
                  <span>-1</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustValue(1)}
                  disabled={isGoalDone}
                  className="focus-ring inline-flex items-center gap-1 rounded-full border border-primary/40 bg-card px-4 py-1.5 text-xs font-extrabold text-foreground hover:bg-primary/10 hover:border-primary active:scale-95 disabled:opacity-40"
                >
                  <Plus className="size-3.5 text-primary" />
                  <span>+1 {currentGoal.unit}</span>
                </button>
                {currentGoal.targetValue >= 10 && (
                  <button
                    type="button"
                    onClick={() => handleAdjustValue(5)}
                    disabled={isGoalDone}
                    className="focus-ring inline-flex items-center gap-1 rounded-full border border-primary/40 bg-card px-3.5 py-1.5 text-xs font-extrabold text-foreground hover:bg-primary/10 hover:border-primary active:scale-95 disabled:opacity-40"
                  >
                    <Plus className="size-3.5 text-primary" />
                    <span>+5</span>
                  </button>
                )}
              </div>
            </div>

            {/* Next Habit Stack Peek */}
            {nextGoal && (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="mono-label text-muted-foreground text-[10px]">Up Next:</span>
                  <span className="font-bold text-sidebar">{nextGoal.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({nextGoal.targetValue} {nextGoal.unit})
                  </span>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </div>
            )}

            {/* Bottom Controls */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={handlePrev}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="focus-ring rounded-full px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Skip for Now
                </button>
              </div>

              <button
                type="button"
                onClick={handleCompleteCurrentAndNext}
                className="focus-ring inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-xs font-extrabold text-primary-foreground shadow-md transition-transform hover:opacity-90 active:scale-95"
              >
                <Check className="size-4 stroke-[3]" />
                <span>
                  {isGoalDone ? 'Confirmed' : 'Mark Done'} & Next Habit →
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* Routine Completed Celebratory Screen */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center space-y-6 animate-fade-in">
            <div className="grid size-20 place-items-center rounded-3xl bg-primary/10 text-primary shadow-lg animate-bounce">
              <CheckCircle2 className="size-10" />
            </div>

            <div className="space-y-2">
              <div className="mono-label text-primary font-bold">Flow Complete</div>
              <h3 className="text-3xl font-black text-sidebar">
                {config.label} Locked In!
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                You successfully flowed through every habit in this routine with zero hesitation. Momentum is completely on your side.
              </p>
            </div>

            {/* Completed Checklist */}
            <div className="w-full max-w-md rounded-2xl border border-border/80 bg-muted/20 p-4 text-left space-y-2.5">
              <div className="text-[11px] font-bold text-muted-foreground border-b border-border/60 pb-2">
                Routine Breakdown ({goals.length} Habits)
              </div>
              {goals.map((g) => (
                <div key={g.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary stroke-[3]" />
                    <span className="font-bold text-sidebar">{g.name}</span>
                  </div>
                  <span className="font-mono text-muted-foreground">
                    {g.targetValue} {g.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full bg-sidebar px-8 py-3 text-xs font-extrabold text-sidebar-foreground shadow-md hover:bg-sidebar/90 active:scale-95"
              >
                Complete Flow Mode
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
