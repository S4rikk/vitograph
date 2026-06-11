/**
 * Lightweight FCM sender using Google Auth Library + fetch().
 * No firebase-admin dependency needed.
 */
import { GoogleAuth } from 'google-auth-library';

let authClient: GoogleAuth | null = null;
let cachedCredentials: any = null;

function getCredentials(): any {
  if (cachedCredentials) return cachedCredentials;

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is missing');
  }

  let cleanJson = rawJson.trim();
  // Strip outer single or double quotes if present
  if ((cleanJson.startsWith("'") && cleanJson.endsWith("'")) ||
      (cleanJson.startsWith('"') && cleanJson.endsWith('"'))) {
    cleanJson = cleanJson.substring(1, cleanJson.length - 1).trim();
  }

  try {
    cachedCredentials = JSON.parse(cleanJson);
    return cachedCredentials;
  } catch (e) {
    console.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', (e as Error).message);
    console.error('[FCM] First 50 chars:', cleanJson.substring(0, 50));
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON');
  }
}

function getAuth(): GoogleAuth {
  if (authClient) return authClient;

  const credentials = getCredentials();

  authClient = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });

  return authClient;
}

/**
 * Send a push notification via FCM HTTP v1 API.
 * @returns true if sent successfully, false if token is invalid (should be deleted)
 */
export async function sendFcmNotification(
  fcmToken: string,
  title: string,
  body: string
): Promise<{ success: boolean; shouldDelete: boolean }> {
  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const credentials = getCredentials();
    const projectId = credentials.project_id;

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            android: {
              priority: 'high',
              notification: {
                channel_id: 'water_reminders',
                icon: 'ic_notification',
              },
            },
          },
        }),
      }
    );

    if (response.ok) {
      return { success: true, shouldDelete: false };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorCode = (errorData as any)?.error?.details?.[0]?.errorCode;

    // Token is invalid/expired — should be deleted
    if (response.status === 404 || response.status === 410 ||
        errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
      console.warn(`[FCM] Token invalid, marking for deletion: ${fcmToken.slice(0, 20)}...`);
      return { success: false, shouldDelete: true };
    }

    console.error(`[FCM] Send failed (${response.status}):`, errorData);
    return { success: false, shouldDelete: false };
  } catch (err) {
    console.error('[FCM] Error sending notification:', err);
    return { success: false, shouldDelete: false };
  }
}
