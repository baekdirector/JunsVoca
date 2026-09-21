import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookIcon, ChevronRightIcon, PlusIcon } from '../components/icons'
import { BottomNav } from '../components/BottomNav'
import { getWordSets, type WordSetRecord } from '../lib/db'

export function WordSets() {
  const [sets, setSets] = useState<Array<WordSetRecord & { count: number }> | null>(null)

  useEffect(() => {
    getWordSets().then(setSets)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <div className="flex-1 px-[22px] pb-4 pt-6">
        <h1 className="m-0 text-[22px] font-extrabold">내 단어장</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-muted">저장된 단어장을 확인하고 테스트를 시작해보세요</p>

        <Link
          to="/input"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border p-3.5 text-[13.5px] font-semibold text-ink-muted"
        >
          <PlusIcon width={15} height={15} />
          새 단어장 만들기
        </Link>

        <div className="mt-4 flex flex-col gap-2.5">
          {sets === null ? (
            <p className="py-8 text-center text-ink-muted">불러오는 중...</p>
          ) : sets.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-ink-muted">
              아직 단어장이 없어요. 단어를 입력해서 첫 단어장을 만들어보세요.
            </p>
          ) : (
            sets.map((s) => (
              <Link
                key={s.id}
                to={`/wordsets/${s.id}`}
                className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-primary-tint">
                  <BookIcon width={20} height={20} className="text-primary" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15.5px] font-bold">{s.title}</div>
                  <div className="mt-0.5 text-[12.5px] text-ink-muted">
                    단어 {s.count}개 · {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <ChevronRightIcon width={18} height={18} className="flex-none text-ink-muted" />
              </Link>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
