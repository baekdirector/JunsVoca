import { useEffect, useState } from 'react'

/** 로딩이 `delayMs` 이상 이어지면 true. 무료 서버가 잠들어 있다가 깨어나는 경우를 알려주는 용도. */
export function useSlowLoading(loading: boolean, delayMs = 3000): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setSlow(true), delayMs)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [loading, delayMs])

  return loading && slow
}
