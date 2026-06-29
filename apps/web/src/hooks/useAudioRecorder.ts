import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
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
    return new Promise((resolve, reject) => {
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
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
