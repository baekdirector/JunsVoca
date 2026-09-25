/** 데이터를 불러오지 못했을 때, 스피너가 끝없이 도는 대신 알려주고 다시 시도할 수 있게 한다. */
export function LoadError({
  message = '데이터를 불러오지 못했어요.',
  onRetry,
  screen = false,
}: {
  message?: string
  onRetry: () => void
  screen?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-6 py-8 text-center ${screen ? 'min-h-svh bg-bg' : ''}`}
    >
      <p className="m-0 text-[14px] font-semibold text-ink">{message}</p>
      <p className="m-0 text-[12.5px] text-ink-muted">인터넷 연결을 확인하고 다시 시도해 주세요.</p>
      <button type="button" onClick={onRetry} className="rounded-2xl bg-primary px-6 py-3 text-[14px] font-bold text-white">
        다시 시도
      </button>
    </div>
  )
}
