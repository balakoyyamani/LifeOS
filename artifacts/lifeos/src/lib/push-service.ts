// Web Push and Service Worker registration client for LifeOS

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const reg = await registerServiceWorker();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('Failed to retrieve push subscription:', err);
    return null;
  }
}

const DEFAULT_VAPID_PUBLIC_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) ||
  'BMmc_Ki3stxLXjExZuKGtlSiRwXb_FXv-NWwWktnujFAUr0fnOAkwifXLer3vYNqRjp7QdZmk3dh-8j95wxqoq4';

export async function subscribeToPush(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push is not supported in this browser.' };
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied or dismissed.' };
    }

    // 2. Fetch server VAPID public key with static fallback
    let publicKey = DEFAULT_VAPID_PUBLIC_KEY;
    try {
      const res = await fetch('/api/push/vapid-key');
      if (res.ok) {
        const data = await res.json();
        if (data?.publicKey) {
          publicKey = data.publicKey;
        }
      }
    } catch {
      // Fallback to DEFAULT_VAPID_PUBLIC_KEY
    }

    // 3. Register service worker and subscribe
    const reg = await registerServiceWorker();
    if (!reg) {
      throw new Error('Service worker is unavailable in this environment.');
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    // 4. Save subscription to backend
    const subJSON = sub.toJSON();
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        subscription: subJSON,
        userAgent: navigator.userAgent,
      }),
    });

    if (!saveRes.ok) {
      if (saveRes.status === 404) {
        return {
          success: true,
          subscription: sub,
          error: undefined,
        };
      }
      const errData = await saveRes.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned ${saveRes.status}`);
    }

    return { success: true, subscription: sub };
  } catch (err: any) {
    console.error('Subscription error:', err);
    return { success: false, error: err?.message || 'Failed to subscribe to Web Push' };
  }
}


export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const reg = await registerServiceWorker();
    if (!reg) return false;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.warn('Unsubscribe error:', err);
    return false;
  }
}

export async function triggerTestPush(delaySeconds = 0): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ delaySeconds }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to trigger test push' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error triggering test' };
  }
}

export const testClosedAppPush = triggerTestPush;


export interface UserRemindersConfigPayload {
  morningKickoffEnabled?: boolean;
  morningKickoffTime?: string;
  eveningReflectionEnabled?: boolean;
  eveningReflectionTime?: string;
  goalRemindersEnabled?: boolean;
  goalSchedules?: Record<string, any>;
  timezone?: string;
}

export async function fetchRemindersConfig(): Promise<UserRemindersConfigPayload | null> {
  try {
    const res = await fetch('/api/reminders/config', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function updateRemindersConfig(
  config: UserRemindersConfigPayload,
): Promise<UserRemindersConfigPayload | null> {
  try {
    const res = await fetch('/api/reminders/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
