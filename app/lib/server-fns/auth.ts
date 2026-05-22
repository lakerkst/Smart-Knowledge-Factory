import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { createToken, verifyToken } from '../auth'
import { mockUsers } from '../mock-data'

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const user = mockUsers.find(
      (u) => u.email === data.email && (u.role === 'company_admin' || u.role === 'super_admin')
    )

    if (!user) {
      return { error: 'Неверный email или пароль' }
    }

    if (data.password !== 'demo123') {
      return { error: 'Неверный email или пароль' }
    }

    const token = await createToken({
      userId: user.id,
      email: user.email!,
      role: user.role,
      companyId: user.companyId,
      name: user.name,
    })

    setCookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    }
  })

export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const token = getCookie('auth_token')
  if (!token) return { user: null }

  const payload = await verifyToken(token)
  if (!payload) return { user: null }

  return { user: payload }
})

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  deleteCookie('auth_token', { path: '/' })
  return { success: true }
})

export const getEmployeeByTokenFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const user = mockUsers.find((u) => u.personalToken === data.token && u.role === 'employee')
    if (!user) return { employee: null }

    return {
      employee: {
        id: user.id,
        name: user.name,
        companyId: user.companyId,
      },
    }
  })
