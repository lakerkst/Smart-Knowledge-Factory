import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  Plus,
  BookOpen,
  Clock,
  Users,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Video,
  Trash2,
  UserCheck,
  Route as RouteIcon,
  Edit3,
  X,
  Link2,
  Copy,
  Check,
  Download,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog'
import { getCoursesFn, createCourseFn, deleteCourseFn } from '~/lib/server-fns/courses'
import { getBulkAssignDataFn, bulkAssignCourseFn } from '~/lib/server-fns/employees'
import {
  getPathsFn,
  createPathFn,
  updatePathFn,
  deletePathFn,
  addCourseToPathFn,
  removeCourseFromPathFn,
  reorderPathCourseFn,
  assignPathFn,
} from '~/lib/server-fns/learning-paths'
import { formatDuration, cn } from '~/lib/utils'
import { toast } from '~/components/ui/toaster'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/admin/courses/')({
  loader: async ({ context }) => {
    const companyId = context.user.companyId!
    const [courses, paths] = await Promise.all([
      getCoursesFn({ data: { companyId } }),
      getPathsFn({ data: { companyId } }),
    ])
    return { courses, paths }
  },
  component: CoursesPage,
})

type PathData = Awaited<ReturnType<typeof getPathsFn>>[number]

type BulkEmployee = { id: string; name: string; isActive: boolean; isAssigned: boolean; personalToken: string | null }

