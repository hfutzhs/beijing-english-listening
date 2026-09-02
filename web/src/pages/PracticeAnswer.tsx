import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, XCircle, Lightbulb, FileText, BarChart3, BookMarked, Send } from 'lucide-react';
import { fetchQuestionDetail, fetchQuestions, submitPractice } from '../lib/api';
import { useDeviceId } from '../hooks/useDeviceId';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useResponsive } from '../hooks/useResponsive';
import { TTSPlayer } from '../components/TTSPlayer';
import { RecordButton } from '../components/RecordButton';
import { ResultCard } from '../components/ResultCard';
import type { Question, QuestionType, PracticeRecord, ListenChooseContent, ListenAnswerContent, ListenRetellContent, ReadAloudContent } from '../types';

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  listen_choose: { label: '听后选择', color: '#0EA5E9' },
  listen_answer: { label: '听后回答', color: '#059669' },
  listen_retell: { label: '听后转述', color: '#7C3AED' },
  read_aloud: { label: '短文朗读', color: '#EA580C' },
};

function getScoreColor(ratio: number): string {
  if (ratio >= 0.8) return '#10B981';
  if (ratio >= 0.6) return '#F59E0B';
  return '#EF4444';
}

export default function PracticeAnswer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const { isTablet, contentPadding, maxContentWidth } = useResponsive();
  const recorder = useAudioRecorder();

  const questionId = Number(searchParams.get('questionId'));
  const qType = (searchParams.get('type') || 'listen_choose') as QuestionType;

  const [question, setQuestion] = useState<Question | null>(null);
  const [siblingQuestions, setSiblingQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PracticeRecord | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const resultRef = useRef<HTMLDivElement>(null);

  const config = TYPE_CONFIG[qType] || TYPE_CONFIG.listen_choose;
  const contentWidth = isTablet ? maxContentWidth : '100%';

  // Load question and siblings (same type + same paper)
  const loadData = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setResult(null);
    setSelectedAnswer(null);
    setTextAnswer('');
    setCurrentWordIndex(-1);
    recorder.reset();
    try {
      const q = await fetchQuestionDetail(questionId);
      setQuestion(q);
      // Load siblings: same type and same paper
      const siblings = await fetchQuestions({ type: q.type, paperId: q.paper_id });
      siblings.sort((a, b) => a.section_index - b.section_index || a.id - b.id);
      setSiblingQuestions(siblings);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Scroll to result when it appears
  useEffect(() => {
    if (result && resultRef.current) {
 resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  const currentIdx = useMemo(() => {
    return siblingQuestions.findIndex(q => q.id === questionId);
  }, [siblingQuestions, questionId]);

  const handleSwitchQuestion = (newQid: number) => {
    setSearchParams({ questionId: String(newQid), type: qType });
  };

  const handleStopRecording = useCallback(async () => {
    const { audioUrl, transcript } = await recorder.stopRecording();
    if (transcript) {
      setTextAnswer(transcript);
    }
    return { audioUrl, transcript };
  }, [recorder]);

  const handleSubmit = useCallback(async () => {
    if (!question || !deviceId) return;

    // For recording-based types, stop recording first if still recording
    let transcription = textAnswer;
    let audioUrl: string | null = null;

    if (qType !== 'listen_choose') {
      if (recorder.recording) {
        const res = await handleStopRecording();
        audioUrl = res.audioUrl;
        transcription = res.transcript || textAnswer;
      } else if (recorder.recordedUrl) {
        audioUrl = recorder.recordedUrl;
      }
    }

    setSubmitting(true);
    try {
      const record = await submitPractice({
        questionId: question.id,
        deviceId,
        sessionId: 'practice',
        transcription: qType === 'listen_choose' ? undefined : transcription,
        selectedAnswer: qType === 'listen_choose' ? (selectedAnswer ?? undefined) : undefined,
        audioUrl,
      });
      setResult(record);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }, [question, deviceId, qType, textAnswer, selectedAnswer, recorder, handleStopRecording]);

  const handleNext = () => {
    if (currentIdx < siblingQuestions.length - 1) {
      handleSwitchQuestion(siblingQuestions[currentIdx + 1].id);
    } else {
      navigate(`/practice/${qType}`);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      handleSwitchQuestion(siblingQuestions[currentIdx - 1].id);
    }
  };

  // Word list for read_aloud highlighting - before early returns (hooks order)
  const passageWords = useMemo(() => {
    if (!question || !question.content) return [];
    const content = question.content as ReadAloudContent;
    if (!content.passage) return [];
    return content.passage.split(/\s+/);
  }, [question]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: config.color + '12' }}
        >
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: config.color, borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <span className="text-stone-400">题目不存在</span>
      </div>
    );
  }

  const ms = question.max_score;
  const ratio = result ? result.score / ms : 0;
  const scoreColor = getScoreColor(ratio);
  const fb = result?.feedback || {};

  const optionLabels = ['A', 'B', 'C', 'D', 'E'];
  const canSubmit = qType === 'listen_choose' ? selectedAnswer !== null : true;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      <div style={{ width: contentWidth, margin: '0 auto', paddingBottom: 80 }}>
        {/* Header */}
        <div className="px-5 pt-10 pb-4" style={{ backgroundColor: config.color }}>
          <div className="flex items-center mb-3">
            <button onClick={() => navigate(-1)} className="mr-3">
              <ArrowLeft size={20} color="#FFFFFF" />
            </button>
            <span className="text-white text-lg font-bold flex-1">{config.label}</span>
            <button
              onClick={() => navigate(`/scoring-guide?type=${qType}`)}
              className="rounded-lg px-3 py-1.5 flex items-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <BookMarked size={12} color="#FFFFFF" />
              <span className="text-white text-xs font-semibold ml-1">评分标准</span>
            </button>
          </div>

          {/* Question tabs */}
          {siblingQuestions.length > 1 && (
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-2">
                {siblingQuestions.map((q, idx) => {
                  const isActive = q.id === questionId;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleSwitchQuestion(q.id)}
                      className="rounded-full flex items-center justify-center transition-all"
                      style={{
                        width: 32,
                        height: 32,
                        minWidth: 32,
                        backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                        color: isActive ? config.color : '#FFFFFF',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress + badges */}
          <div className="flex items-center mt-3">
            <span className="text-white/80 text-sm">
              {currentIdx >= 0 ? `第 ${currentIdx + 1} / ${siblingQuestions.length} 题` : ''}
            </span>
            <span className="text-white/60 text-xs ml-3">满分 {ms} 分</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ paddingLeft: contentPadding, paddingRight: contentPadding, paddingTop: 16 }}>
          {/* TTS Player - for listen types (not read_aloud which shows text) */}
          {qType !== 'read_aloud' && (
            <TTSPlayer
              text={question.audio_script}
              color={config.color}
              label={qType === 'listen_retell' ? '播放听力原文（两遍）' : '播放听力原文'}
              playCount={qType === 'listen_retell' ? 2 : 1}
            />
          )}

          {/* read_aloud: show passage with optional word highlighting + standard audio */}
          {qType === 'read_aloud' && (
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${config.color}10` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-stone-800 text-sm font-bold">朗读以下短文</span>
                <button
                  onClick={() => navigate(`/scoring-guide?type=read_aloud`)}
                  className="text-xs font-medium"
                  style={{ color: config.color }}
                >
                  评分标准
                </button>
              </div>
              <p className="text-stone-700 text-sm leading-7" style={{ lineHeight: 1.8 }}>
                {passageWords.map((word, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: idx === currentWordIndex ? config.color + '30' : 'transparent',
                      borderRadius: 3,
                      padding: '0 1px',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {word}{' '}
                  </span>
                ))}
              </p>
              {/* Standard audio player */}
              <div className="mt-4">
                <TTSPlayer
                  text={question.audio_script}
                  color={config.color}
                  label="播放标准朗读"
                  playCount={1}
                  words={passageWords}
                  onWordIndex={setCurrentWordIndex}
                />
              </div>
            </div>
          )}

          {/* listen_choose: question + options */}
          {qType === 'listen_choose' && (
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${config.color}10` }}
            >
              <span className="text-stone-800 text-base font-bold block mb-4">
                {(question.content as ListenChooseContent).question}
              </span>
              <div className="flex flex-col gap-3">
                {(question.content as ListenChooseContent).options.map((opt, idx) => {
                  const isSelected = selectedAnswer === idx;
                  const correctIdx = (question.content as ListenChooseContent).correct_answer;
                  const showResult = !!result;
                  const isCorrect = idx === correctIdx;
                  const isWrong = showResult && isSelected && !isCorrect;

                  let bg = '#FFFFFF';
                  let border = '#E5E7EB';
                  let textColor = '#374151';

                  if (showResult) {
                    if (isCorrect) {
                      bg = '#10B98115';
                      border = '#10B981';
                      textColor = '#059669';
                    } else if (isWrong) {
                      bg = '#EF444415';
                      border = '#EF4444';
                      textColor = '#DC2626';
                    }
                  } else if (isSelected) {
                    bg = config.color + '15';
                    border = config.color;
                    textColor = config.color;
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => !result && setSelectedAnswer(idx)}
                      disabled={!!result}
                      className="rounded-xl p-4 flex items-center transition-all text-left"
                      style={{
                        backgroundColor: bg,
                        border: `1.5px solid ${border}`,
                      }}
                    >
                      <span
                        className="rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: showResult && isCorrect ? '#10B981' : showResult && isWrong ? '#EF4444' : isSelected ? config.color : '#F3F4F6',
                          color: showResult && (isCorrect || isWrong) ? '#FFFFFF' : isSelected ? '#FFFFFF' : '#6B7280',
                          fontSize: 13,
                        }}
                      >
                        {optionLabels[idx]}
                      </span>
                      <span className="ml-3 text-sm font-medium flex-1" style={{ color: textColor }}>
                        {opt}
                      </span>
                      {showResult && isCorrect && <CheckCircle size={18} color="#10B981" />}
                      {showResult && isWrong && <XCircle size={18} color="#EF4444" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* listen_answer: question text */}
          {qType === 'listen_answer' && (
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${config.color}10` }}
            >
              <span className="text-stone-400 text-xs font-bold block mb-2">问题</span>
              <span className="text-stone-800 text-base font-medium block">
                {(question.content as ListenAnswerContent).question}
              </span>
            </div>
          )}

          {/* listen_retell: topic + info_points table */}
          {qType === 'listen_retell' && (
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${config.color}10` }}
            >
              <span className="text-stone-400 text-xs font-bold block mb-1">转述主题</span>
              <span className="text-stone-800 text-base font-bold block mb-3">
                {(question.content as ListenRetellContent).topic}
              </span>
              {(question.content as ListenRetellContent).intro && (
                <p className="text-stone-500 text-sm mb-4">
                  {(question.content as ListenRetellContent).intro}
                </p>
              )}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                {(question.content as ListenRetellContent).info_points.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-start p-3"
                    style={{
                      backgroundColor: idx % 2 === 0 ? '#FAFAFA' : '#FFFFFF',
                      borderTop: idx > 0 ? '1px solid #E5E7EB' : 'none',
                    }}
                  >
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: config.color + '15', color: config.color }}
                    >
                      {point.label}
                    </span>
                    <span className="text-stone-700 text-sm ml-3 flex-1">{point.answer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recording section - for listen_answer, listen_retell, read_aloud */}
          {qType !== 'listen_choose' && !result && (
            <div className="mb-4">
              <RecordButton
                recording={recorder.recording}
                recordedUrl={recorder.recordedUrl}
                playing={recorder.playing}
                transcribing={recorder.transcribing}
                recordingTime={recorder.recordingTime}
                color={config.color}
                onStart={recorder.startRecording}
                onStop={handleStopRecording}
                onPlay={recorder.playRecording}
              />
              {recorder.error && (
                <div
                  className="rounded-xl p-3 mt-3 text-sm"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                >
                  {recorder.error}
                </div>
              )}
              {/* Interim transcript while recording */}
              {recorder.recording && recorder.interimText && (
                <div className="rounded-xl p-3 mt-3" style={{ backgroundColor: '#F5F5F4' }}>
                  <span className="text-stone-400 text-xs block mb-1">实时识别</span>
                  <span className="text-stone-700 text-sm">{recorder.interimText}</span>
                </div>
              )}
              {/* Text input for manual answer / showing ASR result */}
              <div className="mt-3">
                <span className="text-stone-400 text-xs font-bold block mb-2">
                  {qType === 'read_aloud' ? '朗读文本（语音识别结果）' : '回答文本（可手动编辑）'}
                </span>
                <textarea
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder={qType === 'read_aloud' ? '录音后自动填入识别文本，也可手动输入' : '录音后自动填入识别文本，也可手动输入答案'}
                  rows={3}
                  className="w-full rounded-xl p-3 text-sm resize-none"
                  style={{
                    border: '1px solid #E5E7EB',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}

          {/* Submit button */}
          {!result && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full rounded-2xl py-4 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                backgroundColor: config.color,
                boxShadow: `0 6px 12px ${config.color}33`,
              }}
            >
              {submitting ? (
                <>
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin mr-2"
                    style={{ borderColor: '#FFFFFF', borderTopColor: 'transparent' }}
                  />
                  <span className="text-white text-base font-bold">评分中...</span>
                </>
              ) : (
                <>
                  <Send size={16} color="#FFFFFF" />
                  <span className="text-white text-base font-bold ml-2">
                    {qType === 'listen_choose' ? '提交答案' : '提交评分'}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Result display */}
          {result && (
            <div ref={resultRef} className="animate-slide-up">
              {/* Score circle */}
              <div
                className="rounded-2xl p-6 text-center"
                style={{ backgroundColor: '#FFFFFF', boxShadow: `0 4px 8px ${config.color}15` }}
              >
                <div
                  className="rounded-full mx-auto flex flex-col items-center justify-center"
                  style={{
                    width: 80,
                    height: 80,
                    backgroundColor: scoreColor + '15',
                  }}
                >
                  <span className="text-3xl font-bold" style={{ color: scoreColor }}>{result.score}</span>
                  <span className="text-xs" style={{ color: scoreColor + '99' }}>/ {ms}</span>
                </div>
                <span className="text-stone-400 text-sm mt-3 block">
                  {ratio >= 0.8 ? '优秀' : ratio >= 0.6 ? '及格' : '不及格'}
                </span>
              </div>

              {/* listen_choose: show correct/wrong */}
              {qType === 'listen_choose' && (
                <ResultCard icon={(fb as any).isCorrect ? CheckCircle : XCircle} label="答题结果" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6 block mb-2">
                    {(fb as any).explanation}
                  </span>
                  <span className="text-stone-500 text-sm">
                    正确答案：{optionLabels[(question.content as ListenChooseContent).correct_answer]}
                  </span>
                </ResultCard>
              )}

              {/* Transcription */}
              {result.transcription && (
                <ResultCard icon={FileText} label="语音转写" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{result.transcription}</span>
                </ResultCard>
              )}

              {/* Analysis */}
              {(fb as any).analysis && (
                <ResultCard icon={BarChart3} label="评分分析" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{(fb as any).analysis}</span>
                </ResultCard>
              )}
              {(fb as any).accuracyAnalysis && (
                <ResultCard icon={BarChart3} label="准确性分析" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{(fb as any).accuracyAnalysis}</span>
                </ResultCard>
              )}
              {(fb as any).languageAnalysis && (
                <ResultCard icon={BarChart3} label="语言分析" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{(fb as any).languageAnalysis}</span>
                </ResultCard>
              )}
              {(fb as any).fluencyAnalysis && (
                <ResultCard icon={BarChart3} label="流利度分析" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{(fb as any).fluencyAnalysis}</span>
                </ResultCard>
              )}
              {(fb as any).coherenceAnalysis && (
                <ResultCard icon={BarChart3} label="连贯性分析" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{(fb as any).coherenceAnalysis}</span>
                </ResultCard>
              )}
              {(fb as any).completenessAnalysis && (
                <ResultCard icon={BarChart3} label="完整性分析" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{(fb as any).completenessAnalysis}</span>
                </ResultCard>
              )}

              {/* Covered / missing points for listen_retell */}
              {qType === 'listen_retell' && (fb as any).coveredPoints && (
                <ResultCard icon={CheckCircle} label="信息点覆盖" color={config.color}>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(fb as any).coveredPoints.map((p: string) => (
                      <span
                        key={p}
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: '#10B98115', color: '#10B981' }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {(fb as any).missingPoints?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(fb as any).missingPoints.map((p: string) => (
                        <span
                          key={p}
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: '#EF444415', color: '#EF4444' }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </ResultCard>
              )}

              {/* Specific issues for read_aloud */}
              {(fb as any).specificIssues && (
                <ResultCard icon={BarChart3} label="具体问题" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{(fb as any).specificIssues}</span>
                </ResultCard>
              )}

              {/* Suggestions */}
              {result.suggestions && (
                <ResultCard icon={Lightbulb} label="改进建议" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">{result.suggestions}</span>
                </ResultCard>
              )}

              {/* Reference answer */}
              {qType === 'listen_answer' && (
                <ResultCard icon={FileText} label="参考答案" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">
                    {(question.content as ListenAnswerContent).sample_answer}
                  </span>
                </ResultCard>
              )}
              {qType === 'listen_retell' && (
                <ResultCard icon={FileText} label="参考转述" color={config.color}>
                  <span className="text-stone-700 text-sm leading-6">
                    {(question.content as ListenRetellContent).info_points.map(p => p.answer).join('. ')}
                  </span>
                </ResultCard>
              )}

              {/* Next button */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setResult(null);
                    setSelectedAnswer(null);
                    setTextAnswer('');
                    recorder.reset();
                  }}
                  className="flex-1 rounded-2xl py-3.5 flex items-center justify-center transition-all active:scale-[0.98]"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
                >
                  <span className="text-stone-700 font-semibold text-sm">重新作答</span>
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 rounded-2xl py-3.5 flex items-center justify-center transition-all active:scale-[0.98]"
                  style={{ backgroundColor: config.color, boxShadow: `0 4px 10px ${config.color}33` }}
                >
                  <span className="text-white font-bold text-sm">
                    {currentIdx < siblingQuestions.length - 1 ? '下一题' : '完成'}
                  </span>
                  <ChevronRight size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </button>
              </div>
            </div>
          )}

          {/* Bottom nav (when no result) */}
          {!result && siblingQuestions.length > 1 && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handlePrev}
                disabled={currentIdx <= 0}
                className="flex-1 rounded-2xl py-3.5 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
              >
                <ChevronLeft size={16} color="#78716C" />
                <span className="text-stone-600 font-semibold text-sm ml-1">上一题</span>
              </button>
              <button
                onClick={handleNext}
                disabled={currentIdx >= siblingQuestions.length - 1}
                className="flex-1 rounded-2xl py-3.5 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
              >
                <span className="text-stone-600 font-semibold text-sm mr-1">下一题</span>
                <ChevronRight size={16} color="#78716C" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
