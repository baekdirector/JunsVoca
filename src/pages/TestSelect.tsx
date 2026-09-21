import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, BookIcon, ChevronRightIcon } from '../components/icons'
import { Loading } from '../components/Loading'
import { getWordSets } from '../lib/db'
import { loadWordSetsCache, saveWordSetsCache, type WordSetItem } from '../lib/wordSetsCache'
import { formatDate } from '../lib/quiz'

/** 테스트할 단어장을 고르는 화면. 고르면 문제 수/유형을 정하는 테스트 설정 화면으로 간다. */
export function TestSelect() {
  const navigate = useNavigate()
  const [sets, setSets] = useState<WordSetItem[] | null>(loadWordSetsCache)

  useEffect(() => {
    getWordSets()
      .then((fresh) => {
        setSets(fresh)
        saveWordSetsCache(fresh)
      })
      .catch(() => setSets((prev) => prev ?? []))
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <div className="flex flex-none items-center gap-3 px-[18px] pt-[18px]">
        <button
          type="button"
          aria-label="홈으로"
          onClick={() => navigate('/')}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink"
        >
          <ArrowLeftIcon />
        </button>
        <h2 className="m-0 text-[17px] font-bold">테스트할 단어장 고르기</h2>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-[22px] pb-8 pt-5">
        {sets === null ? (
          <Loading />
        ) : sets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="m-0 text-[14px] text-ink-muted">아직 단어장이 없어요. 먼저 단어를 입력해서 만들어주세요.</p>
            <Link to="/input" className="rounded-2xl bg-primary px-6 py-3 text-[14px] font-bold text-white">
              단어 입력하러 가기
            </Link>
          </div>
        ) : (
          sets.map((s) => (
            <Link
              key={s.id}
              to={`/quiz/${s.id}`}
              className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-primary-tint">
                <BookIcon width={20} height={20} className="text-primary" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold">{s.title}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-muted">
                  단어 {s.count}개 · {formatDate(s.createdAt)}
                </div>
              </div>
              <ChevronRightIcon width={18} height={18} className="flex-none text-ink-muted" />
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
