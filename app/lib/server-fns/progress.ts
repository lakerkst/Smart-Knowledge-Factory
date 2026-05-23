import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { db } from '~/../db'
import { lessonProgress, questionAttempts } from '~/../db/schema'

export const updateProgressFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { userId: string; lessonId: string; maxWatchedPosition: number }) => data
  )
  .handler(async ({ data }) => {
    const [existing] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, data.userId),
          eq(lessonProgress.lessonId, data.lessonId)
        )
      )
      .limit(1)

    if (!existing) {
      const [progress] = await db
        .insert(lessonProgress)
        .values({
          userId: data.userId,
          lessonId: data.lessonId,
          status: 'in_progress',
          maxWatchedPosition: data.maxWatchedPosition,
          attemptCount: 0,
        })
        .returning()

      return { progress }
    }

    const newPosition = Math.max(existing.maxWatchedPosition, data.maxWatchedPosition)
    const newStatus =
      existing.status === 'locked' || existing.status === 'available'
        ? 'in_progress'
        : existing.status

    const [progress] = await db
      .update(lessonProgress)
      .set({
        maxWatchedPosition: newPosition,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(lessonProgress.id, existing.id))
      .returning()

    return { progress }
  })

export const submitAnswerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      userId: string
      lessonId: string
      questionId: string
      selectedIndex: number
      correctIndex: number
      attemptNumber: number
    }) => data
  )
  .handler(async ({ data }) => {
    const isCorrect = data.selectedIndex === data.correctIndex

    // Record the attempt
    await db.insert(questionAttempts).values({
      userId: data.userId,
      questionId: data.questionId,
      selectedIndex: data.selectedIndex,
      isCorrect,
      attemptNumber: data.attemptNumber,
    })

    // Update lesson progress attempt count
    const [existing] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, data.userId),
          eq(lessonProgress.lessonId, data.lessonId)
        )
      )
      .limit(1)

    if (existing) {
      await db
        .update(lessonProgress)
        .set({
          attemptCount: data.attemptNumber,
          updatedAt: new Date(),
        })
        .where(eq(lessonProgress.id, existing.id))
    }

    return { isCorrect, attemptNumber: data.attemptNumber }
  })

export const completeLessonFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; lessonId: string }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, data.userId),
          eq(lessonProgress.lessonId, data.lessonId)
        )
      )
      .limit(1)

    if (existing) {
      await db
        .update(lessonProgress)
        .set({
          status: 'passed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(lessonProgress.id, existing.id))
    } else {
      await db.insert(lessonProgress).values({
        userId: data.userId,
        lessonId: data.lessonId,
        status: 'passed',
        maxWatchedPosition: 0,
        attemptCount: 1,
        completedAt: new Date(),
      })
    }

    return { success: true }
  })
