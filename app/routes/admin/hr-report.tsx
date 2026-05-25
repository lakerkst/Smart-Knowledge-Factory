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
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MetricCard } from '~/components/ui/metric-card'
import { getHrReportFn } from '~/lib/server-fns/statistics'
import { getCoursesFn } from '~/lib/server-fns/courses'
import { formatDate, cn } from '~/lib/utils'

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

function exportExcel(rows: HrRow[]) {
  const statusLabel = (s: string) =>
    s === 'completed' ? 'Завершён' : s === 'in_progress' ? 'В процессе' : 'Не начат'

  const data = [
    ['Сотрудник', 'Курс', 'Статус', 'Дата завершения', 'Результат теста', 'Дедлайн', 'Просрочено'],
    ...rows.map((r) => [
      r.employeeName,
      r.courseTitle,
      statusLabel(r.status),
      r.completedAt ? formatDate(r.completedAt) : '—',
      r.finalTestScore !== null ? `${r.finalTestScore}%` : '—',
      r.deadline ? formatDate(r.deadline) : '—',
      r.isOverdue ? 'Да' : 'Нет',
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [28, 32, 14, 16, 16, 14, 12].map((w) => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'HR Отчёт')
  XLSX.writeFile(wb, `hr_report_${new Date().toISOString().split('T')[0]}.xlsx`)
}

function HrReportPage() {
  const { hrReport, courses } = Route.useLoaderData()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')

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
    s === 'completed' ? 'Завершён' : s === 'in_progress' ? 'В процессе' : 'Не начат'
  const statusVariant = (s: string): 'success' | 'warning' | 'secondary' =>
    s === 'completed' ? 'success' : s === 'in_progress' ? 'warning' : 'secondary'

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'completed', label: 'Завершили' },
    { key: 'in_progress', label: 'В процессе' },
    { key: 'not_started', label: 'Не начали' },
    { key: 'overdue', label: `Просрочено (${overdue})` },
  ]

  return (
    <div>
      <Topbar
        title="HR-отчёт"
        subtitle="Прохождение обучения по сотрудникам"
      />

      <div className="p-6">
        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          {[
            {
              title: 'Назначений',
              value: total,
              icon: Users,
              subtitle: 'Всего курс × сотрудник',
            },
            {
              title: 'Завершили',
              value: completed,
              icon: CheckCircle2,
              subtitle: total > 0 ? `${Math.round((completed / total) * 100)}% от всех` : '—',
            },
            {
              title: 'В процессе',
              value: inProgress,
              icon: Clock,
              subtitle: 'Начали, но не завершили',
            },
            {
              title: 'Просрочено',
              value: overdue,
              icon: AlertTriangle,
              subtitle: 'Дедлайн истёк',
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
                Детализация
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  onClick={() => exportExcel(filtered)}
                  disabled={filtered.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  Скачать Excel
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
                    placeholder="Поиск по имени или курсу..."
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
                    <option value="all">Все курсы</option>
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
                    Нет назначенных курсов. Назначьте курсы сотрудникам в разделе «Сотрудники».
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Нет результатов</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light">
                        {['Сотрудник', 'Курс', 'Статус', 'Дата завершения', 'Тест', 'Дедлайн'].map((h) => (
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
                          className={cn(
                            'border-b border-border-light last:border-0 transition-colors',
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
                                  Просрочено
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
                    Показано {filtered.length} из {rows.length}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
