// Browser SpeechRecognition API wrapper for ASR.
// Replaces server-side ASR service - all recognition is client-side.

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function isASRSupported(): boolean {
  return typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
}

export interface ASRResult {
  transcript: string;
  error?: string;
}

export interface ASRController {
  stop: () => void;
  promise: Promise<ASRResult>;
}

interface ASROptions {
  onInterim?: (text: string) => void;
  onEnd?: () => void;
}

export function recognizeSpeech(options?: ASROptions): ASRController {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    return {
      stop: () => {},
      promise: Promise.resolve({ transcript: '', error: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.' }),
    };
  }

  const recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';
  let resolveFn: ((result: ASRResult) => void) | null = null;

  const promise = new Promise<ASRResult>((resolve) => {
    resolveFn = resolve;
  });

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }
    if (options?.onInterim && interim) {
      options.onInterim(finalTranscript + interim);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (resolveFn) {
      resolveFn({ transcript: finalTranscript, error: event.error });
    }
  };

  recognition.onend = () => {
    if (options?.onEnd) options.onEnd();
    if (resolveFn) {
      resolveFn({ transcript: finalTranscript.trim() });
    }
  };

  try {
    recognition.start();
  } catch (e) {
    if (resolveFn) resolveFn({ transcript: '', error: 'Failed to start recognition' });
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    },
    promise,
  };
}
