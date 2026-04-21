import { useState, useEffect } from 'react';

// Утилита для конвертации VAPID ключа
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(token?: string) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        }).catch(err => console.error("Error checking subscription:", err));
      }).catch(err => console.error("Error getting SW ready:", err));
    }
  }, []);

  const getBearerToken = async () => {
    let bearerToken = token;
    if (!bearerToken) {
      try {
         const { createClient } = await import("@/lib/supabase/client");
         const supabase = createClient();
         const { data: { session } } = await supabase.auth.getSession();
         if (session) bearerToken = session.access_token;
      } catch(e) {}
    }
    return bearerToken;
  };

  const subscribe = async () => {
    if (!isSupported) {
      console.warn("Push notifications are not supported in this browser.");
      return false;
    }

    setIsPushLoading(true);
    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
         console.warn("Notification permission denied by user");
         window.alert("❌ Ошибка: Включите разрешения на уведомления в настройках браузера!");
         return false;
      }

      // 2. Register Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 3. Subscribe via PushManager
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
         throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not defined in environment");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // 4. Send subscription to our backend endpoint
      const bearerToken = await getBearerToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/ai/push/subscribe`, {
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
  };

  const unsubscribe = async () => {
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/ai/push/unsubscribe`, {
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
  };

  return { isSupported, isSubscribed, isPushLoading, subscribe, unsubscribe };
}
