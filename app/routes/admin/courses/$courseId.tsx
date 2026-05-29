import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  Plus,
  HelpCircle,
  Clock,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  ClipboardCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { TimecodeInput } from '~/components/ui/timecode-input'
import { ImageUpload } from '~/components/ui/image-upload'
import {
  getCourseFn,
  updateCourseFn,
  createLessonFn,
  updateLessonFn,
  deleteLessonFn,
  reorderLessonFn,
  createQuestionFn,
  updateQuestionFn,
  deleteQuestionFn,
} from '~/lib/server-fns/courses'
import {
  getFinalTestFn,
  updateCourseFinalTestFn,
  createFinalTestQuestionFn,
  updateFinalTestQuestionFn,
  deleteFinalTestQuestionFn,
} from '~/lib/server-fns/final-test'
import { formatDuration, cn } from '~/lib/utils'
import { toast } from '~/components/ui/toaster'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/admin/courses/$courseId')({
  loader: async ({ params }) => {
    const [result, finalTest] = await Promise.all([
      getCourseFn({ data: { courseId: params.courseId } }),
      getFinalTestFn({ data: { courseId: params.courseId } }),
    ])
    return { course: result.course, finalTest }
  },
  component: CourseEditorPage,
})

type LessonQuestion = {
  id: string
  text: string
  options: string[]
  correctIndex: number
  timecodeStart: number
  timecodeTrigger: number
}

