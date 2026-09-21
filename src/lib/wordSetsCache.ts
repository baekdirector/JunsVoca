import type { WordSetRecord } from './db'

export type WordSetItem = WordSetRecord & { count: number }

// 서버가 잠들어 있다가 깨어나는 동안에도 지난번 목록을 바로 보여주기 위한 캐시.
const CACHE_KEY = 'junsvoca_wordsets_cache'

export function loadWordSetsCache(): WordSetItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as WordSetItem[]) : null
  } catch {
    return null
  }
}

export function saveWordSetsCache(sets: WordSetItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(sets))
  } catch {
    // 캐시는 편의 기능이라 실패해도 무시한다.
  }
}

/** 단어장을 새로 만들었을 때처럼 캐시가 낡았을 때 비운다. */
export function clearWordSetsCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // 무시
  }
}
