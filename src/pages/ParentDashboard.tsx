import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, ChevronRightIcon, ClockIcon, StarIcon, BookIcon, CheckCircleIcon } from '../components/icons'
import { getAttempts, getMissedWordCounts, type AttemptSummary } from '../lib/db'
import { formatDate, formatDuration, formatTime } from '../lib/quiz'

// Frozen at module load -- the "this week" window doesn't need to tick live.
const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

function accuracyClasses(accuracy: number) {
  if (accuracy >= 80) return 'bg-success-tint text-success'
  if (accuracy >= 60) return 'bg-warning-tint text-warning'
  return 'bg-error-tint text-error'
}

export function ParentDashboard() {
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null)
  const [missed, setMissed] = useState<Array<{ term: string; meaning: string; wrong: number }>>([])

  useEffect(() => {
    getAttempts().then(setAttempts)
    getMissedWordCounts(5).then(setMissed)
  }, [])

  if (!attempts) {
    return <div className="flex min-h-svh items-center justify-center bg-bg text-ink-muted">불러오는 중...</div>
  }

  const totalSessions = attempts.length
  const avgAccuracy =
    totalSessions > 0 ? Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / totalSessions) : 0
  const attemptsThisWeek = attempts.filter((a) => a.startedAt >= weekAgo)
  const wordsThisWeekCount = attemptsThisWeek.reduce((s, a) => s + a.totalQuestions, 0)

  return (
    <div className="min-h-svh bg-bg pb-10">
      <div className="flex items-center justify-between px-5 pt-5 sm:px-10">
        <Link to="/" className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-muted">
          <ArrowLeftIcon width={16} height={16} />
          아이 앱으로
        </Link>
      </div>

      <div className="px-5 pt-5 sm:px-10">
        <h1 className="m-0 text-[26px] font-extrabold">부모 리포트</h1>
        <p className="mt-1.5 text-[14px] text-ink-muted">아이의 학습 현황과 최근 테스트 기록을 확인하세요</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 px-5 pt-5 sm:grid-cols-4 sm:px-10">
        <StatCard icon={<ClockIcon width={16} height={16} className="text-primary" />} tint="bg-primary-tint" label="총 학습 세션" value={`${totalSessions}회`} />
        <StatCard icon={<CheckCircleIcon width={16} height={16} className="text-success" />} tint="bg-success-tint" label="평균 정답률" value={`${avgAccuracy}%`} />
        <StatCard icon={<BookIcon width={16} height={16} className="text-accent-dark" />} tint="bg-accent-tint" label="이번 주 학습 문항" value={`${wordsThisWeekCount}개`} />
        <StatCard icon={<StarIcon width={16} height={16} className="text-gold" />} tint="bg-gold-tint" label="이번 주 테스트" value={`${attemptsThisWeek.length}회`} />
      </div>

      <div className="flex flex-col gap-6 px-5 pt-5 sm:flex-row sm:px-10">
        <div className="min-w-0 flex-1">
          <h2 className="mb-3 text-[16.5px] font-bold">최근 테스트 기록</h2>

          {attempts.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-[13.5px] text-ink-muted">
              아직 완료된 테스트가 없어요. 아이가 테스트를 마치면 여기에 기록돼요.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="bg-surface-alt">
                    <Th>날짜</Th>
                    <Th>단어장</Th>
                    <Th>문항수</Th>
                    <Th>정답률</Th>
                    <Th>라운드</Th>
                    <Th>소요시간</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.groupId} className="border-t border-border">
                      <Td>
                        {formatDate(a.startedAt)}
                        <div className="text-[11.5px] text-ink-muted">{formatTime(a.startedAt)}</div>
                      </Td>
                      <Td>{a.wordSetTitle}</Td>
                      <Td>{a.totalQuestions}</Td>
                      <Td>
                        <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${accuracyClasses(a.accuracy)}`}>
                          {a.accuracy}%
                        </span>
                      </Td>
                      <Td className="text-ink-muted">
                        {a.mastered ? `${a.roundsTaken}라운드 완료` : `${a.roundsTaken}라운드 진행중`}
                      </Td>
                      <Td className="text-ink-muted">{formatDuration(a.totalDurationMs)}</Td>
                      <Td>
                        <Link
                          to={`/parent/session/${a.groupId}`}
                          className="flex items-center gap-1 text-[13px] font-bold text-primary"
                        >
                          상세보기
                          <ChevronRightIcon width={13} height={13} />
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="w-full flex-none sm:w-80">
          <div className="rounded-2xl border border-border bg-surface p-4.5">
            <h3 className="m-0 text-[15px] font-bold">자주 틀리는 단어 TOP 5</h3>
            <p className="mb-3.5 mt-1 text-[12px] text-ink-muted">누적 기준</p>
            {missed.length === 0 ? (
              <p className="text-[12.5px] text-ink-muted">아직 데이터가 충분하지 않아요.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {missed.map((m, i) => (
                  <div key={`${m.term}-${i}`} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-surface-alt text-[10.5px] font-bold text-ink-muted">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display text-[13.5px] font-bold">{m.term}</span>
                        <span className="flex-none text-[12px] font-bold text-ink-muted">{m.wrong}회</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">{m.meaning}</div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-tint">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (m.wrong / missed[0].wrong) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, tint, label, value }: { icon: React.ReactNode; tint: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-[10px] ${tint}`}>{icon}</div>
        <span className="text-[12px] font-semibold text-ink-muted">{label}</span>
      </div>
      <div className="mt-2.5 text-[22px] font-extrabold">{value}</div>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3.5 py-2.5 ${className}`}>{children}</td>
}
