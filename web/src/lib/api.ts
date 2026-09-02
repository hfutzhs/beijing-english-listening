// API shim: replaces the Express backend with pure client-side logic.
// All data comes from static question data and localStorage.

import type { Question, QuestionType, PracticeRecord, Paper, ScoringResult } from '../types';
import {
  questions,
  questionsById,
  questionsByType,
  questionsByPaper,
  papers,
} from '../data/questions';
import { getDeviceId } from './device';
import {
  getAllRecords,
  saveRecord,
  clearAllRecords,
  getAnsweredQuestionIds,
  getExamProgress,
  getStats,
  getExamScoreForPaper,
  getRecordById,
} from './storage';
import { scoreAnswer } from './scoring';

// === Questions ===

export function fetchQuestions(params: { type?: QuestionType; paperId?: number }): Promise<Question[]> {
  let result: Question[];
  if (params.type && params.paperId) {
    result = (questionsByType[params.type] || []).filter(q => q.paper_id === params.paperId);
  } else if (params.type) {
    result = questionsByType[params.type] || [];
  } else if (params.paperId) {
    result = questionsByPaper[params.paperId] || [];
  } else {
    result = questions;
  }
  return Promise.resolve(result);
}

export function fetchQuestionDetail(id: number): Promise<Question> {
  const q = questionsById.get(id);
  if (!q) return Promise.reject(new Error('题目不存在'));
  return Promise.resolve(q);
}

export function fetchPapers(): Promise<Paper[]> {
  return Promise.resolve(papers);
}

export function fetchExamPaperDetail(paperId: number): Promise<{ questions: Question[] }> {
  return Promise.resolve({ questions: questionsByPaper[paperId] || [] });
}

// === Submit and Score ===

export interface SubmitParams {
  questionId: number;
  deviceId: string;
  sessionId: string; // 'practice' or 'exam'
  transcription?: string;
  selectedAnswer?: number;
  audioUrl?: string | null;
}

export function submitPractice(params: SubmitParams): Promise<PracticeRecord> {
  const question = questionsById.get(params.questionId);
  if (!question) return Promise.reject(new Error('题目不存在'));

  const result: ScoringResult = scoreAnswer(
    question.type,
    question.content,
    params.transcription || '',
    question.max_score,
    params.selectedAnswer
  );

  const record = saveRecord({
    question_id: question.id,
    question_type: question.type,
    paper_id: question.paper_id,
    device_id: params.deviceId,
    session_id: params.sessionId,
    user_answer: params.selectedAnswer !== undefined ? String(params.selectedAnswer) : (params.transcription || null),
    audio_url: params.audioUrl || null,
    transcription: result.transcription || null,
    score: result.score,
    max_score: result.maxScore,
    score_level: (result.feedback.scoreLevel as string) || null,
    is_failed: !result.isPass,
    is_favorite: false,
    accuracy_analysis: (result.feedback.accuracyAnalysis as string) || null,
    fluency_analysis: (result.feedback.fluencyAnalysis as string) || null,
    completeness_analysis: (result.feedback.completenessAnalysis as string) || null,
    specific_issues: (result.feedback.specificIssues as string) || null,
    suggestions: (result.feedback.suggestions as string) || null,
    feedback: result.feedback,
    question_title: question.title,
    question_content: question.content,
  });

  return Promise.resolve(record);
}

// === History ===

export function fetchHistory(deviceId: string, type?: QuestionType, mode?: string, wrong?: boolean): Promise<PracticeRecord[]> {
 let records = getAllRecords(deviceId);
  if (type) records = records.filter(r => r.question_type === type);
  if (mode) records = records.filter(r => r.session_id === mode);
  if (wrong) records = records.filter(r => r.is_failed);
  return Promise.resolve(records);
}

export function fetchHistoryDetail(id: number): Promise<PracticeRecord> {
  const record = getRecordById(id);
  if (!record) return Promise.reject(new Error('记录不存在'));
  return Promise.resolve(record);
}

export function clearHistory(deviceId: string): Promise<void> {
  clearAllRecords(deviceId);
  return Promise.resolve();
}

export function fetchAnsweredQuestions(deviceId: string, type?: QuestionType): Promise<number[]> {
  return Promise.resolve(getAnsweredQuestionIds(deviceId, type));
}

export function fetchExamProgress(deviceId: string): Promise<number[]> {
  return Promise.resolve(getExamProgress(deviceId));
}

export function fetchExamScore(deviceId: string, paperId: number): Promise<number | null> {
  return Promise.resolve(getExamScoreForPaper(deviceId, paperId));
}

export function fetchWrongRecords(deviceId: string): Promise<PracticeRecord[]> {
  const records = getAllRecords(deviceId).filter(r => r.is_failed);
  return Promise.resolve(records);
}

export function fetchStats(deviceId: string) {
  return Promise.resolve(getStats(deviceId));
}

// === Standard Audio (TTS) ===
// In the pure frontend version, TTS is handled by the browser SpeechSynthesis API.
// This function returns the text to be spoken, and the component handles playback.

export function fetchStandardAudioText(questionId: number): Promise<string> {
  const q = questionsById.get(questionId);
  if (!q) return Promise.reject(new Error('题目不存在'));
  return Promise.resolve(q.audio_script || '');
}

// === Convenience ===

export { getDeviceId };
export { questions, questionsById, questionsByType, questionsByPaper, papers };
