import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, XCircle, Send, Headphones, MessageCircle, Repeat, BookOpen, Award, AlertCircle } from 'lucide-react';
import { fetchExamPaperDetail, submitPractice } from '../lib/api';
import { useDeviceId } from '../hooks/useDeviceId';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useResponsive } from '../hooks/useResponsive';
import { TTSPlayer } from '../components/TTSPlayer';
import { RecordButton } from '../components/RecordButton';
import type { Question, QuestionType, PracticeRecord, ListenChooseContent, ListenAnswerContent, ListenRetellContent, ReadAloudContent } from '../types';

const HEADER_COLOR = '#B91C1C';

const SECTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  listen_choose: { label: '听后选择', color: '#0EA5E9', icon: Headphones },
  listen_answer: { label: '听后回答', color: '#059669', icon: MessageCircle },
  listen_retell: { label: '听后转述', color: '#7C3AED', icon: Repeat },
  read_aloud: { label: '短文朗读', color: '#EA580C', icon: BookOpen },
};

const SECTION_ORDER: QuestionType[] = ['listen_choose', 'listen_answer', 'listen_retell', 'read_aloud'];

const optionLabels = ['A', 'B', 'C', 'D', 'E'];

interface AnswerState {
  selectedAnswer?: number;
  transcription?: string;
  audioUrl?: string | null;
  answered: boolean;
}

function getScoreColor(ratio: number): string {
  if (ratio >= 0.8) return '#10B981';
  if (ratio >= 0.6) return '#F59E0B';
  return '#EF4444';
}

