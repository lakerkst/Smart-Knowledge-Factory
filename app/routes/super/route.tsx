import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { Sidebar } from '~/components/layout/sidebar'
import { getSessionFn, logoutFn } from '~/lib/server-fns/auth'

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

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role="super_admin"
        userName={user.name}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto bg-surface">
        <Outlet />
      </main>
    </div>
  )
}
