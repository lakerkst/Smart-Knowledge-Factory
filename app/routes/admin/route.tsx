import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { Sidebar } from '~/components/layout/sidebar'
import { getSessionFn, logoutFn } from '~/lib/server-fns/auth'
import { mockCompanies } from '~/lib/mock-data'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session.user || session.user.role !== 'company_admin') {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const navigate = useNavigate()
  const { user } = Route.useRouteContext()
  const company = mockCompanies.find((c) => c.id === user.companyId)

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role="company_admin"
        userName={user.name}
        companyName={company?.name}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto bg-surface">
        <Outlet />
      </main>
    </div>
  )
}