function CourseEditorPage() {
  const { t } = useTranslation()
  const { course, finalTest: initialFinalTest } = Route.useLoaderData()
  const router = useRouter()
  const lessons = course?.lessons || []

  const [expandedLesson, setExpandedLesson] = useState<string | null>(
    lessons[0]?.id || null
  )

  // Course fields
  const [courseTitle, setCourseTitle] = useState(course?.title || '')
  const [courseDesc, setCourseDesc] = useState(course?.description || '')
  const [courseCover, setCourseCover] = useState(course?.coverImage || '')
  const [saving, setSaving] = useState(false)

  // Add lesson dialog
  const [showAddLesson, setShowAddLesson] = useState(false)
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [newLessonVimeo, setNewLessonVimeo] = useState('')
  const [newLessonDuration, setNewLessonDuration] = useState('')

  // Add question dialog
  const [showAddQuestion, setShowAddQuestion] = useState<string | null>(null)
  const [qText, setQText] = useState('')
  const [qOptions, setQOptions] = useState(['', '', '', ''])
  const [qCorrect, setQCorrect] = useState(0)
  const [qTrigger, setQTrigger] = useState(0)
  const [qStart, setQStart] = useState(0)

  // Edit question dialog
  const [editingQuestion, setEditingQuestion] = useState<{
    questionId: string
    lessonId: string
  } | null>(null)
  const [eqText, setEqText] = useState('')
  const [eqOptions, setEqOptions] = useState(['', '', '', ''])
  const [eqCorrect, setEqCorrect] = useState(0)
  const [eqTrigger, setEqTrigger] = useState(0)
  const [eqStart, setEqStart] = useState(0)

  // Quiz mode
  const [quizMode, setQuizMode] = useState<'confirm' | 'instant'>(
    (course?.quizMode as 'confirm' | 'instant') || 'confirm'
  )

  // Final test state
  const [ftEnabled, setFtEnabled] = useState(initialFinalTest.enabled)
  const [ftPassScore, setFtPassScore] = useState(String(initialFinalTest.passingScore))
  const [ftSaving, setFtSaving] = useState(false)
  const [showAddFTQ, setShowAddFTQ] = useState(false)
  const [ftqText, setFtqText] = useState('')
  const [ftqOptions, setFtqOptions] = useState(['', '', '', ''])
  const [ftqCorrect, setFtqCorrect] = useState(0)
  const [editingFTQ, setEditingFTQ] = useState<{ id: string; text: string; options: string[]; correctIndex: number } | null>(null)
  const [eftqText, setEftqText] = useState('')
  const [eftqOptions, setEftqOptions] = useState(['', '', '', ''])
  const [eftqCorrect, setEftqCorrect] = useState(0)

  if (!course) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-muted">{t('courseEditor.courseNotFound')}</p>
      </div>
    )
  }

  const totalQuestions = lessons.reduce((acc, l) => acc + l.questions.length, 0)
  const totalDuration = lessons.reduce((acc, l) => acc + l.duration, 0)

  const handleSaveCourse = async () => {
    setSaving(true)
    try {
      await updateCourseFn({
        data: { courseId: course.id, title: courseTitle, description: courseDesc, coverImage: courseCover, quizMode },
      })
      router.invalidate()
      toast.success(t('courseEditor.courseSaved'))
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePublish = async () => {
    await updateCourseFn({ data: { courseId: course.id, isPublished: !course.isPublished } })
    router.invalidate()
    toast.success(t('courseEditor.publishToggle', { status: course.isPublished ? t('courseEditor.draftStatus') : t('courseEditor.publishedStatus') }))
  }

  const handleReorder = async (lessonId: string, direction: 'up' | 'down') => {
    const result = await reorderLessonFn({ data: { lessonId, direction } })
    if ('error' in result && result.error) { toast.error(result.error); return }
    router.invalidate()
  }

  const handleAddLesson = async () => {
    if (!newLessonTitle.trim()) return
    await createLessonFn({
      data: {
        courseId: course.id,
        title: newLessonTitle.trim(),
        vimeoId: newLessonVimeo.trim() || undefined,
        duration: parseInt(newLessonDuration) || 0,
      },
    })
    setShowAddLesson(false)
    setNewLessonTitle(''); setNewLessonVimeo(''); setNewLessonDuration('')
    router.invalidate()
    toast.success(t('courseEditor.lessonAdded'))
  }

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!confirm(t('courseEditor.confirmDeleteLesson', { title }))) return
    await deleteLessonFn({ data: { lessonId } })
    router.invalidate()
    toast.success(t('courseEditor.lessonDeleted'))
  }

  const handleSaveLesson = async (lessonId: string, title: string, vimeoId: string) => {
    await updateLessonFn({ data: { lessonId, title, vimeoId } })
    router.invalidate()
    toast.success(t('courseEditor.lessonSaved'))
  }

  const handleAddQuestion = async () => {
    if (!showAddQuestion || !qText.trim()) return
    const filled = qOptions.filter((o) => o.trim())
    if (filled.length < 2) return
    await createQuestionFn({
      data: { lessonId: showAddQuestion, text: qText.trim(), options: filled, correctIndex: qCorrect, timecodeStart: qStart, timecodeTrigger: qTrigger },
    })
    setShowAddQuestion(null)
    resetAddForm()
    router.invalidate()
    toast.success(t('courseEditor.questionAdded'))
  }

  const openEditQuestion = (lessonId: string, q: LessonQuestion) => {
    setEditingQuestion({ questionId: q.id, lessonId })
    setEqText(q.text)
    const opts = [...q.options]
    while (opts.length < 4) opts.push('')
    setEqOptions(opts)
    setEqCorrect(q.correctIndex)
    setEqTrigger(q.timecodeTrigger)
    setEqStart(q.timecodeStart)
  }

  const handleSaveEditQuestion = async () => {
    if (!editingQuestion || !eqText.trim()) return
    const filled = eqOptions.filter((o) => o.trim())
    if (filled.length < 2) return
    await updateQuestionFn({
      data: {
        questionId: editingQuestion.questionId,
        text: eqText.trim(),
        options: filled,
        correctIndex: eqCorrect,
        timecodeStart: eqStart,
        timecodeTrigger: eqTrigger,
      },
    })
    setEditingQuestion(null)
    router.invalidate()
    toast.success(t('courseEditor.questionUpdated'))
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm(t('courseEditor.confirmDeleteQuestion'))) return
    await deleteQuestionFn({ data: { questionId } })
    router.invalidate()
    toast.success(t('courseEditor.questionDeleted'))
  }

  const resetAddForm = () => {
    setQText(''); setQOptions(['', '', '', '']); setQCorrect(0); setQTrigger(0); setQStart(0)
  }

  const handleSaveFinalTestSettings = async () => {
    if (!course) return
    setFtSaving(true)
    try {
      await updateCourseFinalTestFn({
        data: { courseId: course.id, finalTestEnabled: ftEnabled, passingScore: parseInt(ftPassScore) || 80 },
      })
      router.invalidate()
      toast.success(t('courseEditor.finalTestSettings'))
    } finally {
      setFtSaving(false)
    }
  }

  const handleAddFTQ = async () => {
    if (!course || !ftqText.trim()) return
    const filled = ftqOptions.filter((o) => o.trim())
    if (filled.length < 2) return
    await createFinalTestQuestionFn({ data: { courseId: course.id, text: ftqText.trim(), options: filled, correctIndex: ftqCorrect } })
    setShowAddFTQ(false)
    setFtqText(''); setFtqOptions(['', '', '', '']); setFtqCorrect(0)
    router.invalidate()
    toast.success(t('courseEditor.questionAdded'))
  }

  const handleSaveEditFTQ = async () => {
    if (!editingFTQ || !eftqText.trim()) return
    const filled = eftqOptions.filter((o) => o.trim())
    if (filled.length < 2) return
    await updateFinalTestQuestionFn({ data: { questionId: editingFTQ.id, text: eftqText.trim(), options: filled, correctIndex: eftqCorrect } })
    setEditingFTQ(null)
    router.invalidate()
    toast.success(t('courseEditor.questionUpdated'))
  }

  const handleDeleteFTQ = async (questionId: string) => {
    if (!confirm(t('courseEditor.confirmDeleteFinalQuestion'))) return
    await deleteFinalTestQuestionFn({ data: { questionId } })
    router.invalidate()
    toast.success(t('courseEditor.questionDeleted'))
  }

  const openEditFTQ = (q: { id: string; text: string; options: string[]; correctIndex: number }) => {
    setEditingFTQ(q)
    setEftqText(q.text)
    const opts = [...q.options]; while (opts.length < 4) opts.push('')
    setEftqOptions(opts)
    setEftqCorrect(q.correctIndex)
  }

  return (
    <div>
      <Topbar title={course.title} subtitle={t('courseEditor.subtitle')} />

      <div className="p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/admin/courses" className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t('courseEditor.backToCourses')}
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleTogglePublish}>
              {course.isPublished ? t('courseEditor.unpublish') : t('courseEditor.publish')}
            </Button>
            <Badge variant={course.isPublished ? 'success' : 'secondary'}>
              {course.isPublished ? t('courseEditor.publishedStatus') : t('courseEditor.draftStatus')}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lessons list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">{t('courseEditor.lessonsTitle', { count: lessons.length })}</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowAddLesson(true)}>
                <Plus className="h-3.5 w-3.5" /> {t('courseEditor.addLesson')}
              </Button>
            </div>

            {lessons.map((lesson, index) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                index={index}
                isFirst={index === 0}
                isLast={index === lessons.length - 1}
                isExpanded={expandedLesson === lesson.id}
                onToggle={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
                onDelete={() => handleDeleteLesson(lesson.id, lesson.title)}
                onSave={(title, vimeoId) => handleSaveLesson(lesson.id, title, vimeoId)}
                onMoveUp={() => handleReorder(lesson.id, 'up')}
                onMoveDown={() => handleReorder(lesson.id, 'down')}
                onAddQuestion={() => setShowAddQuestion(lesson.id)}
                onEditQuestion={(q) => openEditQuestion(lesson.id, q)}
                onDeleteQuestion={handleDeleteQuestion}
              />
            ))}

            {lessons.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <HelpCircle className="mx-auto h-8 w-8 text-text-muted" />
                <p className="mt-3 text-sm text-text-muted">{t('courseEditor.noLessonsYet')}</p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowAddLesson(true)}>
                  <Plus className="h-3.5 w-3.5" /> {t('courseEditor.addFirstLesson')}
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('courseEditor.courseInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-text-muted">{t('courseEditor.courseTitle')}</label>
                  <Input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">{t('common.description')}</label>
                  <textarea
                    value={courseDesc}
                    onChange={(e) => setCourseDesc(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">{t('courseEditor.cover')}</label>
                  <ImageUpload value={courseCover} onChange={setCourseCover} />
                  {/* URL fallback */}
                  <Input
                    value={courseCover}
                    onChange={(e) => setCourseCover(e.target.value)}
                    placeholder={t('courseEditor.pasteUrl')}
                    className="mt-2 text-xs"
                  />
                </div>
                <Button className="w-full" onClick={handleSaveCourse} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? t('common.saving') : t('courseEditor.saveCourse')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('courseEditor.courseStats')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('courseEditor.lessonsLabel')}</span>
                    <span className="font-medium">{lessons.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('courseEditor.questionsLabel')}</span>
                    <span className="font-medium">{totalQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('courseEditor.durationLabel')}</span>
                    <span className="font-medium">{formatDuration(totalDuration)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quiz mode card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  {t('courseEditor.testMode')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <button
                    onClick={() => setQuizMode('confirm')}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                      quizMode === 'confirm' ? 'border-primary bg-primary-50' : 'border-border-light hover:border-border'
                    )}
                  >
                    <div className={cn('h-3 w-3 rounded-full shrink-0', quizMode === 'confirm' ? 'bg-primary' : 'bg-border')} />
                    <div>
                      <p className="text-sm font-medium text-text">{t('courseEditor.withConfirmation')}</p>
                      <p className="text-xs text-text-muted">{t('courseEditor.withConfirmationDesc')}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setQuizMode('instant')}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                      quizMode === 'instant' ? 'border-primary bg-primary-50' : 'border-border-light hover:border-border'
                    )}
                  >
                    <div className={cn('h-3 w-3 rounded-full shrink-0', quizMode === 'instant' ? 'bg-primary' : 'bg-border')} />
                    <div>
                      <p className="text-sm font-medium text-text">{t('courseEditor.noConfirmation')}</p>
                      <p className="text-xs text-text-muted">{t('courseEditor.noConfirmationDesc')}</p>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-3">{t('courseEditor.testModeHint')}</p>
              </CardContent>
            </Card>

            {/* Final Test card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  {t('courseEditor.finalTest')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text">{t('courseEditor.enableTest')}</p>
                    <p className="text-xs text-text-muted mt-0.5">{t('courseEditor.enableTestHint')}</p>
                  </div>
                  <button onClick={() => setFtEnabled(!ftEnabled)} className="text-primary">
                    {ftEnabled
                      ? <ToggleRight className="h-7 w-7" />
                      : <ToggleLeft className="h-7 w-7 text-text-muted" />}
                  </button>
                </div>

                {/* Passing score */}
                <div>
                  <label className="text-xs font-medium text-text-muted">{t('courseEditor.minScore')}</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={ftPassScore}
                      onChange={(e) => setFtPassScore(e.target.value)}
                      className="w-20 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <span className="text-sm text-text-muted">{t('courseEditor.outOf100')}</span>
                  </div>
                </div>

                <Button size="sm" className="w-full" onClick={handleSaveFinalTestSettings} disabled={ftSaving}>
                  <Save className="h-3.5 w-3.5" />
                  {ftSaving ? t('common.saving') : t('courseEditor.saveSettings')}
                </Button>

                {/* Questions list */}
                <div className="border-t border-border-light pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-text-muted">
                      {t('courseEditor.questionsCount', { count: initialFinalTest.questions.length })}
                    </p>
                    <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowAddFTQ(true)}>
                      <Plus className="h-3 w-3" /> {t('common.add')}
                    </Button>
                  </div>

                  {initialFinalTest.questions.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-3">{t('courseEditor.noQuestions')}</p>
                  ) : (
                    <div className="space-y-2">
                      {initialFinalTest.questions.map((q, i) => (
                        <div key={q.id} className="rounded-lg border border-border-light p-2.5">
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 text-xs font-bold text-primary">{i + 1}.</span>
                            <p className="flex-1 text-xs text-text leading-tight">{q.text}</p>
                            <div className="flex shrink-0 gap-1">
                              <button onClick={() => openEditFTQ(q)} className="text-text-muted hover:text-text">
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDeleteFTQ(q.id)} className="text-danger hover:text-danger/80">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {q.options.map((opt, oi) => (
                              <span key={oi} className={cn(
                                'rounded px-1.5 py-0.5 text-[10px]',
                                oi === q.correctIndex ? 'bg-success-light text-success font-medium' : 'bg-surface-dim text-text-muted'
                              )}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Lesson Dialog */}
      <Dialog open={showAddLesson} onOpenChange={setShowAddLesson}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('courseEditor.newLesson')}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} placeholder={t('courseEditor.lessonTitle')} />
            <div className="grid grid-cols-2 gap-4">
              <Input value={newLessonVimeo} onChange={(e) => setNewLessonVimeo(e.target.value)} placeholder="Vimeo ID" />
              <Input type="number" value={newLessonDuration} onChange={(e) => setNewLessonDuration(e.target.value)} placeholder={t('courseEditor.durationSec')} />
            </div>
            <Button onClick={handleAddLesson} disabled={!newLessonTitle.trim()} className="w-full">
              {t('courseEditor.addLesson')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Final Test Question Dialog */}
      <Dialog open={showAddFTQ} onOpenChange={(o) => { if (!o) setShowAddFTQ(false) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('courseEditor.newFinalQuestion')}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.questionText')}</label>
              <Input value={ftqText} onChange={(e) => setFtqText(e.target.value)} placeholder="..." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.answerOptions')}</label>
              <div className="space-y-2">
                {ftqOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button type="button" onClick={() => setFtqCorrect(i)}
                      className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                        ftqCorrect === i ? 'bg-success text-white' : 'bg-surface-dim text-text-muted hover:bg-surface-dim/80')}>
                      {String.fromCharCode(65 + i)}
                    </button>
                    <Input value={opt} onChange={(e) => { const n = [...ftqOptions]; n[i] = e.target.value; setFtqOptions(n) }}
                      placeholder={t('courseEditor.optionLabel', { letter: String.fromCharCode(65 + i) })} className="flex-1" />
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleAddFTQ} disabled={!ftqText.trim() || ftqOptions.filter((o) => o.trim()).length < 2} className="w-full">
              {t('courseEditor.addQuestion')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Final Test Question Dialog */}
      <Dialog open={!!editingFTQ} onOpenChange={(o) => { if (!o) setEditingFTQ(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('courseEditor.editQuestion')}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.questionText')}</label>
              <Input value={eftqText} onChange={(e) => setEftqText(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.answerOptions')}</label>
              <div className="space-y-2">
                {eftqOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button type="button" onClick={() => setEftqCorrect(i)}
                      className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                        eftqCorrect === i ? 'bg-success text-white' : 'bg-surface-dim text-text-muted hover:bg-surface-dim/80')}>
                      {String.fromCharCode(65 + i)}
                    </button>
                    <Input value={opt} onChange={(e) => { const n = [...eftqOptions]; n[i] = e.target.value; setEftqOptions(n) }}
                      placeholder={t('courseEditor.optionLabel', { letter: String.fromCharCode(65 + i) })} className="flex-1" />
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveEditFTQ} disabled={!eftqText.trim() || eftqOptions.filter((o) => o.trim()).length < 2} className="w-full">
              {t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Question Dialog */}
      <QuestionDialog
        open={!!showAddQuestion}
        title={t('courseEditor.newQuestion')}
        submitLabel={t('courseEditor.addQuestion')}
        text={qText} onTextChange={setQText}
        options={qOptions} onOptionsChange={setQOptions}
        correct={qCorrect} onCorrectChange={setQCorrect}
        trigger={qTrigger} onTriggerChange={setQTrigger}
        start={qStart} onStartChange={setQStart}
        onClose={() => { setShowAddQuestion(null); resetAddForm() }}
        onSubmit={handleAddQuestion}
      />

      {/* Edit Question Dialog */}
      <QuestionDialog
        open={!!editingQuestion}
        title={t('courseEditor.editQuestion')}
        submitLabel={t('common.save')}
        text={eqText} onTextChange={setEqText}
        options={eqOptions} onOptionsChange={setEqOptions}
        correct={eqCorrect} onCorrectChange={setEqCorrect}
        trigger={eqTrigger} onTriggerChange={setEqTrigger}
        start={eqStart} onStartChange={setEqStart}
        onClose={() => setEditingQuestion(null)}
        onSubmit={handleSaveEditQuestion}
      />
    </div>
  )
}

// ---- Shared Question Dialog ----
function QuestionDialog({
  open, title, submitLabel,
  text, onTextChange,
  options, onOptionsChange,
  correct, onCorrectChange,
  trigger, onTriggerChange,
  start, onStartChange,
  onClose, onSubmit,
}: {
  open: boolean; title: string; submitLabel: string
  text: string; onTextChange: (v: string) => void
  options: string[]; onOptionsChange: (v: string[]) => void
  correct: number; onCorrectChange: (v: number) => void
  trigger: number; onTriggerChange: (v: number) => void
  start: number; onStartChange: (v: number) => void
  onClose: () => void; onSubmit: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.questionText')}</label>
            <Input value={text} onChange={(e) => onTextChange(e.target.value)} placeholder="Что такое...?" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.answerOptions')}</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCorrectChange(i)}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                      correct === i ? 'bg-success text-white' : 'bg-surface-dim text-text-muted hover:bg-surface-dim/80'
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => { const n = [...options]; n[i] = e.target.value; onOptionsChange(n) }}
                    placeholder={t('courseEditor.optionLabel', { letter: String.fromCharCode(65 + i) })}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-muted">{t('courseEditor.clickLetter')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.timecode')}</label>
              <TimecodeInput value={trigger} onChange={onTriggerChange} placeholder="01:00" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('courseEditor.returnTo')}</label>
              <TimecodeInput value={start} onChange={onStartChange} placeholder="00:30" />
            </div>
          </div>
          <p className="text-xs text-text-muted -mt-2">{t('courseEditor.formatMMSS')}</p>
          <Button onClick={onSubmit} disabled={!text.trim() || options.filter((o) => o.trim()).length < 2} className="w-full">
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Lesson Card ----
function LessonCard({
  lesson, index, isFirst, isLast, isExpanded,
  onToggle, onDelete, onSave, onMoveUp, onMoveDown,
  onAddQuestion, onEditQuestion, onDeleteQuestion,
}: {
  lesson: {
    id: string; title: string; vimeoId: string | null; duration: number
    questions: LessonQuestion[]
  }
  index: number; isFirst: boolean; isLast: boolean; isExpanded: boolean
  onToggle: () => void; onDelete: () => void
  onSave: (title: string, vimeoId: string) => void
  onMoveUp: () => void; onMoveDown: () => void
  onAddQuestion: () => void
  onEditQuestion: (q: LessonQuestion) => void
  onDeleteQuestion: (id: string) => void
}) {
  const { t } = useTranslation()
  const [editTitle, setEditTitle] = useState(lesson.title)
  const [editVimeo, setEditVimeo] = useState(lesson.vimeoId || '')

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}>
      <Card className="overflow-hidden">
        <button
          onClick={onToggle}
          className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-dim/50 transition-colors"
        >
          <div className="flex shrink-0 flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={isFirst} onClick={onMoveUp}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-surface-dim hover:text-text disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={isLast} onClick={onMoveDown}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-surface-dim hover:text-text disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">{lesson.title}</p>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(lesson.duration)}</span>
              <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{t('courseEditor.questionsShort', { count: lesson.questions.length })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={(e) => { e.stopPropagation(); onDelete() }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {isExpanded ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border-light animate-fade-in">
            <div className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-muted">{t('common.title')}</label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Vimeo ID</label>
                  <Input value={editVimeo} onChange={(e) => setEditVimeo(e.target.value)} placeholder="123456789" className="mt-1" />
                </div>
              </div>
              <Button size="sm" onClick={() => onSave(editTitle, editVimeo)}>
                <Save className="h-3.5 w-3.5" /> {t('courseEditor.saveLesson')}
              </Button>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-text-muted">{t('courseEditor.questionsCount', { count: lesson.questions.length })}</label>
                  <Button variant="secondary" size="sm" onClick={onAddQuestion}>
                    <Plus className="h-3 w-3" /> {t('common.add')}
                  </Button>
                </div>

                {lesson.questions.length > 0 ? (
                  <div className="space-y-2">
                    {lesson.questions.map((q) => (
                      <div key={q.id} className="rounded-xl border border-border-light p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text">{q.text}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {q.options.map((opt, oi) => (
                                <span key={oi} className={cn(
                                  'inline-flex items-center rounded-lg px-2 py-1 text-xs',
                                  oi === q.correctIndex ? 'bg-success-light text-success font-medium' : 'bg-surface-dim text-text-muted'
                                )}>
                                  {String.fromCharCode(65 + oi)}. {opt}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                              <span>{t('courseEditor.timecodeTrigger')}: {formatDuration(q.timecodeTrigger)}</span>
                              <span>{t('courseEditor.timecodeReturn')}: {formatDuration(q.timecodeStart)}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted hover:text-text"
                              onClick={() => onEditQuestion(q)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-danger"
                              onClick={() => onDeleteQuestion(q.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center">
                    <HelpCircle className="mx-auto h-6 w-6 text-text-muted" />
                    <p className="mt-2 text-sm text-text-muted">{t('courseEditor.noQuestions')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
