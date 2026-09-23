import { describe, expect, it } from 'vitest'
import {
  checkAnswer,
  formatDate,
  formatDateTime,
  formatTime,
  generateQuestions,
  type Question,
  type QuizWord,
} from './quiz'

function word(id: number, term: string, meaning: string): QuizWord {
  return { id, wordSetId: 1, term, meaning, isIdiom: term.includes(' ') }
}

const words = [word(1, 'apple', '사과'), word(2, 'run', '달리다, 운영하다'), word(3, 'give up', '포기하다')]

describe('generateQuestions', () => {
  it('count를 생략하면 모든 단어를 한 번씩 출제한다', () => {
    const questions = generateQuestions(words)
    expect(questions.map((q) => q.word.id).sort()).toEqual([1, 2, 3])
  })

  it('count만큼만 중복 없이 출제한다', () => {
    const questions = generateQuestions(words, { count: 2 })
    expect(questions).toHaveLength(2)
    expect(new Set(questions.map((q) => q.word.id)).size).toBe(2)
  })

  it('단어 수보다 많이 요청해도 있는 만큼만 출제한다', () => {
    expect(generateQuestions(words, { count: 10 })).toHaveLength(3)
  })

  it('shuffle을 끄면 단어장 순서대로 앞에서부터 출제한다', () => {
    const questions = generateQuestions(words, { shuffle: false, count: 2 })
    expect(questions.map((q) => q.word.id)).toEqual([1, 2])
    expect(generateQuestions(words, { shuffle: false }).map((q) => q.word.id)).toEqual([1, 2, 3])
  })

  it('shuffle을 켜면(기본) 모든 단어가 한 번씩, 순서만 무작위다', () => {
    const many = Array.from({ length: 30 }, (_, i) => word(i + 1, `w${i}`, '뜻'))
    const ids = generateQuestions(many).map((q) => q.word.id)
    expect([...ids].sort((a, b) => a - b)).toEqual(many.map((w) => w.id))
    expect(ids).not.toEqual(many.map((w) => w.id))
  })

  it('mode를 지정하면 모든 문제가 그 유형이다', () => {
    expect(generateQuestions(words, { mode: 'spelling' }).every((q) => q.type === 'spelling')).toBe(true)
    expect(generateQuestions(words, { mode: 'meaning' }).every((q) => q.type === 'meaning')).toBe(true)
  })
})

describe('checkAnswer', () => {
  const q = (w: QuizWord, type: Question['type']): Question => ({ word: w, type })

  it('스펠링은 대소문자와 앞뒤 공백을 무시한다', () => {
    expect(checkAnswer(q(words[0], 'spelling'), '  Apple ')).toBe(true)
    expect(checkAnswer(q(words[0], 'spelling'), 'banana')).toBe(false)
  })

  it('여러 뜻 중 하나만 맞아도 정답이다', () => {
    expect(checkAnswer(q(words[1], 'meaning'), '운영하다')).toBe(true)
  })

  it('띄어쓰기와 기호 차이는 무시한다', () => {
    const hardly = word(4, 'hardly', '거의 ...않다')
    expect(checkAnswer(q(hardly, 'meaning'), '거의않다')).toBe(true)
    expect(checkAnswer(q(hardly, 'meaning'), '거의 ... 않다')).toBe(true)
  })

  it('괄호 안 설명은 생략해도 정답이다', () => {
    const episode = word(5, 'episode', '(쇼의) 회')
    expect(checkAnswer(q(episode, 'meaning'), '회')).toBe(true)
    expect(checkAnswer(q(episode, 'meaning'), '(쇼의) 회')).toBe(true)
    expect(checkAnswer(q(episode, 'meaning'), '쇼')).toBe(false)
  })

  it('빈 답은 오답이다', () => {
    expect(checkAnswer(q(words[0], 'spelling'), '   ')).toBe(false)
  })

  it('동사의 평서형 현재 활용(...ㄴ다/는다)도 정답으로 인정한다', () => {
    expect(checkAnswer(q(word(6, 'look like', '...처럼 보이다'), 'meaning'), '처럼 보인다')).toBe(true)
    expect(checkAnswer(q(word(7, 'eat', '먹다'), 'meaning'), '먹는다')).toBe(true)
    expect(checkAnswer(q(word(8, 'live', '살다'), 'meaning'), '산다')).toBe(true) // ㄹ 탈락
    expect(checkAnswer(q(word(9, 'make', '만들다'), 'meaning'), '만든다')).toBe(true) // ㄹ 탈락
    expect(checkAnswer(q(words[2], 'meaning'), '포기한다')).toBe(true) // 포기하다 → 포기한다
    // 사전형으로 답해도 여전히 정답이다.
    expect(checkAnswer(q(word(7, 'eat', '먹다'), 'meaning'), '먹다')).toBe(true)
  })

  it('동사 활용형이 우연히 다른 뜻과 겹치지 않는 한 관계없는 답은 여전히 오답이다', () => {
    expect(checkAnswer(q(word(6, 'look like', '...처럼 보이다'), 'meaning'), '전혀 다른 뜻')).toBe(false)
  })
})

describe('날짜 표시', () => {
  it('날짜와 시간을 한국어로 표시한다', () => {
    const ts = new Date(2026, 8, 22, 0, 5).getTime()
    expect(formatDate(ts)).toBe('9월 22일 (화)')
    expect(formatTime(ts)).toBe('오전 12:05')
    expect(formatDateTime(new Date(2026, 8, 22, 15, 30).getTime())).toBe('9월 22일 (화) 오후 3:30')
  })
})
