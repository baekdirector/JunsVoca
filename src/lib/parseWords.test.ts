import { describe, expect, it } from 'vitest'
import { parseWords, parseWordsDetailed } from './parseWords'

const pairs = (text: string) => parseWords(text).map((w) => [w.term, w.meaning])

describe('parseWords', () => {
  it('번호 영단어 뜻 형식(공백/탭/쉼표 구분)을 처리한다', () => {
    expect(pairs('1 festival 축제\n2\tnational holiday\t국경일\n3, celebrate, 기념하다')).toEqual([
      ['festival', '축제'],
      ['national holiday', '국경일'],
      ['celebrate', '기념하다'],
    ])
  })

  it('번호가 없거나 "1." "2)" 형식이어도 처리한다', () => {
    expect(pairs('apple 사과\n1. banana 바나나\n2) cherry - 체리')).toEqual([
      ['apple', '사과'],
      ['banana', '바나나'],
      ['cherry', '체리'],
    ])
  })

  it('숫자로 시작하는 영단어는 번호로 오인하지 않는다', () => {
    expect(pairs('3D printer 입체 프린터')).toEqual([['3D printer', '입체 프린터']])
  })

  it('뜻이 괄호나 물결표로 시작해도 영단어에 섞이지 않는다', () => {
    expect(pairs('20 episode (쇼의) 회\n33 hardly 거의 ...않다\n7 be in charge of ~을 책임지는')).toEqual([
      ['episode', '(쇼의) 회'],
      ['hardly', '거의 ...않다'],
      ['be in charge of', '~을 책임지는'],
    ])
  })

  it('띄어쓰기가 있는 영어 표현은 숙어로 표시한다', () => {
    const [phrase, single] = parseWords('4 flea market 벼룩시장\n5 royal 왕의')
    expect(phrase.isIdiom).toBe(true)
    expect(single.isIdiom).toBe(false)
  })

  it('한글이 없는 줄(제목 등)은 건너뛴다', () => {
    expect(pairs('Unit 03 World & Culture\n1 festival 축제')).toEqual([['festival', '축제']])
  })
})

describe('parseWordsDetailed', () => {
  it('읽지 못한 줄과 중복 줄을 skipped로 돌려준다', () => {
    const { words, skipped } = parseWordsDetailed('1 apple 사과\nUnit 03\n2 Apple 사과나무\n\n3 banana')
    expect(words.map((w) => w.term)).toEqual(['apple'])
    expect(skipped).toEqual(['Unit 03', '2 Apple 사과나무', '3 banana'])
  })
})
