import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/../db'
import { users, courseAssignments, lessonProgress, lessons, courses } from '~/../db/schema'
import { generateToken } from '../utils'

export const getEmployeesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const employees = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.companyId, data.companyId),
          eq(users.role, 'employee')
        )
      )

    const results = await Promise.all(
      employees.map(async (emp) => {
        // Get assigned courses
        const assignments = await db
          .select()
          .from(courseAssignments)
          .where(eq(courseAssignments.userId, emp.id))

        // Count total lessons across all assigned courses
        let totalLessons = 0
        for (const a of assignments) {
          const [count] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(lessons)
            .where(eq(lessons.courseId, a.courseId))
          totalLessons += count.count
        }

        // Count completed lessons
        const [completedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, emp.id),
              eq(lessonProgress.status, 'passed')
            )
          )
        const completedLessons = completedCount.count

        let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'
        if (completedLessons > 0 && completedLessons >= totalLessons && totalLessons > 0) {
          status = 'completed'
        } else if (completedLessons > 0) {
          status = 'in_progress'
        } else {
          // Check if there's any progress at all
          const [anyProgress] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(lessonProgress)
            .where(eq(lessonProgress.userId, emp.id))
          if (anyProgress.count > 0) status = 'in_progress'
        }

        return {
          id: emp.id,
          name: emp.name,
          personalToken: emp.personalToken,
          isActive: emp.isActive,
          createdAt: emp.createdAt,
          lastLoginAt: emp.lastLoginAt,
          status,
          coursesAssigned: assignments.length,
          lessonsCompleted: completedLessons,
          totalLessons,
          progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        }
      })
    )

    return results
  })

export const createEmployeeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; companyId: string }) => data)
  .handler(async ({ data }) => {
    const token = generateToken(24)

    const [newEmployee] = await db
      .insert(users)
      .values({
        name: data.name,
        role: 'employee',
        companyId: data.companyId,
        personalToken: token,
        isActive: true,
      })
      .returning()

    return { employee: newEmployee }
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
