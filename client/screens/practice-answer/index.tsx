import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  TextInput, StyleSheet, Dimensions,
} from 'react-native';
import { useSafeSearchParams, useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useResponsive } from '@/hooks/useResponsive';
import { FontAwesome6 } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { createFormDataFile } from '@/utils';
import {
  fetchQuestionDetail, submitPractice, fetchStandardAudio, fetchQuestions,
  type Question, type QuestionType, type PracticeResult,
} from '@/utils/api';
import { useDeviceId } from '@/hooks/useDeviceId';

const TYPE_TITLE: Record<string, string> = {
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

const TYPE_ICON: Record<string, string> = {
  read_aloud: 'book-open',
  listen_choose: 'headphones',
  listen_answer: 'comment',
  listen_retell: 'diagram-project',
};

export default function PracticeAnswerScreen() {
  const params = useSafeSearchParams<{ questionId: number; type: string }>();
  const router = useSafeRouter();
  const questionId = params.questionId;
  const type = (params.type || 'read_aloud') as QuestionType;
  const color = TYPE_COLOR[type] || '#EA580C';
  const deviceId = useDeviceId();
  const { maxWidthStyle } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [content, setContent] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);

  // Audio states
  const [recording, setRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [standardPlaying, setStandardPlaying] = useState(false);
  const [standardAudioUrl, setStandardAudioUrl] = useState<string | null>(null);
  const [standardLoading, setStandardLoading] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [standardAudioPosition, setStandardAudioPosition] = useState(0);
  const [standardAudioDuration, setStandardAudioDuration] = useState(0);
  const [questionList, setQuestionList] = useState<Question[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const standardSoundRef = useRef<Audio.Sound | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setResult(null);
    setSelectedAnswer(null);
    setRecordedUri(null);
    setTextAnswer('');
    setStandardAudioUrl(null);
    setStandardLoading(false);
    if (soundRef.current) { soundRef.current.stopAsync(); soundRef.current = null; }
    try {
      const q = await fetchQuestionDetail(questionId);
      setQuestion(q);
      const c = typeof q.content === 'string' ? JSON.parse(q.content) : q.content;
      setContent(c);
      const list = await fetchQuestions({ type });
      const samePaper = list.filter(item => item.paper_id === q.paper_id);
      setQuestionList(samePaper);
    } catch (e: any) {
      Alert.alert('错误', e.message || '加载题目失败');
    } finally {
      setLoading(false);
    }
  }, [questionId, type]);

  useEffect(() => {
    loadData();
    return () => {
      cleanupAudio();
    };
  }, [loadData]);

  const cleanupAudio = () => {
    if (wordTimerRef.current) {
      clearInterval(wordTimerRef.current);
      wordTimerRef.current = null;
    }
    if (soundRef.current) {
      soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    if (standardSoundRef.current) {
      standardSoundRef.current.unloadAsync();
      standardSoundRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
  };

  // ===== Recording =====
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
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
      setRecordedUri(null);
      setResult(null);
    } catch (e: any) {
      Alert.alert('错误', '录音启动失败: ' + e.message);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecording(false);
      if (uri) setRecordedUri(uri);
    } catch (e: any) {
      Alert.alert('错误', '停止录音失败: ' + e.message);
    }
  };

  const playRecording = async () => {
    if (!recordedUri) return;
    if (playing) {
      await soundRef.current?.pauseAsync();
      setPlaying(false);
      return;
    }
    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            setPlaying(false);
          }
        });
      }
      await soundRef.current.playAsync();
      setPlaying(true);
    } catch (e: any) {
      Alert.alert('错误', '播放失败: ' + e.message);
    }
  };

  // ===== Standard Audio =====
  const loadStandardAudio = async () => {
    if (!question) return;
    if (standardPlaying) {
      await standardSoundRef.current?.pauseAsync();
      setStandardPlaying(false);
      return;
    }
    try {
      let audioUrl = standardAudioUrl;
      if (!audioUrl) {
        setStandardLoading(true);
        audioUrl = await fetchStandardAudio(question.id);
        setStandardAudioUrl(audioUrl);
        setStandardLoading(false);
      }
      if (!standardSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
        standardSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded) {
            setStandardAudioPosition(status.positionMillis);
            setStandardAudioDuration(status.durationMillis);
          }
          if (status.didJustFinish) {
            setStandardPlaying(false);
            setCurrentWordIndex(-1);
            if (wordTimerRef.current) {
              clearInterval(wordTimerRef.current);
              wordTimerRef.current = null;
            }
          }
        });
      }
      await standardSoundRef.current.playAsync();
      setStandardPlaying(true);
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
      wordTimerRef.current = setInterval(async () => {
        const status = await standardSoundRef.current?.getStatusAsync();
        if (status && (status as any).isLoaded) {
          const pos = (status as any).positionMillis;
          const dur = (status as any).durationMillis;
          setStandardAudioPosition(pos);
          setStandardAudioDuration(dur);
          const words = getPassageWords();
          if (words.length > 0 && dur > 0) {
            const idx = Math.floor((pos / dur) * words.length);
            setCurrentWordIndex(Math.min(idx, words.length - 1));
          }
        }
      }, 80);
    } catch (e: any) {
      setStandardLoading(false);
      Alert.alert('错误', '加载音频失败: ' + e.message);
    }
  };

  const getPassageWords = (): string[] => {
    if (type !== 'read_aloud' || !content) return [];
    return (content.passage || '').split(/\s+/).filter((w: string) => w.length > 0);
  };

  // ===== Submit Answer =====
  const handleSubmit = async () => {
    if (!question || !deviceId) {
      Alert.alert('提示', '请稍等，正在初始化...');
      return;
    }

    if (type === 'read_aloud') {
      if (!recordedUri) {
        Alert.alert('提示', '请先录音');
        return;
      }
    } else if (type === 'listen_choose') {
      if (selectedAnswer === null) {
        Alert.alert('提示', '请选择一个答案');
        return;
      }
    } else if (type === 'listen_answer' || type === 'listen_retell') {
      if (!recordedUri && !textAnswer.trim()) {
        Alert.alert('提示', '请录音或输入文字回答');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await submitPractice(
        question.id,
        recordedUri || null,
        deviceId,
        'single',
        type === 'listen_choose' ? String(selectedAnswer) : (textAnswer.trim() || undefined)
      );

      setResult(res);
      if ((type === 'listen_answer' || type === 'listen_retell') && res.transcript) {
        setTextAnswer(res.transcript);
      }
    } catch (e: any) {
      Alert.alert('评分失败', e.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Next Question =====
  const handleNextQuestion = () => {
    const currentIdx = questionList.findIndex(q => q.id === questionId);
    if (currentIdx >= 0 && currentIdx < questionList.length - 1) {
      const nextQ = questionList[currentIdx + 1];
      router.replace('/practice-answer', { questionId: nextQ.id, type });
    } else {
      Alert.alert('提示', '已是最后一题', [
        { text: '返回列表', onPress: () => router.back() }
      ]);
    }
  };

  // ===== Text answer for listen_answer =====
  const [textAnswer, setTextAnswer] = useState('');

  const currentQIndex = questionList.findIndex(q => q.id === questionId);

  const handleSwitchQuestion = (qId: number) => {
    if (qId === questionId) return;
    router.replace('/practice-answer', { questionId: qId, type });
  };

  // ===== Render =====
  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: color + '12' }}>
            <ActivityIndicator size="large" color={color} />
          </View>
          <Text className="text-stone-400 text-sm">加载题目中...</Text>
        </View>
      </Screen>
    );
  }

  if (!question || !content) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: '#FEF2F2' }}>
            <FontAwesome6 name="circle-exclamation" size={28} color="#EF4444" />
          </View>
          <Text className="text-stone-500 text-base">题目加载失败</Text>
        </View>
      </Screen>
    );
  }

  const progressPercent = standardAudioDuration > 0 ? (standardAudioPosition / standardAudioDuration) * 100 : 0;

  return (
    <Screen>
      <View className="flex-1" style={[{ backgroundColor: '#FFFBF5' }, maxWidthStyle]}>
        {/* Header with gradient effect */}
        <View style={{
          paddingTop: 50,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 5,
        }}>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <FontAwesome6 name="arrow-left" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <View className="flex-1 ml-3">
              <Text className="text-white text-lg font-bold">{TYPE_TITLE[type]}</Text>
              {questionList.length > 0 && (
                <Text className="text-white/70 text-xs mt-0.5">
                  第 {currentQIndex + 1} / {questionList.length} 题
                </Text>
              )}
            </View>
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <FontAwesome6 name={TYPE_ICON[type] || 'book'} size={16} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Tab bar for switching between questions */}
        {questionList.length > 1 && (
          <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F5F5F4' }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
            >
              {questionList.map((q, idx) => {
                const isActive = q.id === questionId;
                return (
                  <TouchableOpacity
                    key={q.id}
                    onPress={() => handleSwitchQuestion(q.id)}
                    className="mr-2 rounded-full px-4 py-2 items-center justify-center"
                    style={{
                      backgroundColor: isActive ? color : '#F5F5F4',
                      minWidth: 40,
                    }}
                  >
                    <Text
                      className="text-sm font-bold"
                      style={{ color: isActive ? '#FFFFFF' : '#A8A29E' }}
                    >
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="px-5 pt-5">
            {/* Difficulty + score badges */}
            <View className="flex-row items-center mb-4">
              {question.difficulty_coefficient ? (
                <View className="rounded-full px-3 py-1.5 flex-row items-center" style={{ backgroundColor: color + '12' }}>
                  <FontAwesome6 name="signal" size={10} color={color} />
                  <Text className="text-xs font-semibold ml-1.5" style={{ color }}>
                    难度 {question.difficulty_coefficient}
                  </Text>
                </View>
              ) : null}
              <View className="rounded-full px-3 py-1.5 ml-2 flex-row items-center" style={{ backgroundColor: color + '12' }}>
                <FontAwesome6 name="star" size={10} color={color} />
                <Text className="text-xs font-semibold ml-1.5" style={{ color }}>
                  满分 {question.max_score} 分
                </Text>
              </View>
              <View className="flex-1" />
              <TouchableOpacity
                onPress={() => router.push('/scoring-guide')}
                className="flex-row items-center rounded-full px-3 py-1.5"
                style={{ backgroundColor: color + '12' }}
              >
                <FontAwesome6 name="circle-info" size={10} color={color} />
                <Text className="text-xs font-semibold ml-1.5" style={{ color }}>查看标准</Text>
              </TouchableOpacity>
            </View>

            {/* Audio player for all types */}
            <View className="mb-5">
              <TouchableOpacity
                onPress={loadStandardAudio}
                disabled={standardLoading}
                className="rounded-2xl py-4 px-5 flex-row items-center"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: color + '25',
                  shadowColor: color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: color }}>
                  {standardLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <FontAwesome6 name={standardPlaying ? 'pause' : 'volume-high'} size={16} color="#FFFFFF" />
                  )}
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-stone-800 text-sm font-bold">
                    {standardLoading ? '生成音频中...' : standardPlaying ? '正在播放' : type === 'read_aloud' ? '标准朗读示范' : '播放听力原文'}
                  </Text>
                  <Text className="text-stone-400 text-xs mt-0.5">
                    {standardPlaying ? '点击暂停' : '点击播放'}
                  </Text>
                </View>
                {standardPlaying && (
                  <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                )}
              </TouchableOpacity>
              {standardPlaying && standardAudioDuration > 0 && (
                <View className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#F5F5F4' }}>
                  <View className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: color }} />
                </View>
              )}
            </View>

            {/* Content based on type */}
            {type === 'read_aloud' && <ReadAloudContent content={content} color={color} currentWordIndex={currentWordIndex} />}
            {type === 'listen_choose' && <ListenChooseContent content={content} color={color} selectedAnswer={selectedAnswer} setSelectedAnswer={setSelectedAnswer} showResult={!!result} correctAnswer={content.correct_answer ?? -1} />}
            {type === 'listen_answer' && <ListenAnswerContent content={content} color={color} />}
            {type === 'listen_retell' && <ListenRetellContent content={content} color={color} />}

            {/* Recording section for read_aloud */}
            {type === 'read_aloud' && (
              <View className="mt-6">
                <RecordButton
                  recording={recording}
                  recordedUri={recordedUri}
                  playing={playing}
                  color={color}
                  onStart={startRecording}
                  onStop={stopRecording}
                  onPlay={playRecording}
                />
              </View>
            )}

            {/* Recording + text input for listen_answer and listen_retell */}
            {(type === 'listen_answer' || type === 'listen_retell') && (
              <View className="mt-6">
                <RecordButton
                  recording={recording}
                  recordedUri={recordedUri}
                  playing={playing}
                  color={color}
                  onStart={startRecording}
                  onStop={stopRecording}
                  onPlay={playRecording}
                />

                {/* Text input */}
                <View className="mt-4">
                  <Text className="text-stone-500 text-sm mb-2 font-medium">
                    {result ? '语音识别结果' : '或输入文字回答'}
                  </Text>
                  <TextInput
                    value={textAnswer}
                    onChangeText={setTextAnswer}
                    placeholder={type === 'listen_answer' ? '输入你的回答...' : '输入你的转述...'}
                    multiline
                    editable={!result}
                    className="rounded-2xl p-4 text-stone-800"
                    style={{
                      backgroundColor: result ? '#F5F5F4' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: result ? '#E7E5E4' : color + '20',
                      minHeight: 80,
                      textAlignVertical: 'top',
                      shadowColor: color,
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                    placeholderTextColor="#A8A29E"
                  />
                  {/* Show correct/incorrect indicator for listen_answer after result */}
                  {result && type === 'listen_answer' && (
                    <View className="mt-3 rounded-2xl p-4 flex-row items-center" style={{
                      backgroundColor: (result.score / (result.max_score || 1)) >= 0.6 ? '#ECFDF5' : '#FEF2F2',
                      borderWidth: 1,
                      borderColor: (result.score / (result.max_score || 1)) >= 0.6 ? '#A7F3D0' : '#FECACA',
                    }}>
                      <FontAwesome6
                        name={(result.score / (result.max_score || 1)) >= 0.6 ? 'circle-check' : 'circle-xmark'}
                        size={18}
                        color={(result.score / (result.max_score || 1)) >= 0.6 ? '#059669' : '#DC2626'}
                      />
                      <View className="ml-3 flex-1">
                        <Text className="font-bold text-sm" style={{
                          color: (result.score / (result.max_score || 1)) >= 0.6 ? '#059669' : '#DC2626'
                        }}>
                          {(result.score / (result.max_score || 1)) >= 0.6 ? '回答正确' : '回答不完整，需改进'}
                        </Text>
                        {content.sample_answer && (
                          <Text className="text-stone-500 text-xs mt-0.5">
                            参考答案：{content.sample_answer}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Submit button + Next button */}
            {result === null ? (
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || recording}
                className="rounded-2xl py-4 items-center justify-center mt-6"
                style={{
                  backgroundColor: submitting || recording ? '#D6D3D1' : color,
                  shadowColor: color,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.2,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                {submitting ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text className="text-white font-bold ml-2">智能评分中...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />
                    <Text className="text-white text-base font-bold ml-2">提交</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View className="mt-6 gap-3">
                <TouchableOpacity
                  onPress={handleNextQuestion}
                  className="rounded-2xl py-4 items-center justify-center flex-row"
                  style={{
                    backgroundColor: color,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.2,
                    shadowRadius: 12,
                    elevation: 4,
                  }}
                >
                  <FontAwesome6 name="arrow-right" size={18} color="#FFFFFF" />
                  <Text className="text-white text-base font-bold ml-2">下一题</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Result display */}
            {result && (
              <ResultView result={result} color={color} type={type} content={content} />
            )}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

// ===== Record Button Component =====
function RecordButton({ recording, recordedUri, playing, color, onStart, onStop, onPlay }: {
  recording: boolean;
  recordedUri: string | null;
  playing: boolean;
  color: string;
  onStart: () => void;
  onStop: () => void;
  onPlay: () => void;
}) {
  return (
    <View>
      <TouchableOpacity
        onPress={recording ? onStop : onStart}
        className="rounded-2xl py-4 items-center justify-center flex-row"
        style={{
          backgroundColor: recording ? '#EF4444' : color,
          shadowColor: recording ? '#EF4444' : color,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <FontAwesome6 name={recording ? 'stop' : 'microphone'} size={18} color="#FFFFFF" />
        <Text className="text-white text-base font-bold ml-2">
          {recording ? '停止录音' : recordedUri ? '重新录音' : '开始录音'}
        </Text>
      </TouchableOpacity>

      {recordedUri && !recording && (
        <TouchableOpacity
          onPress={onPlay}
          className="rounded-2xl py-3.5 items-center justify-center flex-row mt-3"
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E7E5E4',
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <FontAwesome6 name={playing ? 'pause' : 'play'} size={14} color="#78716C" />
          <Text className="text-stone-600 font-semibold ml-2">
            {playing ? '暂停播放' : '播放我的录音'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ===== Read Aloud Content with word highlighting =====
function ReadAloudContent({ content, color, currentWordIndex }: { content: any; color: string; currentWordIndex: number }) {
  const words = (content.passage || '').split(/\s+/).filter((w: string) => w.length > 0);

  return (
    <View className="rounded-2xl p-6" style={{
      backgroundColor: '#FFFFFF',
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    }}>
      <View className="flex-row items-center mb-3">
        <FontAwesome6 name="book-open" size={14} color={color} />
        <Text className="text-stone-400 text-xs font-bold ml-2 uppercase tracking-wider">READING PASSAGE</Text>
      </View>
      <Text className="text-stone-800 text-base leading-8" style={{ lineHeight: 34 }}>
        {words.map((word: string, i: number) => {
          let textColor = '#292524';
          let fontWeight = '400';
          let bgColor = 'transparent';
          if (currentWordIndex >= 0) {
            if (i === currentWordIndex) {
              textColor = color;
              fontWeight = '700';
              bgColor = color + '18';
            } else if (i < currentWordIndex) {
              textColor = '#A8A29E';
            }
          }
          return (
            <Text
              key={i}
              style={{ color: textColor, fontWeight: fontWeight as any, backgroundColor: bgColor }}
            >
              {word}{' '}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

// ===== Listen Choose Content =====
function ListenChooseContent({ content, color, selectedAnswer, setSelectedAnswer, showResult, correctAnswer }: {
  content: any;
  color: string;
  selectedAnswer: number | null;
  setSelectedAnswer: (idx: number | null) => void;
  showResult: boolean;
  correctAnswer: number;
}) {
  const options = content.options || [];

  const handleSelect = (idx: number) => {
    if (showResult) return;
    setSelectedAnswer(idx);
  };

  return (
    <View>
      <View className="rounded-2xl p-6 mb-4" style={{
        backgroundColor: '#FFFFFF',
        shadowColor: color,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}>
        <View className="flex-row items-center mb-3">
          <FontAwesome6 name="headphones" size={14} color={color} />
          <Text className="text-stone-400 text-xs font-bold ml-2 uppercase tracking-wider">QUESTION</Text>
        </View>
        <Text className="text-stone-800 text-base font-medium leading-8">
          {content.question}
        </Text>
      </View>
      <View className="gap-3">
        {options.map((opt: string, idx: number) => {
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === correctAnswer;
          let bg = '#FFFFFF';
          let borderColor = '#E7E5E4';
          let textColor = '#44403C';
          if (showResult) {
            if (isCorrect) {
              bg = '#ECFDF5';
              borderColor = '#10B981';
              textColor = '#059669';
            } else if (isSelected) {
              bg = '#FEF2F2';
              borderColor = '#EF4444';
              textColor = '#DC2626';
            }
          } else if (isSelected) {
            bg = color + '10';
            borderColor = color;
            textColor = color;
          }
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSelect(idx)}
              className="rounded-2xl p-4 flex-row items-center"
              style={{
                backgroundColor: bg,
                borderWidth: 1.5,
                borderColor,
                shadowColor: color,
                shadowOpacity: isSelected && !showResult ? 0.06 : 0,
                shadowRadius: 6,
                elevation: isSelected && !showResult ? 2 : 0,
              }}
              disabled={showResult}
              activeOpacity={0.8}
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                style={{
                  backgroundColor: showResult && isCorrect ? '#10B981' : showResult && isSelected ? '#EF4444' : isSelected ? color : '#F5F5F4'
                }}
              >
                {showResult && isCorrect ? (
                  <FontAwesome6 name="check" size={12} color="#FFFFFF" />
                ) : showResult && isSelected ? (
                  <FontAwesome6 name="xmark" size={12} color="#FFFFFF" />
                ) : (
                  <Text className="font-bold text-sm" style={{ color: isSelected ? '#FFFFFF' : '#78716C' }}>{String.fromCharCode(65 + idx)}</Text>
                )}
              </View>
              <Text className="flex-1 text-sm font-medium" style={{ color: textColor }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {showResult && (
        <View className="mt-4 rounded-2xl p-4" style={{
          backgroundColor: selectedAnswer === correctAnswer ? '#ECFDF5' : '#FEF2F2',
          borderWidth: 1,
          borderColor: selectedAnswer === correctAnswer ? '#A7F3D0' : '#FECACA',
        }}>
          <Text className="font-bold text-sm" style={{ color: selectedAnswer === correctAnswer ? '#059669' : '#DC2626' }}>
            {selectedAnswer === correctAnswer ? '回答正确！' : '回答错误'}
          </Text>
          {selectedAnswer !== correctAnswer && (
            <Text className="text-stone-500 text-sm mt-1">
              正确答案：{String.fromCharCode(65 + correctAnswer)}. {options[correctAnswer]}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ===== Listen Answer Content =====
function ListenAnswerContent({ content, color }: { content: any; color: string }) {
  return (
    <View className="rounded-2xl p-6" style={{
      backgroundColor: '#FFFFFF',
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    }}>
      <View className="flex-row items-center mb-3">
        <FontAwesome6 name="comment" size={14} color={color} />
        <Text className="text-stone-400 text-xs font-bold ml-2 uppercase tracking-wider">QUESTION</Text>
      </View>
      <Text className="text-stone-800 text-base font-medium leading-8">
        {content.question}
      </Text>
    </View>
  );
}

// ===== Listen Retell Content =====
function ListenRetellContent({ content, color }: { content: any; color: string }) {
  const infoPoints = content.info_points || [];
  return (
    <View className="rounded-2xl p-6" style={{
      backgroundColor: '#FFFFFF',
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    }}>
      <View className="flex-row items-center mb-3">
        <FontAwesome6 name="diagram-project" size={14} color={color} />
        <Text className="text-stone-800 text-base font-bold ml-2">{content.topic}</Text>
      </View>
      <Text className="text-stone-500 text-sm mb-4 leading-6">{content.intro}</Text>
      <View className="rounded-xl p-4" style={{ backgroundColor: color + '08' }}>
        {infoPoints.map((point: any, idx: number) => (
          <View key={idx} className="flex-row items-start py-2.5" style={{ borderBottomWidth: idx < infoPoints.length - 1 ? 1 : 0, borderBottomColor: color + '12' }}>
            <View className="w-7 h-7 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: color + '15' }}>
              <Text className="text-xs font-bold" style={{ color }}>{point.label.charAt(0)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-stone-400 text-xs">{point.label}</Text>
              <Text className="text-stone-700 text-sm font-medium mt-0.5">{point.answer}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ===== Result View =====
function ResultView({ result, color, type, content }: { result: PracticeResult; color: string; type: QuestionType; content: any }) {
  const score = result.score || 0;
  const maxScore = result.max_score || 9;
  const percentage = maxScore > 0 ? score / maxScore : 0;
  const isPass = percentage >= 0.6;

  const isListenType = type === 'listen_choose' || type === 'listen_answer' || type === 'listen_retell';

  return (
    <View className="mt-6">
      {/* For listen_* correct: show simple success banner */}
      {isListenType && isPass && (
        <View className="rounded-2xl p-5 mb-4 flex-row items-center" style={{
          backgroundColor: '#ECFDF5',
          borderWidth: 1,
          borderColor: '#A7F3D0',
        }}>
          <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#059669' }}>
            <FontAwesome6 name="check" size={18} color="#FFFFFF" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-bold text-base" style={{ color: '#059669' }}>回答正确</Text>
            <Text className="text-stone-500 text-sm mt-0.5">得分 {score} / {maxScore}</Text>
          </View>
        </View>
      )}

      {/* For listen_* incorrect: show error banner + analysis */}
      {isListenType && !isPass && (
        <>
          <View className="rounded-2xl p-5 mb-4 flex-row items-center" style={{
            backgroundColor: '#FEF2F2',
            borderWidth: 1,
            borderColor: '#FECACA',
          }}>
            <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#EF4444' }}>
              <FontAwesome6 name="xmark" size={18} color="#FFFFFF" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold text-base" style={{ color: '#DC2626' }}>回答不正确</Text>
              <Text className="text-stone-500 text-sm mt-0.5">得分 {score} / {maxScore}，请查看下方分析</Text>
            </View>
          </View>

          {result.transcript && (
            <ResultCard icon="file-lines" label="语音转写" color={color}>
              <Text className="text-stone-700 text-sm leading-6">{result.transcript}</Text>
            </ResultCard>
          )}

          {result.analysis && (
            <ResultCard icon="triangle-exclamation" label="错误分析" color="#EF4444">
              <Text className="text-stone-700 text-sm leading-6">{result.analysis}</Text>
            </ResultCard>
          )}

          {result.suggestions && (
            <ResultCard icon="lightbulb" label="改进建议" color={color}>
              <Text className="text-stone-700 text-sm leading-6">{result.suggestions}</Text>
            </ResultCard>
          )}

          {type === 'listen_choose' && content && (
            <ResultCard icon="check-double" label="正确答案" color={color}>
              <Text className="text-stone-700 text-sm leading-6">
                {String.fromCharCode(65 + (content.correct_answer ?? 0))}. {content.options?.[content.correct_answer ?? 0]}
              </Text>
            </ResultCard>
          )}

          {type === 'listen_answer' && content?.sample_answer && (
            <ResultCard icon="check-double" label="参考答案" color={color}>
              <Text className="text-stone-700 text-sm leading-6">{content.sample_answer}</Text>
            </ResultCard>
          )}

          {type === 'listen_retell' && content?.info_points && (
            <ResultCard icon="list-ul" label="信息点参考" color={color}>
              {content.info_points.map((point: any, idx: number) => (
                <View key={idx} className="flex-row items-start py-1.5">
                  <Text className="text-stone-400 text-sm mr-2">{idx + 1}.</Text>
                  <View className="flex-1">
                    <Text className="text-stone-500 text-xs">{point.label}</Text>
                    <Text className="text-stone-800 text-sm font-medium">{point.answer}</Text>
                  </View>
                </View>
              ))}
            </ResultCard>
          )}
        </>
      )}

      {/* For read_aloud: show full analysis */}
      {!isListenType && (
        <>
          {!isPass && (
            <View className="rounded-2xl p-5 mb-4 flex-row items-center" style={{
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FECACA',
            }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#EF4444' }}>
                <FontAwesome6 name="triangle-exclamation" size={18} color="#FFFFFF" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-bold text-sm" style={{ color: '#DC2626' }}>未达标</Text>
                <Text className="text-stone-500 text-xs mt-0.5">得分低于满分的60%，请查看下方建议并重试</Text>
              </View>
            </View>
          )}

          {/* Score Card - Premium Design */}
          <View className="rounded-3xl p-6 items-center" style={{
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 6,
          }}>
            <Text className="text-white/70 text-xs font-bold uppercase tracking-widest">本次得分</Text>
            <View className="flex-row items-baseline mt-3">
              <Text className="text-white text-6xl font-bold">{score}</Text>
              <Text className="text-white/70 text-2xl ml-1.5 font-medium">/ {maxScore}</Text>
            </View>
            <View className="mt-4 rounded-full px-5 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Text className="text-white text-sm font-bold">
                {isPass ? '及格' : '不及格'}
              </Text>
            </View>
          </View>

          {result.transcript && (
            <ResultCard icon="file-lines" label="语音转写" color={color}>
              <Text className="text-stone-700 text-sm leading-6">{result.transcript}</Text>
            </ResultCard>
          )}

          {result.analysis && (
            <ResultCard icon="chart-line" label="评分分析" color={color}>
              <Text className="text-stone-700 text-sm leading-6">{result.analysis}</Text>
            </ResultCard>
          )}

          {result.suggestions && (
            <ResultCard icon="lightbulb" label="改进建议" color={color}>
              <Text className="text-stone-700 text-sm leading-6">{result.suggestions}</Text>
            </ResultCard>
          )}
        </>
      )}
    </View>
  );
}

// ===== Reusable Result Card =====
function ResultCard({ icon, label, color, children }: { icon: string; label: string; color: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl p-5 mt-4" style={{
      backgroundColor: '#FFFFFF',
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    }}>
      <View className="flex-row items-center mb-3">
        <View className="w-6 h-6 rounded-lg items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <FontAwesome6 name={icon} size={10} color={color} />
        </View>
        <Text className="text-stone-400 text-xs font-bold ml-2 uppercase tracking-wider">{label}</Text>
      </View>
      {children}
    </View>
  );
}
