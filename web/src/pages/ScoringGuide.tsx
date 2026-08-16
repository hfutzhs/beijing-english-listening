import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, BookOpen, MessageCircle, Repeat, ListChecks, Lightbulb } from 'lucide-react';

const SCORING_RULES = [
  {
    type: 'listen_choose',
    label: '听后选择',
    color: '#0EA5E9',
    icon: ListChecks,
    maxScore: 9,
    rules: [
      '每题1.5分，共6题',
      '每题2-3个选项，选择正确得分',
      '选错或不选不得分',
      '听力材料播放两遍',
    ],
  },
  {
    type: 'listen_answer',
    label: '听后回答',
    color: '#059669',
    icon: MessageCircle,
    maxScore: 12,
    rules: [
      '每题2分，共6题',
      '发音不准确但不影响理解，不扣分',
      '表达有语法错误但能说出关键词，不影响理解，不扣分',
      '不做答或所答与对话内容完全无关，不得分',
      '录音中出现多题答案，以最后答案为准',
      '零误差原则',
    ],
  },
  {
    type: 'listen_retell',
    label: '听后转述',
    color: '#7C3AED',
    icon: Repeat,
    maxScore: 10,
    rules: [
      '根据信息表转述听力内容',
      '信息点完整，每个信息点2分',
      '拼写错误不得分',
      '单复数扣分，大小写错误不扣分',
      '出现多余信息但不影响交际不扣分',
      '意思等值可给分（遵循交际原则）',
    ],
  },
  {
    type: 'read_aloud',
    label: '短文朗读',
    color: '#EA580C',
    icon: BookOpen,
    maxScore: 9,
    rules: [
      '满分档引入容错机制',
      '档内从宽原则',
      '个别错误指1-2个（不影响得分档）',
      '评分维度：语音语调、语速节奏、意群停顿、重读弱读',
      '如出现与作答无关的语音，做异常卷标记',
    ],
  },
];

const GRADE_LEVELS = [
  { range: '8-9分', desc: '语音清晰，语调自然，节奏流畅，意群停顿恰当', color: '#10B981' },
  { range: '6-7分', desc: '语音基本清晰，偶有发音错误，语调基本自然', color: '#84CC16' },
  { range: '4-5分', desc: '语音有较多错误，部分影响理解，语调平淡', color: '#F59E0B' },
  { range: '2-3分', desc: '语音错误较多，影响理解，节奏不连贯', color: '#F97316' },
  { range: '0-1分', desc: '无法完成朗读，语音严重错误', color: '#EF4444' },
];

export default function ScoringGuide() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || '';
  const filteredRules = type ? SCORING_RULES.filter(r => r.type === type) : SCORING_RULES;
  const isSingleType = !!type;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="px-6 pt-12 pb-6" style={{ backgroundColor: '#1C1917' }}>
        <div className="flex items-center mb-2">
          <button onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft size={18} color="#FFFFFF" />
          </button>
          <span className="text-white text-xl font-bold">
            {isSingleType ? `${filteredRules[0].label}评分标准` : '评分标准'}
          </span>
        </div>
        <span className="text-stone-400 text-sm">参考北京市中考英语听说考试评分标准</span>
      </div>

      <div className="p-6 pb-20">
        {!isSingleType && (
          <div
            className="bg-white rounded-2xl p-5 mb-4"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          >
            <div className="flex items-center mb-3">
              <ClipboardList size={16} color="#1C1917" />
              <span className="text-stone-800 text-base font-bold ml-2">总分构成</span>
            </div>
            <div className="flex justify-between">
              {SCORING_RULES.map(s => (
                <div key={s.type} className="items-center flex-1 text-center">
                  <span className="text-2xl font-bold block" style={{ color: s.color }}>{s.maxScore}</span>
                  <span className="text-stone-500 text-xs">{s.label}</span>
                </div>
              ))}
              <div className="items-center flex-1 text-center">
                <span className="text-2xl font-bold text-stone-800 block">40</span>
                <span className="text-stone-500 text-xs">总分</span>
              </div>
            </div>
          </div>
        )}

        {filteredRules.map(rule => {
          const RuleIcon = rule.icon;
          return (
            <div
              key={rule.type}
              className="bg-white rounded-2xl p-5 mb-4"
              style={{ boxShadow: `0 2px 6px ${rule.color}10` }}
            >
              <div className="flex items-center mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: rule.color + '15' }}
                >
                  <RuleIcon size={14} color={rule.color} />
                </div>
                <span className="text-stone-800 text-base font-bold ml-2">{rule.label}</span>
                <div className="flex-1" />
                <span className="text-sm font-bold" style={{ color: rule.color }}>满分 {rule.maxScore} 分</span>
              </div>
              {rule.rules.map((r, idx) => (
                <div key={idx} className="flex items-start mb-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: rule.color + '15' }}
                  >
                    <span className="text-xs font-bold" style={{ color: rule.color }}>{idx + 1}</span>
                  </div>
                  <span className="text-stone-600 text-sm flex-1 ml-2 leading-5">{r}</span>
                </div>
              ))}
            </div>
          );
        })}

        {filteredRules.some(r => r.type === 'read_aloud') && (
          <div
            className="bg-white rounded-2xl p-5 mb-4"
            style={{ boxShadow: '0 2px 6px #EA580C10' }}
          >
            <span className="text-stone-800 text-base font-bold block mb-3">短文朗读评分档次</span>
            {GRADE_LEVELS.map((g, idx) => (
              <div key={idx} className="flex items-center mb-3">
                <div
                  className="w-16 rounded-lg py-1 text-center mr-3"
                  style={{ backgroundColor: g.color + '15' }}
                >
                  <span className="text-xs font-bold" style={{ color: g.color }}>{g.range}</span>
                </div>
                <span className="text-stone-600 text-sm flex-1 leading-5">{g.desc}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center mt-2">
          <Lightbulb size={12} color="#A8A29E" />
          <span className="text-stone-400 text-xs ml-1">
            评分标准参考北京市中考英语听说机考评分标准。AI 评分仅供参考，实际考试以人工评分为准。
          </span>
        </div>
      </div>
    </div>
  );
}
