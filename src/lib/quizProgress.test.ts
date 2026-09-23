import { beforeEach, describe, expect, it } from 'vitest'
import { clearQuizProgress, loadQuizProgress, peekQuizProgress, saveQuizProgress, type QuizProgress } from './quizProgress'

// 이 저장소는 Node 환경(jsdom 없음)에서 테스트가 돌아가므로 localStorage를 직접 흉내 낸다.
class FakeLocalStorage {
  private store = new Map<string, string>()
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
}

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new FakeLocalStorage()
})

const sample: Omit<QuizProgress, 'savedAt'> = {
  wordSetTitle: '9월 21일 단어장',
  setCount: 1,
  round: 1,
  groupId: 'g1',
  startedAt: 1000,
  firstRound: null,
  questions: [
    { type: 'spelling', word: { id: 1, wordSetId: 1, term: 'apple', meaning: '사과', isIdiom: false } },
    { type: 'spelling', word: { id: 2, wordSetId: 1, term: 'run', meaning: '달리다', isIdiom: false } },
  ],
  answers: [null, null],
  qIndex: 0,
}

describe('quizProgress', () => {
  it('저장한 진행 상황을 그대로 불러온다', () => {
    saveQuizProgress('5', sample)
    const loaded = loadQuizProgress('5')
    expect(loaded?.wordSetTitle).toBe('9월 21일 단어장')
    expect(loaded?.questions).toHaveLength(2)
    expect(typeof loaded?.savedAt).toBe('number')
  })

  it('다른 단어장 조합(idsKey)은 서로 섞이지 않는다', () => {
    saveQuizProgress('5', sample)
    expect(loadQuizProgress('1,2')).toBeNull()
  })

  it('빈 idsKey(오답 노트)도 별도 키로 저장된다', () => {
    saveQuizProgress('', sample)
    expect(loadQuizProgress('')?.wordSetTitle).toBe('9월 21일 단어장')
    expect(loadQuizProgress('5')).toBeNull()
  })

  it('clearQuizProgress 이후에는 조회되지 않는다', () => {
    saveQuizProgress('5', sample)
    clearQuizProgress('5')
    expect(loadQuizProgress('5')).toBeNull()
  })

  it('저장된 게 없으면 null을 돌려준다', () => {
    expect(loadQuizProgress('999')).toBeNull()
  })

  it('peekQuizProgress는 답한 문제 수/전체를 요약해서 돌려준다', () => {
    saveQuizProgress('5', {
      ...sample,
      answers: [
        { wordId: 1, questionType: 'spelling', term: 'apple', meaning: '사과', correctAnswer: 'apple', userAnswer: 'apple', correct: true },
        null,
      ],
    })
    expect(peekQuizProgress('5')).toEqual({ answered: 1, total: 2 })
    expect(peekQuizProgress('999')).toBeNull()
  })

  it('localStorage를 쓸 수 없어도 오류 없이 null/무시로 동작한다', () => {
    ;(globalThis as { localStorage?: unknown }).localStorage = undefined
    expect(() => saveQuizProgress('5', sample)).not.toThrow()
    expect(loadQuizProgress('5')).toBeNull()
  })
})
