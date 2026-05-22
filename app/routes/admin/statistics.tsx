import { createFileRoute } from '@tanstack/react-router'
import {
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { MetricCard } from '~/components/ui/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card'
import { Progress } from '~/components/ui/progress'
import { Badge } from '~/components/ui/badge'
import {
  mockUsers,
  mockCourses,
  mockLessons,
  mockLessonProgress,
  mockCourseAssignments,
  mockActivityLog,
} from '~/lib/mock-data'
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
  component: StatisticsPage,
})

function StatisticsPage() {
  const { user } = Route.useRouteContext()
  const companyId = user.companyId

  const employees = mockUsers.filter(
    (u) => u.companyId === companyId && u.role === 'employee'
  )
  const courses = mockCourses.filter((c) => c.companyId === companyId)
  const lessons = mockLessons.filter((l) => courses.some((c) => c.id === l.courseId))
  const employeeIds = employees.map((e) => e.id)
  const progress = mockLessonProgress.filter((lp) => employeeIds.includes(lp.userId))

  const completedAll = employees.filter((emp) => {
    const assigned = mockCourseAssignments.filter((a) => a.userId === emp.id)
    if (assigned.length === 0) return false
    const total = assigned.reduce(
      (acc, a) => acc + mockLessons.filter((l) => l.courseId === a.courseId).length,
      0
    )
    const done = progress.filter((lp) => lp.userId === emp.id && lp.status === 'passed').length
    return done >= total && total > 0
  }).length

  const inProgressCount = employees.filter((emp) => {
    const empProg = progress.filter((lp) => lp.userId === emp.id)
    return empProg.length > 0
  }).length - completedAll

  const notStarted = employees.length - completedAll - Math.max(0, inProgressCount)

  const statusData = [
    { name: 'Завершили', value: completedAll, fill: 'oklch(0.65 0.17 145)' },
    { name: 'В процессе', value: Math.max(0, inProgressCount), fill: 'oklch(0.75 0.15 80)' },
    { name: 'Не начали', value: Math.max(0, notStarted), fill: 'oklch(0.90 0.01 250)' },
  ]

  const courseStats = courses.map((course) => {
    const courseLessons = lessons.filter((l) => l.courseId === course.id)
    const assigned = mockCourseAssignments.filter((a) => a.courseId === course.id)
    const totalPossible = assigned.length * courseLessons.length
    const done = assigned.reduce((acc, a) => {
      return acc + progress.filter(
        (lp) => lp.userId === a.userId && lp.status === 'passed' && courseLessons.some((l) => l.id === lp.lessonId)
      ).length
    }, 0)

    return {
      name: course.title.length > 20 ? course.title.slice(0, 20) + '...' : course.title,
      progress: totalPossible > 0 ? Math.round((done / totalPossible) * 100) : 0,
      assigned: assigned.length,
    }
  })

  const employeeStats = employees.map((emp) => {
    const assigned = mockCourseAssignments.filter((a) => a.userId === emp.id)
    const total = assigned.reduce(
      (acc, a) => acc + mockLessons.filter((l) => l.courseId === a.courseId).length,
      0
    )
    const done = progress.filter((lp) => lp.userId === emp.id && lp.status === 'passed').length

    return {
      id: emp.id,
      name: emp.name,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      completed: done,
      total,
    }
  })

  return (
    <div>
      <Topbar title="Статистика" subtitle="Аналитика обучения компании" />

      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Сотрудники', value: employees.length, icon: Users, subtitle: 'В компании' },
            { title: 'Курсы', value: courses.length, icon: BookOpen, subtitle: 'Опубликовано' },
            { title: 'Уроков', value: lessons.length, icon: GraduationCap, subtitle: 'Всего' },
            { title: 'Завершили', value: completedAll, icon: CheckCircle2, subtitle: `Из ${employees.length} сотрудников` },
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
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={mockActivityLog}>
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
                      tickFormatter={(v) => new Date(v).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="logins" name="Входы" stroke="oklch(0.55 0.18 250)" fill="url(#colorActivity)" strokeWidth={2} />
                    <Area type="monotone" dataKey="lessonsCompleted" name="Уроки" stroke="oklch(0.65 0.17 145)" fill="url(#colorLessons)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Статусы сотрудников
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
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
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={courseStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 250)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: 'oklch(0.45 0.02 250)' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="progress" name="Прогресс %" fill="oklch(0.55 0.18 250)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Прогресс по сотрудникам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {employeeStats.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                      {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-text truncate">{emp.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-text-muted">{emp.completed}/{emp.total}</span>
                          <Badge
                            variant={emp.progress === 100 ? 'success' : emp.progress > 0 ? 'warning' : 'secondary'}
                          >
                            {emp.progress}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={emp.progress} className="h-2" />
                    </div>
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
