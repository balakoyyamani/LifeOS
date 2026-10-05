import { db, pushSubscriptionsTable, userRemindersConfigTable, remindersTable } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";
import { logger } from "./logger";
import { sendPushToSubscription } from "./webpush";

let schedulerInterval: NodeJS.Timeout | null = null;

function getCurrentHHMMInTimezone(timeZone: string): { hhmm: string; todayStr: string } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);

    let year = "";
    let month = "";
    let day = "";
    let hour = "";
    let minute = "";

    for (const p of parts) {
      if (p.type === "year") year = p.value;
      if (p.type === "month") month = p.value;
      if (p.type === "day") day = p.value;
      if (p.type === "hour") hour = p.value;
      if (p.type === "minute") minute = p.value;
    }

    if (hour === "24") hour = "00";

    return {
      hhmm: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
      todayStr: `${year}-${month}-${day}`,
    };
  } catch {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    const todayStr = now.toISOString().slice(0, 10);
    return { hhmm: `${hh}:${mm}`, todayStr };
  }
}

export async function checkAndDispatchReminders() {
  try {
    const configs = await db.select().from(userRemindersConfigTable);
    if (!configs.length) return;

    for (const config of configs) {
      const timezone = config.timezone || "Asia/Calcutta";
      const { hhmm, todayStr } = getCurrentHHMMInTimezone(timezone);

      // Find user push subscriptions
      const subscriptions = await db
        .select()
        .from(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.userId, config.userId));

      if (!subscriptions.length) continue;

      const pushAll = async (payload: { title: string; body: string; url?: string; goalId?: number }) => {
        for (const sub of subscriptions) {
          await sendPushToSubscription(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        }
      };

      // 0. Check One-time and Scheduled Reminders from remindersTable
      try {
        const dueReminders = await db
          .select()
          .from(remindersTable)
          .where(
            and(
              eq(remindersTable.userId, config.userId),
              eq(remindersTable.status, "pending"),
              lte(remindersTable.remindAt, new Date()),
            ),
          );

        for (const rem of dueReminders) {
          logger.info({ userId: config.userId, reminderId: rem.id }, "Dispatching custom reminder push");
          await pushAll({
            title: `🔔 ${rem.title}`,
            body: rem.message,
            url: "/today",
            goalId: rem.goalId || undefined,
          });
          await db
            .update(remindersTable)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(remindersTable.id, rem.id));
        }
      } catch (err) {
        logger.debug({ err }, "Could not query pending reminders in dispatcher cycle");
      }

      // 1. Check Morning Kickoff
      if (
        config.morningKickoffEnabled &&
        config.morningKickoffTime === hhmm &&
        config.lastMorningNotifiedDate !== todayStr
      ) {
        logger.info({ userId: config.userId, hhmm }, "Dispatching Morning Kickoff push");
        await pushAll({
          title: "🌅 Morning Focus Kickoff",
          body: "Plan your day, set intentions, and establish your rhythm in LifeOS.",
          url: "/today?action=morning",
        });

        await db
          .update(userRemindersConfigTable)
          .set({ lastMorningNotifiedDate: todayStr })
          .where(eq(userRemindersConfigTable.id, config.id));
      }

      // 2. Check Evening Reflection
      if (
        config.eveningReflectionEnabled &&
        config.eveningReflectionTime === hhmm &&
        config.lastEveningNotifiedDate !== todayStr
      ) {
        logger.info({ userId: config.userId, hhmm }, "Dispatching Evening Reflection push");
        await pushAll({
          title: "🌙 Evening Reflection & Wind-Down",
          body: "Review today's momentum, reflect on what went well, and log signal.",
          url: "/today?action=evening",
        });

        await db
          .update(userRemindersConfigTable)
          .set({ lastEveningNotifiedDate: todayStr })
          .where(eq(userRemindersConfigTable.id, config.id));
      }

      // 3. Check Synced Goal Schedules (if present in config.goalSchedules)
      if (config.goalRemindersEnabled && config.goalSchedules) {
        const schedules = config.goalSchedules as Record<
          string,
          {
            goalId: number;
            name?: string;
            time: string;
            enabled: boolean;
            lastNotifiedDate?: string;
            lastNotifiedAt?: number;
            followUpIntervalMinutes?: number;
            manuallyHandledDate?: string;
          }
        >;

        let modified = false;
        const nowMs = Date.now();
        const [curH, curM] = hhmm.split(":").map(Number);
        const curMinutesTotal = (curH || 0) * 60 + (curM || 0);

        for (const key of Object.keys(schedules)) {
          const item = schedules[key];
          if (!item || !item.enabled) continue;
          if (item.manuallyHandledDate === todayStr) continue;

          const [itemH, itemM] = (item.time || "08:00").split(":").map(Number);
          const itemMinutesTotal = (itemH || 0) * 60 + (itemM || 0);

          const isInitial = item.time === hhmm && item.lastNotifiedDate !== todayStr;
          const followUpIntervalMs = (item.followUpIntervalMinutes || 20) * 60 * 1000;
          const isFollowUp =
            item.lastNotifiedDate === todayStr &&
            curMinutesTotal >= itemMinutesTotal &&
            nowMs - (item.lastNotifiedAt || 0) >= followUpIntervalMs;

          if (isInitial || isFollowUp) {
            item.lastNotifiedDate = todayStr;
            item.lastNotifiedAt = nowMs;
            modified = true;

            const goalName = item.name || "Daily Commitment";
            const title = isFollowUp ? `⏳ Follow-up: ${goalName}` : `⏰ Time for: ${goalName}`;
            const body = isFollowUp
              ? `Scheduled for ${item.time} is still pending. Ready to tackle it?`
              : `Scheduled for ${item.time}. Ready to maintain your rhythm?`;

            logger.info({ userId: config.userId, goalId: item.goalId, hhmm, isFollowUp }, "Dispatching Goal reminder push");

            await pushAll({
              title,
              body,
              url: `/today?goalId=${item.goalId}`,
              goalId: item.goalId,
            });
          }
        }

        if (modified) {
          await db
            .update(userRemindersConfigTable)
            .set({ goalSchedules: schedules })
            .where(eq(userRemindersConfigTable.id, config.id));
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Error checking and dispatching scheduled reminders");
  }
}

export function startScheduleDispatcher() {
  if (schedulerInterval) return;

  logger.info("Starting background Web Push schedule dispatcher (interval: 30s)...");
  // Check every 30 seconds so we never miss a minute boundary
  schedulerInterval = setInterval(() => {
    void checkAndDispatchReminders();
  }, 30000);
}

export function stopScheduleDispatcher() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("Schedule dispatcher stopped.");
  }
}
