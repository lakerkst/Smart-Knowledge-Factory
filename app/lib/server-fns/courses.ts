import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from '~/../db'
import {
  courses,
  lessons,
  questions,
  courseAssignments,
  lessonProgress,
} from '~/../db/schema'

export const getCoursesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const companyCourses = await db
      .select()
      .from(courses)
      .where(eq(courses.companyId, data.companyId))

    const results = await Promise.all(
      companyCourses.map(async (course) => {
        const courseLessons = await db
          .select()
          .from(lessons)
          .where(eq(lessons.courseId, course.id))

        const [assignedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(courseAssignments)
          .where(eq(courseAssignments.courseId, course.id))

        return {
          ...course,
          lessonsCount: courseLessons.length,
          assignedCount: assignedCount.count,
          totalDuration: courseLessons.reduce((acc, l) => acc + l.duration, 0),
        }
      })
    )

    return results
  })

export const getCourseFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { courseId: string }) => data)
  .handler(async ({ data }) => {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, data.courseId))
      .limit(1)

    if (!course) return { course: null }

    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, course.id))
      .orderBy(asc(lessons.orderIndex))

    const lessonsWithQuestions = await Promise.all(
      courseLessons.map(async (lesson) => {
        const lessonQuestions = await db
          .select()
          .from(questions)
          .where(eq(questions.lessonId, lesson.id))
          .orderBy(asc(questions.orderIndex))

        return {
          ...lesson,
          questions: lessonQuestions.map((q) => ({
            ...q,
            options: JSON.parse(q.options) as string[],
          })),
        }
      })
    )

    return { course: { ...course, lessons: lessonsWithQuestions } }
  })

export const getEmployeeCourseFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string; courseId: string }) => data)
  .handler(async ({ data }) => {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, data.courseId))
      .limit(1)

    if (!course) return { course: null }

    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, course.id))
      .orderBy(asc(lessons.orderIndex))

    const lessonsWithProgress = await Promise.all(
      courseLessons.map(async (lesson, index) => {
        const [progress] = await db
          .select()
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, data.userId),
              eq(lessonProgress.lessonId, lesson.id)
            )
          )
          .limit(1)

        const lessonQuestions = await db
          .select()
          .from(questions)
          .where(eq(questions.lessonId, lesson.id))
          .orderBy(asc(questions.orderIndex))

        let status: 'locked' | 'available' | 'in_progress' | 'passed' = 'locked'
        if (progress) {
          status = progress.status
        } else if (index === 0) {
          status = 'available'
        } else {
          // Check if previous lesson is passed
          const prevLesson = courseLessons[index - 1]
          const [prevProgress] = await db
            .select()
            .from(lessonProgress)
            .where(
              and(
                eq(lessonProgress.userId, data.userId),
                eq(lessonProgress.lessonId, prevLesson.id)
              )
            )
            .limit(1)
          if (prevProgress?.status === 'passed') status = 'available'
        }

        return {
          ...lesson,
          questions: lessonQuestions.map((q) => ({
            ...q,
            options: JSON.parse(q.options) as string[],
          })),
          status,
          maxWatchedPosition: progress?.maxWatchedPosition || 0,
          attemptCount: progress?.attemptCount || 0,
        }
      })
    )

    return { course: { ...course, lessons: lessonsWithProgress } }
  })

export const getEmployeeCoursesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const assignments = await db
      .select()
      .from(courseAssignments)
      .where(eq(courseAssignments.userId, data.userId))

    const results = await Promise.all(
      assignments.map(async (assignment) => {
        const [course] = await db
          .select()
          .from(courses)
          .where(eq(courses.id, assignment.courseId))
          .limit(1)

        if (!course) return null

        const courseLessons = await db
          .select()
          .from(lessons)
          .where(eq(lessons.courseId, course.id))

        const [completedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, data.userId),
              eq(lessonProgress.status, 'passed'),
              sql`${lessonProgress.lessonId} IN (SELECT id FROM lessons WHERE course_id = ${course.id})`
            )
          )

        return {
          ...course,
          lessonsCount: courseLessons.length,
          completedLessons: completedCount.count,
          progress:
            courseLessons.length > 0
              ? Math.round((completedCount.count / courseLessons.length) * 100)
              : 0,
        }
      })
    )

    return results.filter(Boolean)
  })
