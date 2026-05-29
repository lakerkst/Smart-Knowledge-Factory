import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  UserPlus,
  Link2,
  Copy,
  Check,
  Search,
  Settings2,
  BookOpen,
  Plus,
  X,
  Power,
  PowerOff,
  RotateCcw,
  Save,
  Briefcase,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileSpreadsheet,
  Upload,
  ClipboardList,
  Trash2,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Progress } from '~/components/ui/progress'
import { Card, CardContent } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog'
import {
  getEmployeesFn,
  createEmployeeFn,
  updateEmployeeFn,
  generateLinkFn,
  toggleEmployeeActiveFn,
  assignCourseFn,
  unassignCourseFn,
  resetProgressFn,
  setAssignmentDeadlineFn,
  deleteEmployeeFn,
  bulkDeleteEmployeesFn,
} from '~/lib/server-fns/employees'
import { importEmployeesFn } from '~/lib/server-fns/import'
import { getCoursesFn } from '~/lib/server-fns/courses'
import { cn } from '~/lib/utils'
import { toast } from '~/components/ui/toaster'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/admin/employees')({
  loader: async ({ context }) => {
    const companyId = context.user.companyId!
    const [employees, courses] = await Promise.all([
      getEmployeesFn({ data: { companyId } }),
      getCoursesFn({ data: { companyId } }),
    ])
    return { employees, courses }
  },
  component: EmployeesPage,
})

type Employee = Awaited<ReturnType<typeof getEmployeesFn>>[number]
type SortKey = 'name' | 'progress' | 'lastLogin'
type StatusFilter = 'all' | 'active' | 'inactive' | 'not_started' | 'in_progress' | 'completed'

// STATUS_TABS labels are now resolved inside the component via t()

