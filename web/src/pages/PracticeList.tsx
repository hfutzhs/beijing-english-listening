import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, BookOpen } from 'lucide-react';
import { fetchQuestions, fetchAnsweredQuestions } from '../lib/api';
import { useDeviceId } from '../hooks/useDeviceId';
import { useResponsive } from '../hooks/useResponsive';
import type { Question, QuestionType } from '../types';

const TYPE_CONFIG: Record<string, { label: string; subtitle: string; color: string }> = {
  listen_choose: { label: '听后选择', subtitle: '听对话或独白，选择正确答案', color: '#0EA5E9' },
  listen_answer: { label: '听后回答', subtitle: '听对话或独白，口头回答问题', color: '#059669' },
  listen_retell: { label: '听后转述', subtitle: '听两遍录音，转述信息内容', color: '#7C3AED' },
  read_aloud: { label: '短文朗读', subtitle: '朗读给定英文短文', color: '#EA580C' },
};

// Types that have only 1 question per paper -> show flat list instead of paper tabs
const FLAT_LIST_TYPES = ['read_aloud', 'listen_retell'];

function getPreview(q: Question): string {
  const c = q.content as any;
  switch (q.type) {
    case 'listen_choose':
      return c.question || '';
    case 'listen_answer':
      return c.question || '';
    case 'listen_retell':
      return c.topic || c.intro || '';
    case 'read_aloud':
      return (c.passage || '').substring(0, 60) + '...';
    default:
      return '';
  }
}

export default function PracticeList() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const { isTablet, contentPadding, cardColumns, maxContentWidth } = useResponsive();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState(1);

  const qType = (type || 'listen_choose') as QuestionType;
  const config = TYPE_CONFIG[qType] || TYPE_CONFIG.listen_choose;
  const isFlatList = FLAT_LIST_TYPES.includes(qType);

  const loadData = useCallback(async () => {
    if (!qType) return;
    setLoading(true);
    try {
      const [qs, answered] = await Promise.all([
        fetchQuestions({ type: qType }),
        deviceId ? fetchAnsweredQuestions(deviceId, qType) : Promise.resolve([]),
      ]);
      setQuestions(qs);
      setAnsweredIds(new Set(answered));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [qType, deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group by paper for tabbed types
  const paperGroups = useMemo(() => {
    const map: Record<number, Question[]> = {};
    for (const q of questions) {
      if (!map[q.paper_id]) map[q.paper_id] = [];
      map[q.paper_id].push(q);
    }
    return map;
  }, [questions]);

  const paperIds = useMemo(() => Object.keys(paperGroups).map(Number).sort((a, b) => a - b), [paperGroups]);

  // Questions to display: filtered by selected paper for tabbed types, all for flat list
  const displayQuestions = useMemo(() => {
    if (isFlatList) return questions;
    return paperGroups[selectedPaper] || [];
  }, [isFlatList, questions, paperGroups, selectedPaper]);

  const contentWidth = isTablet ? maxContentWidth : '100%';

  const handleQuestionClick = (q: Question) => {
    navigate(`/practice-answer?questionId=${q.id}&type=${q.type}`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      <div style={{ width: contentWidth, margin: '0 auto' }}>
        {/* Immersive header */}
        <div
          className="px-6 pt-12 pb-8"
          style={{ backgroundColor: config.color, boxShadow: `0 4px 12px ${config.color}25` }}
        >
          <span className="text-white text-2xl font-bold block">{config.label}</span>
          <span className="text-white/70 text-sm mt-1 block">{config.subtitle}</span>
          <div className="flex items-center mt-4">
            <span className="text-white/90 text-sm font-medium">
              共 {questions.length} 题
            </span>
            <span className="text-white/50 text-sm ml-3">
              已答 {answeredIds.size}
            </span>
          </div>
        </div>

        {/* Paper tabs for non-flat types */}
        {!isFlatList && paperIds.length > 0 && (
          <div
            className="overflow-x-auto scrollbar-hide"
            style={{ paddingLeft: contentPadding, paddingRight: contentPadding, paddingTop: 12, paddingBottom: 8 }}
          >
            <div className="flex gap-2">
              {paperIds.map(pid => {
                const paperQs = paperGroups[pid] || [];
                const answeredCount = paperQs.filter(q => answeredIds.has(q.id)).length;
                const isActive = selectedPaper === pid;
                return (
                  <button
                    key={pid}
                    onClick={() => setSelectedPaper(pid)}
                    className="rounded-xl px-4 py-2.5 whitespace-nowrap transition-all"
                    style={{
                      backgroundColor: isActive ? config.color : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : '#78716C',
                      fontWeight: 600,
                      fontSize: 13,
                      boxShadow: isActive ? `0 2px 8px ${config.color}30` : '0 1px 4px rgba(0,0,0,0.04)',
                    }}
                  >
                    试卷 {pid}
                    <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>
                      {answeredCount}/{paperQs.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question cards */}
        <div style={{ paddingLeft: contentPadding, paddingRight: contentPadding, paddingTop: 8, paddingBottom: 100 }}>
          {loading ? (
            <div className="flex flex-col items-center py-20">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: config.color + '12' }}
              >
                <div
                  className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: config.color, borderTopColor: 'transparent' }}
                />
              </div>
              <span className="text-stone-400 text-sm">加载题目中...</span>
            </div>
          ) : displayQuestions.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F5F5F4' }}>
                <BookOpen size={28} color="#D6D3D1" />
              </div>
              <span className="text-stone-400 text-base font-medium">暂无题目</span>
            </div>
          ) : (
            <div className="flex flex-wrap" style={{ gap: 12 }}>
              {displayQuestions.map((q, idx) => {
                const answered = answeredIds.has(q.id);
                const preview = getPreview(q);
                return (
                  <button
                    key={q.id}
                    onClick={() => handleQuestionClick(q)}
                    className="rounded-2xl p-4 flex items-center transition-all active:scale-[0.98] text-left"
                    style={{
                      width: `calc(${100 / cardColumns}% - ${(cardColumns - 1) * 12 / cardColumns}px)`,
                      backgroundColor: '#FFFFFF',
                      boxShadow: `0 2px 8px ${config.color}10`,
                    }}
                  >
                    {/* Number badge */}
                    <div
                      className="rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: answered ? '#10B98115' : config.color + '12',
                      }}
                    >
                      {answered ? (
                        <CheckCircle size={18} color="#10B981" />
                      ) : (
                        <span className="text-base font-bold" style={{ color: config.color }}>
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 ml-3 overflow-hidden">
                      <div className="flex items-center mb-1">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: config.color + '12', color: config.color }}
                        >
                          试卷 {q.paper_id}
                        </span>
                        <span className="text-stone-300 text-xs ml-2">
                          {q.max_score}分
                        </span>
                      </div>
                      <span className="text-stone-800 text-sm font-medium block truncate">
                        {preview || `第 ${idx + 1} 题`}
                      </span>
                    </div>
                    <ChevronRight size={14} color="#D6D3D1" style={{ flexShrink: 0, marginLeft: 4 }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
