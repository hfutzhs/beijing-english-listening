import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useResponsive } from '@/hooks/useResponsive';

const SCORING_RULES = [
  {
    type: 'listen_choose',
    label: '听后选择',
    color: '#0EA5E9',
    icon: 'list-check',
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
    icon: 'comment',
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
    icon: 'diagram-project',
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
    icon: 'book-open',
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

export default function ScoringGuideScreen() {
  const router = useSafeRouter();
  const { type } = useSafeSearchParams<{ type?: string }>();
  const { maxWidthStyle } = useResponsive();
  const filteredRules = type ? SCORING_RULES.filter(r => r.type === type) : SCORING_RULES;
  const isSingleType = !!type;
  const currentType = filteredRules[0];

  return (
    <Screen>
      <View className="flex-1 bg-stone-50" style={maxWidthStyle}>
        <View className="px-6 pt-12 pb-6" style={{ backgroundColor: '#1C1917' }}>
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">{isSingleType ? `${currentType.label}评分标准` : '评分标准'}</Text>
          </View>
          <Text className="text-stone-400 text-sm">参考北京市中考英语听说考试评分标准</Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          {/* Overview - only show when displaying all types */}
          {!isSingleType && (
            <View className="bg-white rounded-2xl p-5 mb-4" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <View className="flex-row items-center mb-3">
                <FontAwesome6 name="clipboard-list" size={16} color="#1C1917" />
                <Text className="text-stone-800 text-base font-bold ml-2">总分构成</Text>
              </View>
              <View className="flex-row justify-between">
                {SCORING_RULES.map(s => (
                  <View key={s.type} className="items-center flex-1">
                    <Text className="text-2xl font-bold" style={{ color: s.color }}>{s.maxScore}</Text>
                    <Text className="text-stone-500 text-xs">{s.label}</Text>
                  </View>
                ))}
                <View className="items-center flex-1">
                  <Text className="text-2xl font-bold text-stone-800">40</Text>
                  <Text className="text-stone-500 text-xs">总分</Text>
                </View>
              </View>
            </View>
          )}

          {/* Each type */}
          {filteredRules.map(rule => (
            <View key={rule.type} className="bg-white rounded-2xl p-5 mb-4" style={{ shadowColor: rule.color, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
              <View className="flex-row items-center mb-3">
                <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: rule.color + '15' }}>
                  <FontAwesome6 name={rule.icon} size={14} color={rule.color} />
                </View>
                <Text className="text-stone-800 text-base font-bold ml-2">{rule.label}</Text>
                <View className="flex-1" />
                <Text className="text-sm font-bold" style={{ color: rule.color }}>满分 {rule.maxScore} 分</Text>
              </View>
              {rule.rules.map((r, idx) => (
                <View key={idx} className="flex-row items-start mb-2">
                  <View className="w-5 h-5 rounded-full items-center justify-center mt-0.5" style={{ backgroundColor: rule.color + '15' }}>
                    <Text className="text-xs font-bold" style={{ color: rule.color }}>{idx + 1}</Text>
                  </View>
                  <Text className="text-stone-600 text-sm flex-1 ml-2 leading-5">{r}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* Grade levels for read_aloud - show when read_aloud is included */}
          {filteredRules.some(r => r.type === 'read_aloud') && (
            <View className="bg-white rounded-2xl p-5 mb-4" style={{ shadowColor: '#EA580C', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-stone-800 text-base font-bold mb-3">短文朗读评分档次</Text>
            {GRADE_LEVELS.map((g, idx) => (
              <View key={idx} className="flex-row items-center mb-3">
                <View className="w-16 rounded-lg py-1 items-center mr-3" style={{ backgroundColor: g.color + '15' }}>
                  <Text className="text-xs font-bold" style={{ color: g.color }}>{g.range}</Text>
                </View>
                <Text className="text-stone-600 text-sm flex-1 leading-5">{g.desc}</Text>
              </View>
            ))}
            </View>
          )}

          <Text className="text-stone-400 text-xs text-center mt-2">
            * 评分标准参考北京市中考英语听说机考评分标准。AI 评分仅供参考，实际考试以人工评分为准。
          </Text>
        </ScrollView>
      </View>
    </Screen>
  );
}
