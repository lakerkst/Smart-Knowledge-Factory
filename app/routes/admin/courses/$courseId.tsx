import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  Plus,
  GripVertical,
  HelpCircle,
  Clock,
  Trash2,
  Edit3,
  Save,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { getCourseFn } from '~/lib/server-fns/courses'
import { formatDuration, cn } from '~/lib/utils'

export const Route = createFileRoute('/admin/courses/$courseId')({
  loader: async ({ params }) => {
    const result = await getCourseFn({ data: { courseId: params.courseId } })
    return { course: result.course }
  },
  component: CourseEditorPage,
})

function CourseEditorPage() {
  const { course } = Route.useLoaderData()
  const lessons = course?.lessons || []

  const [expandedLesson, setExpandedLesson] = useState<string | null>(
    lessons[0]?.id || null
  )

  if (!course) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-muted">Курс не найден</p>
      </div>
    )
  }

  const totalQuestions = lessons.reduce((acc, l) => acc + l.questions.length, 0)
  const totalDuration = lessons.reduce((acc, l) => acc + l.duration, 0)

  return (
    <div>
      <Topbar
        title={course.title}
        subtitle="Редактор курса"
      />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/admin/courses" className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Назад к курсам
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={course.isPublished ? 'success' : 'secondary'}>
              {course.isPublished ? 'Опубликован' : 'Черновик'}
            </Badge>
            <Button>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">Уроки ({lessons.length})</h2>
              <Button variant="secondary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Добавить урок
              </Button>
            </div>

            {lessons.map((lesson, index) => {
              const questions = lesson.questions
              const isExpanded = expandedLesson === lesson.id

              return (
                <div
                  key={lesson.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
                >
                  <Card className="overflow-hidden">
                    <button
                      onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                      className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-dim/50 transition-colors"
                    >
                      <GripVertical className="h-4 w-4 text-text-muted shrink-0 cursor-grab" />
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{lesson.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(lesson.duration)}
                          </span>
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-3 w-3" />
                            {questions.length} вопросов
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-text-muted" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border-light animate-fade-in">
                        <div className="p-4 space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="text-xs font-medium text-text-muted">Название</label>
                              <Input defaultValue={lesson.title} className="mt-1" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-text-muted">Vimeo ID</label>
                              <Input defaultValue={lesson.vimeoId || ''} placeholder="123456789" className="mt-1" />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <label className="text-xs font-medium text-text-muted">Вопросы ({questions.length})</label>
                              <Button variant="secondary" size="sm">
                                <Plus className="h-3 w-3" />
                                Добавить
                              </Button>
                            </div>

                            {questions.length > 0 ? (
                              <div className="space-y-2">
                                {questions.map((q) => {
                                  const opts = q.options
                                  return (
                                    <div key={q.id} className="rounded-xl border border-border-light p-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-text">{q.text}</p>
                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {opts.map((opt, oi) => (
                                              <span
                                                key={oi}
                                                className={cn(
                                                  'inline-flex items-center rounded-lg px-2 py-1 text-xs',
                                                  oi === q.correctIndex
                                                    ? 'bg-success-light text-success font-medium'
                                                    : 'bg-surface-dim text-text-muted'
                                                )}
                                              >
                                                {String.fromCharCode(65 + oi)}. {opt}
                                              </span>
                                            ))}
                                          </div>
                                          <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                                            <span>Таймкод: {formatDuration(q.timecodeTrigger)}</span>
                                            <span>Возврат к: {formatDuration(q.timecodeStart)}</span>
                                          </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                          <Edit3 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                <HelpCircle className="mx-auto h-6 w-6 text-text-muted" />
                                <p className="mt-2 text-sm text-text-muted">Нет вопросов</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Информация о курсе</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-text-muted">Название курса</label>
                  <Input defaultValue={course.title} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Описание</label>
                  <textarea
                    defaultValue={course.description || ''}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>
                <Button className="w-full">
                  <Save className="h-4 w-4" />
                  Сохранить курс
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Статистика курса</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Уроков</span>
                    <span className="font-medium text-text">{lessons.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Вопросов</span>
                    <span className="font-medium text-text">{totalQuestions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Длительность</span>
                    <span className="font-medium text-text">
                      {formatDuration(totalDuration)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
