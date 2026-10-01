import { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  Flame,
  Info,
  Moon,
  Radio,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/context/notification-context';
import { formatTime12h } from '@/lib/reminders';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    schedules,
    routineConfig,
    isPushActive,
    pushSupported,
    markAsRead,
    markAllAsRead,
    clearAll,
    snooze,
    triggerTestAlert,
    enableClosedAppPush,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'schedule'>('alerts');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    try {
      await enableClosedAppPush();
    } finally {
      setIsSubscribing(false);
    }
  };

  // Compile today's schedule items sorted by time
  const scheduleItems = [
    ...(routineConfig.morningKickoffEnabled
      ? [
          {
            id: 'routine-morning',
            time: routineConfig.morningKickoffTime,
            name: 'Morning Focus Kickoff',
            icon: '🌅',
            type: 'routine',
            url: '/today?action=morning',
          },
        ]
      : []),
    ...Object.values(schedules)
      .filter((s) => s.enabled)
      .map((s) => ({
        id: `goal-${s.goalId}`,
        time: s.time,
        name: s.name || `Scheduled Habit #${s.goalId}`,
        icon: '⏰',
        type: 'activity',
        url: `/today?goalId=${s.goalId}`,
      })),
    ...(routineConfig.eveningReflectionEnabled
      ? [
          {
            id: 'routine-evening',
            time: routineConfig.eveningReflectionTime,
            name: 'Evening Reflection & Wind-Down',
            icon: '🌙',
            type: 'routine',
            url: '/today?action=evening',
          },
        ]
      : []),
  ].sort((a, b) => a.time.localeCompare(b.time));


  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.round(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="focus-ring relative flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition hover:border-primary/50 hover:bg-muted/60 hover:text-foreground active:scale-95"
          aria-label="Notification Center"
          data-testid="button-notification-center"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-extrabold text-accent-foreground shadow-xs animate-pulse"
              data-testid="badge-unread-notifications"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-32px)] rounded-2xl border border-border/80 bg-card/95 p-0 shadow-2xl backdrop-blur-xl animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-sidebar">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="focus-ring flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Mark all as read"
              >
                <CheckCheck className="size-3.5" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="focus-ring flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                title="Clear history"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border/60 bg-muted/20 px-2 pt-1.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={cn(
              'focus-ring flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 font-bold transition-all',
              activeTab === 'alerts'
                ? 'border-primary text-sidebar font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="size-1.5 rounded-full bg-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={cn(
              'focus-ring flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 font-bold transition-all',
              activeTab === 'schedule'
                ? 'border-primary text-sidebar font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Today's Schedule</span>
            <span className="mono-label text-[10px] text-muted-foreground">
              ({scheduleItems.length})
            </span>
          </button>
        </div>

        {/* Closed-App Push Status Callout */}
        {pushSupported && (
          <div className="border-b border-border/50 bg-muted/40 px-4 py-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Radio
                  className={cn(
                    'size-3.5',
                    isPushActive ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground',
                  )}
                />
                <span className="font-semibold text-sidebar">
                  {isPushActive ? 'Closed-Tab Push Active ✓' : 'Closed-Tab Alerts Disabled'}
                </span>
              </div>
              {!isPushActive && (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={isSubscribing}
                  className="focus-ring rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-sidebar transition hover:bg-primary/30"
                >
                  {isSubscribing ? 'Connecting…' : 'Enable'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Alerts History */}
        {activeTab === 'alerts' && (
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border/40 p-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Sparkles className="size-4 text-accent" />
                </div>
                <div className="mt-2.5 text-xs font-bold text-sidebar">All quiet and on rhythm</div>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-[200px]">
                  Scheduled habit reminders and reflection nudges will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group relative flex flex-col gap-1.5 rounded-xl p-3 transition-colors text-xs',
                    !item.read ? 'bg-primary/5 font-medium' : 'hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">
                        {item.type === 'morning_kickoff'
                          ? '🌅'
                          : item.type === 'evening_reflection'
                            ? '🌙'
                            : item.type === 'streak_milestone'
                              ? '🏆'
                              : '⏰'}
                      </span>
                      <span className="font-bold text-sidebar line-clamp-1">{item.title}</span>
                    </div>
                    <span className="mono-label text-[10px] text-muted-foreground shrink-0">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="mt-1 flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      {item.goalId && (
                        <button
                          type="button"
                          onClick={() => snooze(item.id, item.goalId, 10)}
                          className="focus-ring inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
                          title="Remind me again in 10 minutes"
                        >
                          <Clock3 className="size-2.5 text-muted-foreground" />
                          <span>+10m</span>
                        </button>
                      )}
                      {item.url && (
                        <Link
                          href={item.url}
                          onClick={() => {
                            markAsRead(item.id);
                            setOpen(false);
                          }}
                          className="focus-ring inline-flex items-center gap-1 rounded-md bg-sidebar px-2 py-0.5 text-[10px] font-bold text-sidebar-foreground hover:opacity-90"
                        >
                          <span>Open</span>
                          <ExternalLink className="size-2.5" />
                        </Link>
                      )}
                    </div>
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(item.id)}
                        className="focus-ring text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Today's Schedule */}
        {activeTab === 'schedule' && (
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border/40 p-2 space-y-1">
            {scheduleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Clock3 className="size-8 text-muted-foreground/50" />
                <div className="mt-2 text-xs font-bold text-sidebar">No timed reminders set</div>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-[220px]">
                  Add target times to daily habits to orchestrate your rhythm.
                </p>
              </div>
            ) : (
              scheduleItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.url || '/today'}
                  onClick={() => setOpen(false)}
                  className="group flex items-center justify-between rounded-xl p-2.5 text-xs hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-sidebar line-clamp-1 group-hover:text-primary transition-colors">
                        {item.name}
                      </div>
                      <span className="mono-label text-[10px] text-muted-foreground capitalize">
                        {item.type}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                    {formatTime12h(item.time)}
                  </span>
                </Link>
              ))

            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3.5 py-2.5 text-[11px]">
          <button
            type="button"
            onClick={triggerTestAlert}
            className="focus-ring inline-flex items-center gap-1.5 font-bold text-muted-foreground hover:text-foreground"
          >
            <Volume2 className="size-3 text-accent" />
            <span>Test Sound & Alert</span>
          </button>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="focus-ring inline-flex items-center gap-1 font-bold text-sidebar hover:underline"
          >
            <Settings className="size-3" />
            <span>Preferences</span>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