export default function ExamFlow() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const { isTablet, contentPadding, maxContentWidth } = useResponsive();
  const recorder = useAudioRecorder();

  const paperId = Number(searchParams.get('paperId'));

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [examResults, setExamResults] = useState<PracticeRecord[] | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [textInput, setTextInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const contentWidth = isTablet ? maxContentWidth : '100%';

  const loadData = useCallback(async () => {
    if (!paperId) return;
    setLoading(true);
    try {
      const { questions: qs } = await fetchExamPaperDetail(paperId);
      qs.sort((a, b) => {
        const sa = SECTION_ORDER.indexOf(a.type);
        const sb = SECTION_ORDER.indexOf(b.type);
        if (sa !== sb) return sa - sb;
        return a.id - b.id;
      });
      setAllQuestions(qs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const flatQuestions = useMemo(() => allQuestions, [allQuestions]);

  const sections = useMemo(() => {
    const map: Record<string, Question[]> = {};
    for (const q of allQuestions) {
      if (!map[q.type]) map[q.type] = [];
      map[q.type].push(q);
    }
    return map;
  }, [allQuestions]);

  const currentQuestion = flatQuestions[currentIdx];
  const currentType = currentQuestion?.type;
  const currentSectionConfig = currentType ? SECTION_CONFIG[currentType] : null;

  useEffect(() => {
    if (currentQuestion) {
      const ans = answers[currentQuestion.id];
      setTextInput(ans?.transcription || '');
      recorder.reset();
    }
  }, [currentIdx]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentIdx]);

  const handleStopRecording = useCallback(async () => {
    const { audioUrl, transcript } = await recorder.stopRecording();
    if (transcript) {
      setTextInput(transcript);
    }
    if (currentQuestion) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          transcription: transcript || prev[currentQuestion.id]?.transcription || '',
          audioUrl,
          answered: true,
        },
      }));
    }
    return { audioUrl, transcript };
  }, [recorder, currentQuestion]);

  const handleSelectAnswer = (idx: number) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedAnswer: idx,
        answered: true,
      },
    }));
  };

  const handleTextInputChange = (val: string) => {
    setTextInput(val);
    if (currentQuestion) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          transcription: val,
          answered: val.trim().length > 0 || !!prev[currentQuestion.id]?.audioUrl,
        },
      }));
    }
  };

  const answeredCount = Object.values(answers).filter(a => a.answered).length;
  const totalQuestions = flatQuestions.length;
  const allAnswered = answeredCount >= totalQuestions;

  const handleSubmitExam = useCallback(async () => {
    if (!deviceId || !flatQuestions.length) return;
    setSubmitting(true);
    try {
      if (recorder.recording) {
        await handleStopRecording();
      }

      const results: PracticeRecord[] = [];
      for (const q of flatQuestions) {
        const ans = answers[q.id];
        if (!ans || !ans.answered) continue;
        try {
          const record = await submitPractice({
            questionId: q.id,
            deviceId,
            sessionId: 'exam',
            transcription: q.type === 'listen_choose' ? undefined : (ans.transcription || ''),
            selectedAnswer: q.type === 'listen_choose' ? ans.selectedAnswer : undefined,
            audioUrl: ans.audioUrl || null,
          });
          results.push(record);
        } catch {
          // skip
        }
      }
      setExamResults(results);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }, [deviceId, flatQuestions, answers, recorder, handleStopRecording]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: HEADER_COLOR + '12' }}>
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: HEADER_COLOR, borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  if (!flatQuestions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <span className="text-stone-400">试卷不存在</span>
      </div>
    );
  }

  // === Exam Result View ===
  if (examResults) {
    const totalScore = examResults.reduce((sum, r) => sum + r.score, 0);
    const totalMax = examResults.reduce((sum, r) => sum + r.max_score, 0);
    const ratio = totalMax > 0 ? totalScore / totalMax : 0;
    const scoreColor = getScoreColor(ratio);

    const resultsBySection: Record<string, PracticeRecord[]> = {};
    for (const r of examResults) {
      if (!resultsBySection[r.question_type]) resultsBySection[r.question_type] = [];
      resultsBySection[r.question_type].push(r);
    }

    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
        <div style={{ width: contentWidth, margin: '0 auto', paddingBottom: 40 }}>
          <div className="px-6 pt-12 pb-8" style={{ backgroundColor: HEADER_COLOR }}>
            <div className="flex items-center mb-2">
              <button onClick={() => navigate('/exam')} className="mr-3">
                <ArrowLeft size={20} color="#FFFFFF" />
              </button>
              <span className="text-white text-xl font-bold">考试结果</span>
            </div>
            <span className="text-white/70 text-sm">试卷 {paperId}</span>
          </div>

          <div style={{ paddingLeft: contentPadding, paddingRight: contentPadding, paddingTop: 16 }}>
            <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#FFFFFF', boxShadow: `0 4px 12px ${HEADER_COLOR}12` }}>
              <div className="rounded-full mx-auto flex flex-col items-center justify-center" style={{ width: 100, height: 100, backgroundColor: scoreColor + '15' }}>
                <span className="text-4xl font-bold" style={{ color: scoreColor }}>{totalScore}</span>
                <span className="text-sm" style={{ color: scoreColor + '99' }}>/ {totalMax}</span>
              </div>
              <span className="text-stone-800 text-base font-bold mt-4 block">
                {ratio >= 0.8 ? '优秀' : ratio >= 0.6 ? '及格' : '需努力'}
              </span>
              <div className="flex items-center justify-center mt-2">
                <Award size={14} color={scoreColor} />
                <span className="text-stone-400 text-sm ml-1">正确率 {Math.round(ratio * 100)}%</span>
              </div>
            </div>

            {SECTION_ORDER.map(secType => {
              const secResults = resultsBySection[secType];
              if (!secResults || secResults.length === 0) return null;
              const secConfig = SECTION_CONFIG[secType];
              const secScore = secResults.reduce((s, r) => s + r.score, 0);
              const secMax = secResults.reduce((s, r) => s + r.max_score, 0);
              const secRatio = secMax > 0 ? secScore / secMax : 0;
              const SecIcon = secConfig.icon;
              return (
                <div key={secType} className="rounded-2xl p-5 mt-4" style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${secConfig.color}10` }}>
                  <div className="flex items-center mb-3">
                    <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: secConfig.color + '15' }}>
                      <SecIcon size={14} color={secConfig.color} />
                    </div>
                    <span className="text-stone-800 text-sm font-bold ml-2">{secConfig.label}</span>
                    <div className="flex-1" />
                    <span className="text-sm font-bold" style={{ color: getScoreColor(secRatio) }}>{secScore} / {secMax}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {secResults.map((r, idx) => {
                      const rRatio = r.max_score > 0 ? r.score / r.max_score : 0;
                      const rColor = getScoreColor(rRatio);
                      const q = flatQuestions.find(qq => qq.id === r.question_id);
                      return (
                        <div key={r.id} className="flex items-center p-3 rounded-xl" style={{ backgroundColor: '#FAFAFA' }}>
                          <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: rColor + '15' }}>
                            {r.is_failed ? <XCircle size={14} color={rColor} /> : <CheckCircle size={14} color={rColor} />}
                          </div>
                          <span className="text-stone-600 text-xs ml-2 flex-1">
                            第 {idx + 1} 题
                            {q && q.type === 'listen_choose' && (
                              <span className="text-stone-400 ml-1">
                                {r.user_answer ? optionLabels[Number(r.user_answer)] : '-'}
                                {(q.content as ListenChooseContent).correct_answer !== undefined && (
                                  <span> -> {optionLabels[(q.content as ListenChooseContent).correct_answer]}</span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="text-sm font-bold" style={{ color: rColor }}>{r.score}/{r.max_score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex gap-3 mt-6">
              <button onClick={() => navigate('/exam')} className="flex-1 rounded-2xl py-3.5 flex items-center justify-center transition-all active:scale-[0.98]" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <span className="text-stone-700 font-semibold text-sm">返回列表</span>
              </button>
              <button onClick={() => { setExamResults(null); setAnswers({}); setCurrentIdx(0); }} className="flex-1 rounded-2xl py-3.5 flex items-center justify-center transition-all active:scale-[0.98]" style={{ backgroundColor: HEADER_COLOR, boxShadow: `0 4px 10px ${HEADER_COLOR}33` }}>
                <span className="text-white font-bold text-sm">重新考试</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === Exam Question View ===
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F3F4F6' }}>
      <div style={{ width: contentWidth, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header with progress */}
        <div className="px-5 pt-10 pb-4" style={{ backgroundColor: HEADER_COLOR }}>
          <div className="flex items-center mb-3">
            <button onClick={() => setShowExitConfirm(true)} className="mr-3">
              <ArrowLeft size={20} color="#FFFFFF" />
            </button>
            <span className="text-white text-lg font-bold flex-1">试卷 {paperId} · 考试模拟</span>
          </div>
          <div className="flex items-center">
            <div className="rounded-full flex-1 overflow-hidden" style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div className="rounded-full transition-all" style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#FFFFFF' }} />
            </div>
            <span className="text-white/80 text-xs ml-3">{answeredCount} / {totalQuestions}</span>
          </div>
        </div>

        {/* Question tabs */}
        <div className="overflow-x-auto scrollbar-hide px-5 py-3" style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex gap-1.5">
            {flatQuestions.map((q, idx) => {
              const ans = answers[q.id];
              const isAnswered = ans?.answered;
              const isActive = idx === currentIdx;
              const qConfig = SECTION_CONFIG[q.type];
              return (
                <button key={q.id} onClick={() => setCurrentIdx(idx)} className="rounded-full flex items-center justify-center transition-all" style={{ width: 30, height: 30, minWidth: 30, backgroundColor: isActive ? HEADER_COLOR : isAnswered ? qConfig.color + '20' : '#F3F4F6', color: isActive ? '#FFFFFF' : isAnswered ? qConfig.color : '#9CA3AF', fontWeight: 700, fontSize: 12 }}>
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ paddingLeft: contentPadding, paddingRight: contentPadding, paddingTop: 16, paddingBottom: 16 }}>
          {currentQuestion && currentSectionConfig && (
            <>
              <div className="flex items-center mb-4">
                <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: currentSectionConfig.color + '15' }}>
                  <currentSectionConfig.icon size={14} color={currentSectionConfig.color} />
                </div>
                <span className="text-stone-800 text-sm font-bold ml-2">{currentSectionConfig.label}</span>
                <span className="text-stone-400 text-xs ml-2">第 {currentIdx + 1} / {totalQuestions} 题 · {currentQuestion.max_score}分</span>
              </div>

              {currentQuestion.type !== 'read_aloud' && (
                <TTSPlayer text={currentQuestion.audio_script} color={currentSectionConfig.color} label={currentQuestion.type === 'listen_retell' ? '播放听力原文（两遍）' : '播放听力原文'} playCount={currentQuestion.type === 'listen_retell' ? 2 : 1} />
              )}

              {currentQuestion.type === 'read_aloud' && (
                <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${currentSectionConfig.color}10` }}>
                  <span className="text-stone-800 text-sm font-bold block mb-3">朗读以下短文</span>
                  <p className="text-stone-700 text-sm" style={{ lineHeight: 1.8 }}>{(currentQuestion.content as ReadAloudContent).passage}</p>
                  <div className="mt-4">
                    <TTSPlayer text={currentQuestion.audio_script} color={currentSectionConfig.color} label="播放标准朗读" playCount={1} />
                  </div>
                </div>
              )}

              {currentQuestion.type === 'listen_choose' && (
                <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${currentSectionConfig.color}10` }}>
                  <span className="text-stone-800 text-sm font-bold block mb-3">{(currentQuestion.content as ListenChooseContent).question}</span>
                  <div className="flex flex-col gap-2">
                    {(currentQuestion.content as ListenChooseContent).options.map((opt, idx) => {
                      const ans = answers[currentQuestion.id];
                      const isSelected = ans?.selectedAnswer === idx;
                      return (
                        <button key={idx} onClick={() => handleSelectAnswer(idx)} className="rounded-xl p-3 flex items-center transition-all text-left" style={{ backgroundColor: isSelected ? currentSectionConfig.color + '15' : '#FAFAFA', border: `1.5px solid ${isSelected ? currentSectionConfig.color : '#E5E7EB'}` }}>
                          <span className="rounded-md flex items-center justify-center font-bold flex-shrink-0" style={{ width: 24, height: 24, backgroundColor: isSelected ? currentSectionConfig.color : '#E5E7EB', color: isSelected ? '#FFFFFF' : '#6B7280', fontSize: 12 }}>{optionLabels[idx]}</span>
                          <span className="ml-2 text-sm font-medium flex-1" style={{ color: isSelected ? currentSectionConfig.color : '#374151' }}>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentQuestion.type === 'listen_answer' && (
                <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${currentSectionConfig.color}10` }}>
                  <span className="text-stone-400 text-xs font-bold block mb-2">问题</span>
                  <span className="text-stone-800 text-sm font-medium block">{(currentQuestion.content as ListenAnswerContent).question}</span>
                </div>
              )}

              {currentQuestion.type === 'listen_retell' && (
                <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 8px ${currentSectionConfig.color}10` }}>
                  <span className="text-stone-400 text-xs font-bold block mb-1">转述主题</span>
                  <span className="text-stone-800 text-sm font-bold block mb-3">{(currentQuestion.content as ListenRetellContent).topic}</span>
                  {(currentQuestion.content as ListenRetellContent).intro && (
                    <p className="text-stone-500 text-xs mb-4">{(currentQuestion.content as ListenRetellContent).intro}</p>
                  )}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                    {(currentQuestion.content as ListenRetellContent).info_points.map((point, idx) => (
                      <div key={idx} className="flex items-start p-3" style={{ backgroundColor: idx % 2 === 0 ? '#FAFAFA' : '#FFFFFF', borderTop: idx > 0 ? '1px solid #E5E7EB' : 'none' }}>
                        <span className="rounded-md px-2 py-0.5 text-xs font-bold flex-shrink-0" style={{ backgroundColor: currentSectionConfig.color + '15', color: currentSectionConfig.color }}>{point.label}</span>
                        <span className="text-stone-700 text-xs ml-3 flex-1">{point.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion.type !== 'listen_choose' && (
                <div className="mb-4">
                  <RecordButton recording={recorder.recording} recordedUrl={recorder.recordedUrl} playing={recorder.playing} transcribing={recorder.transcribing} recordingTime={recorder.recordingTime} color={currentSectionConfig.color} onStart={recorder.startRecording} onStop={handleStopRecording} onPlay={recorder.playRecording} />
                  {recorder.error && (
                    <div className="rounded-xl p-3 mt-3 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>{recorder.error}</div>
                  )}
                  {recorder.recording && recorder.interimText && (
                    <div className="rounded-xl p-3 mt-3" style={{ backgroundColor: '#F5F5F4' }}>
                      <span className="text-stone-400 text-xs block mb-1">实时识别</span>
                      <span className="text-stone-700 text-sm">{recorder.interimText}</span>
                    </div>
                  )}
                  <div className="mt-3">
                    <textarea value={textInput} onChange={(e) => handleTextInputChange(e.target.value)} placeholder="录音后自动填入识别文本，也可手动输入" rows={2} className="w-full rounded-xl p-3 text-sm resize-none" style={{ border: '1px solid #E5E7EB', outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex gap-2 px-5 py-3" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB', paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx <= 0} className="rounded-xl px-4 py-3 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-40" style={{ backgroundColor: '#F5F5F4' }}>
            <ChevronLeft size={16} color="#78716C" />
            <span className="text-stone-600 font-semibold text-sm ml-1">上一题</span>
          </button>
          {currentIdx < totalQuestions - 1 ? (
            <button onClick={() => setCurrentIdx(Math.min(totalQuestions - 1, currentIdx + 1))} className="flex-1 rounded-xl py-3 flex items-center justify-center transition-all active:scale-[0.98]" style={{ backgroundColor: HEADER_COLOR }}>
              <span className="text-white font-bold text-sm mr-1">下一题</span>
              <ChevronRight size={16} color="#FFFFFF" />
            </button>
          ) : (
            <button onClick={handleSubmitExam} disabled={submitting || !allAnswered} className="flex-1 rounded-xl py-3 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: submitting ? '#FCA5A5' : HEADER_COLOR }}>
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 rounded-full animate-spin mr-2" style={{ borderColor: '#FFFFFF', borderTopColor: 'transparent' }} />
                  <span className="text-white font-bold text-sm">评分中...</span>
                </>
              ) : (
                <>
                  <Send size={16} color="#FFFFFF" />
                  <span className="text-white font-bold text-sm ml-2">{allAnswered ? '交卷' : `交卷 (${answeredCount}/${totalQuestions})`}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowExitConfirm(false)}>
          <div className="rounded-3xl p-7" style={{ backgroundColor: '#FFFFFF', width: '80%', maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertCircle size={22} color="#DC2626" />
              </div>
            </div>
            <span className="text-stone-900 text-lg font-bold text-center block mb-2">确认退出</span>
            <span className="text-stone-500 text-sm text-center block mb-6">{answeredCount > 0 ? `已答 ${answeredCount}/${totalQuestions} 题，退出后答题记录不会保存。确定要退出吗？` : '退出后答题记录不会保存。确定要退出吗？'}</span>
            <div className="flex gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-3.5 rounded-xl" style={{ backgroundColor: '#F5F5F4' }}>
                <span className="text-stone-700 font-semibold">继续考试</span>
              </button>
              <button onClick={() => navigate('/exam')} className="flex-1 py-3.5 rounded-xl" style={{ backgroundColor: '#DC2626' }}>
                <span className="text-white font-semibold">退出</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
