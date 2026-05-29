import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2, Users, BookOpen, Shield, Plus, TrendingUp, Power, PowerOff,
  Search, Pencil, Trash2, KeyRound, LogIn, Download, ChevronUp, ChevronDown,
  ChevronsUpDown, AlertTriangle, CheckCircle2, Eye, X, Save,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { MetricCard } from '~/components/ui/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Progress } from '~/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '~/components/ui/dialog'
import { DateRangePicker, type DateRange } from '~/components/ui/date-range-picker'
import { getSuperStatsFn, getPlatformActivityFn, getCompanyEngagementFn } from '~/lib/server-fns/statistics'
import {
  createCompanyWithAdminFn, toggleCompanyActiveFn, updateCompanyFn,
  deleteCompanyFn, resetAdminPasswordFn, getCompanyDetailsFn, impersonateCompanyFn,
} from '~/lib/server-fns/company'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import { formatDate, cn } from '~/lib/utils'
import { toast } from '~/components/ui/toaster'
import i18n from '~/lib/i18n'

export const Route = createFileRoute('/super/')({
  loader: async () => {
    const stats = await getSuperStatsFn()
    return { stats }
  },
  component: SuperDashboard,
})

type CompanyStat = ReturnType<typeof Route.useLoaderData>['stats']['companyStats'][number]
type SortKey = 'name' | 'employees' | 'courses' | 'created'

function defaultRange(): DateRange {
  const to = new Date(); to.setHours(23, 59, 59, 999)
  const from = new Date(); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0)
  return { from, to }
}

