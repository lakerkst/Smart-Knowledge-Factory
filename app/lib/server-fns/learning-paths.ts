import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from '~/../db'
import {
  learningPaths,
  learningPathCourses,
  learningPathAssignments,
  courses,
  users,
  lessonProgress,
  lessons,
} from '~/../db/schema'

export const getPathsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const paths = await db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.companyId, data.companyId))

    const results = await Promise.all(
      paths.map(async (path) => {
        const pathCourses = await db
          .select({ id: learningPathCourses.id, courseId: learningPathCourses.courseId, orderIndex: learningPathCourses.orderIndex })
          .from(learningPathCourses)
          .where(eq(learningPathCourses.pathId, path.id))
          .orderBy(asc(learningPathCourses.orderIndex))

        const courseDetails = await Promise.all(
          pathCourses.map(async (pc) => {
            const [course] = await db.select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.id, pc.courseId)).limit(1)
            return { ...pc, courseTitle: course?.title ?? '—' }
          })
        )

        const [assignedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(learningPathAssignments)
          .where(eq(learningPathAssignments.pathId, path.id))

        return { ...path, courses: courseDetails, assignedCount: assignedCount.count }
      })
    )

    return results
  })

export const createPathFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyId: string; title: string; description?: string }) => data)
  .handler(async ({ data }) => {
    const [path] = await db
      .insert(learningPaths)
      .values({ companyId: data.companyId, title: data.title, description: data.description || null })
      .returning()
    return { path }
  })

export const updatePathFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { pathId: string; title?: string; description?: string; isActive?: boolean }) => data)
  .handler(async ({ data }) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.isActive !== undefined) updates.isActive = data.isActive
    const [path] = await db.update(learningPaths).set(updates).where(eq(learningPaths.id, data.pathId)).returning()
    return { path }
  })

export const deletePathFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { pathId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(learningPaths).where(eq(learningPaths.id, data.pathId))
    return { success: true }
  })

export const addCourseToPathFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { pathId: string; courseId: string }) => data)
  .handler(async ({ data }) => {
    const existing = await db
      .select()
      .from(learningPathCourses)
      .where(and(eq(learningPathCourses.pathId, data.pathId), eq(learningPathCourses.courseId, data.courseId)))
      .limit(1)
    if (existing.length > 0) return { error: 'Курс уже в траектории' }

    const [maxOrder] = await db
      .select({ maxIdx: sql<number>`coalesce(max(${learningPathCourses.orderIndex}), -1)::int` })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.pathId, data.pathId))

    const [pc] = await db
      .insert(learningPathCourses)
      .values({ pathId: data.pathId, courseId: data.courseId, orderIndex: maxOrder.maxIdx + 1 })
      .returning()
    return { pathCourse: pc }
  })

export const removeCourseFromPathFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { pathCourseId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(learningPathCourses).where(eq(learningPathCourses.id, data.pathCourseId))
    return { success: true }
  })

export const reorderPathCourseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { pathCourseId: string; direction: 'up' | 'down' }) => data)
  .handler(async ({ data }) => {
    const [pc] = await db.select().from(learningPathCourses).where(eq(learningPathCourses.id, data.pathCourseId)).limit(1)
    if (!pc) return { error: 'Не найдено' }

    const targetIndex = data.direction === 'up' ? pc.orderIndex - 1 : pc.orderIndex + 1
    const [neighbor] = await db
      .select()
      .from(learningPathCourses)
      .where(and(eq(learningPathCourses.pathId, pc.pathId), eq(learningPathCourses.orderIndex, targetIndex)))
      .limit(1)

    if (!neighbor) return { error: 'Некуда перемещать' }

    await db.update(learningPathCourses).set({ orderIndex: targetIndex }).where(eq(learningPathCourses.id, pc.id))
    await db.update(learningPathCourses).set({ orderIndex: pc.orderIndex }).where(eq(learningPathCourses.id, neighbor.id))
    return { success: true }
  })

export const assignPathFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { pathId: string; userIds: string[] }) => data)
  .handler(async ({ data }) => {
    let assigned = 0
    for (const userId of data.userIds) {
      const existing = await db
        .select()
        .from(learningPathAssignments)
        .where(and(eq(learningPathAssignments.pathId, data.pathId), eq(learningPathAssignments.userId, userId)))
        .limit(1)
      if (existing.length > 0) continue
      await db.insert(learningPathAssignments).values({ pathId: data.pathId, userId })
      assigned++
    }
    return { assigned }
  })

export const unassignPathFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { pathId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(learningPathAssignments).where(
      and(eq(learningPathAssignments.pathId, data.pathId), eq(learningPathAssignments.userId, data.userId))
    )
    return { success: true }
  })

// Returns paths with lock state for a specific employee on the learn page
export const getEmployeePathsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const assignments = await db
      .select({ pathId: learningPathAssignments.pathId })
      .from(learningPathAssignments)
      .where(eq(learningPathAssignments.userId, data.userId))

    if (assignments.length === 0) return []

    const pathIds = assignments.map((a) => a.pathId)

    const results = await Promise.all(
      pathIds.map(async (pathId) => {
        const pathCourses = await db
          .select()
          .from(learningPathCourses)
          .where(eq(learningPathCourses.pathId, pathId))
          .orderBy(asc(learningPathCourses.orderIndex))

        // For each course in path, determine if it's locked (previous course not 100% complete)
        const coursesWithLock = await Promise.all(
          pathCourses.map(async (pc, index) => {
            if (index === 0) return { courseId: pc.courseId, locked: false }

            // Check if previous course is 100% complete
            const prevCourseId = pathCourses[index - 1].courseId
            const courseLessons = await db
              .select({ id: lessons.id })
              .from(lessons)
              .where(eq(lessons.courseId, prevCourseId))

            if (courseLessons.length === 0) return { courseId: pc.courseId, locked: false }

            const [completedCount] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(lessonProgress)
              .where(
                and(
                  eq(lessonProgress.userId, data.userId),
                  eq(lessonProgress.status, 'passed'),
                  sql`${lessonProgress.lessonId} IN (SELECT id FROM lessons WHERE course_id = ${prevCourseId})`
                )
              )

            const prevComplete = completedCount.count >= courseLessons.length
            return { courseId: pc.courseId, locked: !prevComplete }
          })
        )

        return { pathId, courses: coursesWithLock }
      })
    )

    // Flatten to a map: courseId -> locked
    const lockMap: Record<string, boolean> = {}
    for (const path of results) {
      for (const c of path.courses) {
        // A course is locked if it's locked in ANY path (conservative)
        if (lockMap[c.courseId] === undefined) {
          lockMap[c.courseId] = c.locked
        } else {
          lockMap[c.courseId] = lockMap[c.courseId] && c.locked
        }
      }
    }

    return Object.entries(lockMap).map(([courseId, locked]) => ({ courseId, locked }))
  })
