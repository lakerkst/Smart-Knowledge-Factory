import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  UserPlus,
  Link2,
  Copy,
  Check,
  Search,
  MoreHorizontal,
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
  mockUsers,
  mockCourseAssignments,
  mockLessons,
  mockLessonProgress,
} from '~/lib/mock-data'
import { generateToken, cn } from '~/lib/utils'

export const Route = createFileRoute('/admin/employees')({
  component: EmployeesPage,
})

function EmployeesPage() {
  const { user } = Route.useRouteContext()
  const [search, setSearch] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)

  const employees = mockUsers
    .filter((u) => u.companyId === user.companyId && u.role === 'employee')
    .map((emp) => {
      const assignments = mockCourseAssignments.filter((a) => a.userId === emp.id)
      const totalLessons = assignments.reduce(
        (acc, a) => acc + mockLessons.filter((l) => l.courseId === a.courseId).length,
        0
      )
      const completed = mockLessonProgress.filter(
        (lp) => lp.userId === emp.id && lp.status === 'passed'
      ).length
      const pct = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0

      let status: 'completed' | 'in_progress' | 'not_started' = 'not_started'
      if (completed > 0 && completed >= totalLessons) status = 'completed'
      else if (completed > 0 || mockLessonProgress.some((lp) => lp.userId === emp.id))
        status = 'in_progress'

      return { ...emp, totalLessons, completed, progress: pct, status }
    })
    .filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()))

  const handleGenerateLink = (empId: string) => {
    const emp = mockUsers.find((u) => u.id === empId)
    if (emp) {
      setSelectedEmployee(empId)
      const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/learn/${emp.personalToken || generateToken(24)}`
      setGeneratedLink(link)
      setShowLinkDialog(true)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusMap = {
    completed: { label: 'Завершил', variant: 'success' as const },
    in_progress: { label: 'В процессе', variant: 'warning' as const },
    not_started: { label: 'Не начал', variant: 'secondary' as const },
  }

  return (
    <div>
      <Topbar title="Сотрудники" subtitle="Управление сотрудниками и персональными ссылками" />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Поиск по имени..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4" />
            Добавить сотрудника
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Сотрудник</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Статус</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Прогресс</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Уроки</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-b border-border-light last:border-0 hover:bg-surface-dim/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                            {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text">{emp.name}</p>
                            <p className="text-xs text-text-muted">
                              {emp.lastLoginAt
                                ? `Был ${emp.lastLoginAt.toLocaleDateString('ru')}`
                                : 'Не входил'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={statusMap[emp.status].variant}>
                          {statusMap[emp.status].label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 w-32">
                          <Progress value={emp.progress} className="h-1.5" />
                          <span className="text-xs text-text-muted shrink-0">{emp.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary">
                        {emp.completed}/{emp.totalLessons}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleGenerateLink(emp.id)}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {employees.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-text-muted">Сотрудники не найдены</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
            <DialogDescription>Введите ФИО нового сотрудника</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <Input
              placeholder="Иванов Иван Иванович"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddDialog(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => {
                  setShowAddDialog(false)
                  setNewName('')
                }}
                disabled={!newName.trim()}
              >
                Добавить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Персональная ссылка</DialogTitle>
            <DialogDescription>Отправьте ссылку сотруднику для начала обучения</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <Input
                value={generatedLink}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="secondary" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Ссылка уникальна для каждого сотрудника. При переходе по ней сотрудник сразу попадает на экран обучения.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
