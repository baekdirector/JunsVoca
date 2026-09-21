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

function stripLeadingNumbering(line: string): string {
  return line.replace(/^\s*[\d０-９]{1,3}\s*[.).:\]]\s*/, '').trim()
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
  // "~" (and similar placeholder marks) conventionally belong with the Korean
  // meaning ("~을 책임지고 있는"), not the English term -- keep them together.
  while (splitIndex > 0 && /[~-]/.test(line[splitIndex - 1])) splitIndex--
  const left = line.slice(0, splitIndex).trim()
  const right = line.slice(splitIndex).trim()
  if (!left || !right) return null
  if (!LATIN_RE.test(left)) return null
  return [left, right]
}

/**
 * Turns raw OCR text from a vocabulary printout into term/meaning pairs.
 * Handles "word - meaning", "word: meaning", and delimiter-less lines like
 * "considerable 상당한" where the script boundary marks the split.
 */
export function parseWords(rawText: string): ParsedWord[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const results: ParsedWord[] = []

  for (const rawLine of lines) {
    const line = stripLeadingNumbering(rawLine)
    if (!line || line.length < 3) continue

    const split = splitByDelimiter(line) ?? splitByScriptBoundary(line)
    if (!split) continue

    let [term, meaning] = split
    term = term.replace(/[.,;]+$/, '').trim()
    meaning = meaning.replace(/^[.,;]+/, '').trim()
    if (!term || !meaning) continue
    if (!LATIN_RE.test(term)) continue

    const { term: cleanTerm, partOfSpeech } = extractPartOfSpeech(term)
    if (!cleanTerm) continue

    results.push({
      term: cleanTerm,
      meaning,
      isIdiom: cleanTerm.trim().includes(' '),
      partOfSpeech,
    })
  }

  return results
}
