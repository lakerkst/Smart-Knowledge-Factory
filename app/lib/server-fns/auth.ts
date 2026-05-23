import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { eq, and } from 'drizzle-orm'
import { compare } from 'bcryptjs'
import { createToken, verifyToken } from '../auth'
import { db } from '~/../db'
import { users } from '~/../db/schema'

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)

    if (!user || !user.passwordHash) {
      return { error: 'Неверный email или пароль' }
    }

    if (user.role === 'employee') {
      return { error: 'Сотрудники входят по персональной ссылке' }
    }

    const validPassword = await compare(data.password, user.passwordHash)
    if (!validPassword) {
      return { error: 'Неверный email или пароль' }
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

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
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.personalToken, data.token),
          eq(users.role, 'employee'),
          eq(users.isActive, true)
        )
      )
      .limit(1)

    if (!user) return { employee: null }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

    return {
      employee: {
        id: user.id,
        name: user.name,
        companyId: user.companyId,
      },
    }
  })
