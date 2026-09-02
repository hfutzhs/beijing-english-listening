import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useResponsive } from '@/hooks/useResponsive';
import { fetchPapers, fetchExamProgress, type Paper } from '@/utils/api';

const SECTIONS = [
  { type: 'listen_choose', label: '听后选择', icon: 'list-check', color: '#0EA5E9', maxScore: 9, count: 6 },
  { type: 'listen_answer', label: '听后回答', icon: 'comment', color: '#059669', maxScore: 12, count: 6 },
  { type: 'listen_retell', label: '听后转述', icon: 'diagram-project', color: '#7C3AED', maxScore: 10, count: 1 },
  { type: 'read_aloud', label: '短文朗读', icon: 'book-open', color: '#EA580C', maxScore: 9, count: 1 },
];

const HEADER_COLOR = '#B91C1C';

export default function ExamMockScreen() {
  const router = useSafeRouter();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [submittedPaperIds, setSubmittedPaperIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const deviceId = useDeviceId();
  const { isTablet, contentPadding, cardColumns, maxContentWidth } = useResponsive();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPapers();
      setPapers(data);
      if (deviceId) {
        const submitted = await fetchExamProgress(deviceId);
        setSubmittedPaperIds(submitted);
      }
    } catch (e: any) {
      Alert.alert('错误', e.message || '加载试卷失败');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <Screen>
      <View className="flex-1" style={{ backgroundColor: '#FFFBF5', alignItems: isTablet ? 'center' : 'stretch' }}>
        <View style={{ width: isTablet ? maxContentWidth : '100%', backgroundColor: '#FFFBF5' }}>
        {/* Header with depth */}
        <View style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 24,
          backgroundColor: HEADER_COLOR,
          shadowColor: HEADER_COLOR,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 5,
        }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">考试模拟</Text>
              <Text className="text-white/70 text-sm mt-1">综合考试 · 总分 40 分</Text>
            </View>
            <Link href="/scoring-guide" asChild>
              <TouchableOpacity className="rounded-xl px-4 py-2.5 flex-row items-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <FontAwesome6 name="circle-info" size={12} color="#FFFFFF" />
                <Text className="text-white text-sm font-semibold ml-1.5">查看标准</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Section overview card - overlapping header */}
        <View style={{ paddingHorizontal: contentPadding, marginTop: isTablet ? 0 : -5, marginBottom: 8 }}>
          <View className="rounded-2xl p-5" style={{
            backgroundColor: '#FFFFFF',
            shadowColor: HEADER_COLOR,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}>
            <Text className="text-stone-400 text-xs font-bold mb-4 uppercase tracking-wider">考试结构</Text>
            <View className="flex-row justify-between">
              {SECTIONS.map(s => (
                <View key={s.type} className="items-center flex-1">
                  <View className="w-12 h-12 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: s.color + '12' }}>
                    <FontAwesome6 name={s.icon} size={16} color={s.color} />
                  </View>
                  <Text className="text-stone-800 text-xs font-bold">{s.label}</Text>
                  <Text className="text-stone-400 text-xs mt-0.5">{s.maxScore}分 · {s.count}题</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: contentPadding, paddingTop: 8, paddingBottom: 100 }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-stone-700 text-base font-bold">选择试卷</Text>
            {papers.length > 0 && (
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: HEADER_COLOR + '12' }}>
                <Text className="text-xs font-semibold" style={{ color: HEADER_COLOR }}>{papers.length} 套试卷</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View className="items-center mt-20">
              <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: HEADER_COLOR + '12' }}>
                <ActivityIndicator size="large" color={HEADER_COLOR} />
              </View>
              <Text className="text-stone-400 text-sm">加载试卷中...</Text>
            </View>
          ) : papers.length === 0 ? (
            <View className="items-center mt-20">
              <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: '#F5F5F4' }}>
                <FontAwesome6 name="folder-open" size={28} color="#D6D3D1" />
              </View>
              <Text className="text-stone-400 text-sm">暂无试卷</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {papers.map((paper) => {
                const isSubmitted = submittedPaperIds.includes(paper.paperId);
                return (
                  <TouchableOpacity
                    key={paper.paperId}
                    onPress={() => router.push('/exam-flow', { paperId: paper.paperId })}
                    className="rounded-2xl p-5"
                    style={{
                      width: `${100 / cardColumns - 2}%`,
                      backgroundColor: '#FFFFFF',
                      shadowColor: HEADER_COLOR,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                    activeOpacity={0.8}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <View className="w-8 h-8 rounded-lg items-center justify-center mr-2.5" style={{ backgroundColor: isSubmitted ? '#05966915' : HEADER_COLOR + '12' }}>
                            <FontAwesome6 name={isSubmitted ? 'check' : 'file-pen'} size={12} color={isSubmitted ? '#059669' : HEADER_COLOR} />
                          </View>
                          <Text className="text-stone-800 text-base font-bold">模拟试卷 {paper.paperId}</Text>
                          {isSubmitted && (
                            <View className="ml-2 flex-row items-center rounded-full px-2 py-0.5" style={{ backgroundColor: '#05966915' }}>
                              <FontAwesome6 name="circle-check" size={10} color="#059669" />
                              <Text className="ml-1 text-xs font-semibold" style={{ color: '#059669' }}>已交卷</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-stone-400 text-xs mt-1.5 ml-10.5">
                          {paper.questionCount} 道题 · 总分 40 分
                        </Text>
                        {paper.paperTitle && (
                          <Text className="text-xs mt-1 ml-10.5" style={{ color: '#EA580C', fontSize: 11 }}>
                            来源：{paper.paperTitle}
                          </Text>
                        )}
                        <View className="flex-row mt-2.5 ml-10.5">
                          {SECTIONS.map(s => (
                            <View key={s.type} className="rounded-full px-2 py-0.5 mr-1" style={{ backgroundColor: s.color + '10' }}>
                              <Text className="text-xs font-medium" style={{ color: s.color }}>{s.label}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: HEADER_COLOR + '10' }}>
                        <FontAwesome6 name="arrow-right" size={14} color={HEADER_COLOR} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
        </View>
      </View>
    </Screen>
  );
}
