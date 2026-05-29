import { useState, useEffect, useRef, useMemo } from 'react'
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { cn } from '~/lib/utils'

interface QuizBlockProps {
  question: string
  options: string[]
  correctIndex: number
  mode?: 'confirm' | 'instant'
  onCorrect: () => void
  onWrong: () => void
  onSubmit?: (selectedIndex: number, isCorrect: boolean) => void
}

export function QuizBlock({
  question,
  options,
  correctIndex,
  mode = 'confirm',
  onCorrect,
  onWrong,
  onSubmit,
}: QuizBlockProps) {
  const { t } = useTranslation()

  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  // locked = no more clicks allowed (2nd wrong is being processed or correct answer confirmed)
  const [locked, setLocked] = useState(false)
  // Which popup to show: null | 'retry' (1st wrong) | 'rewatch' (2nd wrong)
  const [popup, setPopup] = useState<null | 'retry' | 'rewatch'>(null)

  const wrongCountRef = useRef(0)

  // Shuffle options once on mount. Since QuizBlock remounts on each question
  // (key={currentQuestionIndex} in parent), this reshuffles on every appearance.
  const { shuffledOptions, shuffledCorrectIndex } = useMemo(() => {
    const indices = options.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return {
      shuffledOptions: indices.map((i) => options[i]),
      shuffledCorrectIndex: indices.indexOf(correctIndex),
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentionally fixed on mount

  // 1st wrong: auto-dismiss after 2.5s, reset selection for retry
  useEffect(() => {
    if (popup !== 'retry') return
    const timer = setTimeout(() => {
      setPopup(null)
      setSelected(null)
      setResult(null)
    }, 2500)
    return () => clearTimeout(timer)
  }, [popup])

  // 2nd wrong: auto-dismiss after 4s, then trigger video replay
  useEffect(() => {
    if (popup !== 'rewatch') return
    const timer = setTimeout(() => {
      setPopup(null)
      onWrong()
    }, 4000)
    return () => clearTimeout(timer)
  }, [popup, onWrong])

  const handleWrong = (index: number) => {
    wrongCountRef.current += 1
    onSubmit?.(index, false)
    setSelected(index)
    setResult('wrong')

    if (wrongCountRef.current === 1) {
      // 1st wrong: show retry popup, don't lock (useEffect resets state after 2.5s)
      setPopup('retry')
    } else {
      // 2nd wrong: lock UI, show rewatch popup, then replay video
      setLocked(true)
      setPopup('rewatch')
    }
  }

  const handleCorrect = (index: number) => {
    setSelected(index)
    setResult('correct')
    setLocked(true)
    onSubmit?.(index, true)
    setTimeout(() => onCorrect(), 1200)
  }

  // ── Confirm mode ──
  const handleConfirmSubmit = () => {
    if (selected === null || locked) return
    if (selected === shuffledCorrectIndex) {
      handleCorrect(selected)
    } else {
      handleWrong(selected)
    }
  }

  // ── Instant mode ──
  const handleInstantClick = (index: number) => {
    if (locked || popup !== null) return
    if (index === shuffledCorrectIndex) {
      handleCorrect(index)
    } else {
      handleWrong(index)
    }
  }

  return (
    <>
      {/* ── 1st wrong: small centered popup — user stays on question ── */}
      {popup === 'retry' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="mx-4 flex items-center gap-3 rounded-2xl bg-danger px-6 py-4 shadow-xl animate-slide-up">
            <XCircle className="h-5 w-5 text-white shrink-0" />
            <p className="text-sm font-semibold text-white">
              {t('quiz.wrongAnswerRetry')}
            </p>
          </div>
        </div>
      )}

      {/* ── 2nd wrong: full-screen blocking popup — video will replay ── */}
      {popup === 'rewatch' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
          <div className="mx-4 flex flex-col items-center gap-4 rounded-3xl bg-white px-10 py-8 shadow-2xl animate-slide-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-light">
              <XCircle className="h-9 w-9 text-danger" />
            </div>
            <p className="text-center text-lg font-semibold text-text">
              {t('quiz.wrongAnswerReplay')}
            </p>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-danger/20">
              <div className="h-full bg-danger animate-shrink-bar" />
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl animate-slide-up">
        <div className="rounded-2xl border border-border-light bg-surface-raised p-6 shadow-card">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-primary-50 p-2">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('quiz.knowledgeCheck')}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-text">{question}</h3>
            </div>
          </div>

          <div className="space-y-2.5">
            {shuffledOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  if (mode === 'instant') {
                    handleInstantClick(index)
                  } else {
                    if (!locked && popup === null) {
                      setSelected(index)
                      setResult(null)
                    }
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-sm transition-all',
                  !locked && popup === null && 'hover:scale-[1.01] active:scale-[0.99]',
                  selected === index
                    ? result === 'correct'
                      ? 'border-success bg-success-light'
                      : result === 'wrong'
                        ? 'border-danger bg-danger-light'
                        : 'border-primary bg-primary-50'
                    : 'border-border-light hover:border-border hover:bg-surface-dim',
                  (locked || popup !== null) && 'pointer-events-none'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                    selected === index
                      ? result === 'correct'
                        ? 'bg-success text-white'
                        : result === 'wrong'
                          ? 'bg-danger text-white'
                          : 'bg-primary text-white'
                      : 'bg-surface-dim text-text-muted'
                  )}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-text">{option}</span>
                {selected === index && result === 'correct' && (
                  <CheckCircle2 className="ml-auto h-5 w-5 text-success" />
                )}
                {selected === index && result === 'wrong' && (
                  <XCircle className="ml-auto h-5 w-5 text-danger" />
                )}
              </button>
            ))}
          </div>

          {result === 'correct' && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-success-light p-3 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <p className="text-sm text-success">{t('quiz.correctAnswer')}</p>
            </div>
          )}

          {/* Confirm button — only in confirm mode, not after final lock */}
          {mode === 'confirm' && !result && (
            <div className="mt-5 flex justify-end">
              <Button
                onClick={handleConfirmSubmit}
                disabled={selected === null || locked || popup !== null}
                size="lg"
              >
                {t('quiz.confirmAnswer')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
