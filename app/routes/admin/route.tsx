import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { Sidebar } from '~/components/layout/sidebar'
import { getSessionFn, logoutFn } from '~/lib/server-fns/auth'
import { getCompanyNameFn } from '~/lib/server-fns/company'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session.user || session.user.role !== 'company_admin') {
      throw redirect({ to: '/login' })
    }
    const companyName = session.user.companyId
      ? await getCompanyNameFn({ data: { companyId: session.user.companyId } })
      : null
    return { user: session.user, companyName }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const navigate = useNavigate()
  const { user, companyName } = Route.useRouteContext()

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role="company_admin"
        userName={user.name}
        companyName={companyName || undefined}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto bg-surface">
        <Outlet />
      </main>
    </div>
  )
}
