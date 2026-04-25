/**
 * Lightweight FCM sender using Google Auth Library + fetch().
 * No firebase-admin dependency needed.
 */
import { GoogleAuth } from 'google-auth-library';

let authClient: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (authClient) return authClient;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is missing');
  }

  const credentials = JSON.parse(serviceAccountJson);
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

    const projectId = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!).project_id;

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
