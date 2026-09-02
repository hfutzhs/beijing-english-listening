import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { fetchQuestions, fetchAnsweredQuestions, type Question, type QuestionType } from '@/utils/api';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';

const TYPE_CONFIG: Record<string, { title: string; icon: string; color: string; bgColor: string; lightBg: string; maxScore: number; subtitle: string }> = {
  read_aloud: { title: '短文朗读', icon: 'book-open', color: '#EA580C', bgColor: '#FFF7ED', lightBg: '#FFFBF5', maxScore: 9, subtitle: '朗读短文，智能评分' },
  listen_choose: { title: '听后选择', icon: 'headphones', color: '#0EA5E9', bgColor: '#F0F9FF', lightBg: '#F8FDFF', maxScore: 9, subtitle: '听录音，选出正确答案' },
  listen_answer: { title: '听后回答', icon: 'comment', color: '#059669', bgColor: '#ECFDF5', lightBg: '#F6FEFA', maxScore: 12, subtitle: '听录音，口头或文字回答' },
  listen_retell: { title: '听后转述', icon: 'arrows-retweet', color: '#7C3AED', bgColor: '#F5F3FF', lightBg: '#FBFAFF', maxScore: 10, subtitle: '听录音，转述核心信息' },
};

const FLAT_LIST_TYPES: QuestionType[] = ['read_aloud', 'listen_retell'];

interface PracticeListProps {
  type?: QuestionType;
}

