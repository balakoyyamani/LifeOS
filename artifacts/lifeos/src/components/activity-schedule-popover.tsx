import { useState } from 'react';
import {
  Bell,
  Check,
  Clock3,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import type { DailyGoal } from '@workspace/api-client-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/context/notification-context';
import {
  SCHEDULE_PRESETS,
  formatTime12h,
  isScheduleDueNow,
  removeGoalSchedule,
  triggerReminderAlert,
} from '@/lib/reminders';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function ActivitySchedulePopover({
  goal,
  className,
}: {
  goal: DailyGoal;
  className?: string;
}) {
  const { schedules, updateGoalSchedule } = useNotifications();
  const { toast } = useToast();

  const currentSchedule = schedules[goal.id];
  const [open, setOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState(currentSchedule?.time || '08:00');
  const [enabled, setEnabled] = useState(currentSchedule?.enabled ?? true);

  const isScheduled = Boolean(currentSchedule?.time && currentSchedule?.enabled);
  const isCompleted = goal.status === 'completed';
  const isSkipped = goal.status === 'skipped';
  const isDue = isScheduled && isScheduleDueNow(currentSchedule!.time) && !isCompleted && !isSkipped;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // Sync internal state with current schedule when opening
      setSelectedTime(currentSchedule?.time || '08:00');
      setEnabled(currentSchedule?.enabled ?? true);
    }
    setOpen(nextOpen);
  };

  const handleSave = () => {
    sound.playClick();
    updateGoalSchedule({
      goalId: goal.id,
      name: goal.name,
      time: selectedTime,
      enabled,
    });

    toast({
      title: enabled ? 'Reminder Scheduled ⏰' : 'Reminder Muted',
      description: enabled
        ? `We will alert you at ${formatTime12h(selectedTime)} for "${goal.name}".`
        : `Reminder alerts muted for "${goal.name}".`,
    });
    setOpen(false);
  };

  const handleRemove = () => {
    sound.playClick();
    removeGoalSchedule(goal.id);
    updateGoalSchedule({
      goalId: goal.id,
      name: goal.name,
      time: selectedTime,
      enabled: false,
    });

    toast({
      title: 'Schedule Removed',
      description: `Cleared scheduled time for "${goal.name}".`,
    });
    setOpen(false);
  };

  const handleTestAlert = () => {
    triggerReminderAlert(goal.name, formatTime12h(selectedTime));
    toast({
      title: `⏰ Test Alert: ${goal.name}`,
      description: `Simulated reminder for ${formatTime12h(selectedTime)}.`,
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'focus-ring inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-all active:scale-95 cursor-pointer',
            isDue
              ? 'border-amber-500/70 bg-amber-400/20 text-amber-800 ring-2 ring-amber-500/40 animate-pulse'
              : isScheduled
                ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                : 'border-border/70 bg-card/60 text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground',
            className,
          )}
          title={
            isScheduled
              ? `Scheduled at ${formatTime12h(currentSchedule.time)} (Click to change reminder)`
              : `Set a daily scheduled reminder time for "${goal.name}"`
          }
          data-testid={`button-schedule-goal-${goal.id}`}
        >
          <Clock3 className={cn('size-3', isDue ? 'text-amber-600' : isScheduled ? 'text-primary' : 'text-muted-foreground')} />
          <span>
            {isDue
              ? `Due now · ${formatTime12h(currentSchedule.time)}`
              : isScheduled
                ? formatTime12h(currentSchedule.time)
                : '+ Set Time'}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[300px] rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl backdrop-blur-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border/60 pb-3">
          <div>
            <div className="text-[10px] font-extrabold text-accent uppercase tracking-wider">
              Activity Reminder
            </div>
            <h4 className="mt-0.5 text-xs font-extrabold text-sidebar line-clamp-1">
              {goal.name}
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="focus-ring rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Time Selector */}
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sidebar">Target Time</span>
            <span className="font-mono text-xs font-extrabold text-primary">
              {formatTime12h(selectedTime)}
            </span>
          </div>

          <input
            type="time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="focus-ring w-full rounded-xl border border-input bg-background p-2 text-center font-mono text-base font-bold text-foreground"
          />

          {/* Quick Presets */}
          <div>
            <span className="mono-label text-[10px] text-muted-foreground">Quick Presets</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {SCHEDULE_PRESETS.map((p) => (
                <button
                  key={p.time}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSelectedTime(p.time);
                    setEnabled(true);
                  }}
                  className={cn(
                    'focus-ring flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-all active:scale-95',
                    selectedTime === p.time
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-border/70 bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Enable Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-2.5">
            <div className="flex items-center gap-2">
              <Bell className={cn('size-3.5', enabled ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-[11px] font-bold text-sidebar">Audio & Push Alerts</span>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={cn(
                'focus-ring relative h-5 w-9 shrink-0 rounded-full transition-colors',
                enabled ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-background shadow-xs transition-transform flex items-center justify-center',
                  enabled ? 'translate-x-4' : 'translate-x-0.5',
                )}
              >
                {enabled && <Check className="size-2 text-primary stroke-[3]" />}
              </span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleTestAlert}
              className="focus-ring inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Test chime & notification alert"
            >
              <Volume2 className="size-3.5 text-accent" />
            </button>
            {isScheduled && (
              <button
                type="button"
                onClick={handleRemove}
                className="focus-ring inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Remove schedule"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="focus-ring rounded-lg px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="focus-ring rounded-lg bg-primary px-3.5 py-1 text-xs font-bold text-primary-foreground shadow-2xs hover:opacity-90 active:scale-95"
            >
              Save Time
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
