export type QuestionType = 'listen_choose' | 'listen_answer' | 'listen_retell' | 'read_aloud';

export interface ListenChooseContent {
  question: string;
  options: string[];
  correct_answer: number;
}

export interface ListenAnswerContent {
  question: string;
  sample_answer: string;
  keywords: string[];
}

export interface ListenRetellContent {
  topic: string;
  intro: string;
  info_points: { label: string; answer: string }[];
}

export interface ReadAloudContent {
  passage: string;
}

export type QuestionContent = ListenChooseContent | ListenAnswerContent | ListenRetellContent | ReadAloudContent;

export interface Question {
  id: number;
  type: QuestionType;
  paper_id: number;
  section_index: number;
  difficulty_group: number;
  difficulty_coefficient: number;
  title: string;
  content: QuestionContent;
  audio_script: string;
  max_score: number;
}

export interface PracticeRecord {
  id: number;
  question_id: number;
  question_type: QuestionType;
  paper_id: number;
  device_id: string;
  session_id: string;
  user_answer: string | null;
  audio_url: string | null;
  transcription: string | null;
  score: number;
  max_score: number;
  score_level: string | null;
  is_failed: boolean;
  is_favorite: boolean;
  accuracy_analysis: string | null;
  fluency_analysis: string | null;
  completeness_analysis: string | null;
  specific_issues: string | null;
  suggestions: string | null;
  feedback: Record<string, unknown>;
  created_at: string;
  question_title: string | null;
  question_content: QuestionContent | null;
}

export interface Paper {
  paperId: number;
  paperTitle: string;
  typeList: string[];
  totalScore: number;
  questionCount: number;
}

export interface ScoringResult {
  score: number;
  maxScore: number;
  isPass: boolean;
  transcription: string;
  feedback: Record<string, unknown>;
}
