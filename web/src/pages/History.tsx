import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ClockRotateLeft, ClipboardList, CheckCircle, XCircle, BarChart3, ChevronRight } from 'lucide-react';
import { fetchHistory, clearHistory } from '../lib/api';
import { useDeviceId } from '../hooks/useDeviceId';
import { useResponsive } from '../hooks/useResponsive';
import type { PracticeRecord, QuestionType } from '../types';

const TYPE_LABEL: Record<string, string> = {
  read_aloud: '短文朗读',
  listen_choose: '听后选择',
  listen_answer: '听后回答',
  listen_retell: '听后转述',
};

const TYPE_COLOR: Record<string, string> = {
  read_aloud: '#EA580C',
  listen_choose: '#0EA5E9',
  listen_answer: '#059669',
  listen_retell: '#7C3AED',
};

const HEADER_COLOR = '#6B5B4E';

function getScoreColor(ratio: number): string {
  if (ratio >= 0.8) return '#059669';
  if (ratio >= 0.6) return '#D97706';
  return '#DC2626';
}

function getGrade(ratio: number): string {
  if (ratio >= 0.8) return '优秀';
  if (ratio >= 0.6) return '及格';
  return '不及格';
}

const FILTER_TYPES: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'listen_choose', label: '听后选择' },
  { value: 'listen_answer', label: '听后回答' },
  { value: 'listen_retell', label: '听后转述' },
  { value: 'read_aloud', label: '短文朗读' },
];

