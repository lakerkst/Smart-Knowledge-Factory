import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, sql, inArray } from 'drizzle-orm'
import { db } from '~/../db'
import {
  courses,
  lessons,
  questions,
  courseAssignments,
  lessonProgress,
} from '~/../db/schema'

// ---- Mutations ----

export const createCourseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { title: string; description?: string; companyId: string }) => data)
  .handler(async ({ data }) => {
    const [course] = await db
      .insert(courses)
      .values({
        title: data.title,
        description: data.description || null,
        companyId: data.companyId,
        isPublished: false,
      })
      .returning()
    return { course }
  })

export const updateCourseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { courseId: string; title?: string; description?: string; isPublished?: boolean; coverImage?: string; quizMode?: string }) => data)
  .handler(async ({ data }) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.isPublished !== undefined) updates.isPublished = data.isPublished
    if (data.coverImage !== undefined) updates.coverImage = data.coverImage || null
    if (data.quizMode !== undefined) updates.quizMode = data.quizMode

    const [course] = await db
      .update(courses)
      .set(updates)
      .where(eq(courses.id, data.courseId))
      .returning()
    return { course }
  })

export const deleteCourseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { courseId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(courses).where(eq(courses.id, data.courseId))
    return { success: true }
  })

export const createLessonFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { courseId: string; title: string; vimeoId?: string; duration?: number }) => data)
  .handler(async ({ data }) => {
    // Get max orderIndex for this course
    const existing = await db
      .select({ maxIdx: sql<number>`coalesce(max(${lessons.orderIndex}), -1)::int` })
      .from(lessons)
      .where(eq(lessons.courseId, data.courseId))

    const [lesson] = await db
      .insert(lessons)
      .values({
        courseId: data.courseId,
        title: data.title,
        vimeoId: data.vimeoId || null,
        duration: data.duration || 0,
        orderIndex: existing[0].maxIdx + 1,
      })
      .returning()
    return { lesson }
  })

export const updateLessonFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { lessonId: string; title?: string; vimeoId?: string; duration?: number }) => data)
  .handler(async ({ data }) => {
    const updates: Record<string, unknown> = {}
    if (data.title !== undefined) updates.title = data.title
    if (data.vimeoId !== undefined) updates.vimeoId = data.vimeoId
    if (data.duration !== undefined) updates.duration = data.duration

    const [lesson] = await db
      .update(lessons)
      .set(updates)
      .where(eq(lessons.id, data.lessonId))
      .returning()
    return { lesson }
  })

export const reorderLessonFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { lessonId: string; direction: 'up' | 'down' }) => data)
  .handler(async ({ data }) => {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, data.lessonId)).limit(1)
    if (!lesson) return { error: 'Урок не найден' }

    const targetIndex = data.direction === 'up' ? lesson.orderIndex - 1 : lesson.orderIndex + 1
    const [neighbor] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.courseId, lesson.courseId), eq(lessons.orderIndex, targetIndex)))
      .limit(1)

    if (!neighbor) return { error: 'Некуда перемещать' }

    // Swap orderIndex values
    await db.update(lessons).set({ orderIndex: targetIndex }).where(eq(lessons.id, lesson.id))
    await db.update(lessons).set({ orderIndex: lesson.orderIndex }).where(eq(lessons.id, neighbor.id))

    return { success: true }
  })

export const deleteLessonFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { lessonId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(lessons).where(eq(lessons.id, data.lessonId))
    return { success: true }
  })

export const createQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    lessonId: string
    text: string
    options: string[]
    correctIndex: number
    timecodeStart: number
    timecodeTrigger: number
  }) => data)
  .handler(async ({ data }) => {
    const existing = await db
      .select({ maxIdx: sql<number>`coalesce(max(${questions.orderIndex}), -1)::int` })
      .from(questions)
      .where(eq(questions.lessonId, data.lessonId))

    const [question] = await db
      .insert(questions)
      .values({
        lessonId: data.lessonId,
        text: data.text,
        options: JSON.stringify(data.options),
        correctIndex: data.correctIndex,
        timecodeStart: data.timecodeStart,
        timecodeTrigger: data.timecodeTrigger,
        orderIndex: existing[0].maxIdx + 1,
      })
      .returning()
    return { question }
  })

export const updateQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    questionId: string
    text?: string
    options?: string[]
    correctIndex?: number
    timecodeStart?: number
    timecodeTrigger?: number
  }) => data)
  .handler(async ({ data }) => {
    const updates: Record<string, unknown> = {}
    if (data.text !== undefined) updates.text = data.text
    if (data.options !== undefined) updates.options = JSON.stringify(data.options)
    if (data.correctIndex !== undefined) updates.correctIndex = data.correctIndex
    if (data.timecodeStart !== undefined) updates.timecodeStart = data.timecodeStart
    if (data.timecodeTrigger !== undefined) updates.timecodeTrigger = data.timecodeTrigger

    const [question] = await db
      .update(questions)
      .set(updates)
      .where(eq(questions.id, data.questionId))
      .returning()
    return { question }
  })

export const deleteQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { questionId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(questions).where(eq(questions.id, data.questionId))
    return { success: true }
  })

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
          .where(and(eq(courses.id, assignment.courseId), eq(courses.isPublished, true)))
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
          deadline: assignment.deadline ?? null,
        }
      })
    )

    return results.filter(Boolean)
  })
