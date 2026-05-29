import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { eq, and } from 'drizzle-orm'
import { compare, hash } from 'bcryptjs'
import { createToken, verifyToken } from '../auth'
import { db } from '~/../db'
import { users, activityLog } from '~/../db/schema'

// ---- Simple in-memory rate limiter for token endpoint ----
// Limits each token to RATE_LIMIT requests per window to prevent enumeration / abuse.
const _rlMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000 // 1 minute

function tokenRateLimit(token: string): boolean {
  const now = Date.now()
  const entry = _rlMap.get(token)
  if (!entry || now > entry.resetAt) {
    _rlMap.set(token, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

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
    // Rate-limit: block excessive requests for the same token
    if (!tokenRateLimit(data.token)) {
      return { employee: null }
    }

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

    const now = new Date()
    // Only log a new session if the previous login was >30 min ago (dedup refreshes)
    const isNewSession =
      !user.lastLoginAt || now.getTime() - user.lastLoginAt.getTime() > 30 * 60 * 1000

    await Promise.all([
      db.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id)),
      isNewSession && user.companyId
        ? db.insert(activityLog).values({
            userId: user.id,
            companyId: user.companyId,
            action: 'login',
          })
        : Promise.resolve(),
    ])

    return {
      employee: {
        id: user.id,
        name: user.name,
        companyId: user.companyId,
      },
    }
  })

export const changePasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; currentPassword: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1)
    if (!user || !user.passwordHash) return { error: 'Пользователь не найден' }

    const valid = await compare(data.currentPassword, user.passwordHash)
    if (!valid) return { error: 'Текущий пароль неверный' }

    const newHash = await hash(data.newPassword, 10)
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, data.userId))
    return { success: true }
  })
