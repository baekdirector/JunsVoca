import { describe, expect, it } from 'vitest'
import { checkAnswer, generateQuestions, type Question, type QuizWord } from './quiz'

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
})
