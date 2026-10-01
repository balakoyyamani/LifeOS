import webpush from "web-push";
import { logger } from "./logger";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@lifeos.app";

if (!vapidPublicKey || !vapidPrivateKey) {
  // Generate consistent development fallback keys if none supplied in env
  const generated = webpush.generateVAPIDKeys();
  vapidPublicKey = generated.publicKey;
  vapidPrivateKey = generated.privateKey;
  logger.info({ publicKey: vapidPublicKey }, "Generated dynamic VAPID keys for Web Push");
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  timestamp?: number;
  goalId?: number;
  actions?: Array<{ action: string; title: string }>;
}

export async function sendPushToSubscription(
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  payload: PushNotificationPayload,
): Promise<boolean> {
  try {
    const pushSub = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

    const stringified = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/today",
      icon: payload.icon || "/favicon.ico",
      badge: payload.badge || "/favicon.ico",
      tag: payload.tag || `lifeos-push-${Date.now()}`,
      timestamp: payload.timestamp || Date.now(),
      goalId: payload.goalId,
      actions: payload.actions || [
        { action: "open", title: "Open LifeOS" },
        { action: "snooze", title: "Snooze 10m" },
      ],
    });

    await webpush.sendNotification(pushSub, stringified, {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: "high",
    });

    return true;
  } catch (err: any) {
    logger.warn({ err: err?.message, statusCode: err?.statusCode }, "Push notification delivery failed");

    // If subscription is expired or uninstalled (410 Gone or 404 Not Found), clean it up from DB
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      try {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, subscription.endpoint));
        logger.info({ endpoint: subscription.endpoint }, "Pruned expired push subscription");
      } catch (dbErr) {
        logger.error({ dbErr }, "Failed to remove expired subscription");
      }
    }
    return false;
  }
}
