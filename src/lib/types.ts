export type UserRole = 'admin' | 'student';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: string;
  order_index: number;
  title: string;
  description?: string | null;
  created_at: string;
  topics?: Topic[];
}

export interface TopicClassificationRules {
  keywords?: string[];
  laws?: string[];
  negativeWords?: string[];
}

export interface Topic {
  id: string;
  block_id?: string | null;
  order_index: number;
  title: string;
  description: string | null;
  created_at: string;
  classification_rules?: TopicClassificationRules | null;
  subtopics?: Subtopic[];
}

export interface Subtopic {
  id: string;
  topic_id: string;
  order_index: number;
  title: string;
  created_at: string;
  questions_count?: number;
}

export interface Question {
  id: string;
  subtopic_id: string;
  question_text: string;
  options: string[]; // 3 o 4 opciones flexibles
  correct_option: number;
  explanation: string;
  created_at: string;
  subtopics?: {
    id: string;
    title: string;
    topic_id: string;
    order_index?: number;
    topics?: {
      id: string;
      title: string;
      order_index: number;
      block_id?: string | null;
    };
  };
}

export interface Flashcard {
  id: string;
  subtopic_id: string;
  front_text: string;
  back_text: string;
  hint?: string | null;
  order_index?: number;
  created_at: string;
  subtopics?: {
    id: string;
    title: string;
    topic_id: string;
    topics?: {
      id: string;
      title: string;
      order_index: number;
      block_id?: string | null;
    };
  };
}

export interface OfficialExam {
  id: string;
  title: string;
  year: number;
  description?: string | null;
  duration_minutes: number;
  penalty_ratio: number;
  created_at: string;
  questions_count?: number;
}

export interface OfficialExamQuestion {
  id: string;
  exam_id: string;
  subtopic_id?: string | null;
  question_number: number;
  question_text: string;
  options: string[]; // 3 o 4 opciones flexibles
  correct_option: number;
  explanation: string;
  created_at: string;
  subtopics?: {
    id: string;
    title: string;
    topic_id: string;
    order_index?: number;
    topics?: {
      id: string;
      title: string;
      order_index: number;
      block_id?: string | null;
    };
  };
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  mode: 'exam' | 'anki';
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  blank_count: number;
  net_score: number;
  answers_data: Record<string, any>;
  created_at: string;
}

export type AnkiInterval = 1 | 3 | 10 | 20 | 30;

export type AnkiItemType = 'question' | 'official_question' | 'flashcard';

export interface AnkiReview {
  id?: string;
  user_id: string;
  item_type: AnkiItemType;
  item_id: string;
  interval_days: AnkiInterval;
  next_review_at: string;
  last_reviewed_at: string;
  review_count: number;
  last_result?: 'correct' | 'incorrect' | 'revealed';
  created_at?: string;
  updated_at?: string;
}

export type ChallengeStatus = 'pending' | 'resolved' | 'dismissed';

export interface QuestionChallenge {
  id: string;
  question_id: string;
  question_type: 'bank' | 'official' | 'flashcard';
  user_id: string;
  user_email?: string | null;
  user_name?: string | null;
  reason: string;
  status: ChallengeStatus;
  admin_response?: string | null;
  question_text?: string | null;
  options?: string[] | null;
  correct_option?: number | null;
  explanation?: string | null;
  created_at: string;
  resolved_at?: string | null;
}



