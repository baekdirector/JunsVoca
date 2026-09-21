import { useSpeak } from '../lib/useSpeak'
import { SpeakerIcon } from './icons'

interface SpeakButtonProps {
  /** The English term or idiom to pronounce. Never pass Korean text here. */
  term: string
  size?: 'sm' | 'md'
  className?: string
}

export function SpeakButton({ term, size = 'sm', className = '' }: SpeakButtonProps) {
  const { speak, speakingTerm } = useSpeak()
  const isSpeaking = speakingTerm === term
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-[34px] w-[34px]'

  return (
    <button
      type="button"
      aria-label="영어 발음 듣기"
      onClick={() => speak(term)}
      className={`flex ${dim} flex-none items-center justify-center rounded-[10px] bg-primary-tint text-primary ${className}`}
    >
      <SpeakerIcon width={15} height={15} className={isSpeaking ? 'animate-speak' : ''} />
    </button>
  )
}
