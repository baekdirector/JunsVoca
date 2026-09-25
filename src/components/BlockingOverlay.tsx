import { useSlowLoading } from '../lib/useSlowLoading'
import { Spinner } from './Loading'

/**
 * 서버 응답을 기다리는 동안 화면 전체를 덮고 스피너를 보여준다. 덮여 있는 동안에는 아래 화면을
 * 누를 수 없어서, 응답이 늦을 때 같은 버튼을 다시 눌러 중복으로 저장하는 실수를 막는다.
 */
export function BlockingOverlay({ open, message }: { open: boolean; message: string }) {
  const slow = useSlowLoading(open)
  if (!open) return null

  return (
    <div
      role="alert"
      aria-busy="true"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3.5 bg-black/50 px-8 text-center text-white"
    >
      <Spinner size={46} tone="light" label={message} />
      <p className="m-0 text-[15px] font-bold">{message}</p>
      {slow && (
        <p className="m-0 max-w-[280px] text-[12.5px] leading-relaxed text-white/85">
          서버 응답이 조금 늦어지고 있어요.
          <br />
          화면을 닫지 말고 잠시만 기다려 주세요.
        </p>
      )}
    </div>
  )
}
