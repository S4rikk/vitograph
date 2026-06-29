import { useState, useRef, useCallback } from 'react';

// Helper to convert base64 to Blob for Capacitor
function base64ToBlob(base64: string, mimeType: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const VoiceRecorder = (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.VoiceRecorder);
      
      if (VoiceRecorder) {
        // Native Capacitor Plugin path
        const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
        if (!hasPermission.value) {
          const request = await VoiceRecorder.requestAudioRecordingPermission();
          if (!request.value) {
            throw new Error('Нет доступа к микрофону на устройстве.');
          }
        }
        await VoiceRecorder.startRecording();
        setIsRecording(true);
        return;
      }

      // Standard Web path
      if (typeof window !== 'undefined' && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
        throw new Error('Браузер заблокировал доступ к микрофону. Убедитесь, что сайт открыт по безопасному протоколу HTTPS.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      const VoiceRecorder = (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.VoiceRecorder);
      
      if (VoiceRecorder && isRecording && !mediaRecorderRef.current) {
        // Native Capacitor Plugin path
        try {
          const result = await VoiceRecorder.stopRecording();
          setIsRecording(false);
          const blob = base64ToBlob(result.value.recordDataBase64, result.value.mimeType);
          resolve(blob);
        } catch (err) {
          reject(err);
        }
        return;
      }

      // Standard Web path
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) {
        reject(new Error('No active recorder'));
        return;
      }

      mediaRecorder.onstop = () => {
        const type = chunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        setIsRecording(false);
        chunksRef.current = [];
        
        // Stop all tracks to release the microphone
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, [isRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
