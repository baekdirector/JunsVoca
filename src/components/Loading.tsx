import { useSlowLoading } from '../lib/useSlowLoading'

/** 로딩 표시. 오래 걸리면 서버가 깨어나는 중이라는 안내를 덧붙인다. `screen`이면 화면 전체를 채운다. */
export function Loading({ screen = false }: { screen?: boolean }) {
  const slow = useSlowLoading(true)

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2.5 px-6 py-8 text-center text-ink-muted ${
        screen ? 'min-h-svh bg-bg' : ''
      }`}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary-tint border-t-primary" />
      <p className="m-0 text-[14px]">불러오는 중...</p>
      {slow && (
        <p className="m-0 max-w-[280px] text-[12.5px] leading-relaxed">
          서버가 쉬고 있다가 깨어나는 중이에요.
          <br />
          처음에는 1분 가까이 걸릴 수 있어요.
        </p>
      )}
    </div>
  )
}
