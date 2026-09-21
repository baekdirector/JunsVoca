import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, CheckCircleIcon } from '../components/icons'
import { parseWordsDetailed } from '../lib/parseWords'

const DRAFT_KEY = 'junsvoca_draft_words'

const PLACEHOLDER = `1 festival 축제
2 national holiday 국경일
3 celebrate 기념하다
4 flea market 벼룩시장`

function defaultTitle() {
  const d = new Date()
  return `${d.getMonth() + 1}월 ${d.getDate()}일 단어장`
}

function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveDraft(text: string) {
  try {
    if (text) localStorage.setItem(DRAFT_KEY, text)
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // 저장 공간을 못 쓰는 환경에서는 임시 저장만 건너뛴다.
  }
}

export function TextInput() {
  const navigate = useNavigate()
  const [text, setText] = useState(loadDraft)
  const [title, setTitle] = useState(defaultTitle)

  const { words, skipped } = useMemo(() => parseWordsDetailed(text), [text])

  function handleChange(value: string) {
    setText(value)
    saveDraft(value)
  }

  function goToReview() {
    saveDraft('')
    navigate('/wordsets/review', { state: { words, title: title.trim() || defaultTitle() } })
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
        <h2 className="m-0 text-[17px] font-bold">단어 입력하기</h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[22px] py-5">
        <label className="block">
          <span className="text-[13px] font-bold text-ink-muted">단어장 이름</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={defaultTitle()}
            className="mt-1.5 block w-full rounded-2xl border-[1.5px] border-border bg-surface p-3.5 text-[16px] font-bold outline-none focus:border-primary"
          />
        </label>

        <div>
          <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
            한 줄에 단어 하나씩 <b className="text-ink">번호 · 영단어 · 뜻</b> 순서로 입력하세요.
            <br />
            번호는 없어도 되고, 메모장이나 엑셀에서 붙여넣어도 돼요.
          </p>
          <textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={9}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-2.5 block w-full resize-y rounded-2xl border-[1.5px] border-border bg-surface p-3.5 text-[15px] leading-relaxed outline-none focus:border-primary"
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <CheckCircleIcon width={15} height={15} className={words.length > 0 ? 'text-success' : ''} />
            <span>
              인식된 단어 <b className="text-ink">{words.length}개</b>
            </span>
          </div>

          {words.length > 0 && (
            <ol className="m-0 mt-2 max-h-[280px] list-none overflow-y-auto rounded-2xl border border-border bg-surface p-0">
              {words.map((w, i) => (
                <li
                  key={w.term}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-2 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <span className="text-xs text-ink-muted">{i + 1}</span>
                  <span className="break-words font-display text-[16.5px] font-bold">
                    {w.term}
                    {w.isIdiom && (
                      <span className="ml-1.5 rounded-md bg-accent-tint px-1.5 py-0.5 align-middle font-kr text-[10px] font-bold text-accent-dark">
                        숙어
                      </span>
                    )}
                  </span>
                  <span className="break-words text-[13px]">{w.meaning}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {skipped.length > 0 && (
          <div className="rounded-2xl border border-error/40 bg-error-tint p-3.5">
            <p className="m-0 text-[13px] font-bold text-error">
              {skipped.length}줄은 단어로 읽지 못해서 빠졌어요
            </p>
            <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
              영단어와 한글 뜻이 모두 있는지, 같은 단어가 두 번 들어가지 않았는지 확인해주세요.
            </p>
            <ul className="m-0 mt-2 list-disc break-words pl-4 text-[12.5px]">
              {skipped.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-none flex-col gap-2 border-t border-border bg-surface px-[22px] pb-5 pt-3.5">
        <button
          type="button"
          disabled={words.length === 0}
          onClick={goToReview}
          className="rounded-2xl bg-primary p-[15px] text-center text-[15.5px] font-bold text-white disabled:opacity-40"
        >
          {words.length > 0 ? `단어 ${words.length}개 확인하러 가기` : '단어를 입력해주세요'}
        </button>
      </div>
    </div>
  )
}
