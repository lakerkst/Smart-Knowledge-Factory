import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '~/../db'
import { lessonFeedback, lessons, courses, users } from '~/../db/schema'

export const submitFeedbackFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; lessonId: string; rating: number; comment?: string }) => data)
  .handler(async ({ data }) => {
    // Upsert: one feedback per user per lesson
    const existing = await db
      .select()
      .from(lessonFeedback)
      .where(and(eq(lessonFeedback.userId, data.userId), eq(lessonFeedback.lessonId, data.lessonId)))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(lessonFeedback)
        .set({ rating: data.rating, comment: data.comment ?? null })
        .where(eq(lessonFeedback.id, existing[0].id))
    } else {
      await db.insert(lessonFeedback).values({
        userId: data.userId,
        lessonId: data.lessonId,
        rating: data.rating,
        comment: data.comment ?? null,
      })
    }

    return { success: true }
  })

export const getLessonFeedbackStatsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    // Get all lessons belonging to this company's courses, with avg rating and recent comments
    const companyCourses = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.companyId, data.companyId))

    if (companyCourses.length === 0) return { lessonStats: [], recentComments: [] }

    const courseIds = companyCourses.map((c) => c.id)

    const allLessons = await db
      .select({ id: lessons.id, title: lessons.title, courseId: lessons.courseId })
      .from(lessons)
      .where(sql`${lessons.courseId} = ANY(ARRAY[${sql.raw(courseIds.map((id) => `'${id}'`).join(','))}]::uuid[])`)

    const lessonStats = await Promise.all(
      allLessons.map(async (lesson) => {
        const [stats] = await db
          .select({
            avgRating: sql<number>`round(avg(${lessonFeedback.rating})::numeric, 1)`,
            count: sql<number>`count(*)::int`,
          })
          .from(lessonFeedback)
          .where(eq(lessonFeedback.lessonId, lesson.id))

        const course = companyCourses.find((c) => c.id === lesson.courseId)

        return {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          courseTitle: course?.title ?? '—',
          // pg driver returns numeric as a string — coerce to JS number
          avgRating: stats.avgRating != null ? Number(stats.avgRating) : null,
          feedbackCount: Number(stats.count),
        }
      })
    )

    // Recent comments (last 20 with text)
    const recentRows = await db
      .select({
        id: lessonFeedback.id,
        rating: lessonFeedback.rating,
        comment: lessonFeedback.comment,
        createdAt: lessonFeedback.createdAt,
        lessonId: lessonFeedback.lessonId,
        userId: lessonFeedback.userId,
      })
      .from(lessonFeedback)
      .where(sql`${lessonFeedback.lessonId} = ANY(ARRAY[${sql.raw(allLessons.map((l) => `'${l.id}'`).join(','))}]::uuid[]) AND ${lessonFeedback.comment} IS NOT NULL`)
      .orderBy(desc(lessonFeedback.createdAt))
      .limit(20)

    const recentComments = await Promise.all(
      recentRows.map(async (row) => {
        const lesson = allLessons.find((l) => l.id === row.lessonId)
        const course = companyCourses.find((c) => c.id === lesson?.courseId)
        const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.userId)).limit(1)
        return {
          id: row.id,
          rating: row.rating,
          comment: row.comment!,
          createdAt: row.createdAt,
          lessonTitle: lesson?.title ?? '—',
          courseTitle: course?.title ?? '—',
          userName: user?.name ?? '—',
        }
      })
    )

    return {
      lessonStats: lessonStats.filter((s) => s.feedbackCount > 0),
      recentComments,
    }
  })
