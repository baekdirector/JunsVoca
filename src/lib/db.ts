import Dexie, { type EntityTable } from 'dexie'

export interface WordSetRecord {
  id: number
  title: string
  createdAt: number
}

export interface WordRecord {
  id: number
  wordSetId: number
  term: string
  meaning: string
  isIdiom: boolean
  partOfSpeech?: string
}

export type QuestionType = 'spelling' | 'meaning'

export interface QuizSessionRecord {
  id: number
  /** Groups every round of one quiz attempt together (round 1 + any retry rounds). */
  groupId: string
  wordSetId: number
  wordSetTitle: string
  round: number
  startedAt: number
  finishedAt: number
  durationMs: number
  totalQuestions: number
  correctCount: number
  wrongCount: number
}

export interface QuizAnswerRecord {
  id: number
  sessionId: number
  wordId: number
  questionType: QuestionType
  term: string
  meaning: string
  correctAnswer: string
  userAnswer: string
  correct: boolean
}

class JunsVocaDB extends Dexie {
  wordSets!: EntityTable<WordSetRecord, 'id'>
  words!: EntityTable<WordRecord, 'id'>
  quizSessions!: EntityTable<QuizSessionRecord, 'id'>
  quizAnswers!: EntityTable<QuizAnswerRecord, 'id'>

  constructor() {
    super('junsvoca')
    this.version(1).stores({
      wordSets: '++id, createdAt',
      words: '++id, wordSetId',
      quizSessions: '++id, groupId, wordSetId, round, startedAt',
      quizAnswers: '++id, sessionId, wordId, correct',
    })
  }
}

export const db = new JunsVocaDB()

export async function createWordSet(
  title: string,
  words: Array<Pick<WordRecord, 'term' | 'meaning' | 'isIdiom' | 'partOfSpeech'>>,
): Promise<number> {
  return db.transaction('rw', db.wordSets, db.words, async () => {
    const wordSetId = await db.wordSets.add({ title, createdAt: Date.now() })
    await db.words.bulkAdd(words.map((w) => ({ ...w, wordSetId })))
    return wordSetId
  })
}

export function getWordSets() {
  return db.wordSets.orderBy('createdAt').reverse().toArray()
}

export function getLatestWordSet() {
  return db.wordSets.orderBy('createdAt').reverse().first()
}

export function getWordsBySet(wordSetId: number) {
  return db.words.where('wordSetId').equals(wordSetId).toArray()
}

export function addWord(word: Omit<WordRecord, 'id'>) {
  return db.words.add(word)
}

export function updateWord(id: number, patch: Partial<Omit<WordRecord, 'id' | 'wordSetId'>>) {
  return db.words.update(id, patch)
}

export function deleteWord(id: number) {
  return db.words.delete(id)
}

export interface RecordRoundInput {
  groupId: string
  wordSetId: number
  wordSetTitle: string
  round: number
  startedAt: number
  finishedAt: number
  answers: Array<Omit<QuizAnswerRecord, 'id' | 'sessionId'>>
}

export async function recordQuizRound(input: RecordRoundInput): Promise<number> {
  const correctCount = input.answers.filter((a) => a.correct).length
  const wrongCount = input.answers.length - correctCount
  return db.transaction('rw', db.quizSessions, db.quizAnswers, async () => {
    const sessionId = await db.quizSessions.add({
      groupId: input.groupId,
      wordSetId: input.wordSetId,
      wordSetTitle: input.wordSetTitle,
      round: input.round,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      durationMs: input.finishedAt - input.startedAt,
      totalQuestions: input.answers.length,
      correctCount,
      wrongCount,
    })
    await db.quizAnswers.bulkAdd(input.answers.map((a) => ({ ...a, sessionId })))
    return sessionId
  })
}

