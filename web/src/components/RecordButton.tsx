import { Mic, Square, Play, Pause, Loader2 } from 'lucide-react';

interface RecordButtonProps {
  recording: boolean;
  recordedUrl: string | null;
  playing: boolean;
  transcribing: boolean;
  recordingTime: number;
  color: string;
  onStart: () => void;
  onStop: () => void;
  onPlay: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordButton({
  recording,
  recordedUrl,
  playing,
  transcribing,
  recordingTime,
  color,
  onStart,
  onStop,
  onPlay,
}: RecordButtonProps) {
  return (
    <div>
      <button
        onClick={recording ? onStop : onStart}
        disabled={transcribing}
        className="w-full rounded-2xl py-4 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-60"
        style={{
          backgroundColor: recording ? '#EF4444' : color,
          boxShadow: `0 6px 12px ${recording ? 'rgba(239,68,68,0.2)' : color + '33'}`,
        }}
      >
        {transcribing ? (
          <>
            <Loader2 size={18} color="#FFFFFF" className="animate-spin" />
            <span className="text-white text-base font-bold ml-2">语音识别中...</span>
          </>
        ) : recording ? (
          <>
            <div className="rounded-full animate-rec-pulse" style={{ width: 10, height: 10, backgroundColor: '#FFFFFF' }} />
            <span className="text-white text-base font-bold ml-2">停止录音 · {formatTime(recordingTime)}</span>
          </>
        ) : (
          <>
            <Mic size={18} color="#FFFFFF" />
            <span className="text-white text-base font-bold ml-2">
              {recordedUrl ? '重新录音' : '开始录音'}
            </span>
          </>
        )}
      </button>

      {recordedUrl && !recording && !transcribing && (
        <button
          onClick={onPlay}
          className="w-full rounded-2xl py-3.5 flex items-center justify-center mt-3 transition-all active:scale-[0.98]"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E7E5E4',
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          }}
        >
          {playing ? (
            <Pause size={14} color="#78716C" />
          ) : (
            <Play size={14} color="#78716C" />
          )}
          <span className="text-stone-600 font-semibold ml-2">
            {playing ? '暂停播放' : '播放我的录音'}
          </span>
        </button>
      )}
    </div>
  );
}
