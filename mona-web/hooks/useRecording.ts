"use client";

import { useState, useRef, useCallback } from "react";
import { TtsEngine, LipSyncMode } from "@/components/SettingsModal";
import { ToastType } from "@/contexts/ToastContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface UseRecordingDeps {
  isConnected: boolean;
  sendMessage: (content: string, imageBase64?: string, ttsEngine?: string, lipSyncMode?: string) => void;
  ttsEngine: TtsEngine;
  lipSyncMode: LipSyncMode;
  enableAudio: () => Promise<void>;
  showToast?: (msg: string, type?: ToastType) => void;
}

export function useRecording({ isConnected, sendMessage, ttsEngine, lipSyncMode, enableAudio, showToast }: UseRecordingDeps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcribedText = data.text;

      if (transcribedText && transcribedText.trim()) {
        if (isConnected) {
          sendMessage(transcribedText.trim(), undefined, ttsEngine, lipSyncMode);
        }
      }
    } catch (error) {
      showToast?.('Voice transcription failed. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [isConnected, sendMessage, ttsEngine, lipSyncMode]);

  const startRecording = useCallback(async () => {
    await enableAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      showToast?.('Microphone access denied. Please allow mic access.', 'error');
    }
  }, [enableAudio, transcribeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
  };
}