export interface AttemptSummary {
  groupId: string
  wordSetId: number
  wordSetTitle: string
  firstRoundSessionId: number
  startedAt: number
  /** When the last round of this attempt finished (or the latest round so far). */
  lastFinishedAt: number
  totalQuestions: number
  correctCount: number
  wrongCount: number
  accuracy: number
  totalDurationMs: number
  roundsTaken: number
  /** True once a round in this attempt finished with zero wrong answers. */
  mastered: boolean
}

export async function getAttempts(): Promise<AttemptSummary[]> {
  const sessions = await db.quizSessions.orderBy('startedAt').reverse().toArray()
  const byGroup = new Map<string, QuizSessionRecord[]>()
  for (const s of sessions) {
    const list = byGroup.get(s.groupId) ?? []
    list.push(s)
    byGroup.set(s.groupId, list)
  }
  const attempts: AttemptSummary[] = []
  for (const [groupId, rounds] of byGroup) {
    rounds.sort((a, b) => a.round - b.round)
    const first = rounds[0]
    const last = rounds[rounds.length - 1]
    attempts.push({
      groupId,
      wordSetId: first.wordSetId,
      wordSetTitle: first.wordSetTitle,
      firstRoundSessionId: first.id!,
      startedAt: first.startedAt,
      lastFinishedAt: last.finishedAt,
      totalQuestions: first.totalQuestions,
      correctCount: first.correctCount,
      wrongCount: first.wrongCount,
      accuracy: first.totalQuestions > 0 ? Math.round((first.correctCount / first.totalQuestions) * 100) : 0,
      totalDurationMs: rounds.reduce((sum, r) => sum + r.durationMs, 0),
      roundsTaken: rounds.length,
      mastered: rounds.some((r) => r.wrongCount === 0),
    })
  }
  attempts.sort((a, b) => b.startedAt - a.startedAt)
  return attempts
}

export async function getAttemptDetail(groupId: string) {
  const rounds = await db.quizSessions.where('groupId').equals(groupId).sortBy('round')
  const sessionIds = rounds.map((r) => r.id!)
  const answers = await db.quizAnswers.where('sessionId').anyOf(sessionIds).toArray()
  return { rounds, answers }
}

export async function getMissedWordCounts(limit = 5) {
  const answers = await db.quizAnswers.toArray()
  const counts = new Map<string, { term: string; meaning: string; wrong: number }>()
  for (const a of answers) {
    if (a.correct) continue
    // Grouped by term alone (not question type) so a word missed once as a
    // spelling question and once as a meaning question still counts as one word.
    const entry = counts.get(a.term) ?? { term: a.term, meaning: a.meaning, wrong: 0 }
    entry.wrong += 1
    counts.set(a.term, entry)
  }
  return Array.from(counts.values())
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, limit)
}

export interface HomeStats {
  totalWords: number
  totalAttempts: number
  weeklyAccuracy: number
  streakDays: number
}

function isSameDay(a: number, b: number) {
  const da = new Date(a)
  const db_ = new Date(b)
  return da.getFullYear() === db_.getFullYear() && da.getMonth() === db_.getMonth() && da.getDate() === db_.getDate()
}

export async function getHomeStats(): Promise<HomeStats> {
  const [totalWords, attempts] = await Promise.all([db.words.count(), getAttempts()])
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = attempts.filter((a) => a.startedAt >= weekAgo)
  const weeklyAccuracy =
    recent.length > 0 ? Math.round(recent.reduce((sum, a) => sum + a.accuracy, 0) / recent.length) : 0

  let streakDays = 0
  if (attempts.length > 0) {
    const days = Array.from(new Set(attempts.map((a) => new Date(a.startedAt).toDateString())))
      .map((d) => new Date(d).getTime())
      .sort((a, b) => b - a)
    let cursor = Date.now()
    for (const day of days) {
      if (isSameDay(day, cursor) || isSameDay(day, cursor - 24 * 60 * 60 * 1000)) {
        streakDays += 1
        cursor = day
      } else {
        break
      }
    }
  }

  return { totalWords, totalAttempts: attempts.length, weeklyAccuracy, streakDays }
}
