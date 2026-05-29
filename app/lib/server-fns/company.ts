import { createServerFn } from '@tanstack/react-start'
import { eq, and, gte, sql } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { setCookie } from '@tanstack/react-start/server'
import { createToken } from '../auth'
import { db } from '~/../db'
import { companies, users, courses, lessons, lessonProgress, activityLog, courseAssignments } from '~/../db/schema'
import { generateToken } from '../utils'

export const getCompanyNameFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1)
    return company?.name || null
  })

export const createCompanyWithAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyName: string; adminName: string; adminEmail: string; adminPassword: string; subscriptionExpiresAt?: string | null }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.adminEmail)).limit(1)
    if (existing) return { error: 'Email уже используется' }

    const passwordHash = await hash(data.adminPassword, 10)
    const [company] = await db.insert(companies).values({
      name: data.companyName,
      subscriptionExpiresAt: data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null,
    }).returning()

    await db.insert(users).values({
      name: data.adminName,
      email: data.adminEmail,
      passwordHash,
      role: 'company_admin',
      companyId: company.id,
      isActive: true,
    })
    return { company }
  })

export const toggleCompanyActiveFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyId: string; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const [updated] = await db.update(companies).set({ isActive: data.isActive, updatedAt: new Date() }).where(eq(companies.id, data.companyId)).returning()
    return { company: updated }
  })

export const updateCompanyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyId: string; companyName: string; adminName: string; adminEmail: string; subscriptionExpiresAt?: string | null }) => data)
  .handler(async ({ data }) => {
    // Check email uniqueness (excluding current admin)
    const [admin] = await db.select().from(users).where(and(eq(users.companyId, data.companyId), eq(users.role, 'company_admin'))).limit(1)
    if (admin && data.adminEmail !== admin.email) {
      const [emailConflict] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.adminEmail)).limit(1)
      if (emailConflict) return { error: 'Email уже используется' }
    }

    await db.update(companies).set({
      name: data.companyName,
      subscriptionExpiresAt: data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null,
      updatedAt: new Date(),
    }).where(eq(companies.id, data.companyId))

    if (admin) {
      await db.update(users).set({
        name: data.adminName,
        email: data.adminEmail,
        updatedAt: new Date(),
      }).where(eq(users.id, admin.id))
    }
    return { success: true }
  })

export const deleteCompanyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(companies).where(eq(companies.id, data.companyId))
    return { success: true }
  })

export const resetAdminPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const [admin] = await db.select().from(users).where(and(eq(users.companyId, data.companyId), eq(users.role, 'company_admin'))).limit(1)
    if (!admin) return { error: 'Админ не найден' }

    const newPassword = generateToken(10)
    const passwordHash = await hash(newPassword, 10)
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, admin.id))
    return { newPassword, adminEmail: admin.email }
  })

export const getCompanyDetailsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const [company] = await db.select().from(companies).where(eq(companies.id, data.companyId)).limit(1)
    if (!company) return null

    const [admin] = await db.select({ id: users.id, name: users.name, email: users.email, lastLoginAt: users.lastLoginAt })
      .from(users).where(and(eq(users.companyId, data.companyId), eq(users.role, 'company_admin'))).limit(1)

    const employees = await db.select({ id: users.id, isActive: users.isActive, lastLoginAt: users.lastLoginAt })
      .from(users).where(and(eq(users.companyId, data.companyId), eq(users.role, 'employee')))

    const companyCourses = await db.select({ id: courses.id, isPublished: courses.isPublished })
      .from(courses).where(eq(courses.companyId, data.companyId))

    const courseIds = companyCourses.map((c) => c.id)
    const lessonCount = courseIds.length > 0
      ? (await db.select({ count: sql<number>`count(*)::int` }).from(lessons).where(sql`${lessons.courseId} = ANY(${sql.raw(`ARRAY[${courseIds.map(() => '?').join(',')}]::uuid[]`, ...courseIds)})`)).catch(() => [{ count: 0 }])
      : [{ count: 0 }]

    // Simpler: just count lessons using a loop for small datasets
    let totalLessons = 0
    for (const cid of courseIds) {
      const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(lessons).where(eq(lessons.courseId, cid))
      totalLessons += r.count
    }

    // Active last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentActive = employees.filter((e) => e.lastLoginAt && new Date(e.lastLoginAt) >= sevenDaysAgo).length

    // Avg progress
    let avgProgress = 0
    if (employees.length > 0 && totalLessons > 0) {
      const empIds = employees.map((e) => e.id)
      let totalCompleted = 0
      for (const empId of empIds) {
        const [r] = await db.select({ count: sql<number>`count(*)::int` })
          .from(lessonProgress).where(and(eq(lessonProgress.userId, empId), eq(lessonProgress.status, 'passed')))
        totalCompleted += r.count
      }
      avgProgress = Math.round((totalCompleted / (employees.length * totalLessons)) * 100)
    }

    // Activity last 7 days
    const recentActivity = await db.select()
      .from(activityLog)
      .where(and(eq(activityLog.companyId, data.companyId), gte(activityLog.createdAt, sevenDaysAgo)))

    const logins7d = recentActivity.filter((a) => a.action === 'login').length
    const lessonsCompleted7d = recentActivity.filter((a) => a.action === 'lesson_completed').length

    return {
      id: company.id,
      name: company.name,
      isActive: company.isActive,
      subscriptionExpiresAt: company.subscriptionExpiresAt,
      createdAt: company.createdAt,
      admin: admin ?? null,
      stats: {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e) => e.isActive).length,
        recentActive7d: recentActive,
        totalCourses: companyCourses.length,
        publishedCourses: companyCourses.filter((c) => c.isPublished).length,
        totalLessons,
        avgProgress,
        logins7d,
        lessonsCompleted7d,
      },
    }
  })

// ─── Company list with features (for func-company page) ──────────────────────

export const getCompaniesListFn = createServerFn({ method: 'GET' }).handler(async () => {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      isActive: companies.isActive,
      features: companies.features,
    })
    .from(companies)
    .orderBy(companies.name)
  return rows
})

// ─── Company feature flags ────────────────────────────────────────────────────

export const getCompanyFeaturesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const [company] = await db
      .select({ features: companies.features })
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1)
    return company?.features ?? null
  })

export const setCompanyFeaturesFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyId: string; features: string }) => data)
  .handler(async ({ data }) => {
    await db
      .update(companies)
      .set({ features: data.features, updatedAt: new Date() })
      .where(eq(companies.id, data.companyId))
    return { success: true }
  })

export const impersonateCompanyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const [admin] = await db.select().from(users)
      .where(and(eq(users.companyId, data.companyId), eq(users.role, 'company_admin'))).limit(1)
    if (!admin) return { error: 'Администратор компании не найден' }

    const token = await createToken({
      userId: admin.id,
      email: admin.email!,
      role: admin.role,
      companyId: admin.companyId,
      name: admin.name,
    })

    setCookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/',
    })

    return { success: true }
  })
