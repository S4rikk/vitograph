import { useState, useEffect, useCallback } from 'react';

// --- Utility ---
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Detect Capacitor native platform */
const isCapacitorNative = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
};

/** Get Capacitor PushNotifications plugin via global bridge */
const getCapacitorPush = (): any | null => {
  return (window as any).Capacitor?.Plugins?.PushNotifications ?? null;
};

export function usePushNotifications(token?: string) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [platform, setPlatform] = useState<'web' | 'capacitor' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isCapacitorNative()) {
      const cap = getCapacitorPush();
      if (cap) {
        setPlatform('capacitor');
        setIsSupported(true);
        // Check if already registered by looking for stored state
        const stored = localStorage.getItem('vg_fcm_subscribed');
        setIsSubscribed(stored === 'true');
      }
    } else if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPlatform('web');
      setIsSupported(true);
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        }).catch(err => console.error("Error checking subscription:", err));
      }).catch(err => console.error("Error getting SW ready:", err));
    }
  }, []);

  const getBearerToken = useCallback(async () => {
    let bearerToken = token;
    if (!bearerToken) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) bearerToken = session.access_token;
      } catch (e) {}
    }
    return bearerToken;
  }, [token]);

  // ── Capacitor FCM Subscribe ──
  const subscribeCapacitor = useCallback(async () => {
    const cap = getCapacitorPush();
    if (!cap) return false;

    setIsPushLoading(true);
    try {
      // 1. Request permissions
      const permResult = await cap.requestPermissions();
      if (permResult.receive !== 'granted') {
        window.alert('❌ Разрешите уведомления в настройках устройства!');
        return false;
      }

      // 2. Listen for registration event BEFORE registering (prevent race condition)
      return new Promise<boolean>(async (resolve) => {
        let isResolved = false;
        let regListener: any;
        let errListener: any;

        const cleanup = () => {
          if (regListener) regListener.remove();
          if (errListener) errListener.remove();
        };

        const timeout = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          console.error('[Push] FCM registration timeout');
          window.alert('❌ Таймаут регистрации FCM. Попробуйте ещё раз.');
          setIsPushLoading(false);
          resolve(false);
        }, 15000);

        regListener = await cap.addListener('registration', async (fcmData: { value: string }) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          cleanup();

          const fcmToken = fcmData.value;
          console.log('[Push] FCM token received:', fcmToken.slice(0, 20) + '...');

          // 4. Send to backend
          const bearerToken = await getBearerToken();
          const response = await fetch('/api/v1/ai/push/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {}),
            },
            body: JSON.stringify({ fcm_token: fcmToken, type: 'fcm' }),
          });

          setIsPushLoading(false);
          if (response.ok) {
            localStorage.setItem('vg_fcm_subscribed', 'true');
            localStorage.setItem('vg_fcm_token', fcmToken);
            setIsSubscribed(true);
            window.alert('🔔 Напоминания о воде включены!');
            resolve(true);
          } else {
            console.error('[Push] Backend Error:', response.status);
            window.alert('❌ Ошибка сохранения подписки на сервере');
            resolve(false);
          }
        });

        errListener = await cap.addListener('registrationError', (err: any) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          cleanup();
          console.error('[Push] FCM registration error:', err);
          window.alert(`❌ Ошибка регистрации: ${err?.error || 'Unknown'}`);
          setIsPushLoading(false);
          resolve(false);
        });

        // 2. NOW call register
        try {
          // Создаем канал перед регистрацией, это может предотвратить зависание Firebase на некоторых Android
          await cap.createChannel({
            id: 'vitograph_default',
            name: 'Напоминания',
            description: 'Уведомления о приеме воды',
            importance: 4, // High
            visibility: 1, // Public
          });
          await cap.register();
        } catch(e) {
          if (!isResolved) {
             isResolved = true;
             clearTimeout(timeout);
             cleanup();
             setIsPushLoading(false);
             window.alert(`❌ Ошибка вызова register: ${e}`);
             resolve(false);
          }
        }
      });
    } catch (error) {
      console.error('[Push] Capacitor subscribe error:', error);
      window.alert(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsPushLoading(false);
    }
  }, [getBearerToken]);

  // ── Capacitor FCM Unsubscribe ──
  const unsubscribeCapacitor = useCallback(async () => {
    setIsPushLoading(true);
    try {
      const fcmToken = localStorage.getItem('vg_fcm_token');
      const bearerToken = await getBearerToken();
      
      await fetch('/api/v1/ai/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify({ type: 'fcm', fcm_token: fcmToken }),
      });

      localStorage.removeItem('vg_fcm_subscribed');
      localStorage.removeItem('vg_fcm_token');
      setIsSubscribed(false);
      window.alert('🔕 Напоминания отключены.');
      return true;
    } catch (err) {
      console.error('[Push] Capacitor unsubscribe error:', err);
      return false;
    } finally {
      setIsPushLoading(false);
    }
  }, [getBearerToken]);

  // ── Web Push Subscribe (existing logic, unchanged) ──
  const subscribeWeb = useCallback(async () => {
    if (!isSupported) {
      console.warn("Push notifications are not supported in this browser.");
      return false;
    }

    setIsPushLoading(true);

    // Timeout helper
    const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms));
      return Promise.race([promise, timeout]);
    };

    try {
      // 1. Request permission with a long timeout (in case the prompt hangs or user stares at it)
      const permission = await withTimeout(
        Notification.requestPermission(),
        60000, 
        "Таймаут: Окно разрешений не ответило."
      );
      
      if (permission !== 'granted') {
         console.warn("Notification permission denied by user");
         window.alert("❌ Ошибка: Включите разрешения на уведомления в настройках браузера!");
         return false;
      }

      // 2. Register Service Worker
      let registration: ServiceWorkerRegistration;
      try {
        registration = await withTimeout(navigator.serviceWorker.register('/sw.js'), 10000, "Таймаут: Регистрация Service Worker зависла.");
        await withTimeout(navigator.serviceWorker.ready, 10000, "Таймаут: Service Worker не активировался.");
      } catch (e) {
        throw new Error(`Service Worker Error: ${e instanceof Error ? e.message : e}`);
      }

      // 3. Subscribe via PushManager
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
         throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing!");
      }

      let subscription: PushSubscription;
      try {
        subscription = await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          }),
          15000,
          "Таймаут: PushManager системы не ответил. Попробуйте обновить страницу."
        );
      } catch (e) {
        throw new Error(`PushManager Error: ${e instanceof Error ? e.message : e}`);
      }

      // 4. Send subscription to our backend endpoint
      const bearerToken = await getBearerToken();
      
      const response = await fetch('/api/v1/ai/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {})
        },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`Failed to save subscription on backend: ${errorText}`);
      }

      console.log("Push subscription successful and saved to backend");
      setIsSubscribed(true);
      window.alert("🔔 Напоминания о воде включены!");
      return true;
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      window.alert(`❌ Ошибка подписки. Подробнее: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsPushLoading(false);
    }
  }, [getBearerToken, isSupported]);

  // ── Web Push Unsubscribe (existing logic, unchanged) ──
  const unsubscribeWeb = useCallback(async () => {
    if (!isSupported) return false;
    
    setIsPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return true;
      }

      await subscription.unsubscribe();

      const bearerToken = await getBearerToken();
      const response = await fetch('/api/v1/ai/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {})
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      if (!response.ok) {
         console.warn(`Failed to delete subscription on backend: ${await response.text()}`);
      }

      setIsSubscribed(false);
      window.alert("🔕 Напоминания отключены.");
      return true;
    } catch (err) {
      console.error("Error unsubscribing:", err);
      return false;
    } finally {
      setIsPushLoading(false);
    }
  }, [getBearerToken, isSupported]);

  // ── Public API: route to correct implementation ──
  const subscribe = useCallback(async () => {
    if (platform === 'capacitor') return subscribeCapacitor();
    return subscribeWeb();
  }, [platform, subscribeCapacitor, subscribeWeb]);

  const unsubscribe = useCallback(async () => {
    if (platform === 'capacitor') return unsubscribeCapacitor();
    return unsubscribeWeb();
  }, [platform, unsubscribeCapacitor, unsubscribeWeb]);

  return { isSupported, isSubscribed, isPushLoading, subscribe, unsubscribe };
}
