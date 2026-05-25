import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  GraduationCap,
  Play,
  Clock,
  BookOpen,
  CheckCircle2,
  Lock,
  ChevronRight,
  Trophy,
  ArrowRight,
  Video,
  HelpCircle,
  Star,
  ClipboardCheck,
  MessageSquare,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { VideoPlayer } from '~/components/video-player'
import { QuizBlock } from '~/components/quiz-block'
import { Badge } from '~/components/ui/badge'
import { Progress } from '~/components/ui/progress'
import { formatDuration, cn } from '~/lib/utils'
import { getEmployeeByTokenFn } from '~/lib/server-fns/auth'
import { getEmployeeCoursesFn, getEmployeeCourseFn } from '~/lib/server-fns/courses'
import { updateProgressFn, submitAnswerFn, completeLessonFn } from '~/lib/server-fns/progress'
import { submitFeedbackFn } from '~/lib/server-fns/feedback'
import { getFinalTestFn, submitFinalTestFn } from '~/lib/server-fns/final-test'
import { getEmployeePathsFn } from '~/lib/server-fns/learning-paths'

export const Route = createFileRoute('/learn/$token')({
  loader: async ({ params }) => {
    const { employee } = await getEmployeeByTokenFn({ data: { token: params.token } })
    if (!employee) return { employee: null, courses: [], courseDetails: {}, pathLockMap: {} as Record<string, boolean> }

    const [courses, pathLocks] = await Promise.all([
      getEmployeeCoursesFn({ data: { userId: employee.id } }),
      getEmployeePathsFn({ data: { userId: employee.id } }),
    ])

    const pathLockMap: Record<string, boolean> = {}
    for (const entry of pathLocks) {
      pathLockMap[entry.courseId] = entry.locked
    }

    const courseDetails: Record<string, Awaited<ReturnType<typeof getEmployeeCourseFn>>['course']> = {}
    await Promise.all(
      (courses || []).map(async (c) => {
        if (c) {
          const { course } = await getEmployeeCourseFn({
            data: { userId: employee.id, courseId: c.id },
          })
          if (course) courseDetails[c.id] = course
        }
      })
    )

    return { employee, courses: courses || [], courseDetails, pathLockMap }
  },
  pendingComponent: LearnSkeleton,
  pendingMinMs: 300,
  component: LearnPage,
})

function LearnSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-surface to-primary-50 p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-primary/10 animate-pulse" />
        <div className="mx-auto h-8 w-3/4 rounded-xl bg-surface-dim animate-pulse" />
        <div className="mx-auto mt-3 h-5 w-1/2 rounded-lg bg-surface-dim animate-pulse" />
        <div className="mt-6 rounded-2xl border border-border-light bg-surface-raised p-5 space-y-3">
          {[75, 68, 80, 55].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-surface-dim animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <div className="mx-auto mt-8 h-12 w-48 rounded-xl bg-primary/20 animate-pulse" />
      </div>
    </div>
  )
}

type ViewState = 'welcome' | 'courses' | 'player' | 'finalTest'

// Russian plural form for "курс"
function formatCourses(n: number) {
  if (n % 100 >= 11 && n % 100 <= 19) return `${n} курсов`
  const r = n % 10
  if (r === 1) return `${n} курс`
  if (r >= 2 && r <= 4) return `${n} курса`
  return `${n} курсов`
}