function exportCSV(rows: CompanyStat[]) {
  const t = i18n.t.bind(i18n)
  const header = [t('super.dashboard.thCompany'), t('common.status'), t('super.dashboard.thAdmin'), t('nav.employees'), t('nav.courses'), t('super.dashboard.thCreated')]
  const data = rows.map((c) => [
    c.name, c.isActive ? t('super.dashboard.csvActive') : t('super.dashboard.csvInactive'), c.adminName, c.employeeCount, c.courseCount, formatDate(c.createdAt),
  ])
  const csv = [header, ...data].map((r) => r.map(String).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `companies_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function SortTh({ children, sk, cur, dir, onClick }: { children: React.ReactNode; sk: SortKey; cur: SortKey; dir: 'asc' | 'desc'; onClick: () => void }) {
  const active = cur === sk
  return (
    <th className="px-4 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text transition-colors" onClick={onClick}>
      <span className="flex items-center gap-1">
        {children}
        {active ? (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  )
}

function SubscriptionBadge({ expiresAt }: { expiresAt: Date | string | null }) {
  const { t } = useTranslation()
  if (!expiresAt) return <span className="text-xs text-text-muted">—</span>
  const d = new Date(expiresAt)
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return <Badge variant="danger">{t('super.dashboard.subscriptionExpired')}</Badge>
  if (daysLeft <= 14) return <Badge variant="warning">{t('super.dashboard.subscriptionDaysLeft', { days: daysLeft })}</Badge>
  return <span className="text-xs text-text">{formatDate(d)}</span>
}

function SuperDashboard() {
  const { stats } = Route.useLoaderData()
  const router = useRouter()
  const { t } = useTranslation()

  // ── companies tab state ──
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── add dialog ──
  const [showAdd, setShowAdd] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [addForm, setAddForm] = useState({ companyName: '', adminName: '', adminEmail: '', adminPassword: '', subscriptionExpiresAt: '' })

  // ── edit dialog ──
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ companyName: '', adminName: '', adminEmail: '', subscriptionExpiresAt: '' })
  const [editError, setEditError] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // ── detail dialog ──
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<Awaited<ReturnType<typeof getCompanyDetailsFn>> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── reset password dialog ──
  const [resetResult, setResetResult] = useState<{ newPassword: string; adminEmail: string | null | undefined } | null>(null)


  // ── analytics state ──
  const [analyticsRange, setAnalyticsRange] = useState<DateRange>(defaultRange)
  const [platformActivity, setPlatformActivity] = useState<{ date: string; logins: number; lessonsCompleted: number }[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [engagement, setEngagement] = useState<Awaited<ReturnType<typeof getCompanyEngagementFn>>>([])
  const [engagementLoaded, setEngagementLoaded] = useState(false)

  // Load platform activity whenever date range changes
  useEffect(() => {
    setActivityLoading(true)
    getPlatformActivityFn({ data: { dateFrom: analyticsRange.from.toISOString(), dateTo: analyticsRange.to.toISOString() } })
      .then(setPlatformActivity)
      .finally(() => setActivityLoading(false))
  }, [analyticsRange.from.toISOString(), analyticsRange.to.toISOString()])

  // Load engagement lazily when analytics tab is opened (via engagementLoaded flag)
  useEffect(() => {
    if (!engagementLoaded) return
    getCompanyEngagementFn().then(setEngagement)
  }, [engagementLoaded])

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const filtered = stats.companyStats
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.adminName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, undefined)
      else if (sortBy === 'employees') cmp = a.employeeCount - b.employeeCount
      else if (sortBy === 'courses') cmp = a.courseCount - b.courseCount
      else if (sortBy === 'created') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })

  // ── handlers ──
  const handleAddCompany = async () => {
    if (!addForm.companyName.trim() || !addForm.adminName.trim() || !addForm.adminEmail.trim() || !addForm.adminPassword.trim()) return
    setIsCreating(true); setCreateError('')
    try {
      const result = await createCompanyWithAdminFn({ data: { ...addForm, subscriptionExpiresAt: addForm.subscriptionExpiresAt || null } })
      if ('error' in result && result.error) { setCreateError(result.error); return }
      setShowAdd(false)
      setAddForm({ companyName: '', adminName: '', adminEmail: '', adminPassword: '', subscriptionExpiresAt: '' })
      router.invalidate()
      toast.success(t('super.dashboard.companyCreated', { name: addForm.companyName }))
    } finally { setIsCreating(false) }
  }

  const openEdit = (company: CompanyStat) => {
    setEditId(company.id)
    setEditError('')
    setEditForm({
      companyName: company.name,
      adminName: company.adminName === t('super.dashboard.notAssigned') ? '' : company.adminName,
      adminEmail: '',
      subscriptionExpiresAt: '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editId || !editForm.companyName.trim()) return
    setIsSavingEdit(true); setEditError('')
    try {
      const result = await updateCompanyFn({ data: { companyId: editId, ...editForm, subscriptionExpiresAt: editForm.subscriptionExpiresAt || null } })
      if ('error' in result && result.error) { setEditError(result.error); return }
      setEditId(null)
      router.invalidate()
      toast.success(t('super.dashboard.dataUpdated'))
    } finally { setIsSavingEdit(false) }
  }

  const handleDelete = async (company: CompanyStat) => {
    if (!confirm(t('super.dashboard.confirmDeleteCompany', { name: company.name }))) return
    await deleteCompanyFn({ data: { companyId: company.id } })
    router.invalidate()
    toast.success(t('super.dashboard.companyDeleted', { name: company.name }))
  }

  const handleToggleActive = async (company: CompanyStat) => {
    await toggleCompanyActiveFn({ data: { companyId: company.id, isActive: !company.isActive } })
    router.invalidate()
    toast.success(company.isActive ? t('super.dashboard.companyDeactivated') : t('super.dashboard.companyActivated'))
  }

  const handleResetPassword = async (companyId: string) => {
    const result = await resetAdminPasswordFn({ data: { companyId } })
    if ('error' in result && result.error) { toast.error(result.error); return }
    if ('newPassword' in result) setResetResult({ newPassword: result.newPassword, adminEmail: result.adminEmail })
  }

  const handleImpersonate = async (companyId: string) => {
    const result = await impersonateCompanyFn({ data: { companyId } })
    if ('error' in result && result.error) { toast.error(result.error); return }
    window.location.href = '/admin'
  }

  const openDetail = async (companyId: string) => {
    setDetailId(companyId)
    setDetailData(null)
    setDetailLoading(true)
    const data = await getCompanyDetailsFn({ data: { companyId } })
    setDetailData(data)
    setDetailLoading(false)
  }


  // ── alerts ──
  const noCourses = stats.companyStats.filter((c) => c.courseCount === 0 && c.isActive)
  const noAdminAssigned = stats.companyStats.filter((c) => c.adminName === t('super.dashboard.notAssigned'))

  const statusDistribution = [
    { name: t('super.dashboard.chartStatusActive'), value: stats.totals.activeCompanies, fill: 'oklch(0.65 0.17 145)' },
    { name: t('super.dashboard.chartStatusInactive'), value: stats.totals.companies - stats.totals.activeCompanies, fill: 'oklch(0.90 0.01 250)' },
  ]

  return (
    <div>
      <Topbar title={t('nav.superAdmin')} subtitle={t('super.dashboard.subtitle')} />
      <div className="p-6">
        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: t('super.dashboard.companies'), value: stats.totals.companies, icon: Building2, subtitle: t('super.dashboard.activeCount', { count: stats.totals.activeCompanies }) },
            { title: t('nav.employees'), value: stats.totals.employees, icon: Users, subtitle: t('super.dashboard.onPlatform') },
            { title: t('nav.courses'), value: stats.totals.courses, icon: BookOpen, subtitle: t('super.dashboard.totalCreated') },
            { title: t('super.dashboard.admins'), value: stats.totals.admins, icon: Shield, subtitle: t('super.dashboard.adminsOf') },
          ].map((m, i) => (
            <div key={m.title} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}>
              <MetricCard {...m} />
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Tabs defaultValue="companies" onValueChange={(v) => { if (v === 'analytics' && !engagementLoaded) setEngagementLoaded(true) }}>
            <TabsList>
              <TabsTrigger value="companies">{t('super.dashboard.tabCompanies')}</TabsTrigger>
              <TabsTrigger value="analytics">{t('super.dashboard.tabAnalytics')}</TabsTrigger>
              <TabsTrigger value="charts">{t('super.dashboard.tabCharts')}</TabsTrigger>
            </TabsList>

            {/* ── Companies tab ── */}
            <TabsContent value="companies">
              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input placeholder={t('super.dashboard.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Button variant="secondary" size="sm" onClick={() => exportCSV(filtered)}>
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                  <Plus className="h-3.5 w-3.5" />{t('super.dashboard.addCompany')}
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-light">
                          <SortTh sk="name" cur={sortBy} dir={sortDir} onClick={() => handleSort('name')}>{t('super.dashboard.thCompany')}</SortTh>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('common.status')}</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('super.dashboard.thSubscription')}</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('super.dashboard.thAdmin')}</th>
                          <SortTh sk="employees" cur={sortBy} dir={sortDir} onClick={() => handleSort('employees')}>{t('super.dashboard.thEmployees')}</SortTh>
                          <SortTh sk="courses" cur={sortBy} dir={sortDir} onClick={() => handleSort('courses')}>{t('nav.courses')}</SortTh>
                          <SortTh sk="created" cur={sortBy} dir={sortDir} onClick={() => handleSort('created')}>{t('super.dashboard.thCreated')}</SortTh>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((company) => (
                          <tr key={company.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim/50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xs font-bold text-primary">
                                  {company.name.slice(0, 2)}
                                </div>
                                <span className="text-sm font-medium text-text">{company.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <Badge variant={company.isActive ? 'success' : 'danger'}>
                                {company.isActive ? t('super.dashboard.statusActive') : t('super.dashboard.statusInactive')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3.5">
                              <SubscriptionBadge expiresAt={company.subscriptionExpiresAt} />
                            </td>
                            <td className="px-4 py-3.5 text-sm text-text">{company.adminName}</td>
                            <td className="px-4 py-3.5 text-sm text-text">{company.employeeCount}</td>
                            <td className="px-4 py-3.5 text-sm text-text">{company.courseCount}</td>
                            <td className="px-4 py-3.5 text-xs text-text-muted">{formatDate(company.createdAt)}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title={t('super.dashboard.btnDetails')} onClick={() => openDetail(company.id)}><Eye className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title={t('common.edit')} onClick={() => openEdit(company)}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title={t('super.dashboard.btnImpersonate')} onClick={() => handleImpersonate(company.id)}><LogIn className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title={t('super.dashboard.btnResetPassword')} onClick={() => handleResetPassword(company.id)}><KeyRound className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title={company.isActive ? t('super.dashboard.btnDeactivate') : t('super.dashboard.btnActivate')} onClick={() => handleToggleActive(company)}>
                                  {company.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-danger hover:text-danger" title={t('common.delete')} onClick={() => handleDelete(company)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">{t('super.funcCompany.companiesNotFound')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Analytics tab ── */}
            <TabsContent value="analytics">
              {/* Alerts */}
              {(noCourses.length > 0 || noAdminAssigned.length > 0) && (
                <div className="mb-6 space-y-2">
                  {noCourses.length > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-text">{t('super.dashboard.alertNoCourses')}</p>
                        <p className="text-xs text-text-muted mt-0.5">{noCourses.map((c) => c.name).join(', ')}</p>
                      </div>
                    </div>
                  )}
                  {noAdminAssigned.length > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
                      <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-text">{t('super.dashboard.alertNoAdmin')}</p>
                        <p className="text-xs text-text-muted mt-0.5">{noAdminAssigned.map((c) => c.name).join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Platform activity */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between flex-wrap gap-3">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      {t('super.dashboard.platformActivity')}
                    </span>
                    <DateRangePicker value={analyticsRange} onChange={setAnalyticsRange} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityLoading ? (
                    <div className="flex h-60 items-center justify-center text-sm text-text-muted">{t('common.loading')}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={platformActivity}>
                        <defs>
                          <linearGradient id="gLogins" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gLessons" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.65 0.17 145)" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="oklch(0.65 0.17 145)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 250)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'oklch(0.60 0.015 250)' }}
                          tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} />
                        <YAxis tick={{ fontSize: 10, fill: 'oklch(0.60 0.015 250)' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                        <Legend />
                        <Area type="monotone" dataKey="logins" name={t('super.dashboard.chartLogins')} stroke="oklch(0.55 0.18 250)" fill="url(#gLogins)" strokeWidth={2} />
                        <Area type="monotone" dataKey="lessonsCompleted" name={t('super.dashboard.chartLessons')} stroke="oklch(0.65 0.17 145)" fill="url(#gLessons)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Company engagement */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {t('super.dashboard.engagement')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {engagement.length === 0 ? (
                    <p className="text-sm text-text-muted py-4 text-center">{t('common.loading')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-light text-xs font-semibold uppercase tracking-wider text-text-muted">
                            <th className="pb-2.5 text-left pr-4">{t('super.dashboard.engCompany')}</th>
                            <th className="pb-2.5 text-right pr-4">{t('super.dashboard.engEmployees')}</th>
                            <th className="pb-2.5 text-right pr-4">{t('super.dashboard.engActive7d')}</th>
                            <th className="pb-2.5 text-right">{t('super.dashboard.engAvgProgress')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {engagement.map((e) => (
                            <tr key={e.id} className="border-b border-border-light last:border-0">
                              <td className="py-2.5 pr-4 font-medium text-text">{e.name}</td>
                              <td className="py-2.5 pr-4 text-right text-text-muted">{e.totalEmployees}</td>
                              <td className="py-2.5 pr-4 text-right">
                                <span className={cn('font-medium', e.active7d > 0 ? 'text-success' : 'text-text-muted')}>
                                  {e.active7d}
                                </span>
                              </td>
                              <td className="py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Progress value={e.avgProgress} className="h-1.5 w-20" />
                                  <span className="text-xs font-semibold text-text w-8 text-right">{e.avgProgress}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Charts tab ── */}
            <TabsContent value="charts">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />{t('super.dashboard.chartNewCompanies')}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={stats.newCompaniesPerMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 250)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'oklch(0.60 0.015 250)' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                        <Bar dataKey="count" name={t('super.dashboard.chartCompaniesLabel')} fill="oklch(0.55 0.18 250)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />{t('super.dashboard.chartStatus')}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                          {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid oklch(0.90 0.01 250)', borderRadius: '12px', fontSize: '12px' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />{t('super.dashboard.topByEmployees')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.topByEmployees.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">{i + 1}</span>
                          <span className="flex-1 text-sm text-text truncate">{c.name}</span>
                          <span className="text-sm font-semibold text-text">{c.employeeCount}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />{t('super.dashboard.topByCourses')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.topByCourses.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">{i + 1}</span>
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

      {/* ── Add company dialog ── */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) setCreateError('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('super.dashboard.addCompanyTitle')}</DialogTitle>
            <DialogDescription>{t('super.dashboard.addCompanyDesc')}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.dashboard.companySection')}</p>
              <Input placeholder={t('super.dashboard.companyNamePlaceholder')} value={addForm.companyName} onChange={(e) => setAddForm((p) => ({ ...p, companyName: e.target.value }))} />
              <div>
                <label className="mb-1 block text-xs text-text-muted">{t('super.dashboard.subscriptionUntilOptional')}</label>
                <input type="date" value={addForm.subscriptionExpiresAt} onChange={(e) => setAddForm((p) => ({ ...p, subscriptionExpiresAt: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.dashboard.adminSection')}</p>
              <Input placeholder={t('super.dashboard.adminNamePlaceholder')} value={addForm.adminName} onChange={(e) => setAddForm((p) => ({ ...p, adminName: e.target.value }))} />
              <Input type="email" placeholder="Email" value={addForm.adminEmail} onChange={(e) => setAddForm((p) => ({ ...p, adminEmail: e.target.value }))} />
              <Input type="password" placeholder={t('super.dashboard.passwordPlaceholder')} value={addForm.adminPassword} onChange={(e) => setAddForm((p) => ({ ...p, adminPassword: e.target.value }))} />
            </div>
            {createError && <p className="text-sm text-danger">{createError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleAddCompany} disabled={!addForm.companyName.trim() || !addForm.adminName.trim() || !addForm.adminEmail.trim() || !addForm.adminPassword.trim() || isCreating}>
                {isCreating ? t('super.dashboard.creating') : t('common.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit company dialog ── */}
      <Dialog open={!!editId} onOpenChange={(open) => { if (!open) setEditId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('super.dashboard.editCompanyTitle')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.dashboard.companySection')}</p>
              <Input placeholder={t('super.dashboard.namePlaceholder')} value={editForm.companyName} onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))} />
              <div>
                <label className="mb-1 block text-xs text-text-muted">{t('super.dashboard.subscriptionUntil')}</label>
                <input type="date" value={editForm.subscriptionExpiresAt} onChange={(e) => setEditForm((p) => ({ ...p, subscriptionExpiresAt: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.dashboard.adminSection')}</p>
              <Input placeholder={t('super.dashboard.adminFullNamePlaceholder')} value={editForm.adminName} onChange={(e) => setEditForm((p) => ({ ...p, adminName: e.target.value }))} />
              <Input type="email" placeholder={t('super.dashboard.adminEmailHint')} value={editForm.adminEmail} onChange={(e) => setEditForm((p) => ({ ...p, adminEmail: e.target.value }))} />
            </div>
            {editError && <p className="text-sm text-danger">{editError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditId(null)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveEdit} disabled={!editForm.companyName.trim() || isSavingEdit}>
                <Save className="h-3.5 w-3.5" />{isSavingEdit ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Company detail dialog ── */}
      <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailData?.name ?? t('common.loading')}</DialogTitle>
            <DialogDescription>{t('super.dashboard.detailDesc')}</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 text-center text-sm text-text-muted">{t('common.loading')}</div>
          ) : detailData ? (
            <div className="mt-2 space-y-4">
              {detailData.admin && (
                <div className="rounded-lg border border-border-light p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">{t('super.dashboard.detailAdmin')}</p>
                  <p className="text-sm font-medium text-text">{detailData.admin.name}</p>
                  <p className="text-xs text-text-muted">{detailData.admin.email}</p>
                  {detailData.admin.lastLoginAt && <p className="text-xs text-text-muted mt-0.5">{t('super.dashboard.detailLastLogin', { date: formatDate(detailData.admin.lastLoginAt) })}</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('super.dashboard.detailEmployees'), value: detailData.stats.totalEmployees },
                  { label: t('super.dashboard.detailActiveEmployees'), value: detailData.stats.activeEmployees },
                  { label: t('super.dashboard.detailActive7d'), value: detailData.stats.recentActive7d },
                  { label: t('super.dashboard.detailCourses'), value: `${detailData.stats.publishedCourses}/${detailData.stats.totalCourses}` },
                  { label: t('super.dashboard.detailLessons'), value: detailData.stats.totalLessons },
                  { label: t('super.dashboard.detailAvgProgress'), value: `${detailData.stats.avgProgress}%` },
                  { label: t('super.dashboard.detailLogins7d'), value: detailData.stats.logins7d },
                  { label: t('super.dashboard.detailLessons7d'), value: detailData.stats.lessonsCompleted7d },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-surface-dim/50 px-3 py-2.5">
                    <p className="text-xs text-text-muted">{item.label}</p>
                    <p className="text-lg font-bold text-text">{item.value}</p>
                  </div>
                ))}
              </div>
              {detailData.subscriptionExpiresAt && (
                <div className="flex items-center justify-between rounded-lg border border-border-light px-3 py-2.5">
                  <p className="text-sm text-text-muted">{t('super.dashboard.subscriptionUntil')}</p>
                  <SubscriptionBadge expiresAt={detailData.subscriptionExpiresAt} />
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Reset password result dialog ── */}
      <Dialog open={!!resetResult} onOpenChange={(open) => { if (!open) setResetResult(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('super.dashboard.newPasswordTitle')}</DialogTitle>
            <DialogDescription>{t('super.dashboard.newPasswordDesc')}</DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-surface-dim p-3">
                <p className="text-xs text-text-muted">Email</p>
                <p className="text-sm font-mono font-medium text-text">{resetResult.adminEmail}</p>
              </div>
              <div className="rounded-lg bg-primary-50 p-3">
                <p className="text-xs text-text-muted">{t('super.dashboard.tempPassword')}</p>
                <p className="text-lg font-mono font-bold text-primary tracking-wider">{resetResult.newPassword}</p>
              </div>
              <Button className="w-full" onClick={() => { navigator.clipboard.writeText(resetResult!.newPassword); toast.success(t('super.dashboard.passwordCopied')) }}>
                {t('super.dashboard.copyPassword')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
