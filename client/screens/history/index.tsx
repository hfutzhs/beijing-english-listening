import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { fetchHistory, clearHistory, type HistoryItem } from '@/utils/api';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useResponsive } from '@/hooks/useResponsive';

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
  full_exam: '#B91C1C',
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

export default function HistoryScreen() {
  const router = useSafeRouter();
  const deviceId = useDeviceId();
  const [records, setRecords] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { isTablet, contentPadding, cardColumns } = useResponsive();

  const loadData = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const data = await fetchHistory(deviceId);
      setRecords(data);
    } catch (e: any) {
      console.error('加载历史记录失败:', e.message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleClearConfirm = useCallback(async () => {
    if (!deviceId) return;
    setClearing(true);
    try {
      await clearHistory(deviceId);
      setRecords([]);
      setClearModalVisible(false);
    } catch (e: any) {
      console.error('清空失败:', e.message);
    } finally {
      setClearing(false);
    }
  }, [deviceId]);

  const totalExams = records.length;
  const passCount = records.filter(r => {
    const ms = r.max_score ?? 0;
    const ratio = ms > 0 ? r.score / ms : 0;
    return ratio >= 0.6;
  }).length;
  const failCount = totalExams - passCount;
  const avgScore = totalExams > 0
    ? Math.round(records.reduce((sum, r) => {
        const ms = r.max_score ?? 0;
        return sum + (ms > 0 ? (r.score / ms) * 100 : 0);
      }, 0) / totalExams)
    : 0;

  return (
    <Screen>
      <View className="flex-1" style={{ backgroundColor: '#FFFBF5', alignItems: isTablet ? 'center' : 'stretch' }}>
        <View style={{ width: isTablet ? 720 : '100%', backgroundColor: '#FFFBF5' }}>
        {/* Header */}
        <View style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 24,
          backgroundColor: HEADER_COLOR,
          shadowColor: HEADER_COLOR,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 5,
        }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">历史记录</Text>
              <Text className="text-white/60 text-sm mt-1">各项练习和考试成绩</Text>
            </View>
            {records.length > 0 && (
              <TouchableOpacity
                onPress={() => setClearModalVisible(true)}
                className="rounded-xl px-4 py-2.5 flex-row items-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <FontAwesome6 name="trash-can" size={12} color="#FFFFFF" />
                <Text className="text-white text-sm font-semibold ml-1.5">清空</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats - overlapping header */}
        <View style={{ paddingHorizontal: contentPadding, marginTop: isTablet ? 0 : -5, marginBottom: 8 }}>
          <View className="flex-row rounded-2xl p-4" style={{
            backgroundColor: '#FFFFFF',
            shadowColor: HEADER_COLOR,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}>
            <StatItem icon="clipboard-list" label="总练习" value={totalExams} color="#78716C" />
            <View style={{ width: 1, backgroundColor: '#F5F5F4' }} />
            <StatItem icon="circle-check" label="及格" value={passCount} color="#059669" />
            <View style={{ width: 1, backgroundColor: '#F5F5F4' }} />
            <StatItem icon="circle-xmark" label="不及格" value={failCount} color="#DC2626" />
            <View style={{ width: 1, backgroundColor: '#F5F5F4' }} />
            <StatItem icon="chart-simple" label="平均分" value={avgScore} color="#D97706" suffix="%" />
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: contentPadding, paddingTop: 8, paddingBottom: 100 }}>
          {loading ? (
            <View className="items-center mt-20">
              <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: HEADER_COLOR + '12' }}>
                <ActivityIndicator size="large" color={HEADER_COLOR} />
              </View>
              <Text className="text-stone-400 text-sm">加载记录中...</Text>
            </View>
          ) : records.length === 0 ? (
            <EmptyState />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {records.map((item) => {
                const ms = item.max_score ?? 0;
                const ratio = ms > 0 ? item.score / ms : 0;
                const scoreColor = getScoreColor(ratio);
                const typeKey = (item.type ?? 'unknown') as keyof typeof TYPE_COLOR;
                const typeColor = TYPE_COLOR[typeKey] || '#78716C';
                const grade = getGrade(ratio);

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push('/history-detail', { id: item.id })}
                    className="rounded-2xl p-4 flex-row items-center"
                    style={{
                      width: `${100 / cardColumns - 2}%`,
                      backgroundColor: '#FFFFFF',
                      shadowColor: typeColor,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                    activeOpacity={0.8}
                  >
                    {/* Score badge */}
                    <View className="w-14 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: scoreColor + '12' }}>
                      <Text className="text-xl font-bold" style={{ color: scoreColor }}>{item.score}</Text>
                      <Text className="text-xs" style={{ color: scoreColor + '99' }}>/ {ms}</Text>
                    </View>

                    {/* Info */}
                    <View className="flex-1 ml-4">
                      <View className="flex-row items-center">
                        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: typeColor + '15' }}>
                          <Text className="text-xs font-semibold" style={{ color: typeColor }}>{TYPE_LABEL[typeKey] || item.type}</Text>
                        </View>
                        <View className="rounded-full px-2 py-0.5 ml-1.5" style={{ backgroundColor: scoreColor + '12' }}>
                          <Text className="text-xs font-medium" style={{ color: scoreColor }}>{grade}</Text>
                        </View>
                      </View>
                      <Text className="text-stone-800 text-sm font-medium mt-1.5" numberOfLines={1}>
                        {item.question_title || '练习记录'}
                      </Text>
                      <Text className="text-stone-400 text-xs mt-0.5">
                        {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}
                      </Text>
                    </View>

                    <FontAwesome6 name="chevron-right" size={12} color="#D6D3D1" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
        </View>
      </View>

      {/* 清空确认 Modal */}
      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClearModalVisible(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setClearModalVisible(false)}>
          <Pressable style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, width: '80%', maxWidth: 320 }} onPress={(e) => e.stopPropagation()}>
            <View className="items-center mb-5">
              <View className="w-14 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <FontAwesome6 name="trash-can" size={22} color="#DC2626" />
              </View>
            </View>
            <Text className="text-stone-900 text-lg font-bold text-center mb-2">确认清空</Text>
            <Text className="text-stone-500 text-sm text-center mb-6">将删除所有历史记录，此操作不可恢复。确定要清空吗？</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setClearModalVisible(false)}
                className="flex-1 py-3.5 rounded-xl"
                style={{ backgroundColor: '#F5F5F4' }}
              >
                <Text className="text-stone-700 text-center font-semibold">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClearConfirm}
                disabled={clearing}
                className="flex-1 py-3.5 rounded-xl"
                style={{ backgroundColor: clearing ? '#FCA5A5' : '#DC2626' }}
              >
                <Text className="text-white text-center font-semibold">
                  {clearing ? '清空中...' : '清空'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function StatItem({ icon, label, value, color, suffix }: { icon: string; label: string; value: number; color: string; suffix?: string }) {
  return (
    <View className="flex-1 items-center">
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-1.5" style={{ backgroundColor: color + '12' }}>
        <FontAwesome6 name={icon} size={15} color={color} />
      </View>
      <Text className="text-stone-800 text-lg font-bold">{value}{suffix || ''}</Text>
      <Text className="text-stone-400 text-xs mt-0.5">{label}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="items-center mt-20">
      <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: '#F5F5F4' }}>
        <FontAwesome6 name="clock-rotate-left" size={28} color="#D6D3D1" />
      </View>
      <Text className="text-stone-400 text-base font-medium">暂无历史记录</Text>
      <Text className="text-stone-300 mt-1 text-sm">完成练习后这里会显示成绩</Text>
    </View>
  );
}
