import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import {
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  TrendingUp,
  Clock,
  ChevronRight,
  Search,
  Download,
  AlertTriangle,
  Star,
  MessageSquare,
  Calendar,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { MetricCard } from '~/components/ui/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card'
import { Progress } from '~/components/ui/progress'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog'
import { getCompanyStatsFn, getQuestionStatsFn, getActivityLogFn, getHrReportFn } from '~/lib/server-fns/statistics'
import { getLessonFeedbackStatsFn } from '~/lib/server-fns/feedback'
import { DateRangePicker, type DateRange } from '~/components/ui/date-range-picker'
import { formatDate, cn } from '~/lib/utils'
import { useTranslation } from 'react-i18next'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export const Route = createFileRoute('/admin/statistics')({
  loader: async ({ context }) => {
    const companyId = context.user.companyId!
    const [stats, { questionStats }, feedbackStats, hrReport] = await Promise.all([
      getCompanyStatsFn({ data: { companyId } }),
      getQuestionStatsFn({ data: { companyId } }),
      getLessonFeedbackStatsFn({ data: { companyId } }),
      getHrReportFn({ data: { companyId } }),
    ])
    return { stats, questionStats, companyId, feedbackStats, hrReport }
  },
  component: StatisticsPage,
})

type Emp = ReturnType<typeof Route.useLoaderData>['stats']['employeeStats'][number]
type EmpCourse = Emp['courses'][number]
type EmpLesson = EmpCourse['lessons'][number]

// ─── Legacy CSV export (employee summary) ────────────────────────────────────
function exportCSV(employeeStats: Emp[], header: string[]) {
  const rows = employeeStats.map((emp) => [
    emp.name,
    emp.courses.length,
    emp.totalLessons,
    emp.completedLessons,
    emp.progress,
    emp.lastLoginAt ? formatDate(emp.lastLoginAt) : '—',
  ])
  const csv = [header, ...rows].map((r) => r.map(String).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `statistics_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function defaultRange14(): DateRange {
  const to = new Date(); to.setHours(23, 59, 59, 999)
  const from = new Date(); from.setDate(from.getDate() - 13); from.setHours(0, 0, 0, 0)
  return { from, to }
}

function StatisticsPage() {
  const { t } = useTranslation()
  const { stats, questionStats, companyId, feedbackStats, hrReport } = Route.useLoaderData()
  const { features } = Route.useRouteContext()
  const [selectedEmp, setSelectedEmp] = useState<Emp | null>(null)
  const [search, setSearch] = useState('')

  // Activity chart with custom date range
  const [activityRange, setActivityRange] = useState<DateRange>(defaultRange14)
  const [activityData, setActivityData] = useState<Array<{ date: string; logins: number; lessonsCompleted: number }>>(
    stats.activityLog
  )
  const [activityLoading, setActivityLoading] = useState(false)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    setActivityLoading(true)
    getActivityLogFn({ data: { companyId, dateFrom: activityRange.from.toISOString(), dateTo: activityRange.to.toISOString() } })
      .then(setActivityData)
      .finally(() => setActivityLoading(false))
  }, [activityRange.from.toISOString(), activityRange.to.toISOString()])

  const filteredEmployees = stats.employeeStats.filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase())
  )

  // Employees that have at least one overdue course
  const overdueEmployeeIds = new Set(
    hrReport.rows.filter((r) => r.isOverdue).map((r) => r.employeeId)
  )

  const courseBarData = stats.courseStats.map((course) => ({
    name: course.title.length > 20 ? course.title.slice(0, 20) + '...' : course.title,
    progress: course.progress,
    assigned: course.assignedCount,
  }))

  return (
    <div>
      <Topbar title={t('statistics.title')} subtitle={t('statistics.subtitle')} />

      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: t('nav.employees'), value: stats.totals.employees, icon: Users, subtitle: t('statistics.employeesInCompany') },
            { title: t('nav.courses'), value: stats.totals.courses, icon: BookOpen, subtitle: t('statistics.published') },
            { title: t('common.lessons'), value: stats.totals.lessons, icon: GraduationCap, subtitle: t('statistics.totalLessons') },
            { title: t('dashboard.completedTraining'), value: stats.totals.completed, icon: CheckCircle2, subtitle: t('statistics.completedOf', { count: stats.totals.employees }) },
          ].map((metric, i) => (
            <div
              key={metric.title}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
            >
              <MetricCard {...metric} />
            </div>
          ))}
        </div>

        {(features.statActivity || features.statEmployeeStatus) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {features.statActivity && (
          <div className="animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-3">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t('statistics.activity')}
                  </span>
                  <DateRangePicker value={activityRange} onChange={setActivityRange} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-text-muted">{t('common.loading')}</div>
                ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorLessons" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.17 145)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="oklch(0.65 0.17 145)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 250)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="logins" name={t('statistics.loginsChart')} stroke="oklch(0.55 0.18 250)" fill="url(#colorActivity)" strokeWidth={2} />
                    <Area type="monotone" dataKey="lessonsCompleted" name={t('statistics.lessonsChart')} stroke="oklch(0.65 0.17 145)" fill="url(#colorLessons)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
          )}

          {features.statEmployeeStatus && (
          <div className="animate-fade-in" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {t('statistics.employeeStatuses')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats.statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {stats.statusDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
        )}

        {features.statCourseProgress && (
        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {t('statistics.courseProgress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(160, stats.courseStats.length * 48)}>
                <BarChart data={courseBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 250)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: 'oklch(0.45 0.02 250)' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="progress" name={t('statistics.progressPercent')} fill="oklch(0.55 0.18 250)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Question analytics */}
        {features.statHardQuestions && questionStats.length > 0 && (
          <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.33s', animationFillMode: 'both' }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  {t('statistics.hardQuestions')}
                  <span className="ml-auto text-xs font-normal text-text-muted">{t('statistics.hardQuestionsHint')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light text-xs font-semibold uppercase tracking-wider text-text-muted">
                        <th className="pb-2.5 pr-4 text-left">{t('statistics.question')}</th>
                        <th className="pb-2.5 pr-4 text-left">{t('statistics.lessonCourse')}</th>
                        <th className="pb-2.5 pr-3 text-right w-20">{t('statistics.attempts')}</th>
                        <th className="pb-2.5 text-right w-28">{t('statistics.errorPercent')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionStats.map((q) => (
                        <tr key={q.questionId} className="border-b border-border-light last:border-0">
                          <td className="py-3 pr-4 max-w-xs">
                            <p className="line-clamp-2 text-text">{q.questionText}</p>
                          </td>
                          <td className="py-3 pr-4">
                            <p className="text-text-secondary truncate max-w-[180px]">{q.lessonTitle}</p>
                            <p className="text-xs text-text-muted truncate max-w-[180px]">{q.courseTitle}</p>
                          </td>
                          <td className="py-3 pr-3 text-right text-text-muted">{q.totalAttempts}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-surface-dim overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-danger"
                                  style={{ width: `${q.errorRate}%` }}
                                />
                              </div>
                              <span className={cn(
                                'text-xs font-semibold w-8 text-right',
                                q.errorRate >= 60 ? 'text-danger' : q.errorRate >= 35 ? 'text-warning' : 'text-text-muted'
                              )}>
                                {q.errorRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Feedback / Ratings */}
        {(features.statLessonRating || features.statComments) && feedbackStats.lessonStats.length > 0 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            {features.statLessonRating && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-warning" />
                  {t('statistics.lessonRating')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {feedbackStats.lessonStats
                    .slice()
                    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
                    .map((ls) => (
                      <div key={ls.lessonId} className="flex items-center gap-3 rounded-lg border border-border-light px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{ls.lessonTitle}</p>
                          <p className="text-xs text-text-muted truncate">{ls.courseTitle}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            <span className="text-sm font-semibold text-text">
                              {ls.avgRating != null ? ls.avgRating.toFixed(1) : '—'}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted">{t('statistics.ratingsCount', { count: ls.feedbackCount })}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
            )}

            {features.statComments && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  {t('statistics.recentComments')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedbackStats.recentComments.length === 0 ? (
                  <p className="text-sm text-text-muted py-4 text-center">{t('statistics.noComments')}</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {feedbackStats.recentComments.map((c) => (
                      <div key={c.id} className="rounded-xl border border-border-light p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-text truncate">{c.userName} · {c.lessonTitle}</p>
                            <p className="text-xs text-text-muted truncate">{c.courseTitle}</p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={cn('h-3 w-3', s <= c.rating ? 'fill-warning text-warning' : 'text-surface-dim')} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-text-secondary leading-snug">{c.comment}</p>
                        <p className="mt-1.5 text-xs text-text-muted">{formatDate(c.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        )}

        {/* Employee list — click to drill down */}
        {features.statEmployeeProgress && (
        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {t('statistics.employeeProgress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Search + export bar */}
              <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('statistics.searchByName')}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportCSV(stats.employeeStats, t('statistics.exportHeader', { returnObjects: true }) as string[])}
                  className="shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>

              {stats.employeeStats.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">{t('statistics.noEmployees')}</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">{t('common.noResults')}</p>
              ) : (
                <div className="space-y-2">
                  {filteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmp(emp)}
                      className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-dim text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                        {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-text truncate">{emp.name}</p>
                          {overdueEmployeeIds.has(emp.id) && (
                            <Badge variant="danger" className="shrink-0 text-[10px] px-1.5 py-0">
                              {t('statistics.overdue')}
                            </Badge>
                          )}
                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-muted">{emp.completedLessons}/{emp.totalLessons}</span>
                            <Badge variant={emp.progress === 100 ? 'success' : emp.progress > 0 ? 'warning' : 'secondary'}>
                              {emp.progress}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={emp.progress} className="h-1.5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {/* Employee detail dialog */}
      <Dialog open={!!selectedEmp} onOpenChange={(open) => !open && setSelectedEmp(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedEmp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedEmp.name}
                  {overdueEmployeeIds.has(selectedEmp.id) && (
                    <Badge variant="danger" className="text-xs">{t('statistics.overdue')}</Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-4">
                  <span>{t('statistics.lessonsOf', { completed: selectedEmp.completedLessons, total: selectedEmp.totalLessons })}</span>
                  {selectedEmp.lastLoginAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(selectedEmp.lastLoginAt)}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-1 space-y-4">
                {selectedEmp.courses.length === 0 ? (
                  <p className="text-sm text-text-muted">{t('statistics.coursesNotAssigned')}</p>
                ) : (
                  selectedEmp.courses.map((course: EmpCourse) => (
                    <div key={course.courseId}>
                      {/* Course heading with deadline info */}
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                          {course.courseTitle}
                        </p>
                        {course.deadline && (
                          <span className={cn(
                            'flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5',
                            course.isOverdue
                              ? 'bg-danger-light text-danger font-medium'
                              : 'bg-surface-dim text-text-muted'
                          )}>
                            <Calendar className="h-3 w-3 shrink-0" />
                            {t('statistics.untilDate', { date: formatDate(course.deadline) })}
                            {course.isOverdue && ` · ${t('statistics.overdueText')}`}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {course.lessons.map((lesson: EmpLesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 rounded-lg border border-border-light px-3 py-2.5"
                          >
                            <LessonStatusIcon status={lesson.status} />
                            <span className={cn(
                              'flex-1 truncate text-sm',
                              lesson.status === 'passed' ? 'text-text' : 'text-text-muted'
                            )}>
                              {lesson.title}
                            </span>
                            <div className="shrink-0 text-right">
                              {lesson.status === 'passed' && lesson.completedAt && (
                                <p className="text-xs text-text-muted">
                                  {formatDate(lesson.completedAt)}
                                </p>
                              )}
                              {lesson.attemptCount > 0 && (
                                <p className="text-xs text-text-muted">
                                  {t('statistics.attemptsShort', { count: lesson.attemptCount })}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LessonStatusIcon({ status }: { status: string | null }) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
  if (status === 'in_progress') return (
    <div className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  )
  return <div className="h-4 w-4 shrink-0 rounded-full border-2 border-border" />
}
