// Client-side scoring algorithms replacing server-side LLM scoring.
// Uses keyword matching, text similarity (Levenshtein distance), and
// information point coverage for realistic exam-style scoring.

import type { QuestionType, ScoringResult } from '../types';

// --- Text normalization ---
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(w => w.length > 0);
}

// --- Levenshtein distance ---
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// --- Word-level similarity (Jaccard on token sets) ---
function wordSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }
  const union = tokens1.size + tokens2.size - intersection;
  return intersection / union;
}

// --- Character-level similarity (based on edit distance) ---
function charSimilarity(text1: string, text2: string): number {
  const s1 = normalize(text1);
  const s2 = normalize(text2);
  if (s1.length === 0 && s2.length === 0) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - dist / maxLen;
}

// --- Keyword matching ---
function matchKeywords(transcript: string, keywords: string[]): { matched: string[]; missed: string[] } {
  const normalized = normalize(transcript);
  const matched: string[] = [];
  const missed: string[] = [];
  for (const kw of keywords) {
    const normalizedKw = normalize(kw);
    if (normalizedKw && normalized.includes(normalizedKw)) {
      matched.push(kw);
    } else {
      missed.push(kw);
    }
  }
  return { matched, missed };
}

// --- Scoring for listen_choose (objective) ---
export function scoreListenChoose(
  selectedAnswer: number,
  correctAnswer: number,
  maxScore: number
): ScoringResult {
  const isCorrect = selectedAnswer === correctAnswer;
  return {
    score: isCorrect ? maxScore : 0,
    maxScore,
    isPass: isCorrect,
    transcription: '',
    feedback: {
      isCorrect,
      selectedAnswer,
      correctAnswer,
      explanation: isCorrect ? '回答正确！' : '回答错误，请查看正确答案。',
    },
  };
}

// --- Scoring for listen_answer ---
export function scoreListenAnswer(
  question: string,
  sampleAnswer: string,
  keywords: string[],
  transcript: string,
  maxScore: number
): ScoringResult {
  if (!transcript.trim()) {
    return {
      score: 0,
      maxScore,
      isPass: false,
      transcription: '',
      feedback: {
        isCorrect: false,
        keywordMatch: '未匹配到关键词',
        analysis: '未作答，得0分。请参考标准答案。',
        suggestions: '请仔细听录音后，尝试用完整的句子回答问题。',
        sampleAnswer,
      },
    };
  }

  const { matched, missed } = matchKeywords(transcript, keywords);
  const similarity = wordSimilarity(transcript, sampleAnswer);
  const keywordRatio = keywords.length > 0 ? matched.length / keywords.length : similarity;

  // Score: combine keyword coverage and similarity
  let score: number;
  if (keywordRatio >= 0.8 || similarity >= 0.7) {
    score = maxScore;
  } else if (keywordRatio >= 0.5 || similarity >= 0.4) {
    score = Math.round(maxScore * 0.7 * 10) / 10;
  } else if (keywordRatio >= 0.3 || similarity >= 0.2) {
    score = Math.round(maxScore * 0.4 * 10) / 10;
  } else {
    score = 0;
  }
  score = Math.min(maxScore, Math.max(0, score));

  const isPass = score >= maxScore * 0.6;
  const analysis = matched.length > 0
    ? `学生回答中包含了关键词：${matched.join('、')}。${missed.length > 0 ? `但遗漏了：${missed.join('、')}。` : ''}答案${isPass ? '基本正确' : '不够完整'}。`
    : `学生回答中未匹配到关键词。参考答案关键词为：${keywords.join('、')}。`;
  const suggestions = isPass
    ? '回答不错！可以尝试使用更完整的句子表达，注意语法和发音。'
    : '请仔细听录音，抓住关键信息，用完整的句子回答问题。注意关键词的发音。';

  return {
    score,
    maxScore,
    isPass,
    transcription: transcript,
    feedback: {
      isCorrect: isPass,
      keywordMatch: matched.length > 0 ? matched.join('、') : '未匹配到关键词',
      analysis,
      suggestions,
      sampleAnswer,
      similarity: Math.round(similarity * 100) / 100,
    },
  };
}

