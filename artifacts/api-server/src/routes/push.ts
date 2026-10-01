import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, pushSubscriptionsTable, userRemindersConfigTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getOrCreateUser } from "../lib/lifeos";
import { getVapidPublicKey, sendPushToSubscription } from "../lib/webpush";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Public endpoint so client can retrieve VAPID public key
router.get("/push/vapid-key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// Authenticated endpoints
router.use(requireAuth);

router.post("/push/subscribe", async (req, res): Promise<void> => {
  try {
    const { subscription, userAgent } = req.body || {};
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      res.status(400).json({ error: "Invalid subscription payload" });
      return;
    }

    const user = await getOrCreateUser(req.userId!);

    // Upsert subscription
    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || req.headers["user-agent"] || null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          userId: user.id,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || req.headers["user-agent"] || null,
          updatedAt: new Date(),
        },
      });

    logger.info({ userId: user.id, endpoint: subscription.endpoint }, "Registered Web Push subscription");
    res.json({ success: true, message: "Push subscription saved" });
  } catch (err: any) {
    logger.error({ err }, "Error saving push subscription");
    res.status(500).json({ error: "Failed to save push subscription" });
  }
});

router.post("/push/unsubscribe", async (req, res): Promise<void> => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      res.status(400).json({ error: "Endpoint required" });
      return;
    }

    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    res.json({ success: true, message: "Unsubscribed" });
  } catch (err) {
    logger.error({ err }, "Error deleting push subscription");
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// Test push endpoint: can optionally delay by N seconds so user can close their tab and verify!
router.post("/push/test", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const delaySeconds = Math.min(60, Math.max(0, Number(req.body?.delaySeconds || 0)));

    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, user.id));

    if (!subs.length) {
      res.status(400).json({
        error: "No active push subscription registered for this user. Please enable push notifications first.",
      });
      return;
    }

    res.json({
      success: true,
      message: delaySeconds > 0
        ? `Test notification scheduled! Close this tab now — alert will fire in ${delaySeconds} seconds.`
        : "Test notification dispatched immediately.",
      deviceCount: subs.length,
      delaySeconds,
    });

    const triggerPush = async () => {
      for (const sub of subs) {
        await sendPushToSubscription(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          {
            title: "🔔 LifeOS Closed-App Alert",
            body: "Success! LifeOS notifications reach you even when your browser tab is closed.",
            url: "/today",
            actions: [
              { action: "open", title: "Open LifeOS" },
              { action: "dismiss", title: "Got it" },
            ],
          },
        );
      }
    };

    if (delaySeconds > 0) {
      setTimeout(() => {
        void triggerPush();
      }, delaySeconds * 1000);
    } else {
      void triggerPush();
    }
  } catch (err: any) {
    logger.error({ err }, "Error running test push");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to trigger test push" });
    }
  }
});

// User Reminders Config
router.get("/reminders/config", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const [existing] = await db
      .select()
      .from(userRemindersConfigTable)
      .where(eq(userRemindersConfigTable.userId, user.id))
      .limit(1);

    if (existing) {
      res.json(existing);
      return;
    }

    // Default config
    const [created] = await db
      .insert(userRemindersConfigTable)
      .values({
        userId: user.id,
        morningKickoffEnabled: true,
        morningKickoffTime: "08:30",
        eveningReflectionEnabled: true,
        eveningReflectionTime: "21:00",
        goalRemindersEnabled: true,
        timezone: user.timezone || "Asia/Calcutta",
      })
      .returning();

    res.json(created);
  } catch (err) {
    logger.error({ err }, "Error fetching reminders config");
    res.status(500).json({ error: "Failed to get reminders config" });
  }
});

router.post("/reminders/config", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const body = req.body || {};

    const [existing] = await db
      .select()
      .from(userRemindersConfigTable)
      .where(eq(userRemindersConfigTable.userId, user.id))
      .limit(1);

    const values = {
      morningKickoffEnabled: body.morningKickoffEnabled !== undefined ? Boolean(body.morningKickoffEnabled) : true,
      morningKickoffTime: typeof body.morningKickoffTime === "string" ? body.morningKickoffTime : "08:30",
      eveningReflectionEnabled: body.eveningReflectionEnabled !== undefined ? Boolean(body.eveningReflectionEnabled) : true,
      eveningReflectionTime: typeof body.eveningReflectionTime === "string" ? body.eveningReflectionTime : "21:00",
      goalRemindersEnabled: body.goalRemindersEnabled !== undefined ? Boolean(body.goalRemindersEnabled) : true,
      goalSchedules: body.goalSchedules !== undefined ? body.goalSchedules : (existing?.goalSchedules || {}),
      timezone: typeof body.timezone === "string" ? body.timezone : user.timezone || "Asia/Calcutta",
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db
        .update(userRemindersConfigTable)
        .set(values)
        .where(eq(userRemindersConfigTable.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(userRemindersConfigTable)
        .values({
          userId: user.id,
          ...values,
        })
        .returning();
      res.json(created);
    }
  } catch (err) {
    logger.error({ err }, "Error updating reminders config");
    res.status(500).json({ error: "Failed to update reminders config" });
  }
});

export default router;
