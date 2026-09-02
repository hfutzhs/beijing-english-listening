import { createFormDataFile } from '@/utils';

// In production web mode, frontend and backend are same-origin, use relative URLs
// In dev mode, use the environment variable for the backend URL
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';

// ===== Types =====

export type QuestionType = 'listen_choose' | 'listen_answer' | 'listen_retell' | 'read_aloud';

export interface Question {
  id: number;
  type: QuestionType;
  paper_id: number;
  section_index: number;
  difficulty_group: number;
  difficulty_coefficient: number;
  content: any;
  audio_script: string | null;
  max_score: number;
  title?: string | null;
}

export interface PracticeRecord {
  id: number;
  question_id: number;
  device_id: string;
  practice_mode: string;
  audio_key: string | null;
  audio_url: string | null;
  transcription: string | null;
  user_answer: string | null;
  score: number;
  score_level: string | null;
  accuracy_analysis: string | null;
  fluency_analysis: string | null;
  completeness_analysis: string | null;
  specific_issues: string | null;
  suggestions: string | null;
  is_passed: boolean;
  is_favorite: boolean;
  created_at: string;
  // joined fields from question
  type: QuestionType | null;
  question_type: QuestionType | null;
  question_title: string | null;
  question_content: any | null;
  max_score: number | null;
  // aliases for backward compatibility
  transcript: string | null;
  analysis: string | null;
  details: string | null;
}

// Alias for backward compatibility
export type HistoryItem = PracticeRecord;
export type PracticeResult = PracticeRecord;

export interface Paper {
  id: number;
  paperId: number;
  paperTitle: string;
  questionCount: number;
}

// ===== API Functions =====

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/questions?type=xxx
 * Query 参数：type: QuestionType
 */
export async function fetchQuestions(params: { type?: QuestionType; paperId?: number }): Promise<Question[]> {
  let url = `${API_BASE}/api/v1/practice/questions`;
  const queryParts: string[] = [];
  if (params.type) queryParts.push(`type=${params.type}`);
  if (params.paperId) queryParts.push(`paperId=${params.paperId}`);
  if (queryParts.length > 0) url += `?${queryParts.join('&')}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取题目失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/questions/:id
 * Path 参数：id: number
 */
export async function fetchQuestionDetail(id: number): Promise<Question> {
  const res = await fetch(`${API_BASE}/api/v1/practice/questions/${id}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取题目详情失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/exam-papers
 */
export async function fetchPapers(): Promise<Paper[]> {
  const res = await fetch(`${API_BASE}/api/v1/practice/exam-papers`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取试卷列表失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/exam-papers/:paperId
 * Path 参数：paperId: number
 */
export async function fetchExamPaperDetail(paperId: number): Promise<{ questions: Question[] }> {
  const res = await fetch(`${API_BASE}/api/v1/practice/exam-papers/${paperId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取试卷详情失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：POST /api/v1/practice/submit
 * FormData: audio (file) + questionId (number) + deviceId (string) + practiceMode (string) + userAnswer (string, optional)
 */
export async function submitPractice(
  questionId: number,
  audioUri: string | null,
  deviceId: string,
  practiceMode: string,
  userAnswer?: string
): Promise<PracticeRecord> {
  const formData = new FormData();
  if (audioUri) {
    const audioFile = await createFormDataFile(audioUri, `recording_${questionId}.m4a`, 'audio/m4a');
    formData.append('audio', audioFile as any);
  }
  formData.append('questionId', String(questionId));
  formData.append('deviceId', deviceId);
  formData.append('practiceMode', practiceMode);
  if (userAnswer !== undefined) {
    formData.append('userAnswer', userAnswer);
  }

  const res = await fetch(`${API_BASE}/api/v1/practice/submit`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '提交评分失败');
  return json.data;
}

// Alias for backward compatibility
export const submitAnswer = submitPractice;

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/standard-audio/:questionId
 * Path 参数：questionId: number
 */
export async function fetchStandardAudio(questionId: number): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/practice/standard-audio/${questionId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取标准朗读失败');
  return json.data.audioUrl;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/questions/:id/audio
 * Path 参数：id: number
 */
export async function fetchQuestionAudio(questionId: number): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/practice/questions/${questionId}/audio`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取音频失败');
  return json.data.audioUrl;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/history?deviceId=xxx&type=xxx(optional)
 * Query 参数：deviceId: string, type?: QuestionType
 */
export async function fetchHistory(deviceId: string, type?: QuestionType): Promise<PracticeRecord[]> {
  let url = `${API_BASE}/api/v1/practice/history?deviceId=${deviceId}`;
  if (type) url += `&type=${type}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取历史记录失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/history/:id?deviceId=xxx
 * Path 参数：id: number
 * Query 参数：deviceId: string
 */
export async function fetchHistoryDetail(id: number, deviceId: string): Promise<PracticeRecord> {
  const res = await fetch(`${API_BASE}/api/v1/practice/history/${id}?deviceId=${deviceId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取记录详情失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/favorites?deviceId=xxx
 * Query 参数：deviceId: string
 */
export async function fetchFavorites(deviceId: string): Promise<PracticeRecord[]> {
  const res = await fetch(`${API_BASE}/api/v1/practice/favorites?deviceId=${deviceId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取错题本失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：DELETE /api/v1/practice/history?deviceId=xxx
 * Query 参数：deviceId: string
 */
export async function clearHistory(deviceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/practice/history?deviceId=${deviceId}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '清空历史记录失败');
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/answered-questions?deviceId=xxx&type=xxx(optional)
 * Query 参数：deviceId: string, type?: QuestionType
 */
export async function fetchAnsweredQuestions(deviceId: string, type?: QuestionType): Promise<number[]> {
  let url = `${API_BASE}/api/v1/practice/answered-questions?deviceId=${deviceId}`;
  if (type) url += `&type=${type}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取已答题目失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：GET /api/v1/practice/exam-progress?deviceId=xxx
 * Query 参数：deviceId: string
 * 返回已交卷的试卷ID列表
 */
export async function fetchExamProgress(deviceId: string): Promise<number[]> {
  const res = await fetch(`${API_BASE}/api/v1/practice/exam-progress?deviceId=${deviceId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取考试进度失败');
  return json.data;
}

/**
 * 服务端文件：server/src/routes/practice.ts
 * 接口：PATCH /api/v1/practice/history/:id/favorite
 * Body 参数：deviceId: string, isFavorite: boolean
 */
export async function toggleFavorite(id: number, deviceId: string, isFavorite: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/practice/history/${id}/favorite`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, isFavorite }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '操作失败');
}
