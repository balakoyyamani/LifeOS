import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock3 } from 'lucide-react';
import {
  type GoalSchedule,
  type NotificationItem,
  type RoutineRemindersLocal,
  addNotificationToHistory,
  clearNotificationHistory,
  formatTime12h,
  getGoalSchedules,
  getNotificationHistory,
  getNotificationPermission,
  getRoutineReminders,
  getTodayDateString,
  isNotificationSupported,
  isReminderSnoozed,
  markAllNotificationsRead,
  markNotificationRead,
  requestNotificationPermission,
  saveGoalSchedule,
  saveRoutineReminders,
  sendBrowserNotification,
  snoozeReminder,
} from '@/lib/reminders';
import {
  getPushSubscription,
  isPushSupported,
  subscribeToPush,
  testClosedAppPush,
  unsubscribeFromPush,
  updateRemindersConfig,
} from '@/lib/push-service';
import { sound } from '@/lib/sound';
import { useToast } from '@/hooks/use-toast';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  schedules: Record<number, GoalSchedule>;
  routineConfig: RoutineRemindersLocal;
  permission: NotificationPermission | 'unsupported';
  isPushActive: boolean;
  pushSupported: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  snooze: (id: string, goalId?: number, minutes?: number) => void;
  triggerTestAlert: () => void;
  triggerTestClosedAppPush: (delaySeconds?: number) => Promise<{ success: boolean; message?: string; error?: string }>;
  enableClosedAppPush: () => Promise<boolean>;
  disableClosedAppPush: () => Promise<boolean>;
  updateGoalSchedule: (schedule: GoalSchedule) => void;
  updateRoutineConfig: (config: Partial<RoutineRemindersLocal>) => void;
  refreshPermissions: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotificationHistory);
  const [schedules, setSchedules] = useState<Record<number, GoalSchedule>>(getGoalSchedules);
  const [routineConfig, setRoutineConfig] = useState<RoutineRemindersLocal>(getRoutineReminders);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(getNotificationPermission);
  const [isPushActive, setIsPushActive] = useState(false);
  const pushSupported = useMemo(() => isPushSupported(), []);

  const refreshPermissions = useCallback(() => {
    setPermission(getNotificationPermission());
    if (pushSupported) {
      void getPushSubscription().then((sub) => {
        setIsPushActive(Boolean(sub));
      });
    }
  }, [pushSupported]);

  // Check push subscription on load
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAsRead = useCallback((id: string) => {
    markNotificationRead(id);
    setNotifications(getNotificationHistory());
  }, []);

  const markAllAsRead = useCallback(() => {
    markAllNotificationsRead();
    setNotifications(getNotificationHistory());
  }, []);

  const clearAll = useCallback(() => {
    clearNotificationHistory();
    setNotifications([]);
  }, []);

  const snooze = useCallback((id: string, goalId?: number, minutes = 10) => {
    const key = goalId ? `goal-${goalId}` : `notif-${id}`;
    snoozeReminder(key, minutes);
    markNotificationRead(id);
    setNotifications(getNotificationHistory());

    toast({
      title: 'Reminder Snoozed ⏳',
      description: `We will nudge you again in ${minutes} minutes.`,
    });
  }, [toast]);

  const updateGoalSchedule = useCallback((sched: GoalSchedule) => {
    saveGoalSchedule(sched);
    const updated = getGoalSchedules();
    setSchedules(updated);

    // Sync to backend so closed-app server dispatcher has the updated schedule
    void updateRemindersConfig({
      goalSchedules: updated,
    });
  }, []);

  const updateRoutineConfig = useCallback((partial: Partial<RoutineRemindersLocal>) => {
    setRoutineConfig((prev) => {
      const next = { ...prev, ...partial };
      saveRoutineReminders(next);

      // Sync to backend
      void updateRemindersConfig({
        morningKickoffEnabled: next.morningKickoffEnabled,
        morningKickoffTime: next.morningKickoffTime,
        eveningReflectionEnabled: next.eveningReflectionEnabled,
        eveningReflectionTime: next.eveningReflectionTime,
      });

      return next;
    });
  }, []);

  const enableClosedAppPush = useCallback(async (): Promise<boolean> => {
    const res = await subscribeToPush();
    refreshPermissions();
    if (res.success) {
      // Sync current schedules & routine preferences to server
      await updateRemindersConfig({
        morningKickoffEnabled: routineConfig.morningKickoffEnabled,
        morningKickoffTime: routineConfig.morningKickoffTime,
        eveningReflectionEnabled: routineConfig.eveningReflectionEnabled,
        eveningReflectionTime: routineConfig.eveningReflectionTime,
        goalSchedules: schedules,
      });

      toast({
        title: 'Closed-App Push Connected! 🔔',
        description: 'You will receive reminders even when LifeOS tabs are closed.',
      });
      return true;
    } else {
      toast({
        title: 'Push Permission Needed',
        description: res.error || 'Please grant notification permissions in your browser.',
        variant: 'destructive',
      });
      return false;
    }
  }, [refreshPermissions, routineConfig, schedules, toast]);

  const disableClosedAppPush = useCallback(async (): Promise<boolean> => {
    const ok = await unsubscribeFromPush();
    refreshPermissions();
    toast({
      title: 'Closed-App Push Disabled',
      description: 'You will now only receive in-app alerts.',
    });
    return ok;
  }, [refreshPermissions, toast]);

  const triggerTestAlert = useCallback(() => {
    const isQuiet = localStorage.getItem('lifeos-quiet') === 'true';
    if (!isQuiet) {
      sound.playReminderChime();
    }

    sendBrowserNotification(
      '⏰ Test Reminder Alert',
      'LifeOS reminder engine is active and ready to keep you on rhythm.',
      { url: '/today' },
    );

    const item = addNotificationToHistory({
      type: 'system',
      title: '⏰ Test Alert Triggered',
      message: 'LifeOS audio and notification engines are fully operational.',
      url: '/today',
    });

    setNotifications(getNotificationHistory());

    toast({
      title: '⏰ Test Alert Triggered!',
      description: 'Audio chime, browser alert, and notification tray verified.',
    });
  }, [toast]);

  const triggerTestClosedAppPush = useCallback(async (delaySeconds = 5) => {
    return await testClosedAppPush(delaySeconds);
  }, []);

  // Background Daemon: Runs across ALL pages every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayStr = getTodayDateString();
      const isQuiet = localStorage.getItem('lifeos-quiet') === 'true';

      // 1. Check Goal Reminders
      const currentSchedules = getGoalSchedules();
      Object.values(currentSchedules).forEach((schedule) => {
        if (
          schedule.enabled &&
          schedule.time === currentHHMM &&
          schedule.lastNotifiedDate !== todayStr &&
          !isReminderSnoozed(`goal-${schedule.goalId}`)
        ) {
          schedule.lastNotifiedDate = todayStr;
          saveGoalSchedule(schedule);
          setSchedules(getGoalSchedules());

          const goalName = schedule.name || 'Your scheduled habit';

          if (!isQuiet) {
            sound.playReminderChime();
          }

          sendBrowserNotification(
            `⏰ Time for: ${goalName}`,
            `Scheduled for ${formatTime12h(schedule.time)}. Maintain your rhythm!`,
            { url: `/today?goalId=${schedule.goalId}` },
          );

          const notif = addNotificationToHistory({
            type: 'goal_reminder',
            title: `⏰ Time for: ${goalName}`,
            message: `Scheduled for ${formatTime12h(schedule.time)}. Maintain your daily rhythm!`,
            goalId: schedule.goalId,
            url: `/today?goalId=${schedule.goalId}`,
          });

          setNotifications(getNotificationHistory());

          toast({
            title: `⏰ Time for: ${goalName}`,
            description: `Scheduled for ${formatTime12h(schedule.time)}. Ready to take action?`,
            action: (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    snooze(notif.id, schedule.goalId, 10);
                  }}
                  className="focus-ring inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <Clock3 className="size-3 text-muted-foreground" />
                  Snooze
                </button>
              </div>
            ),
          });
        }
      });

      // 2. Check Morning Kickoff
      const routine = getRoutineReminders();
      if (
        routine.morningKickoffEnabled &&
        routine.morningKickoffTime === currentHHMM &&
        routine.lastMorningDate !== todayStr &&
        !isReminderSnoozed('routine-morning')
      ) {
        routine.lastMorningDate = todayStr;
        saveRoutineReminders(routine);
        setRoutineConfig(routine);

        if (!isQuiet) {
          sound.playReminderChime();
        }

        sendBrowserNotification(
          '🌅 Morning Focus Kickoff',
          'Plan your day, set top intentions, and establish your daily rhythm.',
          { url: '/today?action=morning' },
        );

        addNotificationToHistory({
          type: 'morning_kickoff',
          title: '🌅 Morning Focus Kickoff',
          message: 'Plan your day, set intentions, and establish your daily rhythm.',
          url: '/today?action=morning',
        });

        setNotifications(getNotificationHistory());

        toast({
          title: '🌅 Morning Focus Kickoff',
          description: 'Time to set today’s top commitments and ignite your momentum.',
        });
      }

      // 3. Check Evening Reflection
      if (
        routine.eveningReflectionEnabled &&
        routine.eveningReflectionTime === currentHHMM &&
        routine.lastEveningDate !== todayStr &&
        !isReminderSnoozed('routine-evening')
      ) {
        routine.lastEveningDate = todayStr;
        saveRoutineReminders(routine);
        setRoutineConfig(routine);

        if (!isQuiet) {
          sound.playEveningBell();
        }

        sendBrowserNotification(
          '🌙 Evening Reflection & Wind-Down',
          'Celebrate your wins, reflect on today, and close your loops.',
          { url: '/today?action=evening' },
        );

        addNotificationToHistory({
          type: 'evening_reflection',
          title: '🌙 Evening Reflection & Wind-Down',
          message: 'Celebrate your wins, reflect on today, and close your loops.',
          url: '/today?action=evening',
        });

        setNotifications(getNotificationHistory());

        toast({
          title: '🌙 Evening Reflection & Wind-Down',
          description: 'Take 2 minutes to review your day, capture signal, and rest.',
        });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [snooze, toast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        schedules,
        routineConfig,
        permission,
        isPushActive,
        pushSupported,
        markAsRead,
        markAllAsRead,
        clearAll,
        snooze,
        triggerTestAlert,
        triggerTestClosedAppPush,
        enableClosedAppPush,
        disableClosedAppPush,
        updateGoalSchedule,
        updateRoutineConfig,
        refreshPermissions,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
