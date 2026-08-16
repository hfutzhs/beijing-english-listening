import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePen, CheckCircle, Headphones, MessageCircle, Repeat, BookOpen, ChevronRight } from 'lucide-react';
import { fetchPapers, fetchExamProgress, fetchExamScore } from '../lib/api';
import { useDeviceId } from '../hooks/useDeviceId';
import { useResponsive } from '../hooks/useResponsive';
import type { Paper } from '../types';

const HEADER_COLOR = '#B91C1C';

const SECTIONS = [
  { type: 'listen_choose', label: '听后选择', color: '#0EA5E9', maxScore: 9, count: 6, icon: Headphones },
  { type: 'listen_answer', label: '听后回答', color: '#059669', maxScore: 12, count: 6, icon: MessageCircle },
  { type: 'listen_retell', label: '听后转述', color: '#7C3AED', maxScore: 10, count: 1, icon: Repeat },
  { type: 'read_aloud', label: '短文朗读', color: '#EA580C', maxScore: 9, count: 1, icon: BookOpen },
];

interface PaperProgress {
  completed: boolean;
  score: number | null;
}

export default function ExamMock() {
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const { isTablet, contentPadding, cardColumns, maxContentWidth } = useResponsive();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [progress, setProgress] = useState<Record<number, PaperProgress>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [paperList, completedPaperIds] = await Promise.all([
        fetchPapers(),
        deviceId ? fetchExamProgress(deviceId) : Promise.resolve([]),
      ]);
      setPapers(paperList);

      // Fetch score for each completed paper
      const progressMap: Record<number, PaperProgress> = {};
      if (deviceId) {
        await Promise.all(
          completedPaperIds.map(async (pid) => {
            const score = await fetchExamScore(deviceId, pid);
            progressMap[pid] = { completed: true, score };
          })
        );
      }
      setProgress(progressMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const contentWidth = isTablet ? maxContentWidth : '100%';

  const handlePaperClick = (paperId: number) => {
    navigate(`/exam-flow?paperId=${paperId}`);
  };

  const completedCount = Object.values(progress).filter(p => p.completed).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      <div style={{ width: contentWidth, margin: '0 auto' }}>
        {/* Header */}
        <div
          className="px-6 pt-12 pb-8"
          style={{ backgroundColor: HEADER_COLOR, boxShadow: `0 4px 12px ${HEADER_COLOR}25` }}
        >
          <div className="flex items-center">
            <div
              className="rounded-2xl flex items-center justify-center"
              style={{ width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <FilePen size={22} color="#FFFFFF" />
            </div>
            <div className="ml-3">
              <span className="text-white text-2xl font-bold block">考试模拟</span>
              <span className="text-white/70 text-sm block">综合考试 · 总分 40 分</span>
            </div>
          </div>
          <div className="flex items-center mt-4">
            <span className="text-white/90 text-sm font-medium">
              共 {papers.length} 套试卷
            </span>
            <span className="text-white/50 text-sm ml-3">
              已完成 {completedCount}
            </span>
          </div>
        </div>

        {/* Section overview */}
        <div style={{ paddingLeft: contentPadding, paddingRight: contentPadding, marginTop: -4, marginBottom: 8 }}>
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: `0 4px 12px ${HEADER_COLOR}12` }}
          >
            <div className="flex">
              {SECTIONS.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <div key={s.type} className="flex-1 flex flex-col items-center text-center">
                    <div
                      className="rounded-xl flex items-center justify-center mb-2"
                      style={{ width: 36, height: 36, backgroundColor: s.color + '15' }}
                    >
                      <Icon size={16} color={s.color} />
                    </div>
                    <span className="text-stone-800 text-xs font-bold">{s.label}</span>
                    <span className="text-stone-400 text-xs mt-0.5">{s.count}题 · {s.maxScore}分</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Paper cards */}
        <div style={{ paddingLeft: contentPadding, paddingRight: contentPadding, paddingTop: 8, paddingBottom: 100 }}>
          {loading ? (
            <div className="flex flex-col items-center py-20">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: HEADER_COLOR + '12' }}
              >
                <div
                  className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: HEADER_COLOR, borderTopColor: 'transparent' }}
                />
              </div>
              <span className="text-stone-400 text-sm">加载试卷中...</span>
            </div>
          ) : (
            <div className="flex flex-wrap" style={{ gap: 12 }}>
              {papers.map((paper) => {
                const prog = progress[paper.paperId];
                const isCompleted = prog?.completed;
                const score = prog?.score;
                return (
                  <button
                    key={paper.paperId}
                    onClick={() => handlePaperClick(paper.paperId)}
                    className="rounded-2xl p-4 flex items-center transition-all active:scale-[0.98] text-left"
                    style={{
                      width: `calc(${100 / cardColumns}% - ${(cardColumns - 1) * 12 / cardColumns}px)`,
                      backgroundColor: '#FFFFFF',
                      boxShadow: `0 2px 8px ${HEADER_COLOR}10`,
                    }}
                  >
                    {/* Score / number badge */}
                    <div
                      className="rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                      style={{
                        width: 52,
                        height: 52,
                        backgroundColor: isCompleted ? '#10B98115' : HEADER_COLOR + '12',
                      }}
                    >
                      {isCompleted ? (
                        <>
                          <span className="text-lg font-bold" style={{ color: '#10B981' }}>{score ?? '-'}</span>
                          <span className="text-xs" style={{ color: '#10B98199' }}>/ 40</span>
                        </>
                      ) : (
                        <span className="text-lg font-bold" style={{ color: HEADER_COLOR }}>
                          {paper.paperId}
                        </span>
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 ml-3 overflow-hidden">
                      <div className="flex items-center mb-1">
                        {isCompleted && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium flex items-center"
                            style={{ backgroundColor: '#10B98115', color: '#10B981' }}
                          >
                            <CheckCircle size={10} style={{ marginRight: 3 }} />
                            已完成
                          </span>
                        )}
                      </div>
                      <span className="text-stone-800 text-sm font-medium block truncate">
                        试卷 {paper.paperId}
                      </span>
                      <span className="text-stone-400 text-xs mt-0.5 block">
                        {paper.questionCount} 题 · 总分 {paper.totalScore} 分
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
