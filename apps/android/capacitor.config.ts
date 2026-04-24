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
    backgroundColor: '#10b981',
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: true,  // DEBUG: для chrome://inspect
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'FIT_CENTER',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#10b981',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
