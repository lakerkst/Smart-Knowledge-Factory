import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, sql, desc } from 'drizzle-orm'
import { db } from '~/../db'
import { courses, finalTestQuestions, finalTestAttempts } from '~/../db/schema'

export const updateCourseFinalTestFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { courseId: string; finalTestEnabled: boolean; passingScore: number }) => data)
  .handler(async ({ data }) => {
    const [course] = await db
      .update(courses)
      .set({ finalTestEnabled: data.finalTestEnabled, passingScore: data.passingScore, updatedAt: new Date() })
      .where(eq(courses.id, data.courseId))
      .returning()
    return { course }
  })

export const createFinalTestQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { courseId: string; text: string; options: string[]; correctIndex: number }) => data)
  .handler(async ({ data }) => {
    const [maxOrder] = await db
      .select({ maxIdx: sql<number>`coalesce(max(${finalTestQuestions.orderIndex}), -1)::int` })
      .from(finalTestQuestions)
      .where(eq(finalTestQuestions.courseId, data.courseId))

    const [question] = await db
      .insert(finalTestQuestions)
      .values({
        courseId: data.courseId,
        text: data.text,
        options: JSON.stringify(data.options),
        correctIndex: data.correctIndex,
        orderIndex: maxOrder.maxIdx + 1,
      })
      .returning()
    return { question }
  })

export const updateFinalTestQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { questionId: string; text?: string; options?: string[]; correctIndex?: number }) => data)
  .handler(async ({ data }) => {
    const updates: Record<string, unknown> = {}
    if (data.text !== undefined) updates.text = data.text
    if (data.options !== undefined) updates.options = JSON.stringify(data.options)
    if (data.correctIndex !== undefined) updates.correctIndex = data.correctIndex

    const [question] = await db
      .update(finalTestQuestions)
      .set(updates)
      .where(eq(finalTestQuestions.id, data.questionId))
      .returning()
    return { question }
  })

export const deleteFinalTestQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { questionId: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(finalTestQuestions).where(eq(finalTestQuestions.id, data.questionId))
    return { success: true }
  })

export const getFinalTestFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { courseId: string }) => data)
  .handler(async ({ data }) => {
    const [course] = await db
      .select({ finalTestEnabled: courses.finalTestEnabled, passingScore: courses.passingScore })
      .from(courses)
      .where(eq(courses.id, data.courseId))
      .limit(1)

    if (!course) return { enabled: false, passingScore: 80, questions: [] }

    const qs = await db
      .select()
      .from(finalTestQuestions)
      .where(eq(finalTestQuestions.courseId, data.courseId))
      .orderBy(asc(finalTestQuestions.orderIndex))

    return {
      enabled: course.finalTestEnabled,
      passingScore: course.passingScore,
      questions: qs.map((q) => ({ ...q, options: JSON.parse(q.options) as string[] })),
    }
  })

export const submitFinalTestFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; courseId: string; answers: number[] }) => data)
  .handler(async ({ data }) => {
    const [course] = await db
      .select({ passingScore: courses.passingScore })
      .from(courses)
      .where(eq(courses.id, data.courseId))
      .limit(1)

    if (!course) return { error: 'Курс не найден' }

    const qs = await db
      .select()
      .from(finalTestQuestions)
      .where(eq(finalTestQuestions.courseId, data.courseId))
      .orderBy(asc(finalTestQuestions.orderIndex))

    if (qs.length === 0) return { error: 'Вопросов нет' }

    let correct = 0
    for (let i = 0; i < qs.length; i++) {
      if (data.answers[i] === qs[i].correctIndex) correct++
    }

    const score = Math.round((correct / qs.length) * 100)
    const passed = score >= course.passingScore

    await db.insert(finalTestAttempts).values({
      userId: data.userId,
      courseId: data.courseId,
      score,
      passed,
      answers: JSON.stringify(data.answers),
    })

    return { score, passed, correct, total: qs.length, passingScore: course.passingScore }
  })

export const getMyFinalTestAttemptsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string; courseId: string }) => data)
  .handler(async ({ data }) => {
    const attempts = await db
      .select()
      .from(finalTestAttempts)
      .where(and(eq(finalTestAttempts.userId, data.userId), eq(finalTestAttempts.courseId, data.courseId)))
      .orderBy(desc(finalTestAttempts.createdAt))
    return { attempts }
  })