export default function History() {
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const { isTablet, contentPadding, cardColumns, maxContentWidth } = useResponsive();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [wrongOnly, setWrongOnly] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadData = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const data = await fetchHistory(deviceId);
      setRecords(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearConfirm = useCallback(async () => {
    if (!deviceId) return;
    setClearing(true);
    try {
      await clearHistory(deviceId);
      setRecords([]);
      setClearModalVisible(false);
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  }, [deviceId]);

  const filteredRecords = records.filter(r => {
    if (filterType && r.question_type !== filterType) return false;
    if (wrongOnly && !r.is_failed) return false;
    return true;
  });

  const totalExams = filteredRecords.length;
  const passCount = filteredRecords.filter(r => {
    const ms = r.max_score || 0;
    return ms > 0 && r.score / ms >= 0.6;
  }).length;
  const failCount = totalExams - passCount;
  const avgScore = totalExams > 0
    ? Math.round(filteredRecords.reduce((sum, r) => {
        const ms = r.max_score || 0;
        return sum + (ms > 0 ? (r.score / ms) * 100 : 0);
      }, 0) / totalExams)
    : 0;

  const contentWidth = isTablet ? maxContentWidth : '100%';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFBF5' }}>
      <div style={{ width: contentWidth, margin: '0 auto' }}>
        <div
          className="px-6 pt-12 pb-5"
          style={{ backgroundColor: HEADER_COLOR, boxShadow: `0 4px 12px ${HEADER_COLOR}20` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="text-white text-2xl font-bold block">历史记录</span>
              <span className="text-white/60 text-sm mt-1 block">各项练习和考试成绩</span>
            </div>
            {records.length > 0 && (
              <button
                onClick={() => setClearModalVisible(true)}
                className="rounded-xl px-4 py-2.5 flex items-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <Trash2 size={12} color="#FFFFFF" />
                <span className="text-white text-sm font-semibold ml-1.5">清空</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ paddingLeft: contentPadding, paddingRight: contentPadding, marginTop: -5, marginBottom: 8 }}>
          <div
            className="flex rounded-2xl p-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: `0 4px 12px ${HEADER_COLOR}15` }}
          >
            <StatItem icon={ClipboardList} label="总练习" value={totalExams} color="#78716C" />
            <div style={{ width: 1, backgroundColor: '#F5F5F4' }} />
            <StatItem icon={CheckCircle} label="及格" value={passCount} color="#059669" />
            <div style={{ width: 1, backgroundColor: '#F5F5F4' }} />
            <StatItem icon={XCircle} label="不及格" value={failCount} color="#DC2626" />
            <div style={{ width: 1, backgroundColor: '#F5F5F4' }} />
            <StatItem icon={BarChart3} label="平均分" value={avgScore} color="#D97706" suffix="%" />
          </div>
        </div>

        <div style={{ paddingLeft: contentPadding, paddingRight: contentPadding, marginBottom: 8 }}>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2">
            {FILTER_TYPES.map(ft => (
              <button
                key={ft.value}
                onClick={() => setFilterType(ft.value)}
                className="rounded-full px-4 py-2 whitespace-nowrap transition-all"
                style={{
                  backgroundColor: filterType === ft.value ? HEADER_COLOR : '#FFFFFF',
                  color: filterType === ft.value ? '#FFFFFF' : '#78716C',
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: filterType === ft.value ? `0 2px 6px ${HEADER_COLOR}30` : '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {ft.label}
              </button>
            ))}
            <button
              onClick={() => setWrongOnly(!wrongOnly)}
              className="rounded-full px-4 py-2 whitespace-nowrap transition-all flex items-center"
              style={{
                backgroundColor: wrongOnly ? '#DC2626' : '#FFFFFF',
                color: wrongOnly ? '#FFFFFF' : '#78716C',
                fontWeight: 600,
                fontSize: 13,
                boxShadow: wrongOnly ? '0 2px 6px rgba(220,38,38,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <XCircle size={12} style={{ marginRight: 4 }} />
              只看错题
            </button>
          </div>
        </div>

        <div
          style={{ paddingLeft: contentPadding, paddingRight: contentPadding, paddingTop: 8, paddingBottom: 100 }}
        >
          {loading ? (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: HEADER_COLOR + '12' }}>
                <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: HEADER_COLOR, borderTopColor: 'transparent' }} />
              </div>
              <span className="text-stone-400 text-sm">加载记录中...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F5F5F4' }}>
                <ClockRotateLeft size={28} color="#D6D3D1" />
              </div>
              <span className="text-stone-400 text-base font-medium">暂无历史记录</span>
              <span className="text-stone-300 mt-1 text-sm">完成练习后这里会显示成绩</span>
            </div>
          ) : (
            <div className="flex flex-wrap" style={{ gap: 12 }}>
              {filteredRecords.map((item) => {
                const ms = item.max_score || 0;
                const ratio = ms > 0 ? item.score / ms : 0;
                const scoreColor = getScoreColor(ratio);
                const typeKey = (item.question_type || 'unknown') as QuestionType;
                const typeColor = TYPE_COLOR[typeKey] || '#78716C';
                const grade = getGrade(ratio);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/history-detail?id=${item.id}`)}
                    className="rounded-2xl p-4 flex items-center transition-all active:scale-[0.98] text-left"
                    style={{
                      width: `calc(${100 / cardColumns}% - ${(cardColumns - 1) * 12 / cardColumns}px)`,
                      backgroundColor: '#FFFFFF',
                      boxShadow: `0 2px 8px ${typeColor}10`,
                    }}
                  >
                    <div
                      className="rounded-2xl flex flex-col items-center justify-center"
                      style={{ width: 56, height: 56, backgroundColor: scoreColor + '12', flexShrink: 0 }}
                    >
                      <span className="text-xl font-bold" style={{ color: scoreColor }}>{item.score}</span>
                      <span className="text-xs" style={{ color: scoreColor + '99' }}>/ {ms}</span>
                    </div>
                    <div className="flex-1 ml-4 overflow-hidden">
                      <div className="flex items-center">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ backgroundColor: typeColor + '15', color: typeColor }}
                        >
                          {TYPE_LABEL[typeKey] || item.question_type}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 ml-1.5 text-xs font-medium"
                          style={{ backgroundColor: scoreColor + '12', color: scoreColor }}
                        >
                          {grade}
                        </span>
                      </div>
                      <span className="text-stone-800 text-sm font-medium mt-1.5 block truncate">
                        {item.question_title || '练习记录'}
                      </span>
                      <span className="text-stone-400 text-xs mt-0.5 block">
                        {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}
                      </span>
                    </div>
                    <ChevronRight size={12} color="#D6D3D1" style={{ flexShrink: 0, marginLeft: 4 }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {clearModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setClearModalVisible(false)}
        >
          <div
            className="rounded-3xl p-7"
            style={{ backgroundColor: '#FFFFFF', width: '80%', maxWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <Trash2 size={22} color="#DC2626" />
              </div>
            </div>
            <span className="text-stone-900 text-lg font-bold text-center block mb-2">确认清空</span>
            <span className="text-stone-500 text-sm text-center block mb-6">将删除所有历史记录，此操作不可恢复。确定要清空吗？</span>
            <div className="flex gap-3">
              <button
                onClick={() => setClearModalVisible(false)}
                className="flex-1 py-3.5 rounded-xl"
                style={{ backgroundColor: '#F5F5F4' }}
              >
                <span className="text-stone-700 font-semibold">取消</span>
              </button>
              <button
                onClick={handleClearConfirm}
                disabled={clearing}
                className="flex-1 py-3.5 rounded-xl"
                style={{ backgroundColor: clearing ? '#FCA5A5' : '#DC2626' }}
              >
                <span className="text-white font-semibold">{clearing ? '清空中...' : '清空'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ icon: Icon, label, value, color, suffix }: { icon: any; label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1.5" style={{ backgroundColor: color + '12' }}>
        <Icon size={15} color={color} />
      </div>
      <span className="text-stone-800 text-lg font-bold">{value}{suffix || ''}</span>
      <span className="text-stone-400 text-xs mt-0.5">{label}</span>
    </div>
  );
}
