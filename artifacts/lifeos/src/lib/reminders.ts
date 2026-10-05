import { sound } from '@/lib/sound';

export interface GoalSchedule {
  goalId: number;
  name?: string;
  time: string; // "HH:mm" (24-hour format, e.g. "08:30", "14:00")
  enabled: boolean;
  lastNotifiedDate?: string; // "YYYY-MM-DD"
  lastNotifiedAt?: number; // epoch ms of last alert (for recurring follow-up)
  followUpIntervalMinutes?: number; // follow up every N minutes (default: 20) until manually handled
  manuallyHandledDate?: string; // "YYYY-MM-DD" when user manually completed or updated it today
}

export interface NotificationItem {
  id: string;
  type: 'goal_reminder' | 'morning_kickoff' | 'evening_reflection' | 'streak_milestone' | 'system';
  title: string;
  message: string;
  timestamp: string; // ISO string
  goalId?: number;
  read: boolean;
  snoozedUntil?: string; // ISO string
  url?: string;
}

export interface RoutineRemindersLocal {
  morningKickoffEnabled: boolean;
  morningKickoffTime: string;
  eveningReflectionEnabled: boolean;
  eveningReflectionTime: string;
  lastMorningDate?: string;
  lastEveningDate?: string;
}

const SCHEDULE_STORAGE_KEY = 'lifeos_goal_schedules_registry';
const HISTORY_STORAGE_KEY = 'lifeos_notifications_history';
const SNOOZE_STORAGE_KEY = 'lifeos_snoozed_reminders';
const ROUTINE_STORAGE_KEY = 'lifeos_routine_reminders_local';

export const SCHEDULE_PRESETS = [
  { label: 'Morning', time: '08:00', icon: '🌅', hint: '8:00 AM' },
  { label: 'Midday', time: '12:30', icon: '☀️', hint: '12:30 PM' },
  { label: 'Deep Focus', time: '14:30', icon: '⚡', hint: '2:30 PM' },
  { label: 'Evening', time: '18:30', icon: '🌆', hint: '6:30 PM' },
  { label: 'Night Ritual', time: '21:00', icon: '🌙', hint: '9:00 PM' },
];

export function getGoalSchedules(): Record<number, GoalSchedule> {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getGoalSchedule(goalId: number): GoalSchedule | null {
  const all = getGoalSchedules();
  return all[goalId] || null;
}

export function saveGoalSchedule(schedule: GoalSchedule): void {
  try {
    const all = getGoalSchedules();
    all[schedule.goalId] = schedule;
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to save goal schedule:', err);
  }
}

export function removeGoalSchedule(goalId: number): void {
  try {
    const all = getGoalSchedules();
    delete all[goalId];
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to remove goal schedule:', err);
  }
}

export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return time24;

  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Check if scheduled time is due today (within current hour or past time today and incomplete)
export function isScheduleDueNow(time24: string): boolean {
  if (!time24 || !time24.includes(':')) return false;
  const now = new Date();
  const [hStr, mStr] = time24.split(':');
  const targetMinutes = Number(hStr) * 60 + Number(mStr);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Due if we are within 20 minutes before or after scheduled time
  const diff = currentMinutes - targetMinutes;
  return diff >= -5 && diff <= 45;
}

// Check if schedule time has arrived or passed today
export function isSchedulePastDue(time24: string): boolean {
  if (!time24 || !time24.includes(':')) return false;
  const now = new Date();
  const [hStr, mStr] = time24.split(':');
  const targetMinutes = Number(hStr) * 60 + Number(mStr);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= targetMinutes;
}

// Mark schedule manually handled for today (e.g. when completed, progress made, or rescheduled)
export function markScheduleHandledToday(goalId: number): void {
  const sched = getGoalSchedule(goalId);
  if (sched) {
    sched.manuallyHandledDate = getTodayDateString();
    saveGoalSchedule(sched);
  }
}


// Routine Reminders Management
export function getRoutineReminders(): RoutineRemindersLocal {
  try {
    const raw = localStorage.getItem(ROUTINE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    morningKickoffEnabled: true,
    morningKickoffTime: '08:30',
    eveningReflectionEnabled: true,
    eveningReflectionTime: '21:00',
  };
}

export function saveRoutineReminders(config: RoutineRemindersLocal): void {
  try {
    localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save routine reminders:', err);
  }
}

// Notification History & Log
export function getNotificationHistory(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addNotificationToHistory(item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): NotificationItem {
  try {
    const list = getNotificationHistory();
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [newItem, ...list].slice(0, 50); // Keep max 50 items
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (err) {
    console.error('Failed to append notification to history:', err);
    return {
      ...item,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
  }
}

export function markNotificationRead(id: string): void {
  try {
    const list = getNotificationHistory();
    const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function markAllNotificationsRead(): void {
  try {
    const list = getNotificationHistory();
    const updated = list.map((n) => ({ ...n, read: true }));
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearNotificationHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {}
}

// Snooze Management
export function snoozeReminder(key: string, minutes = 10): void {
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    const snoozes: Record<string, number> = raw ? JSON.parse(raw) : {};
    snoozes[key] = Date.now() + minutes * 60 * 1000;
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(snoozes));
  } catch {}
}

export function isReminderSnoozed(key: string): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!raw) return false;
    const snoozes: Record<string, number> = JSON.parse(raw);
    const expiry = snoozes[key];
    if (!expiry) return false;
    if (Date.now() < expiry) return true;
    // Expired, clean up
    delete snoozes[key];
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(snoozes));
    return false;
  } catch {
    return false;
  }
}

// Browser Desktop Notifications
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
}

export function sendBrowserNotification(
  title: string,
  body: string,
  options?: { url?: string; tag?: string; onClick?: () => void },
) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: options?.tag || `lifeos-reminder-${Date.now()}`,
    });

    notif.onclick = () => {
      window.focus();
      if (options?.onClick) {
        options.onClick();
      } else if (options?.url && typeof window !== 'undefined') {
        window.location.href = options.url;
      }
      notif.close();
    };
  } catch (err) {
    console.warn('Browser notification error:', err);
  }
}

