import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircleIcon, SpeakerIcon, StarIcon, XCircleIcon, XIcon } from '../components/icons'
import { useSpeak } from '../lib/useSpeak'
import { getWordSet, getWordsBySet, getWrongNotes, recordQuizRound, type QuizAnswerRecord } from '../lib/db'
import {
  checkAnswer,
  formatDateTime,
  formatDuration,
  generateQuestions,
  type Question,
  type QuizMode,
  type QuizWord,
} from '../lib/quiz'

type Phase = 'loading' | 'nowords' | 'setup' | 'asking' | 'round-summary'

const COUNT_OPTIONS = [5, 10, 20] as const
const ALL_WORDS = 0
const MODE_OPTIONS: { value: QuizMode; label: string }[] = [
  { value: 'mixed', label: '섞어서' },
  { value: 'meaning', label: '영어→뜻' },
  { value: 'spelling', label: '뜻→영어' },
]

interface AnswerLog extends Omit<QuizAnswerRecord, 'id' | 'sessionId'> {}

interface RoundResult {
  round: number
  finishedAt: number
  /** 이 테스트의 첫 라운드 결과 (복습 라운드 뒤에도 처음 성적을 보여주기 위해) */
  firstRound: { correct: number; total: number }
  durationMs: number
  correctCount: number
  wrongCount: number
  wrongAnswers: AnswerLog[]
  isFinal: boolean
}

