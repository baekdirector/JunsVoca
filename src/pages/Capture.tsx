import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { ArrowLeftIcon, CameraIcon, CheckCircleIcon, GalleryIcon } from '../components/icons'
import { recognizeWordPrintout } from '../lib/ocr'
import { parseWords, type ParsedWord } from '../lib/parseWords'

type Phase = 'idle' | 'processing' | 'done'

export function Capture() {
  const navigate = useNavigate()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [parsedWords, setParsedWords] = useState<ParsedWord[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setImagePreviewUrl(URL.createObjectURL(file))
    setPhase('processing')
    setProgress(0)
    try {
      const text = await recognizeWordPrintout(file, setProgress)
      const words = parseWords(text)
      setParsedWords(words)
      setPhase('done')
    } catch (e) {
      console.error(e)
      setError('사진을 읽는 중 문제가 발생했어요. 다시 시도해주세요.')
      setPhase('idle')
    }
  }

  function goToReview() {
    navigate('/wordsets/review', { state: { words: parsedWords, imagePreviewUrl } })
  }

  function retake() {
    setPhase('idle')
    setParsedWords([])
    setImagePreviewUrl(null)
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
        <h2 className="m-0 text-[17px] font-bold">단어 인식하기</h2>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {phase === 'idle' && (
        <div className="flex flex-1 flex-col px-[22px] py-5">
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[22px] border-2 border-dashed border-border bg-surface p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint">
              <CameraIcon width={30} height={30} className="text-primary" strokeWidth={1.7} />
            </div>
            <p className="m-0 text-[15px] font-semibold leading-relaxed">
              프린트물이 화면 가득
              <br />
              보이도록 촬영해주세요
            </p>
            <p className="m-0 text-[12.5px] text-ink-muted">글씨가 잘 보이도록 밝은 곳에서 찍어요</p>
            {error && <p className="m-0 text-[12.5px] font-semibold text-error">{error}</p>}
          </div>

          <div className="mt-[18px] flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary p-[15px] text-[15px] font-bold text-white"
            >
              <CameraIcon width={18} height={18} />
              카메라로 촬영
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-[15px] text-[15px] font-semibold text-ink"
            >
              <GalleryIcon width={18} height={18} />
              갤러리에서 선택
            </button>
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <div className="flex flex-1 flex-col px-[22px] py-5">
          <div className="h-[180px] flex-none overflow-hidden rounded-[18px] bg-[#CFC9BA]">
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="촬영된 사진" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="mt-6 flex flex-col items-center gap-3.5">
            <div className="h-[46px] w-[46px] animate-spin rounded-full border-4 border-primary-tint border-t-primary" />
            <p className="m-0 text-[15px] font-bold">글자를 인식하고 있어요...</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
              />
            </div>
            <p className="m-0 text-[12.5px] text-ink-muted">
              OCR로 단어와 뜻을 나누는 중 · {Math.round(progress * 100)}%
            </p>
          </div>
          <div className="flex-1" />
          <button type="button" onClick={retake} className="p-2.5 text-[13px] font-semibold text-ink-muted">
            촬영 취소하기
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-1 flex-col px-[22px] py-5">
          <div className="h-[150px] flex-none overflow-hidden rounded-[18px] bg-[#CFC9BA]">
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="촬영된 사진" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="mt-[26px] flex flex-col items-center gap-2.5 text-center">
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-success-tint">
              <CheckCircleIcon width={30} height={30} className="text-success" strokeWidth={2} />
            </div>
            {parsedWords.length > 0 ? (
              <>
                <h3 className="m-0 text-[19px] font-extrabold">{parsedWords.length}개의 단어를 찾았어요!</h3>
                <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
                  단어와 숙어를 구분해서 정리했어요.
                  <br />
                  내용을 확인하고 저장해주세요.
                </p>
              </>
            ) : (
              <>
                <h3 className="m-0 text-[19px] font-extrabold">인식된 단어가 없어요</h3>
                <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
                  사진이 흐리거나 글씨가 작을 수 있어요.
                  <br />
                  다시 촬영하거나 직접 입력해보세요.
                </p>
              </>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={goToReview}
              className="rounded-2xl bg-primary p-[15px] text-center text-[15px] font-bold text-white"
            >
              {parsedWords.length > 0 ? '단어 확인하러 가기' : '직접 입력하러 가기'}
            </button>
            <button type="button" onClick={retake} className="p-2 text-[13px] font-semibold text-ink-muted">
              다시 촬영하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