function SortTh({
  children,
  sortKey,
  current,
  dir,
  onClick,
}: {
  children: React.ReactNode
  sortKey: SortKey
  current: SortKey
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  const active = current === sortKey
  return (
    <th
      className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text transition-colors"
      onClick={onClick}
    >
      <span className="flex items-center gap-1">
        {children}
        {active ? (
          dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

function EmployeesPage() {
  const { t } = useTranslation()
  const { user } = Route.useRouteContext()
  const { employees, courses } = Route.useLoaderData()
  const router = useRouter()

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'active', label: t('common.active') },
    { key: 'inactive', label: t('common.inactive') },
    { key: 'not_started', label: t('employees.notStarted') },
    { key: 'in_progress', label: t('employees.inProgress') },
    { key: 'completed', label: t('employees.completed') },
  ]

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showManageDialog, setShowManageDialog] = useState(false)

  // Add dialog state
  const [newName, setNewName] = useState('')
  const [newPosition, setNewPosition] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Link state
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [importPreview, setImportPreview] = useState<string[]>([])
  const [importResults, setImportResults] = useState<Array<{ name: string; link: string }>>([])
  const [isImporting, setIsImporting] = useState(false)
  const [allLinksCopied, setAllLinksCopied] = useState(false)

  // Manage dialog state
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [editName, setEditName] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deadlines, setDeadlines] = useState<Record<string, string>>({})

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const filtered = employees
    .filter((emp) => {
      if (search) {
        const q = search.toLowerCase()
        if (!emp.name.toLowerCase().includes(q) && !(emp.position ?? '').toLowerCase().includes(q)) return false
      }
      if (statusFilter === 'active') return emp.isActive
      if (statusFilter === 'inactive') return !emp.isActive
      if (statusFilter === 'not_started') return emp.isActive && emp.status === 'not_started'
      if (statusFilter === 'in_progress') return emp.isActive && emp.status === 'in_progress'
      if (statusFilter === 'completed') return emp.isActive && emp.status === 'completed'
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, undefined)
      else if (sortBy === 'progress') cmp = a.progress - b.progress
      else if (sortBy === 'lastLogin') {
        const at = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0
        const bt = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0
        cmp = at - bt
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const handleAddEmployee = async () => {
    if (!newName.trim() || !user.companyId) return
    setIsCreating(true)
    try {
      await createEmployeeFn({
        data: { name: newName.trim(), companyId: user.companyId, position: newPosition.trim() || undefined },
      })
      setShowAddDialog(false)
      setNewName('')
      setNewPosition('')
      router.invalidate()
      toast.success(t('employees.employeeAdded'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleGenerateLink = async (empId: string) => {
    const result = await generateLinkFn({ data: { employeeId: empId } })
    if ('token' in result && result.token) {
      const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/learn/${result.token}`
      setGeneratedLink(link)
      setShowLinkDialog(true)
      router.invalidate()
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    toast.success(t('employees.linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleActive = async (emp: Employee) => {
    await toggleEmployeeActiveFn({ data: { employeeId: emp.id, isActive: !emp.isActive } })
    router.invalidate()
    setSelectedEmp((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev)
    toast.success(emp.isActive ? t('employees.accessBlocked') : t('employees.accessOpened'))
  }

  const handleSaveEdit = async () => {
    if (!selectedEmp || !editName.trim()) return
    setIsSavingEdit(true)
    try {
      await updateEmployeeFn({
        data: { employeeId: selectedEmp.id, name: editName.trim(), position: editPosition.trim() || undefined },
      })
      router.invalidate()
      setSelectedEmp((prev) => prev ? { ...prev, name: editName.trim(), position: editPosition.trim() || null } : prev)
      toast.success(t('employees.dataSaved'))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleResetProgress = async () => {
    if (!selectedEmp) return
    if (!confirm(t('employees.confirmReset', { name: selectedEmp.name }))) return
    await resetProgressFn({ data: { employeeId: selectedEmp.id } })
    router.invalidate()
    toast.success(t('employees.progressReset'))
  }

  const handleAssign = async (courseId: string) => {
    if (!selectedEmp) return
    await assignCourseFn({ data: { userId: selectedEmp.id, courseId } })
    router.invalidate()
    setSelectedEmp((prev) =>
      prev ? { ...prev, assignedCourseIds: [...prev.assignedCourseIds, courseId] } : prev
    )
    toast.success(t('employees.courseAssigned'))
  }

  const handleUnassign = async (courseId: string) => {
    if (!selectedEmp) return
    await unassignCourseFn({ data: { userId: selectedEmp.id, courseId } })
    router.invalidate()
    setSelectedEmp((prev) =>
      prev ? { ...prev, assignedCourseIds: prev.assignedCourseIds.filter((id) => id !== courseId) } : prev
    )
    toast.success(t('employees.courseRemoved'))
  }

  const handleSaveDeadline = async (courseId: string) => {
    if (!selectedEmp) return
    const deadline = deadlines[courseId] || null
    await setAssignmentDeadlineFn({ data: { userId: selectedEmp.id, courseId, deadline } })
    router.invalidate()
    toast.success(deadline ? t('employees.deadlineSet') : t('employees.deadlineRemoved'))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      if (!data) return
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
      const names = rows
        .map((row) => (Array.isArray(row) ? String(row[0] ?? '') : ''))
        .filter((n) => n.trim().length > 0)
      setImportPreview(names)
      setImportStep('preview')
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!user.companyId || importPreview.length === 0) return
    setIsImporting(true)
    try {
      const { results } = await importEmployeesFn({ data: { names: importPreview, companyId: user.companyId } })
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      setImportResults(results.map((r) => ({ name: r.name, link: `${origin}/learn/${r.token}` })))
      setImportStep('done')
      router.invalidate()
      toast.success(t('employees.addedCount', { count: results.length }))
    } finally {
      setIsImporting(false)
    }
  }

  const handleCopyAllLinks = async () => {
    const text = importResults.map((r) => `${r.name}: ${r.link}`).join('\n')
    await navigator.clipboard.writeText(text)
    setAllLinksCopied(true)
    toast.success(t('employees.allLinksCopied'))
    setTimeout(() => setAllLinksCopied(false), 2000)
  }

  const resetImport = () => {
    setImportStep('upload')
    setImportPreview([])
    setImportResults([])
    setAllLinksCopied(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)))
    }
  }

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!confirm(t('employees.confirmDeleteEmployee', { name: emp.name }))) return
    await deleteEmployeeFn({ data: { employeeId: emp.id } })
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(emp.id); return next })
    router.invalidate()
    toast.success(t('employees.employeeDeleted'))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(t('employees.confirmBulkDelete', { count: selectedIds.size }))) return
    await bulkDeleteEmployeesFn({ data: { employeeIds: Array.from(selectedIds) } })
    const count = selectedIds.size
    setSelectedIds(new Set())
    router.invalidate()
    toast.success(t('employees.bulkDeleted', { count }))
  }

  const openManage = (emp: Employee) => {
    setSelectedEmp(emp)
    setEditName(emp.name)
    setEditPosition(emp.position ?? '')
    // Pre-fill deadlines from existing assignment data
    const dl: Record<string, string> = {}
    for (const a of emp.courseAssignments) {
      if (a.deadline) dl[a.courseId] = new Date(a.deadline).toISOString().split('T')[0]
    }
    setDeadlines(dl)
    setShowManageDialog(true)
  }

  const statusMap = {
    completed: { label: t('employees.statusCompleted'), variant: 'success' as const },
    in_progress: { label: t('employees.statusInProgress'), variant: 'warning' as const },
    not_started: { label: t('employees.statusNotStarted'), variant: 'secondary' as const },
  }

  return (
    <div>
      <Topbar title={t('employees.title')} subtitle={t('employees.subtitle')} />

      <div className="p-6">
        {/* Status filter tabs */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'rounded-full px-3.5 py-1 text-xs font-medium transition-colors',
                statusFilter === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-dim text-text-muted hover:bg-surface-raised hover:text-text'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder={t('employees.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => { resetImport(); setShowImportDialog(true) }}>
              <FileSpreadsheet className="h-4 w-4" />
              {t('employees.importExcel')}
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <UserPlus className="h-4 w-4" />
              {t('employees.addEmployee')}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="w-10 px-3 py-3.5">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </th>
                    <SortTh sortKey="name" current={sortBy} dir={sortDir} onClick={() => handleSort('name')}>
                      {t('employees.employee')}
                    </SortTh>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('common.status')}</th>
                    <SortTh sortKey="progress" current={sortBy} dir={sortDir} onClick={() => handleSort('progress')}>
                      {t('common.progress')}
                    </SortTh>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('common.lessons')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('nav.courses')}</th>
                    <SortTh sortKey="lastLogin" current={sortBy} dir={sortDir} onClick={() => handleSort('lastLogin')}>
                      {t('employees.lastLogin')}
                    </SortTh>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      className={cn(
                        'border-b border-border-light last:border-0 transition-colors',
                        emp.isActive ? 'hover:bg-surface-dim/50' : 'opacity-50'
                      )}
                    >
                      <td className="px-3 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.id)}
                          onChange={() => toggleSelect(emp.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                            emp.isActive ? 'bg-primary-100 text-primary' : 'bg-surface-dim text-text-muted'
                          )}>
                            {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text">{emp.name}</p>
                            {emp.position && (
                              <p className="text-xs text-text-muted">{emp.position}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {emp.isActive ? (
                          <Badge variant={statusMap[emp.status].variant}>
                            {statusMap[emp.status].label}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t('employees.deactivated')}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 w-32">
                          <Progress value={emp.progress} className="h-1.5" />
                          <span className="text-xs text-text-muted shrink-0">{emp.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary">
                        {emp.lessonsCompleted}/{emp.totalLessons}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary">
                        {emp.coursesAssigned}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-muted">
                        {emp.lastLoginAt
                          ? new Date(emp.lastLoginAt).toLocaleDateString(undefined)
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleGenerateLink(emp.id)}
                            title={t('employees.generateLink')}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openManage(emp)}
                            title={t('employees.manage')}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-danger hover:text-danger"
                            onClick={() => handleDeleteEmployee(emp)}
                            title={t('employees.deleteEmployee')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-text-muted">{t('employees.notFound')}</p>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 animate-slide-up">
            <div className="flex items-center gap-4 rounded-2xl border border-border-light bg-surface-raised px-5 py-3 shadow-lg">
              <span className="text-sm font-medium text-text">
                {t('employees.selectedCount', { count: selectedIds.size })}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set())}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" variant="default" className="bg-danger hover:bg-danger/90 text-white" onClick={handleBulkDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                {t('employees.deleteSelected')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Import Excel dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { setShowImportDialog(open); if (!open) resetImport() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('employees.importTitle')}</DialogTitle>
            <DialogDescription>
              {importStep === 'upload' && t('employees.importUpload')}
              {importStep === 'preview' && t('employees.importFound', { count: importPreview.length })}
              {importStep === 'done' && t('employees.importSuccess', { count: importResults.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            {importStep === 'upload' && (
              <div className="space-y-4">
                <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-text-muted" />
                  <p className="mt-3 text-sm text-text-muted">
                    {t('employees.importFirstColumn')}
                  </p>
                  <label className="mt-4 inline-block cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <span className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
                      <Upload className="h-4 w-4" />
                      {t('employees.chooseFile')}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-text-muted text-center">
                  {t('employees.supportedFormats')}
                </p>
              </div>
            )}

            {importStep === 'preview' && (
              <div className="space-y-3">
                <div className="max-h-60 overflow-y-auto rounded-xl border border-border-light divide-y divide-border-light">
                  {importPreview.map((name, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm text-text">{name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setImportStep('upload')}>{t('common.back')}</Button>
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? t('employees.creating') : t('employees.createAccounts', { count: importPreview.length })}
                  </Button>
                </div>
              </div>
            )}

            {importStep === 'done' && (
              <div className="space-y-3">
                <div className="max-h-60 overflow-y-auto rounded-xl border border-border-light divide-y divide-border-light">
                  {importResults.map((r, i) => (
                    <div key={i} className="px-3 py-2.5">
                      <p className="text-sm font-medium text-text">{r.name}</p>
                      <p className="text-xs text-text-muted font-mono mt-0.5 truncate">{r.link}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <Button variant="secondary" size="sm" onClick={() => { resetImport(); setShowImportDialog(false) }}>
                    {t('common.close')}
                  </Button>
                  <Button onClick={handleCopyAllLinks}>
                    {allLinksCopied ? <Check className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                    {allLinksCopied ? t('common.copied') + '!' : t('employees.copyAllLinks')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add employee dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setNewName(''); setNewPosition('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('employees.addTitle')}</DialogTitle>
            <DialogDescription>{t('employees.addSubtitle')}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Input
              placeholder={t('employees.namePlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEmployee()}
            />
            <Input
              placeholder={t('employees.positionPlaceholder')}
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEmployee()}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setShowAddDialog(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleAddEmployee} disabled={!newName.trim() || isCreating}>
                {isCreating ? t('employees.adding') : t('common.add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('employees.personalLink')}</DialogTitle>
            <DialogDescription>{t('employees.personalLinkDescription')}</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <Input value={generatedLink} readOnly className="font-mono text-xs" />
              <Button variant="secondary" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              {t('employees.linkUnique')}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage employee dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEmp?.name}</DialogTitle>
            <DialogDescription>{t('employees.manageSubtitle')}</DialogDescription>
          </DialogHeader>

          {selectedEmp && (
            <div className="space-y-5 pt-1">

              {/* Edit name + position */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('employees.data')}</p>
                <Input
                  placeholder={t('employees.nameFull')}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    placeholder={t('employees.position')}
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || isSavingEdit}
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSavingEdit ? t('employees.savingEdit') : t('common.save')}
                </Button>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border-light bg-surface-dim/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text">{t('employees.platformAccess')}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {selectedEmp.isActive ? t('employees.canLogin') : t('employees.loginBlocked')}
                  </p>
                </div>
                <Button
                  variant={selectedEmp.isActive ? 'secondary' : 'default'}
                  size="sm"
                  onClick={() => handleToggleActive(selectedEmp)}
                >
                  {selectedEmp.isActive ? (
                    <><PowerOff className="h-3.5 w-3.5" />{t('employees.deactivate')}</>
                  ) : (
                    <><Power className="h-3.5 w-3.5" />{t('employees.activate')}</>
                  )}
                </Button>
              </div>

              {/* Reset progress */}
              <div className="flex items-center justify-between rounded-lg border border-border-light bg-surface-dim/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text">{t('employees.learningProgress')}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t('employees.lessonsCompleted', { completed: selectedEmp.lessonsCompleted, total: selectedEmp.totalLessons })}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetProgress}
                  disabled={selectedEmp.lessonsCompleted === 0}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('employees.reset')}
                </Button>
              </div>

              {/* Course assignments */}
              <div>
                <p className="mb-2.5 text-sm font-medium text-text flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-text-muted" />
                  {t('employees.assignedCourses')}
                </p>
                <div className="space-y-2">
                  {courses.length === 0 && (
                    <p className="text-xs text-text-muted py-2">{t('employees.noCoursesInSystem')}</p>
                  )}
                  {courses.map((course) => {
                    const isAssigned = selectedEmp.assignedCourseIds.includes(course.id)
                    return (
                      <div
                        key={course.id}
                        className="rounded-lg border border-border-light px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text truncate">{course.title}</p>
                            <p className="text-xs text-text-muted">{t('employees.lessonsCount', { count: course.lessonsCount })}</p>
                          </div>
                          {isAssigned ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-danger hover:text-danger ml-2"
                              onClick={() => handleUnassign(course.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t('employees.remove')}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 ml-2"
                              onClick={() => handleAssign(course.id)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {t('employees.assign')}
                            </Button>
                          )}
                        </div>

                        {/* Deadline row — only for assigned courses */}
                        {isAssigned && (
                          <div className="mt-2 flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-text-muted shrink-0" />
                            <input
                              type="date"
                              value={deadlines[course.id] || ''}
                              onChange={(e) =>
                                setDeadlines((prev) => ({ ...prev, [course.id]: e.target.value }))
                              }
                              className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              className="shrink-0 h-7 px-2.5 text-xs"
                              onClick={() => handleSaveDeadline(course.id)}
                            >
                              <Save className="h-3 w-3" />
                              {t('common.save')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