export function Quiz() {
  const { wordSetId: wordSetIdParam } = useParams<{ wordSetId: string }>()
  // 단어장 id가 없으면(/wrong/quiz) 오답 노트에 남은 단어들로 보는 테스트
  const wordSetId = wordSetIdParam ? Number(wordSetIdParam) : null
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('loading')
  const [wordSetTitle, setWordSetTitle] = useState('')
  const [round, setRound] = useState(1)
  const [groupId] = useState(() => crypto.randomUUID())

  const [allWords, setAllWords] = useState<QuizWord[]>([])
  const [questionCount, setQuestionCount] = useState<number>(ALL_WORDS)
  const [mode, setMode] = useState<QuizMode>('mixed')

  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle')

  const roundAnswersRef = useRef<AnswerLog[]>([])
  const roundStartedAtRef = useRef(0)
  const firstRoundRef = useRef({ correct: 0, total: 0 })
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)

  const { speak, speakingTerm } = useSpeak()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let title: string
      let words: QuizWord[]
      if (wordSetId === null) {
        const notes = (await getWrongNotes()).filter((n) => n.resolvedAt === null)
        title = '오답 노트'
        words = notes.map((n) => ({
          id: n.wordId,
          wordSetId: n.wordSetId,
          term: n.term,
          meaning: n.meaning,
          isIdiom: n.isIdiom,
          partOfSpeech: n.partOfSpeech ?? undefined,
        }))
      } else {
        const set = await getWordSet(wordSetId)
        title = set?.title ?? ''
        words = set ? await getWordsBySet(wordSetId) : []
      }
      if (cancelled) return
      if (words.length === 0) {
        setPhase('nowords')
        return
      }
      setWordSetTitle(title)
      setAllWords(words)
      setPhase('setup')
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordSetId])

  function startRound(words: QuizWord[], roundNumber: number, count?: number) {
    setQuestions(generateQuestions(words, { count, mode }))
    setQIndex(0)
    setAnswer('')
    setFeedback('idle')
    roundAnswersRef.current = []
    roundStartedAtRef.current = Date.now()
    setRound(roundNumber)
    setPhase('asking')
  }

  const currentQuestion = questions[qIndex]

  function submit(skip = false) {
    if (!currentQuestion) return
    const correct = !skip && checkAnswer(currentQuestion, answer)
    roundAnswersRef.current.push({
      wordId: currentQuestion.word.id,
      questionType: currentQuestion.type,
      term: currentQuestion.word.term,
      meaning: currentQuestion.word.meaning,
      correctAnswer: currentQuestion.type === 'spelling' ? currentQuestion.word.term : currentQuestion.word.meaning,
      userAnswer: skip ? '' : answer,
      correct,
    })
    setFeedback(correct ? 'correct' : 'wrong')
  }

  async function next() {
    if (qIndex + 1 < questions.length) {
      setQIndex((i) => i + 1)
      setAnswer('')
      setFeedback('idle')
      return
    }
    await finishRound()
  }

  async function finishRound() {
    const finishedAt = Date.now()
    const answers = roundAnswersRef.current
    const correctCount = answers.filter((a) => a.correct).length
    const wrongAnswers = answers.filter((a) => !a.correct)

    if (round === 1) firstRoundRef.current = { correct: correctCount, total: answers.length }

    await recordQuizRound({
      groupId,
      wordSetId,
      wordSetTitle,
      round,
      startedAt: roundStartedAtRef.current,
      finishedAt,
      answers,
    })

    setRoundResult({
      round,
      finishedAt,
      firstRound: firstRoundRef.current,
      durationMs: finishedAt - roundStartedAtRef.current,
      correctCount,
      wrongCount: wrongAnswers.length,
      wrongAnswers,
      isFinal: wrongAnswers.length === 0,
    })
    setPhase('round-summary')
  }

  function startQuiz() {
    const count = questionCount === ALL_WORDS ? undefined : questionCount
    startRound(allWords, 1, count)
  }

  function retryWrong() {
    if (!roundResult) return
    const wrongWords: QuizWord[] = []
    const seen = new Set<number>()
    for (const a of roundResult.wrongAnswers) {
      if (!seen.has(a.wordId)) {
        seen.add(a.wordId)
        const q = questions.find((qq) => qq.word.id === a.wordId)
        if (q) wrongWords.push(q.word)
      }
    }
    startRound(wrongWords, round + 1)
  }

  function exitToHome() {
    if (phase === 'asking' && !window.confirm('테스트를 종료할까요? 진행 상황이 저장되지 않아요.')) return
    navigate('/')
  }

  if (phase === 'loading') {
    return <div className="flex min-h-svh items-center justify-center bg-bg text-ink-muted">불러오는 중...</div>
  }

  if (phase === 'nowords') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <p className="text-[15px] font-semibold text-ink">
          {wordSetId === null ? '오답 노트가 비어 있어요. 잘하고 있어요!' : '이 단어장에는 문제가 없어요.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-2xl bg-primary px-6 py-3 text-[14px] font-bold text-white"
        >
          홈으로 가기
        </button>
      </div>
    )
  }

  if (phase === 'setup') {
    const total = allWords.length
    const effectiveCount = questionCount === ALL_WORDS ? total : Math.min(questionCount, total)
    return (
      <div className="flex min-h-svh flex-col bg-bg">
        <div className="flex flex-none items-center gap-3 px-[18px] pt-[18px]">
          <button
            type="button"
            aria-label="홈으로"
            onClick={() => navigate('/')}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink"
          >
            <XIcon width={18} height={18} />
          </button>
          <h2 className="m-0 text-[17px] font-bold">테스트 설정</h2>
        </div>

        <div className="flex flex-1 flex-col px-[22px] py-5">
          <div className="rounded-[22px] border border-border bg-surface p-5">
            <div className="text-[19px] font-extrabold">{wordSetTitle}</div>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              단어 {total}개 중 {effectiveCount}문제를 풀어요
            </p>
          </div>

          <OptionGroup
            label="문제 수"
            value={questionCount}
            onChange={setQuestionCount}
            options={[
              ...COUNT_OPTIONS.filter((c) => c < total).map((c) => ({ value: c as number, label: `${c}개` })),
              { value: ALL_WORDS, label: `전체 (${total})` },
            ]}
          />
          <OptionGroup label="시험 유형" value={mode} onChange={setMode} options={MODE_OPTIONS} />

          <div className="flex-1" />
          <button
            type="button"
            onClick={startQuiz}
            className="rounded-2xl bg-primary p-[15px] text-[15.5px] font-bold text-white"
          >
            테스트 시작
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'round-summary' && roundResult) {
    return (
      <RoundSummary
        wordSetTitle={wordSetTitle}
        result={roundResult}
        onRetry={retryWrong}
        onHome={() => navigate('/')}
        onWrongNotes={() => navigate('/wrong')}
      />
    )
  }

  if (!currentQuestion) return null

  const progress = Math.round(((qIndex + (feedback !== 'idle' ? 1 : 0)) / questions.length) * 100)
  const isReviewRound = round > 1

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <div className="flex-none px-[22px] pt-[18px]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="테스트 종료"
            onClick={exitToHome}
            className="flex h-[34px] w-[34px] items-center justify-center text-ink-muted"
          >
            <XIcon width={18} height={18} />
          </button>
          <span className="text-[13px] font-bold text-ink-muted">
            {qIndex + 1} / {questions.length}
          </span>
        </div>
        {isReviewRound && (
          <div className="mt-2 flex justify-center">
            <span className="rounded-full bg-accent-tint px-3 py-1 text-[11.5px] font-bold text-accent-dark">
              복습 라운드 · 틀린 단어만 다시 풀어요
            </span>
          </div>
        )}
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
          <div
            className={`h-full rounded-full transition-all ${isReviewRound ? 'bg-accent' : 'bg-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-[22px] py-6">
        {currentQuestion.type === 'spelling' ? (
          <SpellingQuestion
            question={currentQuestion}
            answer={answer}
            setAnswer={setAnswer}
            feedback={feedback}
            speak={speak}
            speakingTerm={speakingTerm}
          />
        ) : (
          <MeaningQuestion
            question={currentQuestion}
            answer={answer}
            setAnswer={setAnswer}
            feedback={feedback}
            speak={speak}
            speakingTerm={speakingTerm}
          />
        )}

        <div className="flex-1" />

        {feedback === 'idle' ? (
          <>
            <button
              type="button"
              onClick={() => submit(false)}
              className="rounded-2xl bg-primary p-[15px] text-[15.5px] font-bold text-white"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              className="p-3 text-[13px] font-semibold text-ink-muted"
            >
              모르겠어요, 건너뛰기
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={next}
            className="rounded-2xl bg-primary p-[15px] text-[15.5px] font-bold text-white"
          >
            다음 문제
          </button>
        )}
      </div>
    </div>
  )
}

function OptionGroup<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-[13px] font-bold text-ink-muted">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`min-w-0 flex-1 rounded-2xl border p-3 text-[14px] font-semibold ${
                selected ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-ink'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface QuestionProps {
  question: Question
  answer: string
  setAnswer: (v: string) => void
  feedback: 'idle' | 'correct' | 'wrong'
  speak: (term: string) => void
  speakingTerm: string | null
}

function SpellingQuestion({ question, answer, setAnswer, feedback, speak, speakingTerm }: QuestionProps) {
  const { word } = question
  const showHintBoxes = !word.term.includes(' ')

  return (
    <>
      <div className="flex justify-center">
        <span className="rounded-full bg-primary-tint px-3.5 py-1.5 text-[12.5px] font-bold text-primary-dark">
          뜻을 보고 영어 단어를 써보세요
        </span>
      </div>

      <div className="mt-6 rounded-[22px] border border-border bg-surface p-8 text-center">
        {word.partOfSpeech && (
          <span className="rounded-md bg-surface-alt px-2 py-0.5 text-[11px] font-bold text-ink-muted">
            {word.partOfSpeech}
          </span>
        )}
        <div className="mt-3.5 text-[26px] font-extrabold">{word.meaning}</div>
        <button
          type="button"
          onClick={() => speak(word.term)}
          className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-4 py-2 text-[12.5px] font-bold text-primary-dark"
        >
          <SpeakerIcon width={15} height={15} className={speakingTerm === word.term ? 'animate-speak' : ''} />
          발음 듣기
        </button>
      </div>

      {showHintBoxes && (
        <div className="mt-[22px] flex flex-wrap justify-center gap-1.5">
          {word.term.split('').map((ch, i) => (
            <div
              key={i}
              className="flex h-9 w-[30px] items-center justify-center border-b-[3px] font-display text-lg font-bold"
              style={{ borderColor: i === 0 ? 'var(--color-primary)' : 'var(--color-border)' }}
            >
              {i === 0 ? ch : ''}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={feedback !== 'idle'}
          placeholder="정답을 입력하세요"
          autoFocus
          className="w-full rounded-2xl border-[1.5px] border-border bg-surface p-3.5 text-center font-display text-xl outline-none focus:border-primary"
        />
      </div>

      <FeedbackBanner feedback={feedback} correctText={`${word.term} = ${word.meaning}`} wrongText={`정답은 ${word.term} 예요`} />
    </>
  )
}

function MeaningQuestion({ question, answer, setAnswer, feedback, speak, speakingTerm }: QuestionProps) {
  const { word } = question
  return (
    <>
      <div className="flex justify-center">
        <span className="rounded-full bg-accent-tint px-3.5 py-1.5 text-[12.5px] font-bold text-accent-dark">
          영어 단어를 보고 뜻을 한글로 써보세요
        </span>
      </div>

      <div className="mt-6 rounded-[22px] border border-border bg-surface p-8 text-center">
        {(word.partOfSpeech || word.isIdiom) && (
          <span className="rounded-md bg-surface-alt px-2 py-0.5 text-[11px] font-bold text-ink-muted">
            {word.partOfSpeech ?? '숙어'}
          </span>
        )}
        <div className="mt-3.5 flex items-center justify-center gap-2.5">
          <div className="font-display text-[27px] font-bold">{word.term}</div>
          <button
            type="button"
            aria-label="발음 듣기"
            onClick={() => speak(word.term)}
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-primary-tint text-primary"
          >
            <SpeakerIcon width={16} height={16} className={speakingTerm === word.term ? 'animate-speak' : ''} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={feedback !== 'idle'}
          placeholder="한글 뜻을 입력하세요"
          autoFocus
          className="w-full rounded-2xl border-[1.5px] border-border bg-surface p-3.5 text-center text-lg font-semibold outline-none focus:border-primary"
        />
      </div>

      <FeedbackBanner feedback={feedback} correctText={`${word.term} = ${word.meaning}`} wrongText={`정답은 "${word.meaning}" 예요`} />
    </>
  )
}

function FeedbackBanner({
  feedback,
  correctText,
  wrongText,
}: {
  feedback: 'idle' | 'correct' | 'wrong'
  correctText: string
  wrongText: string
}) {
  if (feedback === 'idle') return null
  if (feedback === 'correct') {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-success-tint p-4">
        <CheckCircleIcon width={20} height={20} className="flex-none text-success" />
        <span className="text-[13.5px] font-bold text-primary-dark">정답이에요! {correctText}</span>
      </div>
    )
  }
  return (
    <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-error-tint p-4">
      <XCircleIcon width={20} height={20} className="flex-none text-error" />
      <span className="text-[13.5px] font-bold text-error">아쉬워요! {wrongText}</span>
    </div>
  )
}

function RoundSummary({
  wordSetTitle,
  result,
  onRetry,
  onHome,
  onWrongNotes,
}: {
  wordSetTitle: string
  result: RoundResult
  onRetry: () => void
  onHome: () => void
  onWrongNotes: () => void
}) {
  const { speak, speakingTerm } = useSpeak()
  const total = result.correctCount + result.wrongCount
  const accuracy = total > 0 ? Math.round((result.correctCount / total) * 100) : 0
  const first = result.firstRound
  const firstAccuracy = first.total > 0 ? Math.round((first.correct / first.total) * 100) : 0
  const hadMistakes = first.correct < first.total

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <div className="flex-none px-[22px] pt-8 text-center">
        <span className="text-[13px] font-bold tracking-wide text-ink-muted">
          {result.round === 1 ? '테스트 완료!' : result.isFinal ? '복습 완료!' : '복습 라운드 결과'}
        </span>
        <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
          {wordSetTitle} · {formatDateTime(result.finishedAt)}
        </p>

        {result.isFinal ? (
          <div className="mx-auto mt-3.5 flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full border-8 border-surface bg-success-tint">
            <CheckCircleIcon width={40} height={40} className="text-success" strokeWidth={2} />
          </div>
        ) : (
          <div className="mx-auto mt-3.5 flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full border-8 border-success-tint bg-surface">
            <span className="text-[32px] font-extrabold text-primary-dark">
              {result.correctCount}/{total}
            </span>
            <span className="mt-0.5 text-[11.5px] text-ink-muted">정답률 {accuracy}%</span>
          </div>
        )}

        {result.round > 1 && (
          <p className="m-0 mt-3 text-[13px] font-semibold text-ink-muted">
            첫 시도 결과 {first.correct}/{first.total} · 정답률 {firstAccuracy}%
          </p>
        )}

        <p className="mx-auto mt-4 max-w-[280px] whitespace-pre-line text-[15px] font-bold leading-relaxed">
          {result.isFinal
            ? `완벽해요, ${wordSetTitle}의 단어를\n모두 다 외웠어요!`
            : result.round === 1
              ? '잘했어요, 조금만 더 연습하면\n완벽해질 거예요!'
              : '거의 다 왔어요!\n조금만 더 하면 끝나요.'}
        </p>
      </div>

      <div className="flex flex-none gap-2.5 px-[22px] pt-4.5">
        <div className="flex-1 rounded-2xl border border-border bg-surface p-2.5 text-center">
          <div className="text-lg font-extrabold">{formatDuration(result.durationMs)}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-muted">소요 시간</div>
        </div>
        <div className="flex-1 rounded-2xl bg-success-tint p-2.5 text-center">
          <div className="text-lg font-extrabold text-primary-dark">{result.correctCount}</div>
          <div className="mt-0.5 text-[11.5px] text-primary-dark">정답</div>
        </div>
        <div className="flex-1 rounded-2xl bg-error-tint p-2.5 text-center">
          <div className="text-lg font-extrabold text-error">{result.wrongCount}</div>
          <div className="mt-0.5 text-[11.5px] text-error">오답</div>
        </div>
      </div>

      {!result.isFinal && (
        <div className="flex-none px-[22px] pb-1.5 pt-5">
          <h3 className="m-0 text-[14.5px] font-bold">틀린 단어 다시 보기</h3>
        </div>
      )}

      {result.isFinal ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-8 text-center">
          <StarIcon width={30} height={30} className="text-gold" />
          <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
            {result.round}라운드 만에 모든 단어를 맞혔어요.
            <br />
            오늘 학습은 여기까지!
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-[22px] pb-3.5">
          {Array.from(new Map(result.wrongAnswers.map((a) => [a.wordId, a])).values()).map((a) => (
            <div key={a.wordId} className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-3">
              <div className="flex-1">
                <div className="font-display text-[15px] font-bold">
                  {a.term} <span className="font-kr text-[13px] font-normal text-ink-muted">= {a.meaning}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-error">
                  내가 쓴 답: <span className="line-through">{a.userAnswer || '(건너뜀)'}</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="영어 발음 듣기"
                onClick={() => speak(a.term)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-primary-tint text-primary"
              >
                <SpeakerIcon width={15} height={15} className={speakingTerm === a.term ? 'animate-speak' : ''} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-none flex-col gap-2 border-t border-border bg-surface px-[22px] pb-5 pt-3.5">
        {!result.isFinal && (
          <>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-2xl bg-accent p-[15px] text-[15.5px] font-bold text-white"
            >
              틀린 단어만 다시 풀기
            </button>
            <p className="m-0 text-center text-[11.5px] text-ink-muted">
              다 맞힐 때까지 틀린 단어만 모아서 반복돼요
            </p>
          </>
        )}
        {hadMistakes && (
          <button
            type="button"
            onClick={onWrongNotes}
            className="rounded-[14px] border border-border p-3 text-center text-[14px] font-semibold text-accent-dark"
          >
            틀린 단어는 오답 노트에 저장됐어요 · 보러 가기
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          className="rounded-[14px] border border-border p-3 text-center text-[14px] font-semibold text-ink"
        >
          홈으로 가기
        </button>
      </div>
    </div>
  )
}