// --- Scoring for listen_retell ---
export function scoreListenRetell(
  topic: string,
  intro: string,
  infoPoints: { label: string; answer: string }[],
  transcript: string,
  maxScore: number
): ScoringResult {
  if (!transcript.trim()) {
    return {
      score: 0,
      maxScore,
      isPass: false,
      transcription: '',
      feedback: {
        scoreLevel: '0分档',
        coveredPoints: [],
        missingPoints: infoPoints.map(p => p.label),
        languageAnalysis: '未作答，得0分。',
        coherenceAnalysis: '未作答，得0分。',
        suggestions: '请仔细听两遍录音后，尝试转述所有信息点。',
        infoPoints,
      },
    };
  }

  // Check which info points are covered
  const covered: string[] = [];
  const missing: string[] = [];
  const normalizedTranscript = normalize(transcript);

  for (const point of infoPoints) {
    const pointTokens = tokenize(point.answer);
    const matchedTokens = pointTokens.filter(t => normalizedTranscript.includes(t));
    const coverage = pointTokens.length > 0 ? matchedTokens.length / pointTokens.length : 0;
    if (coverage >= 0.5) {
      covered.push(point.label);
    } else {
      missing.push(point.label);
    }
  }

  const coverageRatio = infoPoints.length > 0 ? covered.length / infoPoints.length : 0;

  // Also check overall language quality via similarity to the full script
  const allAnswers = infoPoints.map(p => p.answer).join(' ');
  const langSimilarity = wordSimilarity(transcript, allAnswers);

  // Score based on coverage and language quality
  let score: number;
  let scoreLevel: string;
  if (coverageRatio >= 0.9 && langSimilarity >= 0.5) {
    score = Math.round(maxScore * 0.95 * 10) / 10;
    scoreLevel = '9-10分档';
  } else if (coverageRatio >= 0.7) {
    score = Math.round(maxScore * 0.75 * 10) / 10;
    scoreLevel = '7-8分档';
  } else if (coverageRatio >= 0.5) {
    score = Math.round(maxScore * 0.55 * 10) / 10;
    scoreLevel = '5-6分档';
  } else if (coverageRatio >= 0.3) {
    score = Math.round(maxScore * 0.35 * 10) / 10;
    scoreLevel = '3-4分档';
  } else {
    score = Math.round(maxScore * 0.15 * 10) / 10;
    scoreLevel = '0-2分档';
  }
  score = Math.min(maxScore, Math.max(0, score));

  const isPass = score >= maxScore * 0.6;

  const languageAnalysis = langSimilarity >= 0.5
    ? '语言表达较为准确，词汇使用得当，语法基本正确。'
    : langSimilarity >= 0.3
      ? '语言表达有一些错误，但不影响理解。词汇和语法需要改进。'
      : '语言表达存在较多问题，建议多练习基本句型和词汇。';

  const coherenceAnalysis = coverageRatio >= 0.7
    ? '转述较为连贯，信息点之间的衔接自然。'
    : '转述的连贯性有待提高，部分信息点之间的逻辑关系不够清晰。';

  const suggestions = missing.length > 0
    ? `遗漏的信息点：${missing.join('、')}。请再听一遍录音，注意这些信息的细节。`
    : '所有信息点都已覆盖！请继续提高语言的准确性和连贯性。';

  return {
    score,
    maxScore,
    isPass,
    transcription: transcript,
    feedback: {
      scoreLevel,
      coveredPoints: covered,
      missingPoints: missing,
      languageAnalysis,
      coherenceAnalysis,
      suggestions,
      infoPoints,
      coverage: Math.round(coverageRatio * 100) / 100,
    },
  };
}

