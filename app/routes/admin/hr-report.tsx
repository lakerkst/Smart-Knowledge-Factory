import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  FileDown,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  XCircle,
  ChevronRight,
  BookOpen,
  HelpCircle,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MetricCard } from '~/components/ui/metric-card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog'
import { getHrReportFn, getEmployeeDetailFn } from '~/lib/server-fns/statistics'
import { getCoursesFn } from '~/lib/server-fns/courses'
import { formatDate, cn } from '~/lib/utils'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/admin/hr-report')({
  loader: async ({ context }) => {
    const companyId = context.user.companyId!
    const [hrReport, courses] = await Promise.all([
      getHrReportFn({ data: { companyId } }),
      getCoursesFn({ data: { companyId } }),
    ])
    return { hrReport, courses }
  },
  component: HrReportPage,
})

type HrRow = ReturnType<typeof Route.useLoaderData>['hrReport']['rows'][number]

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'not_started' | 'overdue'

function exportExcel(rows: HrRow[], statusLabel: (s: string) => string, headers: string[], sheetName: string) {
  const data = [
    headers,
    ...rows.map((r) => [
      r.employeeName,
      r.courseTitle,
      statusLabel(r.status),
      r.wrongCount,
      r.completedAt ? formatDate(r.completedAt) : '—',
      r.finalTestScore !== null ? `${r.finalTestScore}%` : '—',
      r.deadline ? formatDate(r.deadline) : '—',
      r.isOverdue ? '+' : '—',
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [28, 32, 14, 10, 16, 16, 14, 12].map((w) => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `hr_report_${new Date().toISOString().split('T')[0]}.xlsx`)
}

type DetailLesson = {
  id: string
  title: string
  orderIndex: number
  questions: { id: string; text: string; totalAttempts: number; wrongAttempts: number }[]
}

function HrReportPage() {
  const { t } = useTranslation()
  const { hrReport, courses } = Route.useLoaderData()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<HrRow | null>(null)
  const [detailLessons, setDetailLessons] = useState<DetailLesson[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = async (row: HrRow) => {
    setDetailRow(row)
    setDetailLessons([])
    setDetailLoading(true)
    setDetailOpen(true)
    try {
      const result = await getEmployeeDetailFn({ data: { userId: row.employeeId, courseId: row.courseId } })
      setDetailLessons(result.lessons)
    } finally {
      setDetailLoading(false)
    }
  }

  const rows = hrReport.rows

  // Metrics
  const total = rows.length
  const completed = rows.filter((r) => r.status === 'completed').length
  const inProgress = rows.filter((r) => r.status === 'in_progress').length
  const notStarted = rows.filter((r) => r.status === 'not_started').length
  const overdue = rows.filter((r) => r.isOverdue).length

  // Filtered rows
  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.employeeName.toLowerCase().includes(q) && !r.courseTitle.toLowerCase().includes(q))
        return false
    }
    if (courseFilter !== 'all' && r.courseId !== courseFilter) return false
    if (statusFilter === 'overdue') return r.isOverdue
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    return true
  })

  const statusLabel = (s: string) =>
    s === 'completed' ? t('hrReport.statusCompleted') : s === 'in_progress' ? t('hrReport.statusInProgress') : t('hrReport.statusNotStarted')
  const statusVariant = (s: string): 'success' | 'warning' | 'secondary' =>
    s === 'completed' ? 'success' : s === 'in_progress' ? 'warning' : 'secondary'

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'completed', label: t('employees.completed') },
    { key: 'in_progress', label: t('employees.inProgress') },
    { key: 'not_started', label: t('employees.notStarted') },
    { key: 'overdue', label: `${t('hrReport.overdue')} (${overdue})` },
  ]

  return (
    <div>
      <Topbar
        title={t('hrReport.title')}
        subtitle={t('hrReport.subtitle')}
      />

      <div className="p-6">
        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          {[
            {
              title: t('hrReport.assignments'),
              value: total,
              icon: Users,
              subtitle: t('hrReport.assignmentsSubtitle'),
            },
            {
              title: t('hrReport.completedTitle'),
              value: completed,
              icon: CheckCircle2,
              subtitle: total > 0 ? t('hrReport.completedSubtitle', { percent: Math.round((completed / total) * 100) }) : '—',
            },
            {
              title: t('hrReport.inProgressTitle'),
              value: inProgress,
              icon: Clock,
              subtitle: t('hrReport.inProgressSubtitle'),
            },
            {
              title: t('hrReport.overdueTitle'),
              value: overdue,
              icon: AlertTriangle,
              subtitle: t('hrReport.overdueSubtitle'),
            },
          ].map((m, i) => (
            <div
              key={m.title}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
            >
              <MetricCard {...m} />
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <FileDown className="h-5 w-5 text-primary" />
                {t('hrReport.details')}
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  onClick={() => exportExcel(filtered, statusLabel, t('hrReport.exportHeaders', { returnObjects: true }) as string[], t('hrReport.sheetName'))}
                  disabled={filtered.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('hrReport.downloadExcel')}
                </Button>
              </CardTitle>
            </CardHeader>

            <CardContent>
              {/* Filters */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('hrReport.searchPlaceholder')}
                    className="pl-9"
                  />
                </div>

                {/* Course filter */}
                {courses.length > 1 && (
                  <select
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="all">{t('hrReport.allCourses')}</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Status tabs */}
              <div className="mb-4 flex flex-wrap gap-2">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      'rounded-full px-3.5 py-1 text-xs font-medium transition-colors',
                      statusFilter === tab.key
                        ? tab.key === 'overdue'
                          ? 'bg-danger text-white shadow-sm'
                          : 'bg-primary text-white shadow-sm'
                        : 'bg-surface-dim text-text-muted hover:bg-surface-raised hover:text-text'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Table */}
              {rows.length === 0 ? (
                <div className="py-16 text-center">
                  <FileDown className="mx-auto h-10 w-10 text-text-muted/30 mb-3" />
                  <p className="text-sm text-text-muted">
                    {t('hrReport.noAssigned')}
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">{t('common.noResults')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light">
                        {[t('hrReport.employee'), t('hrReport.course'), t('common.status'), t('hrReport.errors'), t('hrReport.completionDate'), t('hrReport.test'), t('hrReport.deadline')].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted first:pl-0"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => (
                        <tr
                          key={`${row.employeeId}-${row.courseId}`}
                          onClick={() => openDetail(row)}
                          className={cn(
                            'border-b border-border-light last:border-0 transition-colors cursor-pointer',
                            row.isOverdue ? 'bg-danger-light/20 hover:bg-danger-light/30' : 'hover:bg-surface-dim/40'
                          )}
                        >
                          {/* Employee */}
                          <td className="py-3 pl-0 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary">
                                {row.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </div>
                              <span className="font-medium text-text">{row.employeeName}</span>
                              {row.isOverdue && (
                                <Badge variant="danger" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {t('hrReport.overdue')}
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Course */}
                          <td className="px-4 py-3 text-text-secondary max-w-[200px]">
                            <p className="truncate">{row.courseTitle}</p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(row.status)}>
                              {statusLabel(row.status)}
                            </Badge>
                          </td>

                          {/* Wrong answers count */}
                          <td className="px-4 py-3">
                            {row.wrongCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-danger-light px-2 py-0.5 text-xs font-semibold text-danger">
                                <XCircle className="h-3 w-3" />
                                {row.wrongCount}
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>

                          {/* Completion date */}
                          <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                            {row.completedAt ? formatDate(row.completedAt) : '—'}
                          </td>

                          {/* Final test score */}
                          <td className="px-4 py-3">
                            {row.finalTestScore !== null ? (
                              <span
                                className={cn(
                                  'text-sm font-semibold',
                                  row.finalTestScore >= 80 ? 'text-success' : 'text-warning'
                                )}
                              >
                                {row.finalTestScore}%
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>

                          {/* Deadline */}
                          <td className="px-4 py-3">
                            {row.deadline ? (
                              <span
                                className={cn(
                                  'flex items-center gap-1 text-xs whitespace-nowrap',
                                  row.isOverdue ? 'text-danger font-medium' : 'text-text-muted'
                                )}
                              >
                                <Calendar className="h-3 w-3 shrink-0" />
                                {formatDate(row.deadline)}
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-right text-xs text-text-muted">
                    {t('hrReport.shown', { shown: filtered.length, total: rows.length })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Employee detail modal ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                {detailRow?.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              {detailRow?.employeeName}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {detailRow?.courseTitle}
              {(detailRow?.wrongCount ?? 0) > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-danger-light px-2 py-0.5 text-xs font-semibold text-danger">
                  <XCircle className="h-3 w-3" />
                  {t('hrReport.errorsCount', { count: detailRow?.wrongCount ?? 0 })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : detailLessons.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">{t('hrReport.noData')}</p>
          ) : (
            <div className="space-y-4">
              {detailLessons.map((lesson, li) => (
                <div key={lesson.id} className="rounded-xl border border-border-light bg-surface p-4">
                  {/* Lesson header */}
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary">
                      {li + 1}
                    </div>
                    <p className="text-sm font-semibold text-text">{lesson.title}</p>
                  </div>

                  {lesson.questions.length === 0 ? (
                    <p className="text-xs text-text-muted pl-8">{t('hrReport.noQuestions')}</p>
                  ) : (
                    <div className="space-y-2 pl-8">
                      {lesson.questions.map((q, qi) => {
                        const notAttempted = q.totalAttempts === 0
                        const hasError = q.wrongAttempts > 0
                        return (
                          <div
                            key={q.id}
                            className={cn(
                              'flex items-start gap-3 rounded-lg p-3 text-xs',
                              notAttempted
                                ? 'bg-surface-dim text-text-muted'
                                : hasError
                                  ? 'bg-danger-light'
                                  : 'bg-success-light'
                            )}
                          >
                            {/* Question icon */}
                            <HelpCircle className={cn(
                              'mt-0.5 h-3.5 w-3.5 shrink-0',
                              notAttempted ? 'text-text-muted' : hasError ? 'text-danger' : 'text-success'
                            )} />

                            {/* Question text */}
                            <p className={cn(
                              'flex-1 leading-relaxed',
                              notAttempted ? 'text-text-muted' : hasError ? 'text-danger' : 'text-success'
                            )}>
                              <span className="font-medium">В{qi + 1}.</span> {q.text}
                            </p>

                            {/* Stats */}
                            <div className="shrink-0 text-right">
                              {notAttempted ? (
                                <span className="text-text-muted">{t('hrReport.notAnswered')}</span>
                              ) : (
                                <>
                                  <p className={hasError ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                                    {q.wrongAttempts > 0 ? t('hrReport.wrongCount', { count: q.wrongAttempts }) : t('hrReport.correct')}
                                  </p>
                                  <p className="text-text-muted">{t('hrReport.attemptsShort', { count: q.totalAttempts })}</p>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
