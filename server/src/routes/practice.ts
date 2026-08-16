import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client';
import {
  uploadAudio,
  transcribeAudio,
  getAudioUrl,
  scoreReading,
  scoreListenAnswer,
  scoreListenRetell,
} from '../services/scoring';
import { generateTTSAudio, getTTSAudioUrl } from '../services/tts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Map raw DB record to frontend-expected format
function mapRecord(row: any) {
  if (!row) return null;
  const q = row.questions || {};
  return {
    id: row.id,
    question_id: row.question_id,
    device_id: row.device_id,
    question_type: row.question_type,
    type: q.type || row.question_type,
    paper_id: row.paper_id || q.paper_id,
    user_answer: row.user_answer,
    audio_key: row.audio_key,
    audio_url: row.audio_url,
    transcription: row.transcription,
    transcript: row.transcription, // alias
    score: row.score,
    max_score: row.max_score || q.max_score,
    score_level: row.score_level,
    accuracy_analysis: row.accuracy_analysis,
    fluency_analysis: row.fluency_analysis,
    completeness_analysis: row.completeness_analysis,
    specific_issues: row.specific_issues,
    analysis: row.specific_issues || row.accuracy_analysis, // alias
    details: row.specific_issues, // alias
    suggestions: row.suggestions,
    is_passed: !row.is_failed,
    is_failed: row.is_failed,
    is_favorite: false,
    question_title: q.title || null,
    question_content: q.content || null,
    feedback: {
      transcription: row.transcription,
      isCorrect: !row.is_failed,
      isCorrectAnswer: !row.is_failed,
      correctAnswer: (() => {
        const content = q.content;
        if (typeof content === 'string') { try { return JSON.parse(content).correct_answer; } catch { return undefined; } }
        return content?.correct_answer;
      })(),
      sampleAnswer: (() => {
        const content = q.content;
        if (typeof content === 'string') { try { return JSON.parse(content).sample_answer; } catch { return undefined; } }
        return content?.sample_answer;
      })(),
      infoPoints: (() => {
        const content = q.content;
        if (typeof content === 'string') { try { return JSON.parse(content).info_points; } catch { return undefined; } }
        return content?.info_points;
      })(),
      specificIssues: row.specific_issues,
      accuracyAnalysis: row.accuracy_analysis,
      fluencyAnalysis: row.fluency_analysis,
      completenessAnalysis: row.completeness_analysis,
      suggestions: row.suggestions,
    },
    created_at: row.created_at,
  };
}

// Type definitions for question content JSON
interface ListenChooseContent {
  question: string;
  options: string[];
  correct_answer: number;
}

interface ListenAnswerContent {
  question: string;
  sample_answer: string;
  keywords: string[];
}

interface ListenRetellContent {
  topic: string;
  intro: string;
  info_points: { label: string; answer: string }[];
}

interface ReadAloudContent {
  passage: string;
}

