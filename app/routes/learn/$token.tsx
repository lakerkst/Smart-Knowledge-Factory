import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useMemo } from 'react'
import {
  GraduationCap,
  Play,
  Clock,
  BookOpen,
  CheckCircle2,
  Lock,
  ChevronRight,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { VideoPlayer } from '~/components/video-player'
import { QuizBlock } from '~/components/quiz-block'
import { Badge } from '~/components/ui/badge'
import { Progress } from '~/components/ui/progress'
import { formatDuration, cn } from '~/lib/utils'
import { mockUsers, mockCourseAssignments, mockCourses, mockLessons, mockQuestions, mockLessonProgress } from '~/lib/mock-data'

export const Route = createFileRoute('/learn/$token')({
  component: LearnPage,
})

type ViewState = 'welcome' | 'courses' | 'player'

function LearnPage() {
  const { token } = Route.useParams()
  const employee = mockUsers.find((u) => u.personalToken === token && u.role === 'employee')

  const [view, setView] = useState<ViewState>('welcome')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [seekTo, setSeekTo] = useState<number | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    new Set(
      mockLessonProgress
        .filter((lp) => lp.userId === employee?.id && lp.status === 'passed')
        .map((lp) => lp.lessonId)
    )
  )

  const assignments = useMemo(
    () => (employee ? mockCourseAssignments.filter((a) => a.userId === employee.id) : []),
    [employee]
  )

  const courses = useMemo(
    () =>
      assignments.map((a) => {
        const course = mockCourses.find((c) => c.id === a.courseId)!
        const lessons = mockLessons.filter((l) => l.courseId === course.id).sort((a, b) => a.orderIndex - b.orderIndex)
        return { ...course, lessons }
      }),
    [assignments]
  )

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId),
    [courses, selectedCourseId]
  )

  const currentLesson = selectedCourse?.lessons[currentLessonIndex]
  const questions = useMemo(
    () =>
      currentLesson
        ? mockQuestions
            .filter((q) => q.lessonId === currentLesson.id)
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((q) => ({ ...q, options: JSON.parse(q.options) as string[] }))
        : [],
    [currentLesson]
  )

  const triggeredQuestions = useMemo(() => new Set<string>(), [currentLesson?.id])

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (showQuiz) return
      const nextQ = questions.find(
        (q) => !triggeredQuestions.has(q.id) && time >= q.timecodeTrigger
      )
      if (nextQ) {
        triggeredQuestions.add(nextQ.id)
        const idx = questions.indexOf(nextQ)
        setCurrentQuestionIndex(idx)
        setShowQuiz(true)
        setIsMinimized(true)
        setAttemptNumber(1)
      }
    },
    [questions, showQuiz, triggeredQuestions]
  )

  const handleVideoComplete = useCallback(() => {
    const remainingQ = questions.find((q) => !triggeredQuestions.has(q.id))
    if (remainingQ) {
      triggeredQuestions.add(remainingQ.id)
      const idx = questions.indexOf(remainingQ)
      setCurrentQuestionIndex(idx)
      setShowQuiz(true)
      setIsMinimized(true)
      setAttemptNumber(1)
    } else if (questions.length === 0) {
      if (currentLesson) {
        setCompletedLessons((prev) => new Set(prev).add(currentLesson.id))
      }
    }
  }, [questions, triggeredQuestions, currentLesson])

  const handleCorrectAnswer = useCallback(() => {
    setShowQuiz(false)
    setIsMinimized(false)

    const nextUnTriggered = questions.find(
      (q, i) => i > currentQuestionIndex && !triggeredQuestions.has(q.id)
    )

    if (!nextUnTriggered && currentQuestionIndex >= questions.length - 1) {
      if (currentLesson) {
        setCompletedLessons((prev) => new Set(prev).add(currentLesson.id))
      }
    }
  }, [currentQuestionIndex, questions, triggeredQuestions, currentLesson])

  const handleFirstWrong = useCallback(() => {
    setAttemptNumber(2)
  }, [])

  const handleSecondWrong = useCallback(() => {
    const q = questions[currentQuestionIndex]
    if (q) {
      setShowQuiz(false)
      setIsMinimized(false)
      triggeredQuestions.delete(q.id)
      setSeekTo(q.timecodeStart)
      setTimeout(() => setSeekTo(null), 100)
    }
  }, [currentQuestionIndex, questions, triggeredQuestions])

  const startCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    setCurrentLessonIndex(0)
    setView('player')
    setShowQuiz(false)
    setIsMinimized(false)
  }

  const goToLesson = (index: number) => {
    if (!selectedCourse) return
    const lesson = selectedCourse.lessons[index]
    const prevLesson = index > 0 ? selectedCourse.lessons[index - 1] : null
    if (index > 0 && prevLesson && !completedLessons.has(prevLesson.id)) return

    setCurrentLessonIndex(index)
    setShowQuiz(false)
    setIsMinimized(false)
    setCurrentQuestionIndex(0)
    setAttemptNumber(1)
    triggeredQuestions.clear()
  }

  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-text-muted" />
          <h1 className="mt-4 text-xl font-semibold text-text">Ссылка не найдена</h1>
          <p className="mt-2 text-sm text-text-muted">Проверьте правильность ссылки или обратитесь к администратору</p>
        </div>
      </div>
    )
  }

  if (view === 'welcome') {
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
            Вас ожидает корпоративное обучение. Вам назначено {assignments.length}{' '}
            {assignments.length === 1 ? 'курс' : 'курса'}.
          </p>

          <div className="mt-6 rounded-2xl border border-border-light bg-surface-raised p-5 text-left shadow-card">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Как проходить обучение</h3>
            <ul className="mt-3 space-y-2.5">
              {[
                'Просмотрите видеоурок полностью — перемотка вперёд заблокирована',
                'Ответьте на вопросы — они появятся в ключевых моментах',
                'При ошибке вы пересмотрите нужный фрагмент и ответите снова',
                'Завершите все уроки курса для получения статуса прохождения',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary mt-0.5">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <Button
            size="lg"
            className="mt-8 text-base"
            onClick={() => setView('courses')}
          >
            <Play className="h-5 w-5" />
            Начать обучение
          </Button>
        </div>
      </div>
    )
  }

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

          <div className="space-y-4">
            {courses.map((course, i) => {
              const completed = course.lessons.filter((l) => completedLessons.has(l.id)).length
              const progress = course.lessons.length > 0 ? Math.round((completed / course.lessons.length) * 100) : 0

              return (
                <div
                  key={course.id}
                  className="rounded-2xl border border-border-light bg-surface-raised p-5 shadow-card hover:shadow-card-hover transition-shadow cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
                  onClick={() => startCourse(course.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-text">{course.title}</h3>
                      <p className="mt-1 text-sm text-text-muted line-clamp-2">{course.description}</p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {course.lessons.length} уроков
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(course.lessons.reduce((a, l) => a + l.duration, 0))}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-text-muted mt-1" />
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-text-muted">Прогресс</span>
                      <span className="font-medium text-text">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border-light bg-surface-raised px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('courses')}
              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-dim hover:text-text transition-colors"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <div>
              <p className="text-sm font-semibold text-text">{selectedCourse?.title}</p>
              <p className="text-xs text-text-muted">
                Урок {currentLessonIndex + 1} из {selectedCourse?.lessons.length}
              </p>
            </div>
          </div>
          <Badge variant={completedLessons.has(currentLesson?.id || '') ? 'success' : 'default'}>
            {completedLessons.has(currentLesson?.id || '') ? 'Пройден' : 'В процессе'}
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex gap-6">
          <div className="hidden w-56 shrink-0 md:block">
            <p className="mb-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Уроки</p>
            <div className="space-y-1.5">
              {selectedCourse?.lessons.map((lesson, index) => {
                const isCompleted = completedLessons.has(lesson.id)
                const isCurrent = index === currentLessonIndex
                const prevCompleted = index === 0 || completedLessons.has(selectedCourse.lessons[index - 1].id)
                const isLocked = index > 0 && !prevCompleted

                return (
                  <button
                    key={lesson.id}
                    onClick={() => !isLocked && goToLesson(index)}
                    disabled={isLocked}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      isCurrent
                        ? 'bg-primary-50 text-primary'
                        : isCompleted
                          ? 'text-success hover:bg-success-light'
                          : isLocked
                            ? 'text-text-muted opacity-50 cursor-not-allowed'
                            : 'text-text-secondary hover:bg-surface-dim'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : isLocked ? (
                      <Lock className="h-4 w-4 shrink-0" />
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                        {index + 1}
                      </span>
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {currentLesson && (
              <>
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-text">{currentLesson.title}</h2>
                  {currentLesson.description && (
                    <p className="mt-1 text-sm text-text-muted">{currentLesson.description}</p>
                  )}
                </div>

                <VideoPlayer
                  lessonTitle={currentLesson.title}
                  duration={currentLesson.duration}
                  maxAllowedPosition={0}
                  onTimeUpdate={handleTimeUpdate}
                  onComplete={handleVideoComplete}
                  seekToTime={seekTo}
                  minimized={isMinimized}
                />

                {showQuiz && questions[currentQuestionIndex] && (
                  <div className="mt-6 animate-slide-up">
                    <QuizBlock
                      question={questions[currentQuestionIndex].text}
                      options={questions[currentQuestionIndex].options}
                      correctIndex={questions[currentQuestionIndex].correctIndex}
                      attemptNumber={attemptNumber}
                      onCorrect={handleCorrectAnswer}
                      onFirstWrong={handleFirstWrong}
                      onSecondWrong={handleSecondWrong}
                    />
                  </div>
                )}

                {completedLessons.has(currentLesson.id) && !showQuiz && (
                  <div className="mt-6 flex items-center justify-between rounded-2xl bg-success-light p-5 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                      <div>
                        <p className="font-semibold text-success">Урок пройден!</p>
                        <p className="text-sm text-success/70">Переходите к следующему уроку</p>
                      </div>
                    </div>
                    {selectedCourse && currentLessonIndex < selectedCourse.lessons.length - 1 && (
                      <Button
                        onClick={() => goToLesson(currentLessonIndex + 1)}
                        variant="success"
                      >
                        Следующий урок
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
