import { useState } from 'react'
import { CheckCircle2, XCircle, HelpCircle, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '~/lib/utils'

interface QuizBlockProps {
  question: string
  options: string[]
  correctIndex: number
  onCorrect: () => void
  onWrong: () => void
  onSubmit?: (selectedIndex: number, isCorrect: boolean) => void
}

export function QuizBlock({
  question,
  options,
  correctIndex,
  onCorrect,
  onWrong,
  onSubmit,
}: QuizBlockProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = () => {
    if (selected === null || isSubmitting) return
    setIsSubmitting(true)
    const isCorrect = selected === correctIndex
    setResult(isCorrect ? 'correct' : 'wrong')
    onSubmit?.(selected, isCorrect)

    if (!isCorrect) {
      // Single attempt: show wrong state briefly, then replay video
      setTimeout(() => onWrong(), 1500)
    }
    // Correct: wait for user to click "Продолжить"
  }

  return (
    <div className="mx-auto max-w-2xl animate-slide-up">
      <div className="rounded-2xl border border-border-light bg-surface-raised p-6 shadow-card">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-primary-50 p-2">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Проверка знаний
            </p>
            <h3 className="mt-1 text-lg font-semibold text-text">{question}</h3>
          </div>
        </div>

        <div className="space-y-2.5">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                if (!isSubmitting) {
                  setSelected(index)
                  setResult(null)
                }
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-sm transition-all hover:scale-[1.01] active:scale-[0.99]',
                selected === index
                  ? result === 'correct'
                    ? 'border-success bg-success-light'
                    : result === 'wrong'
                      ? 'border-danger bg-danger-light'
                      : 'border-primary bg-primary-50'
                  : 'border-border-light hover:border-border hover:bg-surface-dim',
                isSubmitting && 'pointer-events-none'
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
            <p className="text-sm text-success">Правильный ответ!</p>
          </div>
        )}

        {result === 'wrong' && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-danger-light p-3 animate-fade-in">
            <XCircle className="h-4 w-4 text-danger shrink-0" />
            <p className="text-sm text-danger">
              Неверный ответ. Видео повторится с нужного момента.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          {result === 'correct' ? (
            <Button onClick={onCorrect} size="lg">
              Продолжить
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={selected === null || isSubmitting}
              size="lg"
            >
              Подтвердить ответ
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
