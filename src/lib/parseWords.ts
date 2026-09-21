export interface ParsedWord {
  term: string
  meaning: string
  isIdiom: boolean
  partOfSpeech?: string
}

const HANGUL_RE = /[가-힣]/
const LATIN_RE = /[A-Za-z]/

const POS_TAGS: Record<string, string> = {
  명: '명사',
  동: '동사',
  형: '형용사',
  부: '부사',
  전: '전치사',
  접: '접속사',
}

// "1.", "1)", "1:" 뿐 아니라 "1 festival", "1, festival", "1(탭)festival" 처럼 번호 뒤에
// 공백/쉼표/탭만 오는 형식도 번호로 본다. ("3D printer"처럼 붙어 있는 숫자는 건드리지 않는다.)
function stripLeadingNumbering(line: string): string {
  return line.replace(/^\s*[\d０-９]{1,3}(?:\s*[.).:\]]\s*|[\s,]+)/, '').trim()
}

function extractPartOfSpeech(term: string): { term: string; partOfSpeech?: string } {
  const match = term.match(/^\(?([명동형부전접])\)?\s*/) ?? term.match(/\s*\(?([명동형부전접])\)?$/)
  if (match) {
    const tag = POS_TAGS[match[1]]
    if (tag) {
      return { term: term.replace(match[0], '').trim(), partOfSpeech: tag }
    }
  }
  return { term }
}

function splitByDelimiter(line: string): [string, string] | null {
  const match = line.match(/^(.+?)\s*[-–—:]\s+(.+)$/)
  if (match) return [match[1].trim(), match[2].trim()]
  return null
}

function splitByScriptBoundary(line: string): [string, string] | null {
  let splitIndex = line.split('').findIndex((ch) => HANGUL_RE.test(ch))
  if (splitIndex <= 0) return null
  // "~" and opening brackets (and similar marks) conventionally belong with the
  // Korean meaning ("~을 책임지고 있는", "(쇼의) 회"), not the English term.
  while (splitIndex > 0 && /[~\-(（[…]/.test(line[splitIndex - 1])) splitIndex--
  const left = line.slice(0, splitIndex).trim()
  const right = line.slice(splitIndex).trim()
  if (!left || !right) return null
  if (!LATIN_RE.test(left)) return null
  return [left, right]
}

export interface ParseResult {
  words: ParsedWord[]
  /** 영단어/뜻으로 나누지 못했거나 중복이라 제외된 줄 (빈 줄 제외) */
  skipped: string[]
}

/**
 * Turns typed/pasted text (one word per line: "번호 영단어 뜻") into term/meaning
 * pairs. Handles "1 word meaning", "word - meaning", "word: meaning", and
 * tab/comma separated lines, where the script boundary marks the split.
 * Lines that can't be read (or repeat an earlier term) are reported in `skipped`.
 */
export function parseWordsDetailed(rawText: string): ParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const words: ParsedWord[] = []
  const skipped: string[] = []
  const seen = new Set<string>()

  for (const rawLine of lines) {
    const parsed = parseLine(rawLine)
    if (!parsed || seen.has(parsed.term.toLowerCase())) {
      skipped.push(rawLine)
      continue
    }
    seen.add(parsed.term.toLowerCase())
    words.push(parsed)
  }

  return { words, skipped }
}

export function parseWords(rawText: string): ParsedWord[] {
  return parseWordsDetailed(rawText).words
}

function parseLine(rawLine: string): ParsedWord | null {
  const line = stripLeadingNumbering(rawLine)
  if (!line || line.length < 3) return null

  const split = splitByDelimiter(line) ?? splitByScriptBoundary(line)
  if (!split) return null

  let [term, meaning] = split
  term = term.replace(/[.,;]+$/, '').trim()
  meaning = meaning.replace(/^[.,;]+/, '').trim()
  if (!term || !meaning) return null
  if (!LATIN_RE.test(term)) return null

  const { term: cleanTerm, partOfSpeech } = extractPartOfSpeech(term)
  if (!cleanTerm) return null

  return {
    term: cleanTerm,
    meaning,
    isIdiom: cleanTerm.trim().includes(' '),
    partOfSpeech,
  }
}
