import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '~/../db'
import { users, courseAssignments, lessonProgress, lessons, courses, questionAttempts } from '~/../db/schema'
import { generateToken } from '../utils'

export const getEmployeesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const employees = await db
      .select()
      .from(users)
      .where(and(eq(users.companyId, data.companyId), eq(users.role, 'employee')))

    const results = await Promise.all(
      employees.map(async (emp) => {
        const assignments = await db
          .select()
          .from(courseAssignments)
          .where(eq(courseAssignments.userId, emp.id))

        let totalLessons = 0
        for (const a of assignments) {
          const [count] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(lessons)
            .where(eq(lessons.courseId, a.courseId))
          totalLessons += count.count
        }

        const [completedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(lessonProgress)
          .where(and(eq(lessonProgress.userId, emp.id), eq(lessonProgress.status, 'passed')))
        const completedLessons = completedCount.count

        let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'
        if (completedLessons > 0 && completedLessons >= totalLessons && totalLessons > 0) {
          status = 'completed'
        } else if (completedLessons > 0) {
          status = 'in_progress'
        } else {
          const [anyProgress] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(lessonProgress)
            .where(eq(lessonProgress.userId, emp.id))
          if (anyProgress.count > 0) status = 'in_progress'
        }

        return {
          id: emp.id,
          name: emp.name,
          position: emp.position,
          personalToken: emp.personalToken,
          isActive: emp.isActive,
          createdAt: emp.createdAt,
          lastLoginAt: emp.lastLoginAt,
          status,
          coursesAssigned: assignments.length,
          assignedCourseIds: assignments.map((a) => a.courseId),
          // Full assignment records (includes deadline)
          courseAssignments: assignments.map((a) => ({
            courseId: a.courseId,
            deadline: a.deadline,
          })),
          lessonsCompleted: completedLessons,
          totalLessons,
          progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        }
      })
    )

    return results
  })

export const createEmployeeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; companyId: string; position?: string }) => data)
  .handler(async ({ data }) => {
    const token = generateToken(24)
    const [newEmployee] = await db
      .insert(users)
      .values({
        name: data.name,
        role: 'employee',
        companyId: data.companyId,
        personalToken: token,
        position: data.position || null,
        isActive: true,
      })
      .returning()
    return { employee: newEmployee }
  })

export const updateEmployeeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { employeeId: string; name: string; position?: string }) => data)
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(users)
      .set({ name: data.name, position: data.position || null, updatedAt: new Date() })
      .where(eq(users.id, data.employeeId))
      .returning()
    return { employee: updated }
  })

export const generateLinkFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { employeeId: string }) => data)
  .handler(async ({ data }) => {
    const token = generateToken(24)
    const [updated] = await db
      .update(users)
      .set({ personalToken: token, updatedAt: new Date() })
      .where(eq(users.id, data.employeeId))
      .returning()
    if (!updated) return { error: 'Сотрудник не найден' }
    return { token, link: `/learn/${token}` }
  })

export const toggleEmployeeActiveFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { employeeId: string; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(users)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(users.id, data.employeeId))
      .returning()
    return { employee: updated }
  })

export const resetProgressFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { employeeId: string; courseId?: string }) => data)
  .handler(async ({ data }) => {
    if (data.courseId) {
      const courseLessons = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.courseId, data.courseId))
      const lessonIds = courseLessons.map((l) => l.id)
      if (lessonIds.length > 0) {
        for (const lessonId of lessonIds) {
          await db.delete(questionAttempts).where(eq(questionAttempts.userId, data.employeeId))
          await db
            .delete(lessonProgress)
            .where(and(eq(lessonProgress.userId, data.employeeId), eq(lessonProgress.lessonId, lessonId)))
        }
      }
    } else {
      await db.delete(questionAttempts).where(eq(questionAttempts.userId, data.employeeId))
      await db.delete(lessonProgress).where(eq(lessonProgress.userId, data.employeeId))
    }
    return { success: true }
  })

export const assignCourseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; courseId: string }) => data)
  .handler(async ({ data }) => {
    const existing = await db
      .select()
      .from(courseAssignments)
      .where(and(eq(courseAssignments.userId, data.userId), eq(courseAssignments.courseId, data.courseId)))
      .limit(1)
    if (existing.length > 0) return { error: 'Курс уже назначен' }
    const [assignment] = await db
      .insert(courseAssignments)
      .values({ userId: data.userId, courseId: data.courseId })
      .returning()
    return { assignment }
  })

export const unassignCourseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; courseId: string }) => data)
  .handler(async ({ data }) => {
    await db
      .delete(courseAssignments)
      .where(and(eq(courseAssignments.userId, data.userId), eq(courseAssignments.courseId, data.courseId)))
    return { success: true }
  })

// ---- New functions ----

export const bulkAssignCourseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { courseId: string; userIds: string[] }) => data)
  .handler(async ({ data }) => {
    let assigned = 0
    for (const userId of data.userIds) {
      const existing = await db
        .select({ id: courseAssignments.id })
        .from(courseAssignments)
        .where(and(eq(courseAssignments.userId, userId), eq(courseAssignments.courseId, data.courseId)))
        .limit(1)
      if (existing.length > 0) continue
      await db.insert(courseAssignments).values({ userId, courseId: data.courseId })
      assigned++
    }
    return { assigned }
  })

export const setAssignmentDeadlineFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; courseId: string; deadline: string | null }) => data)
  .handler(async ({ data }) => {
    await db
      .update(courseAssignments)
      .set({ deadline: data.deadline ? new Date(data.deadline) : null })
      .where(and(eq(courseAssignments.userId, data.userId), eq(courseAssignments.courseId, data.courseId)))
    return { success: true }
  })

export const deleteEmployeeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { employeeId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(users).where(eq(users.id, data.employeeId))
    return { success: true }
  })

export const bulkDeleteEmployeesFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { employeeIds: string[] }) => data)
  .handler(async ({ data }) => {
    if (data.employeeIds.length === 0) return { deleted: 0 }
    await db.delete(users).where(inArray(users.id, data.employeeIds))
    return { deleted: data.employeeIds.length }
  })

// Lightweight employee list + isAssigned flag for a given course — used in bulk assign dialog
export const getBulkAssignDataFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string; courseId: string }) => data)
  .handler(async ({ data }) => {
    const [employees, assignments] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, isActive: users.isActive, personalToken: users.personalToken })
        .from(users)
        .where(and(eq(users.companyId, data.companyId), eq(users.role, 'employee'))),
      db
        .select({ userId: courseAssignments.userId })
        .from(courseAssignments)
        .where(eq(courseAssignments.courseId, data.courseId)),
    ])
    const assignedIds = new Set(assignments.map((a) => a.userId))
    return employees.map((emp) => ({ ...emp, isAssigned: assignedIds.has(emp.id) }))
  })