function CoursesPage() {
  const { t } = useTranslation()
  const { user } = Route.useRouteContext()
  const { courses, paths } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'courses' | 'paths'>('courses')

  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Bulk assign state
  const [bulkCourseId, setBulkCourseId] = useState<string | null>(null)
  const [bulkEmployees, setBulkEmployees] = useState<BulkEmployee[]>([])
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  // Links step shown after successful assignment
  const [bulkLinksStep, setBulkLinksStep] = useState(false)
  const [bulkLinksData, setBulkLinksData] = useState<{ name: string; link: string }[]>([])
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  // Learning paths state
  const [showCreatePath, setShowCreatePath] = useState(false)
  const [pathTitle, setPathTitle] = useState('')
  const [pathDesc, setPathDesc] = useState('')
  const [creatingPath, setCreatingPath] = useState(false)

  const [editingPath, setEditingPath] = useState<PathData | null>(null)
  const [editPathTitle, setEditPathTitle] = useState('')
  const [editPathDesc, setEditPathDesc] = useState('')

  const [addCoursePathId, setAddCoursePathId] = useState<string | null>(null)

  // Assign path state
  const [assignPathId, setAssignPathId] = useState<string | null>(null)
  const [pathAssignEmployees, setPathAssignEmployees] = useState<BulkEmployee[]>([])
  const [pathAssignSelected, setPathAssignSelected] = useState<Set<string>>(new Set())
  const [pathAssignLoading, setPathAssignLoading] = useState(false)
  const [pathAssignSaving, setPathAssignSaving] = useState(false)

  // Lazy-fetch employees when bulk assign dialog opens
  useEffect(() => {
    if (!bulkCourseId || !user.companyId) return
    setBulkLoading(true)
    getBulkAssignDataFn({ data: { companyId: user.companyId, courseId: bulkCourseId } })
      .then((emps) => {
        setBulkEmployees(emps)
        // Pre-select active employees not yet assigned
        setBulkSelected(new Set(emps.filter((e) => e.isActive && !e.isAssigned).map((e) => e.id)))
      })
      .finally(() => setBulkLoading(false))
  }, [bulkCourseId])

  const handleCreate = async () => {
    if (!newTitle.trim() || !user.companyId) return
    setCreating(true)
    try {
      await createCourseFn({ data: { title: newTitle.trim(), description: newDesc.trim() || undefined, companyId: user.companyId } })
      setShowCreate(false)
      setNewTitle('')
      setNewDesc('')
      router.invalidate()
      toast.success(t('courses.courseCreated'))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (courseId: string, title: string) => {
    if (!confirm(t('courses.confirmDelete', { title }))) return
    await deleteCourseFn({ data: { courseId } })
    router.invalidate()
    toast.success(t('courses.courseDeleted'))
  }

  const handleBulkAssign = async () => {
    if (!bulkCourseId || bulkSelected.size === 0) return
    setBulkSaving(true)
    try {
      const result = await bulkAssignCourseFn({ data: { courseId: bulkCourseId, userIds: Array.from(bulkSelected) } })
      router.invalidate()
      // Build links for newly assigned employees
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const links = bulkEmployees
        .filter((e) => bulkSelected.has(e.id) && e.personalToken)
        .map((e) => ({ name: e.name, link: `${origin}/learn/${e.personalToken}` }))
      if (links.length > 0) {
        setBulkLinksData(links)
        setBulkLinksStep(true)
        toast.success(t('courses.assignedCount', { count: result.assigned }))
      } else {
        toast.success(t('courses.assignedCount', { count: result.assigned }))
        setBulkCourseId(null)
      }
    } finally {
      setBulkSaving(false)
    }
  }

  const handleCopyAllLinks = async () => {
    const text = bulkLinksData.map((r) => `${r.name}: ${r.link}`).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success(t('employees.allLinksCopied'))
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const handleCopyOneLink = async (link: string, idx: number) => {
    await navigator.clipboard.writeText(link)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleDownloadLinks = () => {
    const text = bulkLinksData.map((r) => `${r.name}\t${r.link}`).join('\n')
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `links_${bulkCourse?.title ?? 'course'}_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const closeBulkDialog = () => {
    setBulkCourseId(null)
    setBulkLinksStep(false)
    setBulkLinksData([])
    setCopiedAll(false)
  }

  const toggleBulkEmp = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkCourse = courses.find((c) => c.id === bulkCourseId)

  // Paths handlers
  const handleCreatePath = async () => {
    if (!pathTitle.trim() || !user.companyId) return
    setCreatingPath(true)
    try {
      await createPathFn({ data: { companyId: user.companyId, title: pathTitle.trim(), description: pathDesc.trim() || undefined } })
      setShowCreatePath(false)
      setPathTitle('')
      setPathDesc('')
      router.invalidate()
      toast.success(t('courses.pathCreated'))
    } finally {
      setCreatingPath(false)
    }
  }

  const handleSaveEditPath = async () => {
    if (!editingPath || !editPathTitle.trim()) return
    await updatePathFn({ data: { pathId: editingPath.id, title: editPathTitle.trim(), description: editPathDesc.trim() || undefined } })
    setEditingPath(null)
    router.invalidate()
    toast.success(t('courses.pathUpdated'))
  }

  const handleDeletePath = async (pathId: string, title: string) => {
    if (!confirm(t('courses.confirmDeletePath', { title }))) return
    await deletePathFn({ data: { pathId } })
    router.invalidate()
    toast.success(t('courses.pathDeleted'))
  }

  const handleAddCoursePath = async (courseId: string) => {
    if (!addCoursePathId) return
    const result = await addCourseToPathFn({ data: { pathId: addCoursePathId, courseId } })
    if ('error' in result && result.error) { toast.error(result.error); return }
    router.invalidate()
    toast.success(t('courses.courseAddedToPath'))
  }

  const handleRemoveCourseFromPath = async (pathCourseId: string) => {
    await removeCourseFromPathFn({ data: { pathCourseId } })
    router.invalidate()
    toast.success(t('courses.courseRemovedFromPath'))
  }

  const handleReorderCourse = async (pathCourseId: string, direction: 'up' | 'down') => {
    await reorderPathCourseFn({ data: { pathCourseId, direction } })
    router.invalidate()
  }

  // Path assign — get all company employees
  useEffect(() => {
    if (!assignPathId || !user.companyId) return
    setPathAssignLoading(true)
    // Get all employees for path assignment using existing courses as context
    const firstCourseId = courses[0]?.id
    if (!firstCourseId) {
      setPathAssignLoading(false)
      return
    }
    getBulkAssignDataFn({ data: { companyId: user.companyId, courseId: firstCourseId } })
      .then((emps) => {
        // Reset isAssigned flag — path assignments are tracked separately
        const mapped = emps.map((e) => ({ ...e, isAssigned: false }))
        setPathAssignEmployees(mapped)
        setPathAssignSelected(new Set(mapped.filter((e) => e.isActive).map((e) => e.id)))
      })
      .finally(() => setPathAssignLoading(false))
  }, [assignPathId])

  const handleAssignPath = async () => {
    if (!assignPathId || pathAssignSelected.size === 0) return
    setPathAssignSaving(true)
    try {
      const result = await assignPathFn({ data: { pathId: assignPathId, userIds: Array.from(pathAssignSelected) } })
      toast.success(t('courses.assignedCount', { count: result.assigned }))
      setAssignPathId(null)
      router.invalidate()
    } finally {
      setPathAssignSaving(false)
    }
  }

  return (
    <div>
      <Topbar title={t('courses.title')} subtitle={t('courses.subtitle')} />

      <div className="p-6">
        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 rounded-xl bg-surface-dim p-1 w-fit">
          <button
            onClick={() => setActiveTab('courses')}
            className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'courses' ? 'bg-surface-raised text-text shadow-sm' : 'text-text-muted hover:text-text'
            )}
          >
            <BookOpen className="h-4 w-4" />
            {t('courses.coursesCount', { count: courses.length })}
          </button>
          <button
            onClick={() => setActiveTab('paths')}
            className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'paths' ? 'bg-surface-raised text-text shadow-sm' : 'text-text-muted hover:text-text'
            )}
          >
            <RouteIcon className="h-4 w-4" />
            {t('courses.pathsCount', { count: paths.length })}
          </button>
        </div>

        {activeTab === 'courses' && (
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-text-muted">{t('courses.coursesTotal', { count: courses.length })}</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t('courses.createCourse')}
          </Button>
        </div>
        )}

        {/* ─── Courses tab ─── */}
        {/* Create course dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('courses.newCourse')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">{t('common.title')}</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('courses.titlePlaceholder')} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">{t('common.description')}</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t('courses.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || creating} className="w-full">
                {creating ? t('common.loading') : t('courses.createCourse')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk assign dialog */}
        <Dialog open={!!bulkCourseId} onOpenChange={(open) => { if (!open) closeBulkDialog() }}>
          <DialogContent className="max-w-md">
            {!bulkLinksStep ? (
              <>
                <DialogHeader>
                  <DialogTitle>{t('courses.assignEmployees')}</DialogTitle>
                  <DialogDescription>{bulkCourse?.title}</DialogDescription>
                </DialogHeader>

                <div className="mt-2 max-h-72 overflow-y-auto space-y-0.5 pr-1">
                  {bulkLoading ? (
                    <div className="py-8 text-center text-sm text-text-muted">{t('common.loading')}</div>
                  ) : bulkEmployees.length === 0 ? (
                    <div className="py-8 text-center text-sm text-text-muted">{t('courses.noEmployees')}</div>
                  ) : (
                    bulkEmployees.map((emp) => (
                      <label
                        key={emp.id}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                          emp.isAssigned ? 'opacity-60' : 'cursor-pointer hover:bg-surface-dim'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded accent-primary"
                          checked={emp.isAssigned || bulkSelected.has(emp.id)}
                          disabled={emp.isAssigned}
                          onChange={() => !emp.isAssigned && toggleBulkEmp(emp.id)}
                        />
                        <span className="flex-1 text-sm text-text">{emp.name}</span>
                        {emp.isAssigned && <Badge variant="success">{t('courses.assigned')}</Badge>}
                        {!emp.isActive && !emp.isAssigned && <Badge variant="secondary">{t('employees.deactivated')}</Badge>}
                      </label>
                    ))
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border-light pt-4">
                  <span className="text-xs text-text-muted">{t('courses.selected', { count: bulkSelected.size })}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={closeBulkDialog}>{t('common.cancel')}</Button>
                    <Button
                      size="sm"
                      disabled={bulkSelected.size === 0 || bulkSaving}
                      onClick={handleBulkAssign}
                    >
                      {bulkSaving ? t('courses.assigning') : t('employees.assign')}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    {t('courses.employeeLinks')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('courses.employeeLinksDescription')}
                  </DialogDescription>
                </DialogHeader>

                {/* Action buttons */}
                <div className="flex gap-2 mt-1">
                  <Button size="sm" onClick={handleCopyAllLinks} className="flex-1">
                    {copiedAll ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedAll ? t('common.copied') + '!' : t('courses.copyAll')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleDownloadLinks}>
                    <Download className="h-3.5 w-3.5" />
                    {t('courses.downloadTxt')}
                  </Button>
                </div>

                {/* Links list */}
                <div className="mt-2 max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {bulkLinksData.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-border-light bg-surface p-3"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary">
                        {item.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text truncate">{item.name}</p>
                        <p className="text-[10px] text-text-muted truncate">{item.link}</p>
                      </div>
                      <button
                        onClick={() => handleCopyOneLink(item.link, idx)}
                        className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-surface-dim hover:text-text transition-colors"
                        title={t('courses.copyLink')}
                      >
                        {copiedIdx === idx
                          ? <Check className="h-3.5 w-3.5 text-success" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-border-light pt-4">
                  <Button variant="secondary" size="sm" className="w-full" onClick={closeBulkDialog}>
                    {t('common.done')}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {activeTab === 'courses' && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <div
              key={course.id}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
            >
              <div className="group rounded-2xl border border-border-light bg-surface-raised shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5">
                <Link
                  to="/admin/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="block"
                >
                  <div className="aspect-[16/9] rounded-t-2xl overflow-hidden bg-gradient-to-br from-primary-50 via-surface to-primary-100 flex items-center justify-center">
                    {course.coverImage ? (
                      <img
                        src={course.coverImage}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Video className="mx-auto h-8 w-8 text-primary/50" />
                        <p className="mt-2 text-xs text-text-muted">{t('courses.lessonsCount', { count: course.lessonsCount })}</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                        {course.title}
                      </h3>
                      <ChevronRight className="h-4 w-4 text-text-muted shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="mt-1 text-xs text-text-muted line-clamp-2">
                      {course.description}
                    </p>

                    <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.lessonsCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(course.totalDuration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.assignedCount}
                      </span>
                    </div>

                    <div className="mt-3">
                      <Badge variant={course.isPublished ? 'success' : 'secondary'}>
                        {course.isPublished ? t('common.published') : t('common.draft')}
                      </Badge>
                    </div>
                  </div>
                </Link>

                <div className="px-4 pb-4 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkCourseId(course.id)}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    {t('employees.assign')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    onClick={() => handleDelete(course.id, course.title)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>}

        {/* ─── Paths tab ─── */}
        {activeTab === 'paths' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-text-muted">{t('courses.pathsTotal', { count: paths.length })}</p>
              <Button onClick={() => { setPathTitle(''); setPathDesc(''); setShowCreatePath(true) }}>
                <Plus className="h-4 w-4" />
                {t('courses.createPath')}
              </Button>
            </div>

            {paths.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <RouteIcon className="mx-auto h-8 w-8 text-text-muted" />
                <p className="mt-3 text-sm text-text-muted">{t('courses.noPathsYet')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('courses.pathDescription')}</p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowCreatePath(true)}>
                  <Plus className="h-3.5 w-3.5" /> {t('courses.createFirstPath')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {paths.map((path) => (
                  <div key={path.id} className="rounded-2xl border border-border-light bg-surface-raised p-5 shadow-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-text">{path.title}</h3>
                        {path.description && <p className="text-sm text-text-muted mt-0.5">{path.description}</p>}
                        <p className="text-xs text-text-muted mt-1">{t('courses.pathCoursesEmployees', { courses: path.courses.length, employees: path.assignedCount })}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <Button variant="ghost" size="sm" onClick={() => setAssignPathId(path.id)}>
                          <UserCheck className="h-3.5 w-3.5" />
                          {t('employees.assign')}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingPath(path)
                          setEditPathTitle(path.title)
                          setEditPathDesc(path.description || '')
                        }}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:text-danger"
                          onClick={() => handleDeletePath(path.id, path.title)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Course order */}
                    <div className="space-y-1.5">
                      {path.courses.map((pc, i) => (
                        <div key={pc.id} className="flex items-center gap-2 rounded-lg border border-border-light bg-surface px-3 py-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">{i + 1}</span>
                          <span className="flex-1 text-sm text-text truncate">{pc.courseTitle}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button disabled={i === 0} onClick={() => handleReorderCourse(pc.id, 'up')}
                              className="p-1 rounded text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed">
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button disabled={i === path.courses.length - 1} onClick={() => handleReorderCourse(pc.id, 'down')}
                              className="p-1 rounded text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleRemoveCourseFromPath(pc.id)}
                              className="p-1 rounded text-danger hover:text-danger/80">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setAddCoursePathId(path.id)}
                        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted hover:text-text hover:border-border-light transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('courses.addCourse')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create path dialog */}
        <Dialog open={showCreatePath} onOpenChange={setShowCreatePath}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('courses.newPath')}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input value={pathTitle} onChange={(e) => setPathTitle(e.target.value)} placeholder={t('courses.pathTitlePlaceholder')} />
              <textarea
                value={pathDesc}
                onChange={(e) => setPathDesc(e.target.value)}
                placeholder={t('courses.descriptionOptional')}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <Button onClick={handleCreatePath} disabled={!pathTitle.trim() || creatingPath} className="w-full">
                {creatingPath ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit path dialog */}
        <Dialog open={!!editingPath} onOpenChange={(o) => { if (!o) setEditingPath(null) }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('courses.editPath')}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input value={editPathTitle} onChange={(e) => setEditPathTitle(e.target.value)} placeholder={t('common.title')} />
              <textarea
                value={editPathDesc}
                onChange={(e) => setEditPathDesc(e.target.value)}
                placeholder={t('common.description')}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <Button onClick={handleSaveEditPath} disabled={!editPathTitle.trim()} className="w-full">{t('common.save')}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add course to path dialog */}
        <Dialog open={!!addCoursePathId} onOpenChange={(o) => { if (!o) setAddCoursePathId(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('courses.addCourseTo')}</DialogTitle>
              <DialogDescription>{t('courses.chooseCourse')}</DialogDescription>
            </DialogHeader>
            <div className="mt-2 max-h-72 overflow-y-auto space-y-1">
              {courses.map((course) => (
                <button
                  key={course.id}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-dim transition-colors"
                  onClick={() => { handleAddCoursePath(course.id); setAddCoursePathId(null) }}
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="text-sm text-text">{course.title}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign path dialog */}
        <Dialog open={!!assignPathId} onOpenChange={(o) => { if (!o) setAssignPathId(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('courses.assignPath')}</DialogTitle>
              <DialogDescription>{paths.find((p) => p.id === assignPathId)?.title}</DialogDescription>
            </DialogHeader>
            <div className="mt-2 max-h-72 overflow-y-auto space-y-0.5 pr-1">
              {pathAssignLoading ? (
                <div className="py-8 text-center text-sm text-text-muted">{t('common.loading')}</div>
              ) : pathAssignEmployees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-surface-dim">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary"
                    checked={pathAssignSelected.has(emp.id)}
                    onChange={() => setPathAssignSelected((prev) => {
                      const next = new Set(prev)
                      if (next.has(emp.id)) next.delete(emp.id); else next.add(emp.id)
                      return next
                    })}
                  />
                  <span className="flex-1 text-sm text-text">{emp.name}</span>
                  {!emp.isActive && <Badge variant="secondary">{t('employees.deactivated')}</Badge>}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center border-t border-border-light pt-4">
              <span className="text-xs text-text-muted">{t('courses.selected', { count: pathAssignSelected.size })}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setAssignPathId(null)}>{t('common.cancel')}</Button>
                <Button size="sm" disabled={pathAssignSelected.size === 0 || pathAssignSaving} onClick={handleAssignPath}>
                  {pathAssignSaving ? t('courses.assigning') : t('employees.assign')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
