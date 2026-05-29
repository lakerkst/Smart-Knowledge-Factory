import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Menu, GraduationCap } from 'lucide-react'
import { Sidebar } from '~/components/layout/sidebar'
import { getSessionFn, logoutFn } from '~/lib/server-fns/auth'
import { getCompanyNameFn, getCompanyFeaturesFn } from '~/lib/server-fns/company'
import { parseFeatures, type CompanyFeatures } from '~/lib/features'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session.user || session.user.role !== 'company_admin') {
      throw redirect({ to: '/login' })
    }
    const [companyName, rawFeatures] = await Promise.all([
      session.user.companyId
        ? getCompanyNameFn({ data: { companyId: session.user.companyId } })
        : Promise.resolve(null),
      session.user.companyId
        ? getCompanyFeaturesFn({ data: { companyId: session.user.companyId } })
        : Promise.resolve(null),
    ])
    const features: CompanyFeatures = parseFeatures(rawFeatures)
    return { user: session.user, companyName, features }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const navigate = useNavigate()
  const { user, companyName } = Route.useRouteContext()
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

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300 md:relative md:z-auto md:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar
          role="company_admin"
          userName={user.name}
          companyName={companyName || undefined}
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
            aria-label="Open menu"
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