function LearnPage() {
  const { employee, courses, courseDetails, pathLockMap } = Route.useLoaderData()

  const [view, setView] = useState<ViewState>('welcome')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [seekTo, setSeekTo] = useState<number | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [courseCompleted, setCourseCompleted] = useState(false)

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackLessonId, setFeedbackLessonId] = useState<string | null>(null)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Final test state
  const [finalTestData, setFinalTestData] = useState<{ enabled: boolean; passingScore: number; questions: Array<{ id: string; text: string; options: string[]; correctIndex: number }> } | null>(null)
  const [ftAnswers, setFtAnswers] = useState<number[]>([])
  const [ftCurrentQ, setFtCurrentQ] = useState(0)
  const [ftResult, setFtResult] = useState<{ score: number; passed: boolean; correct: number; total: number; passingScore: number } | null>(null)
  const [ftSubmitting, setFtSubmitting] = useState(false)

  const lastSavedPositionRef = useRef(0)
  // Tracks whether the current question's quiz has already been triggered mid-video
  const quizTriggeredRef = useRef(false)
  // Last time value seen in timeupdate — used to detect seeks vs natural playback
  const prevTimeRef = useRef(0)
  // Set when user seeks past a trigger point; cleared when they return before it
  const quizSkippedBySeekRef = useRef(false)

  const [completedLessons, setCompletedLessons] = useState<Set<string>>(() => {
    const set = new Set<string>()
    Object.values(courseDetails).forEach((course) => {
      if (course) course.lessons.forEach((l) => { if (l.status === 'passed') set.add(l.id) })
    })
    return set
  })

  const selectedCourse = selectedCourseId ? courseDetails[selectedCourseId] : null
  const selectedCourseLessons = selectedCourse?.lessons || []
  const currentLesson = selectedCourseLessons[currentLessonIndex]

  // Reset state when lesson changes
  useEffect(() => {
    lastSavedPositionRef.current = currentLesson?.maxWatchedPosition || 0
    quizTriggeredRef.current = false
    quizSkippedBySeekRef.current = false
    prevTimeRef.current = 0
    setCourseCompleted(false)
  }, [currentLessonIndex, selectedCourseId])

  const questions = useMemo(
    () =>
      currentLesson
        ? currentLesson.questions.map((q) => ({
            ...q,
            options: typeof q.options === 'string' ? (JSON.parse(q.options) as string[]) : (q.options as string[]),
          }))
        : [],
    [currentLesson]
  )

  // No longer needed: quiz triggers are now post-video, not timecode-based

  // Check if all lessons in the current course are completed
  const isAllLessonsCompleted = useMemo(() => {
    if (!selectedCourseLessons.length) return false
    return selectedCourseLessons.every((l) => completedLessons.has(l.id))
  }, [selectedCourseLessons, completedLessons])

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (showQuiz) return

      // Persist progress every 5 seconds of new watched content
      if (employee && currentLesson && time > lastSavedPositionRef.current + 5) {
        lastSavedPositionRef.current = time
        updateProgressFn({ data: { userId: employee.id, lessonId: currentLesson.id, maxWatchedPosition: time } })
      }

      // Distinguish natural playback (~0.25 s steps) from a seek (large jump).
      // Vimeo fires timeupdate both during playback AND after setCurrentTime calls.
      const prev = prevTimeRef.current
      prevTimeRef.current = time
      const isNaturalStep = time > prev && (time - prev) <= 2

      // Trigger quiz at timecodeTrigger only on natural playback — not when the
      // user scrubs the progress bar to/past the trigger position.
      if (!quizTriggeredRef.current && questions.length > 0 && currentQuestionIndex < questions.length) {
        const q = questions[currentQuestionIndex]
        if (q && q.timecodeTrigger > 0) {
          if (time < q.timecodeTrigger) {
            // Playhead is before trigger — clear any seek-skip flag
            quizSkippedBySeekRef.current = false
          } else {
            // Playhead is at or past trigger
            if (!isNaturalStep) {
              // Got here via a seek/scrub — suppress trigger until user returns
              // before the trigger point and lets the video play through naturally
              quizSkippedBySeekRef.current = true
            }
            if (!quizSkippedBySeekRef.current) {
              quizTriggeredRef.current = true
              setShowQuiz(true)
              setIsMinimized(true)
            }
          }
        }
      }
    },
    [showQuiz, employee, currentLesson, questions, currentQuestionIndex]
  )

  const markLessonComplete = useCallback(
    (lessonId: string) => {
      if (!employee) return
      const nextCompleted = new Set(completedLessons).add(lessonId)
      setCompletedLessons(nextCompleted)
      completeLessonFn({ data: { userId: employee.id, lessonId } })
      // Show feedback only when the entire course is finished
      const allDone =
        selectedCourseLessons.length > 0 &&
        selectedCourseLessons.every((l) => nextCompleted.has(l.id))
      if (allDone) {
        setFeedbackLessonId(lessonId)
        setFeedbackRating(0)
        setFeedbackComment('')
        setShowFeedback(true)
      }
    },
    [employee, completedLessons, selectedCourseLessons]
  )

  const handleSubmitFeedback = async () => {
    if (!employee || !feedbackLessonId || feedbackRating === 0) return
    setSubmittingFeedback(true)
    try {
      await submitFeedbackFn({ data: { userId: employee.id, lessonId: feedbackLessonId, rating: feedbackRating, comment: feedbackComment.trim() || undefined } })
    } finally {
      setSubmittingFeedback(false)
      setShowFeedback(false)
    }
  }

  const handleStartFinalTest = async () => {
    if (!selectedCourseId) return
    const ft = await getFinalTestFn({ data: { courseId: selectedCourseId } })
    setFinalTestData(ft)
    setFtAnswers(new Array(ft.questions.length).fill(-1))
    setFtCurrentQ(0)
    setFtResult(null)
    setView('finalTest')
  }

  const handleSubmitFinalTest = async () => {
    if (!employee || !selectedCourseId || !finalTestData) return
    setFtSubmitting(true)
    try {
      const result = await submitFinalTestFn({ data: { userId: employee.id, courseId: selectedCourseId, answers: ftAnswers } })
      if ('score' in result) setFtResult(result)
    } finally {
      setFtSubmitting(false)
    }
  }

  // Called when video ends.
  // With timecodes enabled, quiz normally appears mid-video. This is a fallback for:
  //   - lessons with no questions
  //   - questions where timecodeTrigger was never reached (e.g. user is past all triggers)
  //   - all questions already answered (complete the lesson)
  const handleVideoComplete = useCallback(() => {
    if (questions.length === 0 || currentQuestionIndex >= questions.length) {
      // No questions or all questions answered — mark complete
      if (currentLesson) markLessonComplete(currentLesson.id)
      return
    }
    // Fallback: still have unanswered questions — show quiz
    quizTriggeredRef.current = true
    setShowQuiz(true)
    setIsMinimized(true)
  }, [questions, currentLesson, currentQuestionIndex, markLessonComplete])

  const handleCorrectAnswer = useCallback(() => {
    // Advance question index and always resume video.
    // For timecode-based quizzes: video plays to the next question's trigger.
    // For post-video fallback: handleVideoComplete will show remaining questions.
    quizTriggeredRef.current = false
    quizSkippedBySeekRef.current = false
    setCurrentQuestionIndex((prev) => prev + 1)
    setShowQuiz(false)
    setIsMinimized(false)
  }, [])

  const handleSecondWrong = useCallback(() => {
    const q = questions[currentQuestionIndex]
    if (q) {
      // Reset both flags so the trigger can fire again after replay
      quizTriggeredRef.current = false
      quizSkippedBySeekRef.current = false
      // Hide quiz, expand video, replay from admin's timecode.
      // currentQuestionIndex stays the same — quiz re-appears at timecodeTrigger.
      setShowQuiz(false)
      setIsMinimized(false)
      setSeekTo(q.timecodeStart)
      setTimeout(() => setSeekTo(null), 100)
    }
  }, [currentQuestionIndex, questions])

  const handleQuizSubmit = useCallback(
    (selectedIndex: number, isCorrect: boolean) => {
      if (!employee || !currentLesson || !questions[currentQuestionIndex]) return
      submitAnswerFn({
        data: {
          userId: employee.id,
          lessonId: currentLesson.id,
          questionId: questions[currentQuestionIndex].id,
          selectedIndex,
          correctIndex: questions[currentQuestionIndex].correctIndex,
          attemptNumber: 1,
        },
      })
    },
    [employee, currentLesson, questions, currentQuestionIndex]
  )

  // For a lesson with no vimeoId but has questions: show questions immediately
  const handleNoVideoComplete = useCallback(() => {
    if (!currentLesson) return
    if (questions.length > 0) {
      quizTriggeredRef.current = true
      setCurrentQuestionIndex(0)
      setShowQuiz(true)
    } else {
      markLessonComplete(currentLesson.id)
    }
  }, [currentLesson, questions, markLessonComplete])

  const startCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    setCurrentLessonIndex(0)
    setCurrentQuestionIndex(0)
    setView('player')
    setShowQuiz(false)
    setIsMinimized(false)
    setCourseCompleted(false)
  }

  const goToLesson = (index: number) => {
    if (!selectedCourseLessons.length) return
    const prevLesson = index > 0 ? selectedCourseLessons[index - 1] : null
    if (index > 0 && prevLesson && !completedLessons.has(prevLesson.id)) return
    setCurrentLessonIndex(index)
    setShowQuiz(false)
    setIsMinimized(false)
    setCurrentQuestionIndex(0)
  }

  // ─── Final Test view ────────────────────────────────────────────────────────
  if (view === 'finalTest' && finalTestData) {
    const q = finalTestData.questions[ftCurrentQ]
    const allAnswered = ftAnswers.every((a) => a !== -1)

    return (
      <div className="min-h-screen bg-surface">
        <header className="border-b border-border-light bg-surface-raised px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('player')}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-dim hover:text-text">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <div>
                <p className="text-sm font-semibold text-text">Итоговый тест</p>
                <p className="text-xs text-text-muted">{selectedCourse?.title}</p>
              </div>
            </div>
            <Badge variant="default">
              Порог: {finalTestData.passingScore}%
            </Badge>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-8">
          {ftResult ? (
            // Result screen
            <div className="flex flex-col items-center text-center animate-scale-in py-8">
              <div className={cn('mb-6 flex h-24 w-24 items-center justify-center rounded-full',
                ftResult.passed ? 'bg-success/10' : 'bg-danger-light')}>
                {ftResult.passed
                  ? <Trophy className="h-12 w-12 text-success" />
                  : <ClipboardCheck className="h-12 w-12 text-danger" />}
              </div>
              <h2 className="text-2xl font-bold text-text">
                {ftResult.passed ? 'Тест пройден!' : 'Тест не пройден'}
              </h2>
              <p className="mt-2 text-text-muted">
                Правильных ответов: {ftResult.correct} из {ftResult.total} ({ftResult.score}%)
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Минимальный балл: {ftResult.passingScore}%
              </p>
              <div className="mt-6 flex gap-3">
                {!ftResult.passed && (
                  <Button onClick={() => {
                    setFtAnswers(new Array(finalTestData.questions.length).fill(-1))
                    setFtCurrentQ(0)
                    setFtResult(null)
                  }} variant="secondary">
                    Попробовать снова
                  </Button>
                )}
                <Button onClick={() => setView('courses')}>
                  К списку курсов
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : q ? (
            // Question screen
            <div className="animate-fade-in">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-text-muted">Вопрос {ftCurrentQ + 1} из {finalTestData.questions.length}</p>
                <div className="flex gap-1">
                  {finalTestData.questions.map((_, i) => (
                    <div key={i} className={cn('h-1.5 w-8 rounded-full transition-colors',
                      i === ftCurrentQ ? 'bg-primary' : ftAnswers[i] !== -1 ? 'bg-success' : 'bg-surface-dim')} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border-light bg-surface-raised p-6 shadow-card">
                <h3 className="text-lg font-semibold text-text mb-5">{q.text}</h3>
                <div className="space-y-3">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => {
                        const next = [...ftAnswers]
                        next[ftCurrentQ] = oi
                        setFtAnswers(next)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                        ftAnswers[ftCurrentQ] === oi
                          ? 'border-primary bg-primary-50 text-primary font-medium'
                          : 'border-border-light bg-surface hover:bg-surface-dim text-text'
                      )}
                    >
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        ftAnswers[ftCurrentQ] === oi ? 'bg-primary text-white' : 'bg-surface-dim text-text-muted')}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex justify-between">
                  {ftCurrentQ > 0 ? (
                    <Button variant="secondary" onClick={() => setFtCurrentQ(ftCurrentQ - 1)}>Назад</Button>
                  ) : <div />}
                  {ftCurrentQ < finalTestData.questions.length - 1 ? (
                    <Button onClick={() => setFtCurrentQ(ftCurrentQ + 1)} disabled={ftAnswers[ftCurrentQ] === -1}>
                      Далее <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleSubmitFinalTest} disabled={!allAnswered || ftSubmitting}>
                      {ftSubmitting ? 'Отправка...' : 'Завершить тест'}
                      <ClipboardCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-text-muted">Нет вопросов в тесте</p>
          )}
        </div>
      </div>
    )
  }

  // ─── Invalid token ───────────────────────────────────────────────────────────
  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-light">
            <GraduationCap className="h-8 w-8 text-danger" />
          </div>
          <h1 className="text-xl font-semibold text-text">Ссылка не найдена</h1>
          <p className="mt-2 text-sm text-text-muted">
            Ссылка устарела или неверна. Запросите новую у администратора.
          </p>
        </div>
      </div>
    )
  }

  // ─── Welcome ─────────────────────────────────────────────────────────────────
  if (view === 'welcome') {
    // No courses assigned — show waiting state
    if (courses.length === 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-surface to-primary-50 p-6">
          <div className="w-full max-w-md text-center animate-scale-in">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-text">
              Добро пожаловат��, {employee.name.split(' ')[0]}!
            </h1>
            <p className="mt-3 text-text-secondary">
              Вам пока не назначены курсы. Как только администратор назначит курс — он появится здесь автоматически.
            </p>
            <div className="mt-6 rounded-2xl border border-border-light bg-surface-raised p-4 text-left shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Что вас ждёт</p>
              <ul className="space-y-2">
                {[
                  'Видеоуроки с проверкой знаний',
                  'Вопросы в ключевых моментах видео',
                  'Отслеживание прогресса',
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-text-muted">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )
    }

    // Has courses — show welcome + instructions
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-surface to-primary-50 p-6">
        <div className="w-full max-w-lg text-center animate-scale-in">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-text">
            Добро пожаловать, {employee.name.split(' ')[0]}!
          </h1>
          <p className="mt-3 text-text-secondary">
            Корпоративное обучение. Вам назначено {formatCourses(courses.length)}.
          </p>

          <div className="mt-6 rounded-2xl border border-border-light bg-surface-raised p-5 text-left shadow-card">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Как проходить обучение
            </h3>
            <ul className="mt-3 space-y-2.5">
              {[
                'Просмотрите видеоурок полностью — перемотка вперёд заблокирована',
                'Ответьте на вопросы — они появятся в ключевых моментах',
                'При ошибке вы пересмотрите нужный фрагмент и ответите снова',
                'Завершите все уроки курса для получения статуса прохождения',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <Button size="lg" className="mt-8 text-base" onClick={() => setView('courses')}>
            <Play className="h-5 w-5" />
            Начать обучение
          </Button>
        </div>
      </div>
    )
  }

  // ─── Courses list ─────────────────────────────────────────────────────────────
  if (view === 'courses') {
    return (
      <div className="min-h-screen bg-surface p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Мои курсы</h1>
              <p className="text-sm text-text-muted">{employee.name}</p>
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="rounded-2xl border border-border-light bg-surface-raised p-12 text-center shadow-card">
              <BookOpen className="mx-auto h-12 w-12 text-text-muted/50" />
              <h3 className="mt-4 text-base font-semibold text-text">Курсы не назначены</h3>
              <p className="mt-2 text-sm text-text-muted">
                Обратитесь к администратору для назначения кур��ов
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((course, i) => {
                const detail = courseDetails[course.id]
                const lessonsArr = detail?.lessons || []
                const completed = lessonsArr.filter((l) => completedLessons.has(l.id)).length
                const progress = lessonsArr.length > 0 ? Math.round((completed / lessonsArr.length) * 100) : 0
                const isFinished = progress === 100 && lessonsArr.length > 0
                const isPathLocked = pathLockMap[course.id] === true

                return (
                  <div
                    key={course.id}
                    className={cn(
                      'animate-fade-in rounded-2xl border border-border-light bg-surface-raised p-5 shadow-card transition-all',
                      isPathLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5'
                    )}
                    style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
                    onClick={() => !isPathLocked && startCourse(course.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-text">{course.title}</h3>
                          {isFinished && <Badge variant="success">Пройден</Badge>}
                          {isPathLocked && (
                            <Badge variant="secondary">
                              <Lock className="h-3 w-3 mr-1" />
                              Заблокирован
                            </Badge>
                          )}
                        </div>
                        {course.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{course.description}</p>
                        )}
                        <div className="mt-3 flex items-center gap-4 text-xs text-text-muted flex-wrap">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {course.lessonsCount} уроков
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuration(lessonsArr.reduce((a, l) => a + l.duration, 0))}
                          </span>
                          <span className="text-text-secondary font-medium">
                            {completed}/{lessonsArr.length} завершено
                          </span>
                          {course.deadline && (() => {
                            const dl = new Date(course.deadline)
                            const now = new Date()
                            const daysLeft = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                            const overdue = daysLeft < 0
                            return (
                              <span className={cn(
                                'flex items-center gap-1 font-medium',
                                overdue ? 'text-danger' : daysLeft <= 3 ? 'text-warning' : 'text-text-muted'
                              )}>
                                <Clock className="h-3.5 w-3.5" />
                                {overdue
                                  ? `Просрочен ${Math.abs(daysLeft)} дн.`
                                  : daysLeft === 0
                                    ? 'Дедлайн сегодня'
                                    : `${daysLeft} дн. до дедлайна`}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-text-muted" />
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-text-muted">Прогресс</span>
                        <span className="font-semibold text-text">{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Player view ─────────────────────────────────────────────────────────────
  const isCurrentLessonCompleted = completedLessons.has(currentLesson?.id || '')

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-950">
      {/* Dark compact header */}
      <header className="shrink-0 border-b border-white/10 bg-gray-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('courses')}
            className="rounded-xl p-2 text-white/60 transition-colors active:bg-white/10 hover:text-white"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{selectedCourse?.title}</p>
            <p className="text-xs text-white/50">
              Урок {currentLessonIndex + 1} из {selectedCourseLessons.length}
            </p>
          </div>
          <Badge variant={isCurrentLessonCompleted ? 'success' : 'default'}>
            {isCurrentLessonCompleted ? 'Пройден' : 'В процессе'}
          </Badge>
        </div>
      </header>

      {/* Course completion screen */}
      {isAllLessonsCompleted ? (
        <div className="flex flex-1 flex-col items-center justify-center bg-surface px-6 py-16 text-center animate-scale-in">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
            <Trophy className="h-12 w-12 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-text">Все уроки пройдены!</h2>
          <p className="mt-2 text-text-muted">
            Вы успешно завершили все уроки курса «{selectedCourse?.title}»
          </p>
          <div className="mt-6 flex w-full max-w-xs flex-col items-center gap-3">
            {selectedCourse?.finalTestEnabled && (
              <Button onClick={handleStartFinalTest} size="lg" className="w-full gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Пройти итоговый тест
              </Button>
            )}
            <Button onClick={() => setView('courses')} variant="secondary" className="w-full">
              К списку курсов
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Portrait video area */}
          <div className={cn(
            'flex justify-center bg-gray-950 transition-all duration-300',
            isMinimized ? 'py-2' : 'py-3 sm:py-5'
          )}>
            <div className={cn(
              'transition-all duration-300',
              isMinimized
                ? 'w-[88px]'
                : 'w-full max-w-[340px] sm:max-w-[400px] px-4'
            )}>
              {currentLesson?.vimeoId ? (
                <VideoPlayer
                  key={currentLesson.id}
                  vimeoId={currentLesson.vimeoId}
                  lessonTitle={currentLesson.title}
                  duration={currentLesson.duration}
                  maxAllowedPosition={currentLesson.maxWatchedPosition}
                  onTimeUpdate={handleTimeUpdate}
                  onComplete={handleVideoComplete}
                  seekToTime={seekTo}
                  minimized={isMinimized}
                  paused={showQuiz}
                />
              ) : (
                <div className="aspect-[9/16] rounded-2xl bg-gray-900 flex items-center justify-center">
                  <Video className="h-8 w-8 text-white/20" />
                </div>
              )}
            </div>
          </div>

          {/* Content panel — slides up over video with rounded top */}
          <div className="relative z-10 -mt-4 flex-1 overflow-y-auto rounded-t-3xl bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
            {!currentLesson ? (
              <div className="p-8 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-text-muted/50" />
                <p className="mt-4 text-text-muted">В этом курсе нет уроков</p>
                <Button className="mt-4" variant="secondary" onClick={() => setView('courses')}>
                  Вернуться к курсам
                </Button>
              </div>
            ) : (
              <div className="px-4 pt-4 pb-10">
                {/* Drag handle visual */}
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

                {/* Lesson title */}
                <div className="mb-4">
                  <h2 className="text-base font-bold text-text leading-snug">{currentLesson.title}</h2>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    {currentLesson.duration > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(currentLesson.duration)}
                      </span>
                    )}
                    {questions.length > 0 && (
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-3.5 w-3.5" />
                        {questions.length} вопросов
                      </span>
                    )}
                  </div>
                </div>

                {/* No-video lesson card */}
                {!currentLesson.vimeoId && !isCurrentLessonCompleted && !showQuiz && (
                  <div className="mb-4 rounded-2xl border border-border-light bg-surface-raised p-6 text-center shadow-card">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
                      {questions.length > 0 ? (
                        <HelpCircle className="h-6 w-6 text-primary" />
                      ) : (
                        <BookOpen className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <p className="mb-4 text-sm text-text-muted">
                      {questions.length > 0
                        ? `Пройдите тест из ${questions.length} вопросов для завершения урока`
                        : 'Ознакомьтесь с материалом и завершите урок'}
                    </p>
                    <Button className="w-full" onClick={handleNoVideoComplete}>
                      {questions.length > 0 ? (
                        <><HelpCircle className="h-4 w-4" /> Начать тест</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4" /> Отметить как пройденный</>
                      )}
                    </Button>
                  </div>
                )}

                {/* Quiz block — key forces remount on question change so internal state resets */}
                {showQuiz && questions[currentQuestionIndex] && (
                  <div className="mb-4 animate-slide-up">
                    <QuizBlock
                      key={currentQuestionIndex}
                      question={questions[currentQuestionIndex].text}
                      options={questions[currentQuestionIndex].options}
                      correctIndex={questions[currentQuestionIndex].correctIndex}
                      onCorrect={handleCorrectAnswer}
                      onWrong={handleSecondWrong}
                      onSubmit={handleQuizSubmit}
                    />
                  </div>
                )}

                {/* Lesson completed banner */}
                {isCurrentLessonCompleted && !showQuiz && (
                  <div className="mb-4 flex animate-fade-in items-center justify-between rounded-2xl bg-success-light p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-success">Урок пройден!</p>
                        <p className="text-xs text-success/70">
                          {currentLessonIndex < selectedCourseLessons.length - 1
                            ? 'Переходите к следующему уроку'
                            : 'Все уроки завершены'}
                        </p>
                      </div>
                    </div>
                    {currentLessonIndex < selectedCourseLessons.length - 1 ? (
                      <Button size="sm" onClick={() => goToLesson(currentLessonIndex + 1)} variant="success">
                        Далее <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setView('courses')} variant="success">
                        <Trophy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Horizontal lesson navigation strip */}
                {selectedCourseLessons.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Уроки курса
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedCourseLessons.map((lesson, index) => {
                        const isCompleted = completedLessons.has(lesson.id)
                        const isCurrent = index === currentLessonIndex
                        const prevCompleted = index === 0 || completedLessons.has(selectedCourseLessons[index - 1].id)
                        const isLocked = index > 0 && !prevCompleted
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => !isLocked && goToLesson(index)}
                            disabled={isLocked}
                            className={cn(
                              'shrink-0 flex flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 transition-colors w-[76px]',
                              isCurrent
                                ? 'bg-primary text-white shadow-sm'
                                : isCompleted
                                  ? 'bg-success-light text-success'
                                  : isLocked
                                    ? 'bg-surface-dim text-text-muted opacity-40 cursor-not-allowed'
                                    : 'bg-surface-dim text-text-secondary hover:bg-surface-raised'
                            )}
                          >
                            <div className="flex h-6 w-6 items-center justify-center">
                              {isCompleted ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : isLocked ? (
                                <Lock className="h-3.5 w-3.5" />
                              ) : (
                                <span className="text-sm font-bold">{index + 1}</span>
                              )}
                            </div>
                            <span className="line-clamp-2 text-center leading-tight" style={{ fontSize: '10px' }}>
                              {lesson.title}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-raised border border-border-light shadow-card-hover animate-scale-in">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-text">Оцените урок</h3>
              </div>
              <p className="text-sm text-text-muted mb-5">Ваша оценка поможет улучшить контент</p>

              {/* Stars */}
              <div className="flex justify-center gap-2 mb-5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setFeedbackRating(star)} className="transition-transform hover:scale-110">
                    <Star className={cn('h-9 w-9 transition-colors',
                      star <= feedbackRating ? 'fill-warning text-warning' : 'text-text-muted')} />
                  </button>
                ))}
              </div>

              {/* Comment */}
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Комментарий (необязательно)..."
                rows={3}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowFeedback(false)}
                  className="flex-1 rounded-xl border border-border-light px-4 py-2.5 text-sm text-text-muted hover:bg-surface-dim transition-colors"
                >
                  Пропустить
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={feedbackRating === 0 || submittingFeedback}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submittingFeedback ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
