import type { WordRecord } from './db'

export type QuestionType = 'spelling' | 'meaning'

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

/** One question per word, question type chosen at random, order shuffled. */
export function generateQuestions(words: QuizWord[]): Question[] {
  const questions: Question[] = words.map((word) => ({
    word,
    type: Math.random() < 0.5 ? 'spelling' : 'meaning',
  }))
  return shuffle(questions)
}

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Meanings may list several acceptable phrasings separated by , / ·  -- any one matching is correct. */
export function checkAnswer(question: Question, userAnswer: string): boolean {
  const user = normalizeAnswer(userAnswer)
  if (!user) return false
  if (question.type === 'spelling') {
    return user === normalizeAnswer(question.word.term)
  }
  const tokens = question.word.meaning
    .split(/[,/·]/)
    .map((t) => normalizeAnswer(t))
    .filter(Boolean)
  return tokens.includes(user)
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
