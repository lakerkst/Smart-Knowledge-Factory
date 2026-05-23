import { createFileRoute } from '@tanstack/react-router'
import {
  Users,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { MetricCard } from '~/components/ui/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card'
import { Progress } from '~/components/ui/progress'
import { Badge } from '~/components/ui/badge'
import { getCompanyStatsFn } from '~/lib/server-fns/statistics'
import { getEmployeesFn } from '~/lib/server-fns/employees'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export const Route = createFileRoute('/admin/')({
  loader: async ({ context }) => {
    const companyId = context.user.companyId!
    const [stats, employees] = await Promise.all([
      getCompanyStatsFn({ data: { companyId } }),
      getEmployeesFn({ data: { companyId } }),
    ])
    return { stats, employees }
  },
  component: AdminDashboard,
})

function AdminDashboard() {
  const { stats, employees } = Route.useLoaderData()

  const recentEmployees = employees
    .filter((e) => e.lastLoginAt)
    .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())
    .slice(0, 5)

  return (
    <div>
      <Topbar title="Дашборд" subtitle="Обзор обучения в вашей компании" />

      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="animate-fade-in" style={{ animationDelay: '0s', animationFillMode: 'both' }}>
            <MetricCard
              title="Сотрудники"
              value={stats.totals.employees}
              subtitle="Всего в компании"
              icon={Users}
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.05s', animationFillMode: 'both' }}>
            <MetricCard
              title="Курсы"
              value={stats.totals.courses}
              subtitle="Опубликовано"
              icon={BookOpen}
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <MetricCard
              title="Завершили обучение"
              value={stats.totals.completed}
              subtitle={`Из ${stats.totals.employees} сотрудников`}
              icon={GraduationCap}
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
            <MetricCard
              title="В процессе"
              value={stats.totals.inProgress}
              subtitle="Проходят курсы"
              icon={TrendingUp}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Активность за 14 дней
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={stats.activityLog}>
                    <defs>
                      <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 250)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid oklch(0.90 0.01 250)',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="logins"
                      name="Входы"
                      stroke="oklch(0.55 0.18 250)"
                      fill="url(#colorLogins)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Недавняя активность
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-surface-dim transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                        {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{emp.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={emp.progress} className="h-1.5 flex-1" />
                          <span className="text-xs text-text-muted shrink-0">{emp.progress}%</span>
                        </div>
                      </div>
                      <Badge variant={emp.progress === 100 ? 'success' : emp.progress > 0 ? 'warning' : 'secondary'}>
                        {emp.progress === 100 ? 'Готово' : emp.progress > 0 ? 'Учится' : 'Новый'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Прогресс по курсам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.courseStats.map((course) => (
                  <div key={course.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-text">{course.title}</p>
                        <p className="text-xs text-text-muted">{course.assignedCount} сотрудников назначено</p>
                      </div>
                      <span className="text-sm font-semibold text-text">{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
