// Browser SpeechSynthesis API wrapper for TTS.
// Replaces server-side TTS service - all audio is generated client-side.

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let voices = synth.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }
    // Voices may load asynchronously
    const handler = () => {
      voices = synth.getVoices();
      if (voices.length > 0) {
        cachedVoices = voices;
        synth.removeEventListener('voiceschanged', handler);
        resolve(voices);
      }
    };
    synth.addEventListener('voiceschanged', handler);
    // Fallback timeout
    setTimeout(() => resolve(synth.getVoices()), 1000);
  });
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // Prefer en-US, then any en
  return (
    voices.find(v => v.lang === 'en-US' && /female|samantha|victoria|karen/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null
  );
}

export interface TTSController {
  stop: () => void;
}

export async function speakText(
  text: string,
  options?: { rate?: number; onBoundary?: (charIndex: number) => void; onEnd?: () => void; onStart?: () => void }
): Promise<TTSController> {
  const synth = window.speechSynthesis;
  synth.cancel(); // Stop any ongoing speech

  const voices = cachedVoices.length > 0 ? cachedVoices : await loadVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickEnglishVoice(voices);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  utterance.rate = options?.rate ?? 0.95;
  utterance.pitch = 1.0;

  if (options?.onBoundary) {
    utterance.onboundary = (e) => options.onBoundary!(e.charIndex);
  }
  if (options?.onEnd) utterance.onend = () => options.onEnd!();
  if (options?.onStart) utterance.onstart = () => options.onStart!();

  synth.speak(utterance);

  return {
    stop: () => synth.cancel(),
  };
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Preload voices on module import
if (isSpeechSupported()) {
  loadVoices();
}