export function triggerReminderAlert(
  goalName: string,
  timeFormatted: string,
  onOpen?: () => void,
) {
  // Respect quiet mode
  const isQuiet = typeof localStorage !== 'undefined' && localStorage.getItem('lifeos-quiet') === 'true';

  if (!isQuiet) {
    sound.playReminderChime();
  }

  sendBrowserNotification(
    `⏰ Time for: ${goalName}`,
    `Scheduled for ${timeFormatted}. Maintain your rhythm!`,
    {
      url: '/today',
      onClick: onOpen,
    },
  );
}

// Daily Roadmap & Schedule Stations Support
export type DayStation = 'morning' | 'midday' | 'evening' | 'night' | 'flexible';

export interface StationConfig {
  station: DayStation;
  label: string;
  timeRange: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
}

export const STATION_CONFIGS: Record<DayStation, StationConfig> = {
  morning: {
    station: 'morning',
    label: 'Morning Horizon',
    timeRange: '05:00 – 11:59',
    icon: '🌅',
    badgeBg: 'bg-amber-500/10 border-amber-500/20',
    badgeText: 'text-amber-800 dark:text-amber-300',
  },
  midday: {
    station: 'midday',
    label: 'Midday & Deep Focus',
    timeRange: '12:00 – 16:59',
    icon: '☀️',
    badgeBg: 'bg-sky-500/10 border-sky-500/20',
    badgeText: 'text-sky-800 dark:text-sky-300',
  },
  evening: {
    station: 'evening',
    label: 'Evening Descent',
    timeRange: '17:00 – 20:59',
    icon: '🌆',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/20',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
  },
  night: {
    station: 'night',
    label: 'Night Wind-Down',
    timeRange: '21:00 – 04:59',
    icon: '🌙',
    badgeBg: 'bg-purple-500/10 border-purple-500/20',
    badgeText: 'text-purple-800 dark:text-purple-300',
  },
  flexible: {
    station: 'flexible',
    label: 'Flexible / Anytime Today',
    timeRange: 'Unscheduled',
    icon: '🎒',
    badgeBg: 'bg-muted border-border/70',
    badgeText: 'text-muted-foreground',
  },
};

export function getScheduleStation(time24?: string): DayStation {
  if (!time24 || !time24.includes(':')) return 'flexible';
  const [hStr] = time24.split(':');
  const h = Number(hStr);
  if (isNaN(h)) return 'flexible';
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'midday';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function sortGoalsByScheduleTime<T extends { id: number; priority?: number }>(
  goals: T[],
  schedules: Record<number, GoalSchedule>,
): T[] {
  return [...goals].sort((a, b) => {
    const schedA = schedules[a.id];
    const schedB = schedules[b.id];
    const timeA = schedA?.enabled && schedA?.time ? schedA.time : null;
    const timeB = schedB?.enabled && schedB?.time ? schedB.time : null;

    if (timeA && timeB) {
      return timeA.localeCompare(timeB);
    }
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;

    // Both unscheduled: order by priority (1 is highest)
    const prioA = a.priority ?? 2;
    const prioB = b.priority ?? 2;
    return prioA - prioB;
  });
}

