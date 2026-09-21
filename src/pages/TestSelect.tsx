import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, CheckIcon } from '../components/icons'
import { Loading } from '../components/Loading'
import { getWordSets } from '../lib/db'
import { loadWordSetsCache, saveWordSetsCache, type WordSetItem } from '../lib/wordSetsCache'
import { formatDate } from '../lib/quiz'

/** 테스트할 단어장을 (여러 개도) 고르는 화면. 고르면 문제 수/유형을 정하는 테스트 설정 화면으로 간다. */
export function TestSelect() {
  const navigate = useNavigate()
  const [sets, setSets] = useState<WordSetItem[] | null>(loadWordSetsCache)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    getWordSets()
      .then((fresh) => {
        setSets(fresh)
        saveWordSetsCache(fresh)
        // 삭제되었거나 사라진 단어장은 선택에서 뺀다
        setSelected((prev) => new Set([...prev].filter((id) => fresh.some((s) => s.id === id))))
      })
      .catch(() => setSets((prev) => prev ?? []))
  }, [])

  const allSelected = sets !== null && sets.length > 0 && sets.every((s) => selected.has(s.id))
  const selectedSets = useMemo(() => sets?.filter((s) => selected.has(s.id)) ?? [], [sets, selected])
  const selectedWordCount = selectedSets.reduce((sum, s) => sum + s.count, 0)

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sets?.map((s) => s.id)))
  }

  function start() {
    // 오래된 단어장부터 (단어장 순서대로 출제할 때 Unit1 → Unit2 → ... 순서가 되도록)
    const ids = [...selectedSets].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id).map((s) => s.id)
    navigate(ids.length === 1 ? `/quiz/${ids[0]}` : `/test/start?sets=${ids.join(',')}`)
  }

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

      <div className="flex flex-1 flex-col gap-2.5 px-[22px] pb-6 pt-4">
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
          <>
            <p className="m-0 text-[13px] text-ink-muted">여러 개를 골라 한 번에 테스트할 수 있어요.</p>
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] text-ink-muted">
                <b className="text-ink">{selected.size}</b> / {sets.length}개 선택
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="flex-none rounded-[10px] bg-surface-alt px-3 py-1.5 text-[13px] font-bold text-primary"
              >
                {allSelected ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            {sets.map((s) => {
              const checked = selected.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(s.id)}
                  className={`m-0 flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left ${
                    checked ? 'border-primary bg-primary-tint/40' : 'border-border bg-surface'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg border-2 ${
                      checked ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-transparent'
                    }`}
                  >
                    <CheckIcon width={16} height={16} strokeWidth={3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-bold">{s.title}</div>
                    <div className="mt-0.5 text-[12.5px] font-normal text-ink-muted">
                      단어 {s.count}개 · {formatDate(s.createdAt)}
                    </div>
                  </div>
                </button>
              )
            })}
          </>
        )}
      </div>

      {sets !== null && sets.length > 0 && (
        <div className="flex-none border-t border-border bg-surface px-[22px] pb-5 pt-3.5">
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={start}
            className="w-full rounded-2xl bg-primary p-[15px] text-center text-[15.5px] font-bold text-white disabled:opacity-40"
          >
            {selected.size === 0
              ? '단어장을 골라주세요'
              : `${selected.size}개 단어장 (단어 ${selectedWordCount}개) 테스트 설정하기`}
          </button>
        </div>
      )}
    </div>
  )
}
