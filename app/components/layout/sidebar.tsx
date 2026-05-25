import { Link, useLocation } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  LogOut,
  GraduationCap,
  Building2,
  Shield,
  ChevronLeft,
  Settings,
  Globe,
  FileDown,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '~/lib/utils'

interface SidebarProps {
  role: 'company_admin' | 'super_admin'
  userName: string
  companyName?: string
  onLogout: () => void
  onNavClick?: () => void
}

export function Sidebar({ role, userName, companyName, onLogout, onNavClick }: SidebarProps) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/admin/employees', icon: Users, label: 'Сотрудники' },
    { to: '/admin/courses', icon: BookOpen, label: 'Курсы' },
    { to: '/admin/statistics', icon: BarChart3, label: 'Статистика' },
    { to: '/admin/hr-report', icon: FileDown, label: 'HR-отчёт' },
    { to: '/admin/settings', icon: Settings, label: 'Настройки' },
  ]

  const superLinks = [
    { to: '/super', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/super/landing', icon: Globe, label: 'Лендинг' },
  ]

  const links = role === 'super_admin' ? superLinks : adminLinks

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border-light bg-surface-raised transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className="flex items-center gap-3 border-b border-border-light p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">SKF</p>
            <p className="truncate text-xs text-text-muted">
              {role === 'super_admin' ? 'Супер-админ' : companyName}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'ml-auto rounded-lg p-1.5 text-text-muted hover:bg-surface-dim hover:text-text transition-colors',
            collapsed && 'ml-0'
          )}
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => {
          const isActive =
            link.to === '/admin' || link.to === '/super'
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary'
                  : 'text-text-secondary hover:bg-surface-dim hover:text-text'
              )}
            >
              <link.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border-light p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
            {userName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{userName}</p>
              <p className="truncate text-xs text-text-muted">
                {role === 'super_admin' ? (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Супер-админ
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Админ
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className={cn(
            'mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-muted hover:bg-danger-light hover:text-danger transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>
    </aside>
  )
}
