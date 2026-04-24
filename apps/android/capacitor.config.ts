import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sanderok.vitograph',
  appName: 'Vitograph',
  webDir: 'www',
  server: {
    url: 'https://vitograph.com',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0ea5e9',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,  // DEBUG: для chrome://inspect
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0ea5e9',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