// ============================================================
// GET /api/v1/practice/questions - Get questions by type and/or paper_id
// ============================================================
router.get('/questions', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { type, paperId } = req.query;

    let query = client.from('questions').select('*');

    if (type) {
      query = query.eq('type', type as string);
    }
    if (paperId) {
      query = query.eq('paper_id', parseInt(paperId as string));
    }

    query = query.order('section_index', { ascending: true }).order('difficulty_group', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch questions:', error);
      return res.status(500).json({ error: 'Failed to fetch questions' });
    }

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Error in GET /questions:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/questions/:id - Get single question
// ============================================================
router.get('/questions/:id', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { id } = req.params;

    const { data, error } = await client
      .from('questions')
      .select('*')
      .eq('id', parseInt(id as string))
      .single();

    if (error) {
      console.error('Failed to fetch question:', error);
      return res.status(404).json({ error: 'Question not found' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error in GET /questions/:id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/papers - Get list of available papers
// ============================================================
router.get('/papers', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .select('paper_id, type, max_score, difficulty_coefficient, title')
      .order('paper_id', { ascending: true });

    if (error) {
      console.error('Failed to fetch papers:', error);
      return res.status(500).json({ error: 'Failed to fetch papers' });
    }

    // Group by paper_id
    const paperMap = new Map<number, {
      paperId: number;
      paperTitle: string;
      types: string[];
      totalScore: number;
      avgDifficulty: number;
      questionCount: number;
    }>();

    for (const row of data || []) {
      const pid = row.paper_id as number;
      if (!paperMap.has(pid)) {
        paperMap.set(pid, {
          paperId: pid,
          paperTitle: (row.title as string) || '未知来源',
          types: [],
          totalScore: 0,
          avgDifficulty: 0,
          questionCount: 0,
        });
      }
      const paper = paperMap.get(pid)!;
      if (!paper.types.includes(row.type)) {
        paper.types.push(row.type);
      }
      paper.totalScore += row.max_score || 0;
      paper.avgDifficulty += row.difficulty_coefficient || 0;
      paper.questionCount++;
    }

    const papers = Array.from(paperMap.values()).map(p => ({
      ...p,
      avgDifficulty: p.questionCount > 0 ? p.avgDifficulty / p.questionCount : 0,
    }));

    return res.json({ success: true, data: papers });
  } catch (err) {
    console.error('Error in GET /papers:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/v1/practice/submit - Submit answer and get score
// For listen_choose: { questionId, userAnswer (number index) }
// For listen_answer / listen_retell / read_aloud: FormData with audio file
// ============================================================
router.post('/submit', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.body.deviceId || req.headers['x-device-id'] || 'anonymous';
    const questionId = parseInt(req.body.questionId);
    const practiceMode = req.body.practiceMode || 'single'; // 'single' or 'mock'

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    // Fetch question
    const { data: question, error: qError } = await client
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const questionType = question.type as string;
    const maxScore = question.max_score as number;
    let score = 0;
    let feedback: Record<string, unknown> = {};
    let userAnswer = '';
    let isPass = false;
    let isWrong = false;

    if (questionType === 'listen_choose') {
      // Text-based answer: userAnswer is the selected option index
      const selectedIdx = parseInt(req.body.userAnswer);
      const content = typeof question.content === 'string' ? JSON.parse(question.content) : question.content as ListenChooseContent;
      const hasAnswer = !isNaN(selectedIdx) && selectedIdx >= 0;
      const isCorrect = hasAnswer && selectedIdx === content.correct_answer;

      score = isCorrect ? Math.round((maxScore / 6) * 2) : 0; // Scale to total maxScore

      isPass = isCorrect;
      isWrong = !isCorrect;
      userAnswer = hasAnswer ? (content.options[selectedIdx] || `Option ${selectedIdx + 1}`) : '未作答';

      feedback = {
        isCorrect,
        correctAnswer: content.options[content.correct_answer],
        userAnswer,
        question: content.question,
        explanation: !hasAnswer
          ? '未作答，得0分。'
          : isCorrect
            ? '回答正确！'
            : `正确答案是：${content.options[content.correct_answer]}`,
      };
    } else if (questionType === 'listen_answer') {
      const content = typeof question.content === 'string' ? JSON.parse(question.content) : question.content as ListenAnswerContent;
      let transcription: string;
      let audioUrl: string | undefined;

      if (req.body.userAnswer && typeof req.body.userAnswer === 'string' && req.body.userAnswer.trim()) {
        // Text-based answer: use text directly as transcription
        transcription = req.body.userAnswer.trim();
      } else if (req.file) {
        // Audio-based: need ASR + LLM scoring
        const audioBuffer = req.file.buffer;
        const fileName = `answer-${questionId}-${Date.now()}.m4a`;
        const audioKey = await uploadAudio(audioBuffer, fileName, req.file.mimetype || 'audio/m4a');
        audioUrl = await getAudioUrl(audioKey);
        transcription = await transcribeAudio(audioUrl, req);
      } else {
        // Empty answer: no text and no audio, score 0
        transcription = '';
        score = 0;
        isPass = false;
        isWrong = true;
        userAnswer = '';
        feedback = {
          transcription: '',
          score: 0,
          maxScore: 2,
          isCorrect: false,
          suggestions: '未作答，得0分。请参考标准答案。',
          sampleAnswer: content.sample_answer,
          audioUrl: null,
        };
      }

      const result = await scoreListenAnswer(
        content.question,
        content.sample_answer,
        content.keywords,
        transcription,
        req
      );

      score = result.score;
      isPass = score >= 1; // Pass if at least 1 out of 2
      isWrong = score === 0;
      userAnswer = transcription;

      feedback = {
        transcription,
        score: result.score,
        maxScore: 2,
        isCorrect: result.isCorrect,
        keywordMatch: result.keywordMatch,
        analysis: result.analysis,
        suggestions: result.suggestions,
        sampleAnswer: content.sample_answer,
        audioUrl,
      };
    } else if (questionType === 'listen_retell') {
      const textAnswer = (req.body.userAnswer || '').trim();
      let transcription = '';
      let audioUrl: string | undefined;

      if (textAnswer) {
        transcription = textAnswer;
      } else if (req.file) {
        const audioBuffer = req.file.buffer;
        const fileName = `retell-${questionId}-${Date.now()}.m4a`;
        const audioKey = await uploadAudio(audioBuffer, fileName, req.file.mimetype || 'audio/m4a');
        audioUrl = await getAudioUrl(audioKey);
        transcription = await transcribeAudio(audioUrl, req);
      } else {
        // Empty answer - score 0
        score = 0;
        isPass = false;
        isWrong = true;
        userAnswer = '未作答';
        feedback = {
          transcription: '',
          score: 0,
          maxScore: 10,
          explanation: '未作答，得0分。',
        };
      }

      if (transcription) {
        const content = typeof question.content === 'string' ? JSON.parse(question.content) : question.content as ListenRetellContent;

        const result = await scoreListenRetell(
          content.topic,
          content.intro,
          content.info_points,
          transcription,
          req
        );

        score = result.score;
        isPass = score >= 6; // Pass if at least 6 out of 10
        isWrong = score < 6;
        userAnswer = transcription;

        feedback = {
          transcription,
          score: result.score,
          maxScore: 10,
          scoreLevel: result.scoreLevel,
          coveredPoints: result.coveredPoints,
          missingPoints: result.missingPoints,
          languageAnalysis: result.languageAnalysis,
          coherenceAnalysis: result.coherenceAnalysis,
          suggestions: result.suggestions,
          infoPoints: content.info_points,
          audioUrl,
        };
      }
    } else if (questionType === 'read_aloud') {
      if (!req.file) {
        // Empty answer - score 0
        score = 0;
        isPass = false;
        isWrong = true;
        userAnswer = '未作答';
        feedback = {
          transcription: '',
          score: 0,
          maxScore: 9,
          explanation: '未作答，得0分。',
        };
      } else {
        const audioBuffer = req.file.buffer;
        const fileName = `readaloud-${questionId}-${Date.now()}.m4a`;
        const audioKey = await uploadAudio(audioBuffer, fileName, req.file.mimetype || 'audio/m4a');
        const audioUrl = await getAudioUrl(audioKey);

        const transcription = await transcribeAudio(audioUrl, req);
        const content = typeof question.content === 'string' ? JSON.parse(question.content) : question.content as ReadAloudContent;

        const result = await scoreReading(content.passage, transcription, req);

      score = result.score;
      isPass = score >= 6; // Pass if at least 6 out of 9
      isWrong = score < 6;
      userAnswer = transcription;

      feedback = {
        transcription,
        score: result.score,
        maxScore: 9,
        scoreLevel: result.scoreLevel,
        accuracyAnalysis: result.accuracyAnalysis,
        fluencyAnalysis: result.fluencyAnalysis,
        completenessAnalysis: result.completenessAnalysis,
        specificIssues: result.specificIssues,
        suggestions: result.suggestions,
        passage: content.passage,
        audioUrl,
      };
      }
    } else {
      return res.status(400).json({ error: `Unknown question type: ${questionType}` });
    }

    // Save to practice_records
    const insertData: Record<string, unknown> = {
        question_id: questionId,
        question_type: questionType,
        device_id: deviceId as string,
        user_answer: userAnswer,
        score,
        max_score: maxScore,
        is_failed: isWrong,
        session_id: practiceMode,
        paper_id: question.paper_id,
        specific_issues: JSON.stringify(feedback),
    };

    // Map feedback fields to schema columns
    if (feedback.transcription) insertData.transcription = feedback.transcription;
    if (feedback.accuracyAnalysis) insertData.accuracy_analysis = feedback.accuracyAnalysis;
    if (feedback.fluencyAnalysis) insertData.fluency_analysis = feedback.fluencyAnalysis;
    if (feedback.completenessAnalysis) insertData.completeness_analysis = feedback.completenessAnalysis;
    if (feedback.suggestions) insertData.suggestions = feedback.suggestions;
    if (feedback.scoreLevel) insertData.score_level = feedback.scoreLevel;
    if (feedback.audioUrl) insertData.audio_key = feedback.audioUrl;

    const { data: record, error: insertError } = await client
      .from('practice_records')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save practice record:', insertError);
    }

    return res.json({
      success: true,
      data: {
        recordId: record?.id || null,
        score,
        max_score: maxScore,
        maxScore,
        isPass,
        is_passed: isPass,
        feedback,
        transcription: feedback.transcription || userAnswer,
        transcript: feedback.transcription || userAnswer,
        accuracy_analysis: feedback.accuracyAnalysis || null,
        fluency_analysis: feedback.fluencyAnalysis || null,
        completeness_analysis: feedback.completenessAnalysis || null,
        suggestions: feedback.suggestions || null,
        specific_issues: JSON.stringify(feedback),
        analysis: JSON.stringify(feedback),
        details: feedback.explanation || JSON.stringify(feedback),
      },
    });
  } catch (err) {
    console.error('Error in POST /submit:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/standard-audio/:questionId - Get or generate TTS for a question
// ============================================================
router.get('/standard-audio/:questionId', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const questionId = parseInt(req.params.questionId as string);

    const { data: question, error } = await client
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if audio already cached
    if (question.standard_audio_key) {
      const audioUrl = await getTTSAudioUrl(question.standard_audio_key);
      return res.json({ success: true, data: { audioUrl } });
    }

    // Determine text to synthesize
    let textToSpeak = '';
    const questionType = question.type as string;

    if (question.audio_script) {
      textToSpeak = question.audio_script as string;
    } else if (questionType === 'read_aloud') {
      // Supabase returns JSONB as already-parsed objects; handle both cases
      const rawContent = question.content;
      const content = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
      textToSpeak = content?.passage || '';
    } else {
      return res.status(400).json({ error: 'No text available for TTS' });
    }

    // Generate TTS audio
    const cacheId = `question-${questionId}`;
    const audioKey = await generateTTSAudio(textToSpeak, cacheId, req);

    // Update question with cached audio key
    await client
      .from('questions')
      .update({ standard_audio_key: audioKey })
      .eq('id', questionId);

    const audioUrl = await getTTSAudioUrl(audioKey);
    return res.json({ success: true, data: { audioUrl } });
  } catch (err) {
    console.error('Error in GET /standard-audio/:questionId:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/history - Get practice history by device
// ============================================================
router.get('/history', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.query.deviceId as string;
    const questionType = req.query.type as string | undefined;
    const practiceMode = req.query.mode as string | undefined;
    const onlyWrong = req.query.wrong === 'true';

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    let query = client
      .from('practice_records')
      .select(`
        *,
        questions!inner (
          id,
          type,
          content,
          paper_id,
          difficulty_coefficient
        )
      `)
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (questionType) {
      query = query.eq('question_type', questionType);
    }
    if (practiceMode) {
      query = query.eq('session_id', practiceMode);
    }
    if (onlyWrong) {
      query = query.eq('is_failed', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch history:', error);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    return res.json({ success: true, data: (data || []).map(mapRecord) });
  } catch (err) {
    console.error('Error in GET /history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/history/:id - Get single history record
// ============================================================
router.get('/history/:id', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const recordId = parseInt(req.params.id as string);

    const { data, error } = await client
      .from('practice_records')
      .select(`
        *,
        questions!inner (
          id,
          type,
          content,
          audio_script,
          paper_id,
          difficulty_coefficient
        )
      `)
      .eq('id', recordId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Record not found' });
    }

    return res.json({ success: true, data: mapRecord(data) });
  } catch (err) {
    console.error('Error in GET /history/:id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// DELETE /api/v1/practice/history - Clear all history for a device
// Query 参数：deviceId: string
// ============================================================
router.delete('/history', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.query.deviceId as string;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const { error } = await client
      .from('practice_records')
      .delete()
      .eq('device_id', deviceId);

    if (error) {
      console.error('Failed to clear history:', error);
      return res.status(500).json({ error: 'Failed to clear history' });
    }

    return res.json({ success: true, data: { cleared: true } });
  } catch (err) {
    console.error('Error in DELETE /history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/exam-progress - Get submitted exam paper IDs for a device
// Query 参数：deviceId: string
// 返回已交卷的试卷ID列表（session_id='exam' 且每套至少提交1题）
// ============================================================
router.get('/exam-progress', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.query.deviceId as string;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const { data, error } = await client
      .from('practice_records')
      .select('paper_id')
      .eq('device_id', deviceId)
      .eq('session_id', 'exam');

    if (error) {
      console.error('Failed to fetch exam progress:', error);
      return res.status(500).json({ error: 'Failed to fetch exam progress' });
    }

    const submittedPaperIds = [...new Set((data || []).map((r: any) => r.paper_id as number))];

    return res.json({ success: true, data: submittedPaperIds });
  } catch (err) {
    console.error('Error in GET /exam-progress:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/answered-questions - Get answered question IDs for a device
// Query 参数：deviceId: string, type?: QuestionType
// ============================================================
router.get('/answered-questions', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.query.deviceId as string;
    const questionType = req.query.type as string | undefined;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    let query = client
      .from('practice_records')
      .select('question_id')
      .eq('device_id', deviceId);

    if (questionType) {
      query = query.eq('question_type', questionType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch answered questions:', error);
      return res.status(500).json({ error: 'Failed to fetch answered questions' });
    }

    const answeredIds = (data || []).map((r: any) => r.question_id as number);

    return res.json({ success: true, data: answeredIds });
  } catch (err) {
    console.error('Error in GET /answered-questions:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/wrong-records - Get failed/wrong records
// ============================================================
router.get('/wrong-records', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.query.deviceId as string;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const { data, error } = await client
      .from('practice_records')
      .select(`
        *,
        questions!inner (
          id,
          type,
          content,
          paper_id,
          difficulty_coefficient
        )
      `)
      .eq('device_id', deviceId)
      .eq('is_failed', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch wrong records:', error);
      return res.status(500).json({ error: 'Failed to fetch wrong records' });
    }

    return res.json({ success: true, data: (data || []).map(mapRecord) });
  } catch (err) {
    console.error('Error in GET /wrong-records:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/stats - Get statistics by device
// ============================================================
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.query.deviceId as string;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const { data, error } = await client
      .from('practice_records')
      .select('question_type, score, max_score, is_failed, session_id')
      .eq('device_id', deviceId);

    if (error) {
      console.error('Failed to fetch stats:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    const totalScore = data?.reduce((sum, r) => sum + (r.score as number), 0) || 0;
    const stats = {
      total: data?.length || 0,
      passed: data?.filter(r => !r.is_failed).length || 0,
      failed: data?.filter(r => r.is_failed).length || 0,
      avg_score: data && data.length > 0 ? totalScore / data.length : 0,
      byType: {} as Record<string, { count: number; avgScore: number; totalMax: number }>,
    };

    for (const record of data || []) {
      const type = record.question_type as string;
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, avgScore: 0, totalMax: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].avgScore += record.score as number;
      stats.byType[type].totalMax += record.max_score as number;
    }

    for (const type of Object.keys(stats.byType)) {
      const t = stats.byType[type];
      t.avgScore = t.count > 0 ? t.avgScore / t.count : 0;
    }

    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error in GET /stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/exam-papers - Alias for /papers (frontend compatibility)
// ============================================================
router.get('/exam-papers', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .select('paper_id, type, max_score, difficulty_coefficient, title')
      .order('paper_id', { ascending: true });

    if (error) {
      console.error('Failed to fetch exam papers:', error);
      return res.status(500).json({ error: 'Failed to fetch exam papers' });
    }

    const paperMap = new Map<number, {
      paperId: number;
      paperTitle: string;
      types: string[];
      totalScore: number;
      avgDifficulty: number;
      questionCount: number;
    }>();

    for (const row of data || []) {
      const pid = row.paper_id as number;
      if (!paperMap.has(pid)) {
        paperMap.set(pid, {
          paperId: pid,
          paperTitle: (row.title as string) || `模拟试卷 ${pid}`,
          types: [],
          totalScore: 0,
          avgDifficulty: 0,
          questionCount: 0,
        });
      }
      const paper = paperMap.get(pid)!;
      if (!paper.types.includes(row.type)) {
        paper.types.push(row.type);
      }
      paper.totalScore += row.max_score || 0;
      paper.avgDifficulty += row.difficulty_coefficient || 0;
      paper.questionCount++;
    }

    const papers = Array.from(paperMap.values()).map(p => ({
      ...p,
      avgDifficulty: p.questionCount > 0 ? p.avgDifficulty / p.questionCount : 0,
    }));

    return res.json({ success: true, data: papers });
  } catch (err) {
    console.error('Error in GET /exam-papers:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/exam-papers/:paperId - Get all questions for a paper
// ============================================================
router.get('/exam-papers/:paperId', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const paperId = parseInt(req.params.paperId as string);

    const { data, error } = await client
      .from('questions')
      .select('*')
      .eq('paper_id', paperId)
      .order('type', { ascending: true })
      .order('section_index', { ascending: true });

    if (error) {
      console.error('Failed to fetch exam paper detail:', error);
      return res.status(500).json({ error: 'Failed to fetch exam paper detail' });
    }

    return res.json({ success: true, data: { questions: data || [] } });
  } catch (err) {
    console.error('Error in GET /exam-papers/:paperId:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/v1/practice/favorites - Alias for /wrong-records (frontend compatibility)
// ============================================================
router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const deviceId = req.query.deviceId as string;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const { data, error } = await client
      .from('practice_records')
      .select(`
        *,
        questions!inner (
          id,
          type,
          content,
          paper_id,
          difficulty_coefficient
        )
      `)
      .eq('device_id', deviceId)
      .eq('is_failed', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch favorites:', error);
      return res.status(500).json({ error: 'Failed to fetch favorites' });
    }

    return res.json({ success: true, data: (data || []).map(mapRecord) });
  } catch (err) {
    console.error('Error in GET /favorites:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
