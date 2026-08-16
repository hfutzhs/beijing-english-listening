import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useResponsive } from '@/hooks/useResponsive';
import { fetchHistoryDetail, type HistoryItem } from '@/utils/api';
import { useDeviceId } from '@/hooks/useDeviceId';

const TYPE_LABEL: Record<string, string> = {
  read_aloud: '短文朗读',
  listen_choose: '听后选择',
  listen_answer: '听后回答',
  listen_retell: '听后转述',
  full_exam: '考试模拟',
};

const TYPE_COLOR: Record<string, string> = {
  read_aloud: '#EA580C',
  listen_choose: '#0EA5E9',
  listen_answer: '#059669',
  listen_retell: '#7C3AED',
  full_exam: '#DC2626',
};

export default function HistoryDetailScreen() {
  const { id } = useSafeSearchParams<{ id: number }>();
  const router = useSafeRouter();
  const deviceId = useDeviceId();
  const { maxWidthStyle } = useResponsive();
  const [record, setRecord] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id || !deviceId) return;
      let cancelled = false;
      fetchHistoryDetail(id, deviceId)
        .then(data => { if (!cancelled) setRecord(data); })
        .catch(e => Alert.alert('错误', e.message || '加载失败'))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [id, deviceId])
  );

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-400">记录不存在</Text>
        </View>
      </Screen>
    );
  }

  const ms = record.max_score ?? 0;
  const ratio = ms > 0 ? record.score / ms : 0;
  const isPass = ratio >= 0.6;
  const typeKey = (record.type ?? 'unknown') as keyof typeof TYPE_COLOR;
  const typeColor = TYPE_COLOR[typeKey] || '#EA580C';
  const scoreColor = ratio >= 0.8 ? '#10B981' : ratio >= 0.6 ? '#F59E0B' : '#EF4444';

  return (
    <Screen>
      <View className="flex-1 bg-stone-50" style={maxWidthStyle}>
        {/* Header */}
        <View className="px-6 pt-12 pb-6" style={{ backgroundColor: typeColor }}>
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">成绩详情</Text>
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          {/* Score Card */}
          <View className="bg-white rounded-2xl p-6 items-center" style={{ shadowColor: typeColor, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
            <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: scoreColor + '15' }}>
              <Text className="text-3xl font-bold" style={{ color: scoreColor }}>{record.score}</Text>
              <Text className="text-xs" style={{ color: scoreColor + '99' }}>/ {ms}</Text>
            </View>
            <Text className="text-stone-400 text-sm mt-3">
              {TYPE_LABEL[typeKey] || record.type} · {isPass ? '及格' : '不及格'}
            </Text>
            <Text className="text-stone-300 text-xs mt-1">
              {record.created_at ? new Date(record.created_at).toLocaleString('zh-CN') : ''}
            </Text>
          </View>

          {/* Title */}
          {record.question_title && (
            <View className="bg-white rounded-2xl p-5 mt-4" style={{ shadowColor: typeColor, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-stone-400 text-xs font-bold mb-1">题目</Text>
              <Text className="text-stone-800 text-sm font-medium">{record.question_title}</Text>
            </View>
          )}

          {/* Transcript */}
          {record.transcript && (
            <View className="bg-white rounded-2xl p-5 mt-4" style={{ shadowColor: typeColor, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-stone-400 text-xs font-bold mb-2">语音转写</Text>
              <Text className="text-stone-700 text-sm leading-6">{record.transcript}</Text>
            </View>
          )}

          {/* Analysis */}
          {record.analysis && (
            <View className="bg-white rounded-2xl p-5 mt-4" style={{ shadowColor: typeColor, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-stone-400 text-xs font-bold mb-2">评分分析</Text>
              <Text className="text-stone-700 text-sm leading-6">{record.analysis}</Text>
            </View>
          )}

          {/* Suggestions */}
          {record.suggestions && (
            <View className="bg-white rounded-2xl p-5 mt-4" style={{ shadowColor: typeColor, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <View className="flex-row items-center mb-2">
                <FontAwesome6 name="lightbulb" size={14} color={typeColor} />
                <Text className="text-stone-400 text-xs font-bold ml-1">改进建议</Text>
              </View>
              <Text className="text-stone-700 text-sm leading-6">{record.suggestions}</Text>
            </View>
          )}

          {/* Details */}
          {record.details && (
            <View className="bg-white rounded-2xl p-5 mt-4" style={{ shadowColor: typeColor, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-stone-400 text-xs font-bold mb-2">详细评分</Text>
              <Text className="text-stone-700 text-sm leading-6">{record.details}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}
