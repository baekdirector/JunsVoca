/** 앱 디자인에 맞춘 확인 팝업. 브라우저 기본 confirm() 대신 쓴다. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-5 pb-8 sm:items-center sm:pb-0"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] rounded-[22px] bg-surface p-5 shadow-lg"
      >
        <h3 className="m-0 text-[16.5px] font-bold">{title}</h3>
        {description && <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-ink-muted">{description}</p>}
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-border bg-surface p-3 text-[14px] font-semibold text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-2xl p-3 text-[14px] font-bold text-white ${danger ? 'bg-error' : 'bg-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
