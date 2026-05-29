import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, GraduationCap } from 'lucide-react'
import { Sidebar } from '~/components/layout/sidebar'
import { getSessionFn, logoutFn } from '~/lib/server-fns/auth'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/super')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session.user || session.user.role !== 'super_admin') {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }
  },
  component: SuperLayout,
})

function SuperLayout() {
  const navigate = useNavigate()
  const { user } = Route.useRouteContext()
  const { t } = useTranslation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300 md:relative md:z-auto md:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar
          role="super_admin"
          userName={user.name}
          onLogout={handleLogout}
          onNavClick={() => setMobileMenuOpen(false)}
        />
      </div>

      <main className="flex-1 overflow-auto bg-surface min-w-0">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-border-light bg-surface-raised px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-dim hover:text-text transition-colors"
            aria-label={t('nav.openMenu')}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-text">SKF</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
