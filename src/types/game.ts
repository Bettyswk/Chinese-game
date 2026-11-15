export interface VocabItem {
  id: string;
  zh: string;
  pinyin: string;
  th: string;
}

export interface QuestionItem {
  id: string;
  session: '会话1' | '会话2' | '会话3';
  sessionTh: string;
  template: string; // Uses ____ as placeholder
  pinyinTemplate: string; // Uses ____ as placeholder
  thTranslation: string;
  answerZh: string;
  contextHint?: string;
}

export interface GroupDeck {
  groupId: number;
  label: string;
  questions: QuestionItem[];
}

export interface GameSettings {
  lockSeconds: number; // Lockout duration on wrong answer (0 - 10s)
  penaltySeconds: number; // Extra time penalty added per wrong answer (0 - 10s)
  revealDelayMs: number; // Delay showing filled answer + Thai meaning before next Q
  shoutWord: string; // Winning shout word (e.g. "入住！" or "完成！")
  showContextHints: boolean; // Shows subtle Thai context clue to reduce ambiguity
}

export type TeamStatus = 'IDLE' | 'READY' | 'PLAYING' | 'FINISHED';

export interface TeamProgress {
  groupId: number;
  status: TeamStatus;
  currentQ: number; // 1-based current question index during play
  totalQ: number;
  wrongCount: number;
  elapsedMs: number | null;
  penaltyMs: number;
  finalMs: number | null;
  finishOrder: number | null;
  updatedAt: number;
}

export interface ClassroomSession {
  phase: 'LOBBY' | 'COUNTDOWN' | 'ACTIVE';
  countdownEndsAt: number | null;
  startedAt: number | null;
  teams: Record<number, TeamProgress>;
}

export interface ClassroomState {
  curriculumVersion?: number;
  settings: GameSettings;
  vocab: VocabItem[];
  groups: GroupDeck[];
  session: ClassroomSession;
}
