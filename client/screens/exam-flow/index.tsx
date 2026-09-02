import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useResponsive } from '@/hooks/useResponsive';
import {
  fetchQuestions, fetchStandardAudio, submitPractice,
  type Question,
} from '@/utils/api';

const SECTIONS = [
  { type: 'listen_choose', label: '选择', short: '选', color: '#0EA5E9', maxScore: 9 },
  { type: 'listen_answer', label: '回答', short: '答', color: '#059669', maxScore: 12 },
  { type: 'listen_retell', label: '转述', short: '述', color: '#7C3AED', maxScore: 10 },
  { type: 'read_aloud', label: '朗读', short: '读', color: '#EA580C', maxScore: 9 },
] as const;

type SectionType = typeof SECTIONS[number]['type'];

export default function ExamFlowScreen() {
  const router = useSafeRouter();
  const deviceId = useDeviceId();
  const { paperId } = useSafeSearchParams<{ paperId: number }>();
  const { maxWidthStyle } = useResponsive();

  const [questions, setQuestions] = useState<Record<SectionType, Question[]>>({} as any);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Record<string, any>>({});

  // Audio state
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [standardAudioUrl, setStandardAudioUrl] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Exam submitted state
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScoring, setExamScoring] = useState(false);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [recordedUris, setRecordedUris] = useState<Record<number, string | null>>({});

  const loadData = useCallback(async () => {
    if (!paperId) return;
    setLoading(true);
    try {
      const data = await fetchQuestions({ paperId });
      const grouped: Record<string, Question[]> = {};
      for (const q of data) {
        if (!grouped[q.type]) grouped[q.type] = [];
        grouped[q.type].push(q);
      }
      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => (a.section_index || 0) - (b.section_index || 0));
      }
      setQuestions(grouped as any);
    } catch (e: any) {
      Alert.alert('错误', e.message || '加载试卷失败');
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cleanup
  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const section = SECTIONS[currentSection];
  const sectionQuestions = questions[section.type as SectionType] || [];
  const question = sectionQuestions[currentQ];

  // Build flat list of all tabs
  const allTabs = useMemo(() => {
    const tabs: { sectionIdx: number; qIdx: number; label: string; color: string }[] = [];
    SECTIONS.forEach((s, sIdx) => {
      const qs = questions[s.type as SectionType] || [];
      qs.forEach((_, qIdx) => {
        tabs.push({
          sectionIdx: sIdx,
          qIdx,
          label: `${s.short}${qIdx + 1}`,
          color: s.color,
        });
      });
    });
    return tabs;
  }, [questions]);

  const currentTabIndex = allTabs.findIndex(
    t => t.sectionIdx === currentSection && t.qIdx === currentQ
  );

  const resetAudioState = useCallback(() => {
    setRecordedUri(null);
    setStandardAudioUrl(null);
    setPlaying(false);
    setAudioLoading(false);
    soundRef.current?.unloadAsync().catch(() => undefined);
  }, []);

  const switchToTab = useCallback((sectionIdx: number, qIdx: number) => {
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
      recordingRef.current = null;
      setRecording(false);
    }
    soundRef.current?.pauseAsync().catch(() => undefined);
    resetAudioState();
    setCurrentSection(sectionIdx);
    setCurrentQ(qIdx);
  }, [resetAudioState]);

  // Recording
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('提示', '需要麦克风权限才能录音');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecording(true);
    } catch (e: any) {
      Alert.alert('错误', '录音启动失败: ' + e.message);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setRecordedUri(uri);
      setRecording(false);
    } catch (e: any) {
      Alert.alert('错误', '停止录音失败: ' + e.message);
      setRecording(false);
    }
  };

  // Standard audio
  const playStandardAudio = async () => {
    if (!question) return;
    try {
      if (playing) {
        await soundRef.current?.pauseAsync();
        setPlaying(false);
        return;
      }

      let url = standardAudioUrl;
      if (!url) {
        setAudioLoading(true);
        url = await fetchStandardAudio(question.id);
        setStandardAudioUrl(url);
        setAudioLoading(false);
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      await sound.playAsync();
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlaying(false);
        }
      });
    } catch (e: any) {
      setAudioLoading(false);
      Alert.alert('错误', '播放失败: ' + e.message);
    }
  };

  // Submit single question
  const handleSubmit = async () => {
    if (!question) return;

    if (section.type === 'listen_choose') {
      if (answers[question.id] === undefined) {
        Alert.alert('提示', '请选择一个答案');
        return;
      }
    } else if (section.type === 'read_aloud') {
      if (!recordedUri) {
        Alert.alert('提示', '请先录音');
        return;
      }
    } else {
      if (!answers[question.id] && !recordedUri) {
        Alert.alert('提示', '请先回答问题（可录音或直接打字）');
        return;
      }
    }

    // Save recorded URI for this question
    if (recordedUri) {
      setRecordedUris(prev => ({ ...prev, [question.id]: recordedUri }));
    }

    // Mark as answered (no API call, no result display)
    setAnswered(prev => new Set(prev).add(question.id));
  };

  // Count answered
  const submittedCount = useMemo(() => {
    return answered.size;
  }, [answered]);

  const totalCount = useMemo(() => {
    let total = 0;
    SECTIONS.forEach((s) => {
      const qs = questions[s.type as SectionType] || [];
      total += qs.length;
    });
    return total;
  }, [questions]);

  const totalScore = useMemo(() => {
    return Object.values(results).reduce((sum: number, r: any) => sum + (r.score || 0), 0);
  }, [results]);

  // Submit exam (final) - score all questions
  const handleFinishExam = async () => {
    if (!deviceId) return;
    const unanswered = totalCount - submittedCount;
    const doSubmit = async () => {
      setExamScoring(true);
      const devId = deviceId;
      try {
        const allQuestions: { q: Question; sectionIdx: number }[] = [];
        SECTIONS.forEach((s, sIdx) => {
          const qs = questions[s.type as SectionType] || [];
          qs.forEach(q => allQuestions.push({ q, sectionIdx: sIdx }));
        });

        const newResults: Record<string, any> = {};

        for (const { q } of allQuestions) {
          const isAnswered = answered.has(q.id);
          if (!isAnswered) {
            // Empty answer = 0 score
            newResults[q.id] = { score: 0, max_score: q.max_score, transcription: '', analysis: '未作答', suggestions: '建议下次完成所有题目' };
            continue;
          }

          try {
            const recordedUri = recordedUris[q.id];
            const answerText = answers[q.id];

            let response;
            if (recordedUri) {
              response = await submitPractice(q.id, recordedUri, devId, 'mock');
            } else if (answerText !== undefined && answerText !== '') {
              response = await submitPractice(q.id, null, devId, 'mock', String(answerText));
            } else {
              newResults[q.id] = { score: 0, max_score: q.max_score, transcription: '', analysis: '未作答', suggestions: '建议下次完成所有题目' };
              continue;
            }

            newResults[q.id] = response;
          } catch (e: any) {
            newResults[q.id] = { score: 0, max_score: q.max_score, transcription: '', analysis: '评分失败', suggestions: e.message || '请重试' };
          }
        }

        setResults(newResults);
        setExamSubmitted(true);
      } catch (e: any) {
        Alert.alert('错误', e.message || '交卷失败');
      } finally {
        setExamScoring(false);
      }
    };

    if (unanswered > 0) {
      Alert.alert(
        '确认交卷',
        `还有 ${unanswered} 道题未提交，确定交卷吗？未提交的题目将按0分计算。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确定交卷', onPress: doSubmit },
        ]
      );
    } else {
      doSubmit();
    }
  };

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#B45309" />
          <Text className="text-stone-400 mt-3">加载试卷...</Text>
        </View>
      </Screen>
    );
  }

  if (!question) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-400">题目加载失败</Text>
        </View>
      </Screen>
    );
  }

  const content = typeof question.content === 'string' ? JSON.parse(question.content) : question.content;
  const isAnswered = answered.has(question.id);
  const hasResult = examSubmitted && !!results[question.id];
  const result = results[question.id];
  const locked = isAnswered || examSubmitted;

  // ===== Exam Result View =====
  if (examSubmitted) {
    return (
      <Screen>
        <View className="flex-1" style={[{ backgroundColor: '#FFFBF5' }, maxWidthStyle]}>
          {/* Header */}
          <View className="px-6 pt-12 pb-8" style={{ backgroundColor: '#B45309' }}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                  <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold">考试结果 · 模拟试题 {paperId}</Text>
              </View>
              <View className="bg-white/20 rounded-full px-3 py-1">
                <Text className="text-white text-xs font-medium">{totalScore >= 24 ? '及格' : '未及格'}</Text>
              </View>
            </View>
            <View className="flex-row items-end mt-3">
              <Text className="text-white/80 text-sm mb-1">总分</Text>
              <Text className="text-white text-5xl font-bold ml-3" style={{ lineHeight: 56 }}>{totalScore}</Text>
              <Text className="text-white/80 text-sm mb-1 ml-1">/ 40</Text>
            </View>
            {/* Score bar */}
            <View className="mt-3 h-1.5 rounded-full bg-white/20">
              <View className="h-1.5 rounded-full bg-white" style={{ width: `${Math.min(totalScore / 40 * 100, 100)}%` }} />
            </View>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
            {/* Summary */}
            <View className="bg-white rounded-3xl p-6 mb-4" style={{ shadowColor: '#B45309', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <Text className="text-stone-800 text-base font-bold mb-4">成绩单</Text>
              {SECTIONS.map((s) => {
                const qs = questions[s.type as SectionType] || [];
                const sectionScore = qs.reduce((sum, q) => sum + (results[q.id]?.score || 0), 0);
                const sectionMax = qs.length * s.maxScore;
                const passRate = sectionMax > 0 ? (sectionScore / sectionMax) : 0;
                return (
                  <View key={s.type} className="flex-row items-center justify-between py-2" style={{ borderBottomWidth: 0.5, borderBottomColor: '#F5F5F4' }}>
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: `${s.color}15` }}>
                        <FontAwesome6 name={
                          s.type === 'listen_choose' ? 'list-check' :
                          s.type === 'listen_answer' ? 'comment' :
                          s.type === 'listen_retell' ? 'diagram-project' :
                          'book-open'
                        } size={14} color={s.color} />
                      </View>
                      <Text className="text-stone-700 text-sm font-medium">{s.label}（{qs.length}题）</Text>
                    </View>
                    <Text className="text-sm font-bold" style={{ color: passRate >= 0.6 ? '#10B981' : '#EF4444' }}>
                      {sectionScore} / {sectionMax}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Wrong answer analysis */}
            <Text className="text-stone-800 text-base font-bold mb-3">错题分析</Text>
            {allTabs.map((tab) => {
              const tabQuestion = questions[SECTIONS[tab.sectionIdx].type as SectionType]?.[tab.qIdx];
              if (!tabQuestion) return null;
              const r = results[tabQuestion.id];
              if (!r) {
                // Unanswered
                const tabContent = typeof tabQuestion.content === 'string' ? JSON.parse(tabQuestion.content) : tabQuestion.content;
                return (
                  <View key={`${tab.sectionIdx}-${tab.qIdx}`} className="bg-white rounded-2xl p-4 mb-3" style={{ borderLeftWidth: 3, borderLeftColor: '#EF4444', shadowColor: '#B45309', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm font-bold" style={{ color: SECTIONS[tab.sectionIdx].color }}>
                        {SECTIONS[tab.sectionIdx].label} 第{tab.qIdx + 1}题
                      </Text>
                      <Text className="text-red-500 text-xs font-bold">未作答</Text>
                    </View>
                    <Text className="text-stone-600 text-xs leading-5">
                      {tabContent.question || tabContent.passage?.slice(0, 80) || '未作答'}
                    </Text>
                  </View>
                );
              }
              const tabContent = typeof tabQuestion.content === 'string' ? JSON.parse(tabQuestion.content) : tabQuestion.content;
              const isCorrect = r.feedback?.isCorrect || (r.score >= (tabQuestion.max_score || 9) * 0.6);
              if (isCorrect) return null;

              return (
                <View key={`${tab.sectionIdx}-${tab.qIdx}`} className="bg-white rounded-2xl p-4 mb-3" style={{ borderLeftWidth: 3, borderLeftColor: '#EF4444', shadowColor: '#B45309', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-bold" style={{ color: SECTIONS[tab.sectionIdx].color }}>
                      {SECTIONS[tab.sectionIdx].label} 第{tab.qIdx + 1}题
                    </Text>
                    <Text className="text-red-500 text-xs font-bold">{r.score} / {tabQuestion.max_score}分</Text>
                  </View>

                  {/* Question */}
                  <Text className="text-stone-700 text-xs leading-5 mb-2">
                    {tabContent.question || tabContent.passage?.slice(0, 100) + '...'}
                  </Text>

                  {/* Transcription */}
                  {r.transcription && (
                    <View className="bg-stone-100 rounded-lg p-2 mb-2">
                      <Text className="text-stone-400 text-xs mb-1">你的回答：</Text>
                      <Text className="text-stone-700 text-xs leading-5">{r.transcription}</Text>
                    </View>
                  )}

                  {/* Correct answer for listen_choose */}
                  {SECTIONS[tab.sectionIdx].type === 'listen_choose' && tabContent.correct_answer !== undefined && (
                    <View className="bg-emerald-50 rounded-lg p-2 mb-2">
                      <Text className="text-emerald-700 text-xs font-medium">
                        正确答案：{String.fromCharCode(65 + tabContent.correct_answer)}
                      </Text>
                    </View>
                  )}

                  {/* Sample answer for listen_answer */}
                  {SECTIONS[tab.sectionIdx].type === 'listen_answer' && tabContent.sample_answer && (
                    <View className="bg-sky-50 rounded-lg p-2 mb-2">
                      <Text className="text-sky-700 text-xs font-medium">
                        参考答案：{tabContent.sample_answer}
                      </Text>
                    </View>
                  )}

                  {/* Error analysis */}
                  {r.analysis && (
                    <View className="bg-red-50 rounded-lg p-2 mb-2">
                      <Text className="text-red-600 text-xs font-bold mb-1">错误分析</Text>
                      <Text className="text-stone-700 text-xs leading-5">{r.analysis}</Text>
                    </View>
                  )}

                  {/* Accuracy/Fluency for read_aloud */}
                  {SECTIONS[tab.sectionIdx].type === 'read_aloud' && r.accuracy_analysis && (
                    <View className="bg-red-50 rounded-lg p-2 mb-2">
                      <Text className="text-red-600 text-xs font-bold mb-1">准确性问题</Text>
                      <Text className="text-stone-700 text-xs leading-5">{r.accuracy_analysis}</Text>
                    </View>
                  )}
                  {SECTIONS[tab.sectionIdx].type === 'read_aloud' && r.fluency_analysis && (
                    <View className="bg-orange-50 rounded-lg p-2 mb-2">
                      <Text className="text-orange-600 text-xs font-bold mb-1">流利度问题</Text>
                      <Text className="text-stone-700 text-xs leading-5">{r.fluency_analysis}</Text>
                    </View>
                  )}

                  {/* Suggestions */}
                  {r.suggestions && (
                    <View className="bg-amber-50 rounded-lg p-2">
                      <Text className="text-amber-700 text-xs font-bold mb-1">改进建议</Text>
                      <Text className="text-stone-700 text-xs leading-5">{r.suggestions}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* All correct message */}
            {totalScore >= 36 && (
              <View className="bg-emerald-50 rounded-2xl p-5 items-center mb-4">
                <FontAwesome6 name="star" size={32} color="#10B981" />
                <Text className="text-emerald-700 text-lg font-bold mt-2">优秀！</Text>
                <Text className="text-emerald-600 text-sm mt-1">总分 {totalScore}/40，继续努力！</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => router.replace('/history')}
              className="rounded-2xl py-4 items-center mt-2"
              style={{ backgroundColor: '#B45309', shadowColor: '#B45309', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-sm">查看历史记录</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Screen>
    );
  }

  // ===== Exam Flow View =====
  return (
    <Screen>
      <View className="flex-1" style={[{ backgroundColor: '#FFFBF5' }, maxWidthStyle]}>
        {/* Header */}
        <View className="px-6 pt-12 pb-3" style={{ backgroundColor: '#B45309' }}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <TouchableOpacity onPress={() => router.back()} className="mr-3">
                <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-bold">考试模拟 · 模拟试题 {paperId}</Text>
            </View>
            <Text className="text-white text-xs">
              已答 {submittedCount} / {totalCount}
            </Text>
          </View>

          {/* Tab bar - all questions */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
            {allTabs.map((tab) => {
              const isActive = tab.sectionIdx === currentSection && tab.qIdx === currentQ;
              const tabQuestion = questions[SECTIONS[tab.sectionIdx].type as SectionType]?.[tab.qIdx];
              const isDone = tabQuestion && answered.has(tabQuestion.id);
              return (
                <TouchableOpacity
                  key={`${tab.sectionIdx}-${tab.qIdx}`}
                  onPress={() => switchToTab(tab.sectionIdx, tab.qIdx)}
                  className="mr-2 items-center justify-center rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                    minWidth: 48,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: isActive ? tab.color : '#FFFFFF' }}
                  >
                    {tab.label}
                  </Text>
                  {isDone && (
                    <View
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center"
                      style={{ backgroundColor: '#10B981' }}
                    >
                      <FontAwesome6 name="check" size={8} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
          {/* Section label */}
          <View className="flex-row items-center mb-4">
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${section.color}15` }}>
              <Text className="text-xs font-bold" style={{ color: section.color }}>
                {section.label} · 第 {currentQ + 1} / {sectionQuestions.length} 题
              </Text>
            </View>
            <Text className="text-stone-400 text-xs ml-2">满分 {section.maxScore} 分</Text>
          </View>

          {/* Question content */}
          <View className="bg-white rounded-3xl p-5" style={{ shadowColor: section.color, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
            {section.type === 'listen_choose' && (
              <ListenChooseUI
                content={content}
                audioScript={question.audio_script}
                selected={answers[question.id]}
                onSelect={(idx: number) => setAnswers(prev => ({ ...prev, [question.id]: idx }))}
                playing={playing}
                audioLoading={audioLoading}
                onPlayAudio={playStandardAudio}
                locked={locked}
                result={result}
              />
            )}

            {section.type === 'listen_answer' && (
              <ListenAnswerUI
                content={content}
                audioScript={question.audio_script}
                answer={answers[question.id] || ''}
                onAnswer={(text: string) => setAnswers(prev => ({ ...prev, [question.id]: text }))}
                playing={playing}
                audioLoading={audioLoading}
                onPlayAudio={playStandardAudio}
                recording={recording}
                recordedUri={recordedUri}
                onStartRecord={startRecording}
                onStopRecord={stopRecording}
                locked={locked}
                result={result}
              />
            )}

            {section.type === 'listen_retell' && (
              <ListenRetellUI
                content={content}
                audioScript={question.audio_script}
                recordedUri={recordedUri}
                recording={recording}
                onStartRecord={startRecording}
                onStopRecord={stopRecording}
                playing={playing}
                audioLoading={audioLoading}
                onPlayAudio={playStandardAudio}
                locked={locked}
                result={result}
              />
            )}

            {section.type === 'read_aloud' && (
              <ReadAloudUI
                content={content}
                recordedUri={recordedUri}
                recording={recording}
                standardAudioUrl={standardAudioUrl}
                playing={playing}
                audioLoading={audioLoading}
                onStartRecord={startRecording}
                onStopRecord={stopRecording}
                onPlayStandard={playStandardAudio}
                question={question}
                locked={locked}
                result={result}
              />
            )}

            {/* Submit button inside question - hide if already answered or exam submitted */}
            {!isAnswered && !examSubmitted && (
              <TouchableOpacity
                onPress={handleSubmit}
                className="rounded-2xl py-3.5 items-center mt-4"
                style={{ backgroundColor: section.color }}
                activeOpacity={0.8}
              >
                <Text className="text-white font-bold text-sm">提交</Text>
              </TouchableOpacity>
            )}

            {/* "已提交" indicator */}
            {isAnswered && !examSubmitted && (
              <View className="rounded-2xl py-3.5 items-center mt-4 bg-emerald-50">
                <Text className="text-emerald-600 font-bold text-sm">已提交</Text>
              </View>
            )}
          </View>

          {/* Result feedback */}
          {hasResult && (
            <View className="bg-white rounded-3xl p-5 mt-4" style={{ shadowColor: '#10B981', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-stone-400 text-xs font-bold">本题得分</Text>
                <Text
                  className="text-lg font-bold"
                  style={{ color: result.score >= question.max_score * 0.6 ? '#10B981' : '#EF4444' }}
                >
                  {result.score} / {question.max_score}
                </Text>
              </View>
              {/* Show result details based on correctness */}
              {section.type === 'listen_choose' && result.feedback && (
                <>
                  {result.feedback.isCorrect ? (
                    <Text className="text-emerald-600 text-sm font-medium">回答正确</Text>
                  ) : (
                    <View>
                      <Text className="text-red-600 text-sm font-medium mb-1">回答不正确</Text>
                      <Text className="text-stone-500 text-xs">
                        正确答案：{String.fromCharCode(65 + (content.correct_answer || 0))}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {(section.type === 'listen_answer' || section.type === 'listen_retell') && (
                <>
                  {result.transcription && (
                    <Text className="text-stone-600 text-sm mb-2">
                      识别结果：{result.transcription}
                    </Text>
                  )}
                  {result.score >= (question.max_score || 9) * 0.6 ? (
                    <Text className="text-emerald-600 text-sm font-medium">回答正确</Text>
                  ) : (
                    <View>
                      <Text className="text-red-600 text-sm font-medium mb-1">回答不正确</Text>
                      {result.analysis && (
                        <Text className="text-stone-600 text-sm leading-6 mb-2">{result.analysis}</Text>
                      )}
                      {result.suggestions && (
                        <Text className="text-stone-500 text-xs leading-5">{result.suggestions}</Text>
                      )}
                      {section.type === 'listen_answer' && content.sample_answer && (
                        <Text className="text-sky-600 text-xs mt-1">参考答案：{content.sample_answer}</Text>
                      )}
                    </View>
                  )}
                </>
              )}
              {section.type === 'read_aloud' && (
                <View>
                  {result.transcription && (
                    <Text className="text-stone-600 text-sm mb-2">
                      识别结果：{result.transcription}
                    </Text>
                  )}
                  {result.accuracy_analysis && (
                    <Text className="text-stone-600 text-sm leading-6 mb-1">
                      准确性：{result.accuracy_analysis}
                    </Text>
                  )}
                  {result.fluency_analysis && (
                    <Text className="text-stone-600 text-sm leading-6 mb-1">
                      流利度：{result.fluency_analysis}
                    </Text>
                  )}
                  {result.suggestions && (
                    <Text className="text-stone-500 text-xs leading-5">{result.suggestions}</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Bottom buttons: 上一题 / 下一题 / 交卷 */}
        <View className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-white" style={{ borderTopWidth: 1, borderTopColor: '#F5F5F4', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 5 }}>
          <View className="flex-row gap-3">
            {/* Previous */}
            {currentTabIndex > 0 && (
              <TouchableOpacity
                onPress={() => {
                  const prev = allTabs[currentTabIndex - 1];
                  switchToTab(prev.sectionIdx, prev.qIdx);
                }}
                className="rounded-2xl px-5 py-4 items-center justify-center"
                style={{ backgroundColor: '#F5F5F4' }}
                activeOpacity={0.8}
              >
                <FontAwesome6 name="chevron-left" size={14} color="#78716C" />
              </TouchableOpacity>
            )}

            {/* Next */}
            {currentTabIndex < allTabs.length - 1 && (
              <TouchableOpacity
                onPress={() => {
                  const next = allTabs[currentTabIndex + 1];
                  switchToTab(next.sectionIdx, next.qIdx);
                }}
                className="flex-1 rounded-2xl py-4 items-center"
                style={{ backgroundColor: '#B45309' }}
                activeOpacity={0.8}
              >
                <Text className="text-white font-bold text-sm">下一题</Text>
              </TouchableOpacity>
            )}

            {/* Submit exam */}
            <TouchableOpacity
              onPress={handleFinishExam}
              disabled={examScoring}
              className="rounded-2xl px-5 py-4 items-center justify-center"
              style={{ backgroundColor: submittedCount === totalCount ? '#10B981' : '#F5F5F4', borderWidth: submittedCount === totalCount ? 0 : 1, borderColor: '#D6D3D1' }}
              activeOpacity={0.8}
            >
              {examScoring ? (
                <ActivityIndicator size="small" color="#78716C" />
              ) : (
                <>
                  <FontAwesome6 name="flag-checkered" size={16} color={submittedCount === totalCount ? '#FFFFFF' : '#78716C'} />
                  <Text className="text-xs font-bold mt-0.5" style={{ color: submittedCount === totalCount ? '#FFFFFF' : '#78716C' }}>
                    交卷
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Screen>
  );
}

// ===== Sub-UI Components =====

function ListenChooseUI({ content, audioScript, selected, onSelect, playing, audioLoading, onPlayAudio, locked, result }: any) {
  const isCorrect = result?.feedback?.isCorrect;
  const correctAnswer = content?.correct_answer;

  return (
    <View>
      <View className="flex-row items-center mb-3">
        <FontAwesome6 name="headphones" size={16} color="#0EA5E9" />
        <Text className="text-stone-800 text-sm font-bold ml-2">听后选择</Text>
      </View>
      {/* Audio player - at top */}
      <TouchableOpacity
        onPress={onPlayAudio}
        className="flex-row items-center bg-sky-50 rounded-xl px-4 py-3 mb-4"
        activeOpacity={0.8}
      >
        {audioLoading ? (
          <ActivityIndicator size="small" color="#0EA5E9" />
        ) : (
          <FontAwesome6 name={playing ? 'pause' : 'play'} size={16} color="#0EA5E9" />
        )}
        <Text className="text-sky-700 text-sm font-medium ml-2">
          {audioLoading ? '加载中...' : playing ? '暂停' : '播放听力原文'}
        </Text>
      </TouchableOpacity>

      <Text className="text-stone-800 text-base font-medium mb-4">{content.question}</Text>
      {content.options?.map((opt: string, idx: number) => {
        const isSelected = selected === idx;
        const showCorrect = locked && idx === correctAnswer;
        const showWrong = locked && isSelected && idx !== correctAnswer;
        return (
          <TouchableOpacity
            key={idx}
            onPress={() => !locked && onSelect(idx)}
            className="flex-row items-center rounded-xl px-4 py-3 mb-2"
            style={{
              backgroundColor: showCorrect ? '#10B98115' : showWrong ? '#EF444415' : isSelected ? '#0EA5E915' : '#F5F5F4',
              borderWidth: showCorrect ? 1.5 : showWrong ? 1.5 : isSelected ? 1.5 : 0,
              borderColor: showCorrect ? '#10B981' : showWrong ? '#EF4444' : isSelected ? '#0EA5E9' : 'transparent',
            }}
            activeOpacity={0.7}
            disabled={locked}
          >
            <View
              className="w-6 h-6 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: showCorrect ? '#10B981' : showWrong ? '#EF4444' : isSelected ? '#0EA5E9' : '#D6D3D1' }}
            >
              {(isSelected || showCorrect) && <FontAwesome6 name="check" size={10} color="#FFFFFF" />}
            </View>
            <Text className={`text-sm flex-1 ${showCorrect ? 'text-emerald-800 font-medium' : showWrong ? 'text-red-800 font-medium' : isSelected ? 'text-sky-800 font-medium' : 'text-stone-700'}`}>
              {String.fromCharCode(65 + idx)}. {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ListenAnswerUI({ content, audioScript, answer, onAnswer, playing, audioLoading, onPlayAudio, recording, recordedUri, onStartRecord, onStopRecord, locked, result }: any) {
  const displayText = result?.transcription || answer;

  return (
    <View>
      <View className="flex-row items-center mb-3">
        <FontAwesome6 name="comment" size={16} color="#059669" />
        <Text className="text-stone-800 text-sm font-bold ml-2">听后回答</Text>
      </View>
      {/* Audio player - at top */}
      <TouchableOpacity
        onPress={onPlayAudio}
        className="flex-row items-center bg-emerald-50 rounded-xl px-4 py-3 mb-4"
        activeOpacity={0.8}
      >
        {audioLoading ? (
          <ActivityIndicator size="small" color="#059669" />
        ) : (
          <FontAwesome6 name={playing ? 'pause' : 'play'} size={16} color="#059669" />
        )}
        <Text className="text-emerald-700 text-sm font-medium ml-2">
          {audioLoading ? '加载中...' : playing ? '暂停' : '播放听力原文'}
        </Text>
      </TouchableOpacity>

      <Text className="text-stone-800 text-base font-medium mb-3">{content.question}</Text>
      <TextInput
        value={displayText}
        onChangeText={onAnswer}
        placeholder="输入你的回答..."
        placeholderTextColor="#A8A29E"
        className="bg-stone-100 rounded-xl px-4 py-3 text-stone-800 text-sm"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        editable={!locked}
      />

      {/* Record button */}
      {!locked && (
        <>
          <TouchableOpacity
            onPress={recording ? onStopRecord : onStartRecord}
            className="flex-row items-center justify-center rounded-xl py-3.5 mt-3"
            style={{ backgroundColor: recording ? '#EF4444' : '#059669' }}
            activeOpacity={0.8}
          >
            <FontAwesome6 name={recording ? 'stop' : 'microphone'} size={16} color="#FFFFFF" />
            <Text className="text-white font-bold ml-2 text-sm">{recording ? '停止录音' : recordedUri ? '重新录音' : '语音回答'}</Text>
          </TouchableOpacity>
          {recordedUri && !recording && (
            <Text className="text-emerald-600 text-xs text-center mt-2">录音完成，请提交</Text>
          )}
        </>
      )}
    </View>
  );
}

function ListenRetellUI({ content, audioScript, recordedUri, recording, onStartRecord, onStopRecord, playing, audioLoading, onPlayAudio, locked, result }: any) {
  return (
    <View>
      <View className="flex-row items-center mb-3">
        <FontAwesome6 name="diagram-project" size={16} color="#7C3AED" />
        <Text className="text-stone-800 text-sm font-bold ml-2">听后转述</Text>
      </View>
      {/* Audio player - at top */}
      <TouchableOpacity
        onPress={onPlayAudio}
        className="flex-row items-center bg-violet-50 rounded-xl px-4 py-3 mb-4"
        activeOpacity={0.8}
      >
        {audioLoading ? (
          <ActivityIndicator size="small" color="#7C3AED" />
        ) : (
          <FontAwesome6 name={playing ? 'pause' : 'play'} size={16} color="#7C3AED" />
        )}
        <Text className="text-violet-700 text-sm font-medium ml-2">
          {audioLoading ? '加载中...' : playing ? '暂停' : '播放听力原文'}
        </Text>
      </TouchableOpacity>

      {/* Info table */}
      <Text className="text-stone-600 text-sm mb-2">{content.intro}</Text>
      <View className="gap-2 mb-4">
        {content.info_points?.map((pt: any, idx: number) => (
          <View key={idx} className="flex-row items-center bg-violet-50 rounded-lg px-3 py-2">
            <View className="w-7 h-7 rounded-full bg-violet-200 items-center justify-center mr-3">
              <Text className="text-violet-700 text-xs font-bold">{idx + 1}</Text>
            </View>
            <Text className="text-stone-700 text-sm flex-1">{pt.label}</Text>
          </View>
        ))}
      </View>

      {/* Record */}
      {!locked ? (
        <>
          <TouchableOpacity
            onPress={recording ? onStopRecord : onStartRecord}
            className="flex-row items-center justify-center rounded-xl py-4"
            style={{ backgroundColor: recording ? '#EF4444' : '#7C3AED' }}
            activeOpacity={0.8}
          >
            <FontAwesome6 name={recording ? 'stop' : 'microphone'} size={18} color="#FFFFFF" />
            <Text className="text-white font-bold ml-2">{recording ? '停止录音' : recordedUri ? '重新录音' : '开始录音'}</Text>
          </TouchableOpacity>
          {recordedUri && !recording && (
            <Text className="text-emerald-600 text-xs text-center mt-2">录音完成，请提交</Text>
          )}
        </>
      ) : (
        result?.transcription && (
          <View className="bg-stone-100 rounded-xl p-3 mt-2">
            <Text className="text-stone-400 text-xs mb-1">你的转述：</Text>
            <Text className="text-stone-700 text-sm leading-5">{result.transcription}</Text>
          </View>
        )
      )}
    </View>
  );
}

function ReadAloudUI({ content, recordedUri, recording, standardAudioUrl, playing, audioLoading, onStartRecord, onStopRecord, onPlayStandard, question, locked, result }: any) {
  return (
    <View>
      <View className="flex-row items-center mb-3">
        <FontAwesome6 name="book-open" size={16} color="#EA580C" />
        <Text className="text-stone-800 text-sm font-bold ml-2">短文朗读</Text>
      </View>
      <Text className="text-stone-800 text-base leading-7 mb-4">{content.passage}</Text>

      {/* Standard audio */}
      <TouchableOpacity
        onPress={onPlayStandard}
        className="flex-row items-center bg-orange-50 rounded-xl px-4 py-3 mb-4"
        activeOpacity={0.8}
      >
        {audioLoading ? (
          <ActivityIndicator size="small" color="#EA580C" />
        ) : (
          <FontAwesome6 name={playing ? 'pause' : 'volume-high'} size={16} color="#EA580C" />
        )}
        <Text className="text-orange-700 text-sm font-medium ml-2">
          {audioLoading ? '加载中...' : playing ? '暂停' : '播放标准朗读'}
        </Text>
      </TouchableOpacity>

      {/* Record */}
      {!locked ? (
        <>
          <TouchableOpacity
            onPress={recording ? onStopRecord : onStartRecord}
            className="flex-row items-center justify-center rounded-xl py-4"
            style={{ backgroundColor: recording ? '#EF4444' : '#EA580C' }}
            activeOpacity={0.8}
          >
            <FontAwesome6 name={recording ? 'stop' : 'microphone'} size={18} color="#FFFFFF" />
            <Text className="text-white font-bold ml-2">{recording ? '停止录音' : recordedUri ? '重新录音' : '开始录音'}</Text>
          </TouchableOpacity>
          {recordedUri && !recording && (
            <Text className="text-emerald-600 text-xs text-center mt-2">录音完成，请提交</Text>
          )}
        </>
      ) : (
        result?.transcription && (
          <View className="bg-stone-100 rounded-xl p-3 mt-2">
            <Text className="text-stone-400 text-xs mb-1">你的朗读识别：</Text>
            <Text className="text-stone-700 text-sm leading-5">{result.transcription}</Text>
          </View>
        )
      )}
    </View>
  );
}
