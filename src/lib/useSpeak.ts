import { useCallback, useState } from 'react'

/**
 * English-only pronunciation via the Web Speech API. Quiz meanings are
 * always Korean and are never spoken -- only the English term/idiom is.
 */
export function useSpeak() {
  const [speakingTerm, setSpeakingTerm] = useState<string | null>(null)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback(
    (term: string) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(term)
      utter.lang = 'en-US'
      utter.rate = 0.9
      utter.onstart = () => setSpeakingTerm(term)
      utter.onend = () => setSpeakingTerm(null)
      utter.onerror = () => setSpeakingTerm(null)
      window.speechSynthesis.speak(utter)
    },
    [supported],
  )

  return { speak, speakingTerm, supported }
}
