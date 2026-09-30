import type { DailyGoal } from '@workspace/api-client-react';
import { sound } from '@/lib/sound';

export interface GoalSchedule {
  goalId: number;
  time: string; // "HH:mm" (24-hour format, e.g. "08:30", "14:00")
  enabled: boolean;
  lastNotifiedDate?: string; // "YYYY-MM-DD" to avoid repeated reminders on the same day
}

const STORAGE_KEY = 'lifeos_goal_schedules_registry';

export const SCHEDULE_PRESETS = [
  { label: 'Morning', time: '08:00', icon: '🌅', hint: '8:00 AM' },
  { label: 'Midday', time: '12:30', icon: '☀️', hint: '12:30 PM' },
  { label: 'Deep Focus', time: '14:30', icon: '⚡', hint: '2:30 PM' },
  { label: 'Evening', time: '18:30', icon: '🌆', hint: '6:30 PM' },
  { label: 'Night Ritual', time: '21:00', icon: '🌙', hint: '9:00 PM' },
];

export function getGoalSchedules(): Record<number, GoalSchedule> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to save goal schedule:', err);
  }
}

export function removeGoalSchedule(goalId: number): void {
  try {
    const all = getGoalSchedules();
    delete all[goalId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
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

export function sendBrowserNotification(title: string, body: string, icon = '⏰') {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `lifeos-reminder-${Date.now()}`,
    });
  } catch (err) {
    console.warn('Browser notification error:', err);
  }
}

export function triggerReminderAlert(
  goalName: string,
  timeFormatted: string,
  onOpen?: () => void,
) {
  // Play procedural audio chime
  sound.playReminderChime();

  // Trigger system notification if granted
  sendBrowserNotification(
    `⏰ Time for: ${goalName}`,
    `Scheduled for ${timeFormatted}. Maintain your rhythm!`,
  );
}
