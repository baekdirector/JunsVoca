import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '../components/icons'
import { Loading } from '../components/Loading'
import { SpeakButton } from '../components/SpeakButton'
import {
  addWord as dbAddWord,
  createWordSet,
  deleteWord as dbDeleteWord,
  getWordSet,
  getWordsBySet,
  updateWord as dbUpdateWord,
  updateWordSetTitle,
  type WordRecord,
} from '../lib/db'
import type { ParsedWord } from '../lib/parseWords'
import { clearWordSetsCache } from '../lib/wordSetsCache'

interface Row {
  key: string
  id?: number
  term: string
  meaning: string
}

function isIdiom(term: string) {
  return term.trim().includes(' ')
}

function defaultTitle() {
  const d = new Date()
  return `${d.getMonth() + 1}월 ${d.getDate()}일 단어장`
}

export function WordReview() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation() as { state?: { words?: ParsedWord[]; title?: string } }
  const navigate = useNavigate()

  const wordSetId = id ? Number(id) : undefined
  const isExisting = wordSetId !== undefined

  const [title, setTitle] = useState(() => location.state?.title || defaultTitle())
  const [rows, setRows] = useState<Row[]>(() =>
    isExisting
      ? []
      : (location.state?.words ?? []).map((w, i) => ({ key: `new-${i}`, term: w.term, meaning: w.meaning })),
  )
  const [loaded, setLoaded] = useState(!isExisting)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!isExisting) return
    let cancelled = false
    ;(async () => {
      const set = await getWordSet(wordSetId!)
      const words = await getWordsBySet(wordSetId!)
      if (cancelled) return
      setTitle(set?.title ?? defaultTitle())
      setRows(words.map((w) => ({ key: `db-${w.id}`, id: w.id, term: w.term, meaning: w.meaning })))
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [isExisting, wordSetId])

  const validCount = useMemo(() => rows.filter((r) => r.term.trim() && r.meaning.trim()).length, [rows])

  function patchRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function commitRow(row: Row) {
    if (!isExisting || row.id === undefined) return
    const patch: Partial<Omit<WordRecord, 'id' | 'wordSetId'>> = {
      term: row.term,
      meaning: row.meaning,
      isIdiom: isIdiom(row.term),
    }
    await dbUpdateWord(row.id, patch)
  }

  async function removeRow(row: Row) {
    setRows((prev) => prev.filter((r) => r.key !== row.key))
    if (isExisting && row.id !== undefined) {
      await dbDeleteWord(row.id)
    }
  }

  async function addRow() {
    if (isExisting) {
      const newId = await dbAddWord({ wordSetId: wordSetId!, term: '', meaning: '', isIdiom: false })
      setRows((prev) => [...prev, { key: `db-${newId}`, id: newId, term: '', meaning: '' }])
    } else {
      setRows((prev) => [...prev, { key: `new-${Date.now()}`, term: '', meaning: '' }])
    }
  }

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const cleaned = rows
        .filter((r) => r.term.trim() && r.meaning.trim())
        .map((r) => ({ term: r.term.trim(), meaning: r.meaning.trim(), isIdiom: isIdiom(r.term) }))
      const newId = await createWordSet(title.trim() || defaultTitle(), cleaned)
      clearWordSetsCache() // 목록을 다시 불러와서 방금 저장한 단어장이 보이게 한다
      navigate('/wordsets', { state: { savedId: newId } })
    } catch {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해주세요.')
      setSaving(false)
    }
  }

  if (!loaded) {
    return <Loading screen />
  }

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <div className="flex flex-none items-center gap-3 px-[18px] pt-[18px]">
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => navigate(isExisting ? '/' : '/input')}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink"
        >
          <ArrowLeftIcon />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (isExisting) updateWordSetTitle(wordSetId!, title)
          }}
          className="m-0 flex-1 bg-transparent text-[17px] font-bold outline-none"
        />
      </div>

      <div className="flex flex-none items-center justify-between px-[22px] pb-1.5 pt-3.5">
        <span className="text-[13px] text-ink-muted">
          총 <b className="text-ink">{rows.length}개</b> 단어 · 수정 후 저장하세요
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-[22px] pb-3.5">
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
          >
            <span className="w-4 text-xs text-ink-muted">{idx + 1}</span>
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  value={row.term}
                  placeholder="영어 단어"
                  onChange={(e) => patchRow(row.key, { term: e.target.value })}
                  onBlur={() => commitRow(row)}
                  className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 font-display text-[17.5px] font-bold outline-none focus:border-primary"
                />
                {isIdiom(row.term) && (
                  <span className="flex-none rounded-md bg-accent-tint px-1.5 py-0.5 text-[10px] font-bold text-accent-dark">
                    숙어
                  </span>
                )}
              </div>
              <input
                value={row.meaning}
                placeholder="한글 뜻"
                onChange={(e) => patchRow(row.key, { meaning: e.target.value })}
                onBlur={() => commitRow(row)}
                className="rounded-lg border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
              />
            </div>
            {row.term.trim() && <SpeakButton term={row.term} />}
            <button
              type="button"
              aria-label="삭제"
              onClick={() => removeRow(row)}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-surface-alt text-error"
            >
              <TrashIcon width={15} height={15} />
            </button>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-muted">
            아직 단어가 없어요. 아래 버튼으로 직접 추가해보세요.
          </p>
        )}

        <button
          type="button"
          onClick={addRow}
          className="flex items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-border p-3.5 text-[13.5px] font-semibold text-ink-muted"
        >
          <PlusIcon width={15} height={15} />
          단어 직접 추가하기
        </button>
      </div>

      <div className="flex flex-none flex-col gap-2 border-t border-border bg-surface px-[22px] pb-5 pt-3.5">
        {isExisting ? (
          <button
            type="button"
            disabled={validCount === 0}
            onClick={() => navigate(`/quiz/${wordSetId}`)}
            className="rounded-2xl bg-primary p-[15px] text-center text-[15.5px] font-bold text-white disabled:opacity-40"
          >
            테스트 시작
          </button>
        ) : (
          <>
            {saveError && <p className="m-0 text-center text-[13px] font-semibold text-error">{saveError}</p>}
            <button
              type="button"
              disabled={validCount === 0 || saving}
              onClick={save}
              className="rounded-2xl bg-primary p-[15px] text-center text-[15.5px] font-bold text-white disabled:opacity-40"
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