export default function PracticeListScreen({ type: propType }: PracticeListProps = {}) {
  const params = useSafeSearchParams<{ type?: string }>();
  const type = (propType || params.type || 'read_aloud') as QuestionType;
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.read_aloud;
  const useFlatList = FLAT_LIST_TYPES.includes(type);

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<number>>(new Set());
  const deviceId = useDeviceId();
  const insets = useSafeAreaInsets();
  const { isTablet, contentPadding, cardColumns, maxContentWidth, isLandscape } = useResponsive();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, answered] = await Promise.all([
        fetchQuestions({ type }),
        deviceId ? fetchAnsweredQuestions(deviceId, type) : Promise.resolve([] as number[]),
      ]);
      setQuestions(data);
      setAnsweredIds(new Set(answered));
      if (data.length > 0) {
        setSelectedPaperId(data[0].paper_id);
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [type, deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const paperIds = React.useMemo(() => {
    const set = new Set<number>();
    for (const q of questions) set.add(q.paper_id);
    return Array.from(set).sort((a, b) => a - b);
  }, [questions]);

  const displayQuestions = React.useMemo(() => {
    if (useFlatList) return questions;
    if (selectedPaperId === null) return [];
    return questions.filter(q => q.paper_id === selectedPaperId);
  }, [questions, selectedPaperId, useFlatList]);

  const answeredCount = displayQuestions.filter(q => answeredIds.has(q.id)).length;

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']} backgroundColor={config.color} statusBarStyle="light">
      <View className="flex-1" style={{ backgroundColor: config.lightBg, alignItems: isTablet ? 'center' : 'stretch' }}>
        <View style={{ width: isTablet ? maxContentWidth : '100%', backgroundColor: config.lightBg }}>
        {/* Header with gradient */}
        <View style={{ backgroundColor: config.color, paddingTop: insets.top }}>
          <View style={{
            paddingHorizontal: contentPadding,
            paddingBottom: 20,
            backgroundColor: config.color,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            shadowColor: config.color,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 6,
          }}>
            <View className="flex-row items-center">
              <View style={{
                width: 52, height: 52,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FontAwesome6 name={config.icon as any} size={22} color="#FFFFFF" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-white text-2xl font-bold" style={{ letterSpacing: 0.5 }}>{config.title}</Text>
                <Text className="text-white/80 text-sm mt-1">{config.subtitle}</Text>
              </View>
              {type === 'read_aloud' && (
                <Link href="/scoring-guide?type=read_aloud" asChild>
                  <TouchableOpacity style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 12,
                  }}>
                    <Text className="text-white text-sm font-semibold">查看标准</Text>
                  </TouchableOpacity>
                </Link>
              )}
            </View>
            {/* Stats bar */}
            {!loading && displayQuestions.length > 0 && (
              <View className="flex-row mt-4 items-center">
                <View className="flex-row items-center">
                  <FontAwesome6 name="list-ul" size={11} color="rgba(255,255,255,0.7)" />
                  <Text className="text-white/90 text-xs font-medium ml-1.5">{displayQuestions.length} 题</Text>
                </View>
                <View className="flex-row items-center ml-4">
                  <FontAwesome6 name="check-double" size={11} color="rgba(255,255,255,0.7)" />
                  <Text className="text-white/90 text-xs font-medium ml-1.5">已做 {answeredCount}</Text>
                </View>
                <View className="flex-row items-center ml-4">
                  <FontAwesome6 name="star" size={11} color="rgba(255,255,255,0.7)" />
                  <Text className="text-white/90 text-xs font-medium ml-1.5">满分 {config.maxScore}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Paper Tabs */}
        {!useFlatList && paperIds.length > 0 && (
          <View style={{ backgroundColor: 'transparent', marginTop: 12 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: contentPadding, paddingVertical: 8 }}
            >
              {paperIds.map((pid) => {
                const isActive = pid === selectedPaperId;
                return (
                  <TouchableOpacity
                    key={pid}
                    onPress={() => setSelectedPaperId(pid)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      marginRight: 8,
                      backgroundColor: isActive ? config.color : '#FFFFFF',
                      shadowColor: isActive ? config.color : '#000000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isActive ? 0.2 : 0.04,
                      shadowRadius: 6,
                      elevation: isActive ? 3 : 1,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isActive ? '#FFFFFF' : '#78716C',
                    }}>
                      试卷 {pid}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Question List */}
        <ScrollView className="flex-1 pt-3" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: 40 }}
        >
          {loading ? (
            <View className="items-center py-20">
              <ActivityIndicator size="large" color={config.color} />
              <Text style={{ color: '#A8A29E', marginTop: 16, fontSize: 14 }}>加载题目中...</Text>
            </View>
          ) : error ? (
            <View className="items-center py-20">
              <View style={{
                width: 64, height: 64, borderRadius: 20,
                backgroundColor: '#FEF2F2',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <FontAwesome6 name="circle-exclamation" size={28} color="#EF4444" />
              </View>
              <Text style={{ color: '#78716C', marginTop: 16, fontSize: 14 }}>{error}</Text>
              <TouchableOpacity onPress={loadData} style={{
                marginTop: 16, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
                backgroundColor: config.color,
              }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>重试</Text>
              </TouchableOpacity>
            </View>
          ) : displayQuestions.length === 0 ? (
            <View className="items-center py-20">
              <View style={{
                width: 64, height: 64, borderRadius: 20,
                backgroundColor: config.bgColor,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <FontAwesome6 name="inbox" size={28} color={config.color} />
              </View>
              <Text style={{ color: '#A8A29E', marginTop: 16, fontSize: 14 }}>暂无题目</Text>
            </View>
          ) : (
            <View style={{ gap: 12, flexDirection: cardColumns > 1 ? 'row' : 'column', flexWrap: 'wrap' }}>
              {displayQuestions.map((q, idx) => (
                <View key={q.id} style={cardColumns > 1 ? { width: `${100 / cardColumns - 2}%`, marginBottom: 12 } : { width: '100%' }}>
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={idx + 1}
                  color={config.color}
                  bgColor={config.bgColor}
                  type={type}
                  answered={answeredIds.has(q.id)}
                />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        </View>
      </View>
    </Screen>
  );
}

function QuestionCard({
  question,
  index,
  color,
  bgColor,
  type,
  answered,
}: {
  question: Question;
  index: number;
  color: string;
  bgColor: string;
  type: QuestionType;
  answered: boolean;
}) {
  const router = useSafeRouter();

  const getPreview = () => {
    const content = typeof question.content === 'string' ? JSON.parse(question.content) : question.content;
    if (type === 'read_aloud') {
      const text = content.passage || '';
      return text.substring(0, 80) + '...';
    }
    if (type === 'listen_choose') {
      return content.question || '';
    }
    if (type === 'listen_answer') {
      return content.question || '';
    }
    if (type === 'listen_retell') {
      return content.topic || '';
    }
    return '';
  };

  const handlePress = () => {
    router.push('/practice-answer', { questionId: question.id, type });
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        paddingTop: 14,
        shadowColor: color,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}
      activeOpacity={0.85}
    >
      {/* Top color accent bar */}
      <View style={{
        position: 'absolute',
        top: 0, left: 16, right: 16,
        height: 3,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        backgroundColor: answered ? '#10B981' : color,
        opacity: answered ? 0.5 : 0.3,
      }} />

      <View className="flex-row items-center">
        {/* Number badge */}
        <View style={{
          width: 36, height: 36,
          borderRadius: 12,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color }}>{index}</Text>
        </View>

        <View className="flex-1 ml-3">
          {/* Tags row */}
          <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: bgColor,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color }}>试卷 {question.paper_id}</Text>
            </View>
            {answered && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: '#10B98115',
                gap: 3,
              }}>
                <FontAwesome6 name="check" size={9} color="#10B981" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981' }}>已做</Text>
              </View>
            )}
          </View>
          {/* Source */}
          {question.title ? (
            <Text style={{ color: '#A8A29E', fontSize: 11, marginTop: 4 }} numberOfLines={1}>
              {question.title}
            </Text>
          ) : null}
          {/* Preview text */}
          <Text style={{ color: '#44403C', fontSize: 14, fontWeight: '500', marginTop: 4, lineHeight: 20 }} numberOfLines={2}>
            {getPreview()}
          </Text>
        </View>

        <FontAwesome6 name="chevron-right" size={12} color="#D6D3D1" style={{ marginLeft: 4 }} />
      </View>
    </TouchableOpacity>
  );
}
