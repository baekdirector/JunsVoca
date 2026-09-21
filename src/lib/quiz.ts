import type { WordRecord } from './db'

export type QuestionType = 'spelling' | 'meaning'

/** 시험 유형: 한 가지 유형만 내거나 ('mixed'는 문제마다 무작위) */
export type QuizMode = QuestionType | 'mixed'

export type QuizWord = WordRecord

export interface Question {
  word: QuizWord
  type: QuestionType
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface GenerateOptions {
  /** 출제할 문제 수. 생략하면 전체 단어. */
  count?: number
  mode?: QuizMode
}

/** Picks `count` random words (all by default), one question each, order shuffled. */
export function generateQuestions(
  words: QuizWord[],
  { count, mode = 'mixed' }: GenerateOptions = {},
): Question[] {
  const picked = count === undefined ? words : shuffle(words).slice(0, Math.max(0, count))
  const questions: Question[] = picked.map((word) => ({
    word,
    type: mode === 'mixed' ? (Math.random() < 0.5 ? 'spelling' : 'meaning') : mode,
  }))
  return shuffle(questions)
}

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

// 띄어쓰기, 기호("...", "~", 하이픈 등) 차이는 정답 판정에서 무시한다.
function looseKey(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function withoutParentheses(s: string): string {
  return s.replace(/[(（][^)）]*[)）]/g, ' ')
}

/**
 * Meanings may list several acceptable phrasings separated by , / ·  -- any one matching is correct.
 * Spacing/punctuation differences are ignored, and a parenthesized note may be omitted
 * ("(쇼의) 회" accepts both "(쇼의) 회" and "회").
 */
export function checkAnswer(question: Question, userAnswer: string): boolean {
  const user = looseKey(userAnswer)
  if (!user) return false
  if (question.type === 'spelling') {
    return user === looseKey(question.word.term)
  }
  const tokens = question.word.meaning.split(/[,/·]/).filter((t) => t.trim())
  return tokens.some((t) => looseKey(t) === user || looseKey(withoutParentheses(t)) === user)
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
