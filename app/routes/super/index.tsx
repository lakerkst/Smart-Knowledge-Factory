import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Building2,
  Users,
  BookOpen,
  Shield,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { MetricCard } from '~/components/ui/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs'
import {
  mockCompanies,
  mockUsers,
  mockCourses,
} from '~/lib/mock-data'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { formatDate } from '~/lib/utils'

export const Route = createFileRoute('/super/')({
  component: SuperDashboard,
})

function SuperDashboard() {
  const companies = mockCompanies
  const allEmployees = mockUsers.filter((u) => u.role === 'employee')
  const allAdmins = mockUsers.filter((u) => u.role === 'company_admin')
  const allCourses = mockCourses

  const companyStats = companies.map((company) => {
    const employees = allEmployees.filter((u) => u.companyId === company.id)
    const courses = allCourses.filter((c) => c.companyId === company.id)
    const admin = allAdmins.find((u) => u.companyId === company.id)

    return {
      ...company,
      employeeCount: employees.length,
      courseCount: courses.length,
      adminName: admin?.name || 'Не назначен',
      adminEmail: admin?.email || '-',
    }
  })

  const statusDistribution = [
    { name: 'Активные', value: companies.filter((c) => c.isActive).length, fill: 'oklch(0.65 0.17 145)' },
    { name: 'Неактивные', value: companies.filter((c) => !c.isActive).length, fill: 'oklch(0.90 0.01 250)' },
  ]

  const topByEmployees = [...companyStats].sort((a, b) => b.employeeCount - a.employeeCount)
  const topByCourses = [...companyStats].sort((a, b) => b.courseCount - a.courseCount)

  const newCompaniesData = [
    { month: 'Янв', count: 1 },
    { month: 'Фев', count: 1 },
    { month: 'Мар', count: 1 },
    { month: 'Апр', count: 0 },
    { month: 'Май', count: 0 },
  ]

  return (
    <div>
      <Topbar title="Супер-админ" subtitle="Управление всеми компаниями платформы" />

      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Компании', value: companies.length, icon: Building2, subtitle: `${companies.filter((c) => c.isActive).length} активных` },
            { title: 'Сотрудники', value: allEmployees.length, icon: Users, subtitle: 'На платформе' },
            { title: 'Курсы', value: allCourses.length, icon: BookOpen, subtitle: 'Всего создано' },
            { title: 'Админы', value: allAdmins.length, icon: Shield, subtitle: 'Компаний' },
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

        <div className="mt-6">
          <Tabs defaultValue="companies">
            <TabsList>
              <TabsTrigger value="companies">Компании</TabsTrigger>
              <TabsTrigger value="admins">Админы</TabsTrigger>
              <TabsTrigger value="stats">Статистика</TabsTrigger>
            </TabsList>

            <TabsContent value="companies">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-text-muted">{companies.length} компаний</p>
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Добавить компанию
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-light">
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Компания</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Статус</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Админ</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Сотрудники</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Курсы</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Создана</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyStats.map((company) => (
                          <tr
                            key={company.id}
                            className="border-b border-border-light last:border-0 hover:bg-surface-dim/50 transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xs font-bold text-primary">
                                  {company.name.slice(0, 2)}
                                </div>
                                <span className="text-sm font-medium text-text">{company.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant={company.isActive ? 'success' : 'danger'}>
                                {company.isActive ? 'Активна' : 'Неактивна'}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5">
                              <div>
                                <p className="text-sm text-text">{company.adminName}</p>
                                <p className="text-xs text-text-muted">{company.adminEmail}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-text">{company.employeeCount}</td>
                            <td className="px-5 py-3.5 text-sm text-text">{company.courseCount}</td>
                            <td className="px-5 py-3.5 text-sm text-text-muted">
                              {formatDate(company.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admins">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-light">
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Имя</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Email</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Компания</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allAdmins.map((admin) => {
                          const company = companies.find((c) => c.id === admin.companyId)
                          return (
                            <tr
                              key={admin.id}
                              className="border-b border-border-light last:border-0 hover:bg-surface-dim/50 transition-colors"
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                                    {admin.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <span className="text-sm font-medium text-text">{admin.name}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-text-muted">{admin.email}</td>
                              <td className="px-5 py-3.5 text-sm text-text">{company?.name || '-'}</td>
                              <td className="px-5 py-3.5">
                                <Badge variant={admin.isActive ? 'success' : 'secondary'}>
                                  {admin.isActive ? 'Активен' : 'Неактивен'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Новые компании по месяцам
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={newCompaniesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 250)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                        <Bar dataKey="count" name="Компании" fill="oklch(0.55 0.18 250)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Статус компаний
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Топ по сотрудникам
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {topByEmployees.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-sm text-text truncate">{c.name}</span>
                          <span className="text-sm font-semibold text-text">{c.employeeCount}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Топ по курсам
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {topByCourses.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-sm text-text truncate">{c.name}</span>
                          <span className="text-sm font-semibold text-text">{c.courseCount}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
