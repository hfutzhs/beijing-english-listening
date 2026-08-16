import type { PracticeRecord } from '../types';

const STORAGE_KEY = 'english_practice_records';

export function getAllRecords(deviceId?: string): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: PracticeRecord[] = JSON.parse(raw);
    if (deviceId) return all.filter(r => r.device_id === deviceId);
    return all;
  } catch {
    return [];
  }
}

export function getRecordById(id: number): PracticeRecord | null {
  const all = getAllRecords();
  return all.find(r => r.id === id) || null;
}

export function saveRecord(record: Omit<PracticeRecord, 'id' | 'created_at'>): PracticeRecord {
  const all = getAllRecords();
  const newRecord: PracticeRecord = {
    ...record,
    id: Date.now(),
    created_at: new Date().toISOString(),
  };
  all.push(newRecord);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return newRecord;
}

export function clearAllRecords(deviceId: string): void {
  const all = getAllRecords();
 const remaining = all.filter(r => r.device_id !== deviceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

export function getAnsweredQuestionIds(deviceId: string, type?: string): number[] {
  const records = getAllRecords(deviceId);
  const filtered = type ? records.filter(r => r.question_type === type) : records;
  return [...new Set(filtered.map(r => r.question_id))];
}

export function getExamProgress(deviceId: string): number[] {
  const records = getAllRecords(deviceId).filter(r => r.session_id === 'exam');
  return [...new Set(records.map(r => r.paper_id))];
}

export function getStats(deviceId: string) {
  const records = getAllRecords(deviceId);
  const totalScore = records.reduce((sum, r) => sum + r.score, 0);
  const byType: Record<string, { count: number; avgScore: number; totalMax: number }> = {};
  for (const r of records) {
    if (!byType[r.question_type]) byType[r.question_type] = { count: 0, avgScore: 0, totalMax: 0 };
    byType[r.question_type].count++;
    byType[r.question_type].avgScore += r.score;
    byType[r.question_type].totalMax += r.max_score;
  }
  for (const t of Object.keys(byType)) {
    const item = byType[t];
    item.avgScore = item.count > 0 ? item.avgScore / item.count : 0;
  }
  return {
    total: records.length,
    passed: records.filter(r => !r.is_failed).length,
    failed: records.filter(r => r.is_failed).length,
    avg_score: records.length > 0 ? totalScore / records.length : 0,
    byType,
  };
}

export function getExamScoreForPaper(deviceId: string, paperId: number): number | null {
  const records = getAllRecords(deviceId).filter(r => r.session_id === 'exam' && r.paper_id === paperId);
  if (records.length === 0) return null;
  return records.reduce((sum, r) => sum + r.score, 0);
}
