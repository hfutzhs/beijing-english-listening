import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, FileText, BarChart3, RefreshCw } from 'lucide-react';
import { fetchHistoryDetail } from '../lib/api';
import { ResultCard } from '../components/ResultCard';
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

export default function HistoryDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = Number(searchParams.get('id'));
  const [record, setRecord] = useState<PracticeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecord = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchHistoryDetail(id);
      setRecord(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EA580C12' }}>
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#EA580C', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <span className="text-stone-400">记录不存在</span>
      </div>
    );
  }

  const ms = record.max_score || 0;
  const ratio = ms > 0 ? record.score / ms : 0;
  const isPass = ratio >= 0.6;
  const typeKey = (record.question_type || 'unknown') as QuestionType;
  const typeColor = TYPE_COLOR[typeKey] || '#EA580C';
  const scoreColor = ratio >= 0.8 ? '#10B981' : ratio >= 0.6 ? '#F59E0B' : '#EF4444';
  const fb = record.feedback || {};

  const analysisText =
    (fb.analysis as string) ||
    (fb.accuracyAnalysis as string) ||
    (fb.languageAnalysis as string) ||
    record.accuracy_analysis ||
    '';

  const fluencyText =
    (fb.fluencyAnalysis as string) ||
    (fb.coherenceAnalysis as string) ||
    record.fluency_analysis ||
    '';

  const completenessText =
    (fb.completenessAnalysis as string) ||
    record.completeness_analysis ||
    '';

  const suggestionsText = record.suggestions || (fb.suggestions as string) || '';

  const handleRetry = () => {
    if (record.question_id) {
      navigate(`/practice-answer?questionId=${record.question_id}&type=${record.question_type}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="px-6 pt-12 pb-6" style={{ backgroundColor: typeColor }}>
        <div className="flex items-center mb-3">
          <button onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft size={18} color="#FFFFFF" />
          </button>
          <span className="text-white text-lg font-bold">成绩详情</span>
        </div>
      </div>

      <div className="p-6 pb-20">
        <div
          className="bg-white rounded-2xl p-6 text-center"
          style={{ boxShadow: `0 4px 8px ${typeColor}15` }}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto flex flex-col items-center justify-center"
            style={{ backgroundColor: scoreColor + '15' }}
          >
            <span className="text-3xl font-bold" style={{ color: scoreColor }}>{record.score}</span>
            <span className="text-xs" style={{ color: scoreColor + '99' }}>/ {ms}</span>
          </div>
          <span className="text-stone-400 text-sm mt-3 block">
            {TYPE_LABEL[typeKey] || record.question_type} · {isPass ? '及格' : '不及格'}
          </span>
          <span className="text-stone-300 text-xs mt-1 block">
            {record.created_at ? new Date(record.created_at).toLocaleString('zh-CN') : ''}
          </span>
        </div>

        {record.question_title && (
          <div
            className="bg-white rounded-2xl p-5 mt-4"
            style={{ boxShadow: `0 2px 6px ${typeColor}10` }}
          >
            <span className="text-stone-400 text-xs font-bold block mb-1">题目</span>
            <span className="text-stone-800 text-sm font-medium">{record.question_title}</span>
          </div>
        )}

        {record.transcription && (
          <ResultCard icon={FileText} label="语音转写" color={typeColor}>
            <span className="text-stone-700 text-sm leading-6">{record.transcription}</span>
          </ResultCard>
        )}

        {analysisText && (
          <ResultCard icon={BarChart3} label="评分分析" color={typeColor}>
            <span className="text-stone-700 text-sm leading-6">{analysisText}</span>
          </ResultCard>
        )}

        {fluencyText && (
          <ResultCard icon={BarChart3} label="流利度分析" color={typeColor}>
            <span className="text-stone-700 text-sm leading-6">{fluencyText}</span>
          </ResultCard>
        )}

        {completenessText && (
          <ResultCard icon={BarChart3} label="完整性分析" color={typeColor}>
            <span className="text-stone-700 text-sm leading-6">{completenessText}</span>
          </ResultCard>
        )}

        {suggestionsText && (
          <ResultCard icon={Lightbulb} label="改进建议" color={typeColor}>
            <span className="text-stone-700 text-sm leading-6">{suggestionsText}</span>
          </ResultCard>
        )}

        <button
          onClick={handleRetry}
          className="w-full rounded-2xl py-4 flex items-center justify-center mt-6 transition-all active:scale-[0.98]"
          style={{ backgroundColor: typeColor, boxShadow: `0 6px 12px ${typeColor}33` }}
        >
          <RefreshCw size={16} color="#FFFFFF" />
          <span className="text-white text-base font-bold ml-2">重新练习</span>
        </button>
      </div>
    </div>
  );
}