// --- Scoring for read_aloud ---
export function scoreReading(
  passage: string,
  transcript: string,
  maxScore: number
): ScoringResult {
  if (!transcript.trim()) {
    return {
      score: 0,
      maxScore,
      isPass: false,
      transcription: '',
      feedback: {
        scoreLevel: '0分档',
        accuracyAnalysis: '未作答，得0分。',
        fluencyAnalysis: '未作答，得0分。',
        completenessAnalysis: '未作答，得0分。',
        specificIssues: '未检测到朗读内容',
        suggestions: '请先点击录音按钮，朗读屏幕上显示的短文。',
        passage,
      },
    };
  }

  const charSim = charSimilarity(passage, transcript);
  const wordSim = wordSimilarity(passage, transcript);
  const overallSim = (charSim + wordSim) / 2;

  // Analyze word-level differences
  const passageTokens = tokenize(passage);
  const transcriptTokens = tokenize(transcript);
  const transcriptSet = new Set(transcriptTokens);

  let correctWords = 0;
  let missingWords = 0;
  let extraWords = 0;

  for (const w of passageTokens) {
    if (transcriptSet.has(w)) {
      correctWords++;
    } else {
      missingWords++;
    }
  }

  const passageSet = new Set(passageTokens);
  for (const w of transcriptTokens) {
    if (!passageSet.has(w)) extraWords++;
  }

  const completeness = passageTokens.length > 0 ? correctWords / passageTokens.length : 0;

  // Score based on overall similarity
  let score: number;
  let scoreLevel: string;
  if (overallSim >= 0.9) {
    score = Math.round(maxScore * 0.97 * 10) / 10;
    scoreLevel = '9分档';
  } else if (overallSim >= 0.75) {
    score = Math.round(maxScore * 0.8 * 10) / 10;
    scoreLevel = '7-8分档';
  } else if (overallSim >= 0.55) {
    score = Math.round(maxScore * 0.6 * 10) / 10;
    scoreLevel = '5-6分档';
  } else if (overallSim >= 0.3) {
    score = Math.round(maxScore * 0.4 * 10) / 10;
    scoreLevel = '3-4分档';
  } else {
    score = Math.round(maxScore * 0.15 * 10) / 10;
    scoreLevel = '0-2分档';
  }
  score = Math.min(maxScore, Math.max(0, score));

  const isPass = score >= maxScore * 0.6;

  const accuracyAnalysis = overallSim >= 0.8
    ? '语音准确度较高，大部分单词发音正确。'
    : overallSim >= 0.5
      ? '语音准确度一般，存在一些发音错误，但不影响整体理解。'
      : '语音准确度较低，存在较多发音错误，建议多练习单词发音。';

  const fluencyAnalysis = overallSim >= 0.8
    ? '朗读流利，节奏感好，停顿自然。'
    : overallSim >= 0.5
      ? '朗读基本流利，但部分地方停顿不够自然。'
      : '朗读流利度有待提高，存在较多卡顿和不自然的停顿。';

  const completenessAnalysis = completeness >= 0.9
    ? '朗读完整，覆盖了全文内容。'
    : completeness >= 0.6
      ? `朗读基本完整，覆盖率约${Math.round(completeness * 100)}%。`
      : `朗读不够完整，覆盖率仅约${Math.round(completeness * 100)}%，存在漏读现象。`;

  const issues: string[] = [];
  if (missingWords > 0) issues.push(`漏读约${missingWords}个单词`);
  if (extraWords > 0) issues.push(`多读了约${extraWords}个单词`);
  if (issues.length === 0) issues.push('无明显问题');

  const suggestions = overallSim >= 0.8
    ? '朗读表现优秀！继续保持，可以尝试提高语速和情感表达。'
    : '建议先逐句练习，注意每个单词的发音，然后逐渐加快速度进行完整朗读。';

  return {
    score,
    maxScore,
    isPass,
    transcription: transcript,
    feedback: {
      scoreLevel,
      accuracyAnalysis,
      fluencyAnalysis,
      completenessAnalysis,
      specificIssues: issues.join('；'),
      suggestions,
      passage,
      similarity: Math.round(overallSim * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
    },
  };
}

// --- Main scoring dispatcher ---
export function scoreAnswer(
  type: QuestionType,
  content: any,
  transcript: string,
  maxScore: number,
  selectedAnswer?: number
): ScoringResult {
  switch (type) {
    case 'listen_choose':
      return scoreListenChoose(selectedAnswer ?? -1, content.correct_answer, maxScore);
    case 'listen_answer':
      return scoreListenAnswer(content.question, content.sample_answer, content.keywords, transcript, maxScore);
    case 'listen_retell':
      return scoreListenRetell(content.topic, content.intro, content.info_points, transcript, maxScore);
    case 'read_aloud':
      return scoreReading(content.passage, transcript, maxScore);
    default:
      return { score: 0, maxScore, isPass: false, transcription: '', feedback: {} };
  }
}
