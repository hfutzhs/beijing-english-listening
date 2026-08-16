import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { speakText, stopSpeaking, isSpeechSupported } from '../lib/tts';

interface TTSPlayerProps {
  text: string;
  color: string;
  label?: string;
  playCount?: number; // for listen_retell: play twice
  onWordIndex?: (index: number) => void;
  words?: string[];
}

export function TTSPlayer({ text, color, label, playCount = 1, onWordIndex, words }: TTSPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playRound, setPlayRound] = useState(0);
  const controllerRef = useRef<ReturnType<typeof speakText> | null>(null);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handlePlay = useCallback(async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      setPlayRound(0);
      if (onWordIndex) onWordIndex(-1);
      return;
    }

    setLoading(true);
    const currentRound = playRound;

    const controller = await speakText(text, {
      rate: 0.95,
      onStart: () => {
        setLoading(false);
        setPlaying(true);
      },
      onBoundary: (charIndex) => {
        if (onWordIndex && words) {
          // Calculate word index from char index
          let pos = 0;
          let wordIdx = 0;
          for (let i = 0; i < words.length; i++) {
            if (pos >= charIndex) {
              wordIdx = i;
              break;
            }
            pos += words[i].length + 1;
            wordIdx = i + 1;
          }
          onWordIndex(Math.min(wordIdx, words.length - 1));
        }
      },
      onEnd: () => {
        setPlaying(false);
        if (onWordIndex) onWordIndex(-1);

        // For listen_retell: play twice
        if (currentRound < playCount - 1) {
          setPlayRound(currentRound + 1);
          setTimeout(() => {
            handlePlay();
          }, 500);
        } else {
          setPlayRound(0);
        }
      },
    });

    controllerRef.current = controller;
    setLoading(false);
  }, [playing, text, playRound, playCount, onWordIndex, words]);

  if (!isSpeechSupported()) {
    return (
      <div
        className="rounded-2xl py-4 px-5 flex items-center"
        style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
      >
        <Volume2 size={20} color="#EF4444" />
        <span className="ml-3 text-sm text-red-600">当前浏览器不支持语音合成</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handlePlay}
        disabled={loading}
        className="w-full rounded-2xl py-4 px-5 flex items-center transition-all active:scale-[0.98]"
        style={{
          backgroundColor: '#FFFFFF',
          border: `1px solid ${color}25`,
          boxShadow: `0 2px 8px ${color}10`,
        }}
      >
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ width: 44, height: 44, backgroundColor: color, flexShrink: 0 }}
        >
          {loading ? (
            <Loader2 size={18} color="#FFFFFF" className="animate-spin" />
          ) : playing ? (
            <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Volume2 size={18} color="#FFFFFF" />
          )}
        </div>
        <div className="flex-1 ml-3 text-left">
          <div className="text-sm font-bold" style={{ color: '#1F2937' }}>
            {loading ? '准备音频中...' : playing ? '正在播放' : (label || '播放听力原文')}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {playing ? `第 ${playRound + 1} / ${playCount} 遍 · 点击停止` : '点击播放'}
          </div>
        </div>
        {playing && (
          <div className="rounded-full animate-rec-pulse" style={{ width: 6, height: 6, backgroundColor: color }} />
        )}
      </button>
    </div>
  );
}
