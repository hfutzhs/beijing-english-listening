import { useState, useRef, useCallback } from 'react';
import { recognizeSpeech, isASRSupported, type ASRController } from '../lib/asr';

interface AudioRecorderState {
  recording: boolean;
  recordedUrl: string | null;
  playing: boolean;
  transcribing: boolean;
  interimText: string;
  recordingTime: number;
  error: string | null;
}

interface AudioRecorderActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ audioUrl: string | null; transcript: string }>;
  playRecording: () => void;
  reset: () => void;
}

export function useAudioRecorder(): AudioRecorderState & AudioRecorderActions {
  const [state, setState] = useState<AudioRecorderState>({
    recording: false,
    recordedUrl: null,
    playing: false,
    transcribing: false,
    interimText: '',
    recordingTime: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const asrControllerRef = useRef<ASRController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    setState(s => ({ ...s, error: null, interimText: '', recording: true, recordingTime: 0 }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();

      // Start ASR if supported
      if (isASRSupported()) {
        asrControllerRef.current = recognizeSpeech({
          onInterim: (text) => {
            setState(s => ({ ...s, interimText: text }));
          },
        });
      }

      // Start timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(s => ({ ...s, recordingTime: elapsed }));
      }, 1000);
    } catch (e: any) {
      setState(s => ({ ...s, recording: false, error: e.message || '无法访问麦克风，请检查权限设置。' }));
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<{ audioUrl: string | null; transcript: string }> => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop ASR and get transcript
    let transcript = '';
    if (asrControllerRef.current) {
      setState(s => ({ ...s, transcribing: true }));
      const result = await asrControllerRef.current.promise;
      transcript = result.transcript;
      asrControllerRef.current = null;
      setState(s => ({ ...s, transcribing: false }));
    }

    // Stop MediaRecorder and create audio URL
    let audioUrl: string | null = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            audioUrl = URL.createObjectURL(blob);
            audioUrlRef.current = audioUrl;
          }
          resolve();
        };
        recorder.stop();
      });
    }

    setState(s => ({
      ...s,
      recording: false,
      recordedUrl: audioUrl,
      interimText: transcript,
    }));

    return { audioUrl, transcript };
  }, []);

  const playRecording = useCallback(() => {
    if (!audioUrlRef.current) return;

    if (state.playing) {
      audioElementRef.current?.pause();
      setState(s => ({ ...s, playing: false }));
      return;
    }

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(audioUrlRef.current);
      audioElementRef.current.onended = () => {
        setState(s => ({ ...s, playing: false }));
      };
    }

    audioElementRef.current.play();
    setState(s => ({ ...s, playing: true }));
  }, [state.playing]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (asrControllerRef.current) asrControllerRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setState({
      recording: false,
      recordedUrl: null,
      playing: false,
      transcribing: false,
      interimText: '',
      recordingTime: 0,
      error: null,
    });
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    playRecording,
    reset,
  };
}
