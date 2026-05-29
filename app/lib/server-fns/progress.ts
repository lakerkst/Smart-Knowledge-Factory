import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { db } from '~/../db'
import { lessonProgress, questionAttempts, users, activityLog } from '~/../db/schema'

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

    // Look up user for companyId (needed for activity log)
    const [user] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, data.userId)).limit(1)

    // Record the attempt and log activity in parallel
    const existing = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, data.userId),
          eq(lessonProgress.lessonId, data.lessonId)
        )
      )
      .limit(1)
      .then((rows) => rows[0])

    await Promise.all([
      db.insert(questionAttempts).values({
        userId: data.userId,
        questionId: data.questionId,
        selectedIndex: data.selectedIndex,
        isCorrect,
        attemptNumber: data.attemptNumber,
      }),
      existing
        ? db.update(lessonProgress).set({ attemptCount: data.attemptNumber, updatedAt: new Date() }).where(eq(lessonProgress.id, existing.id))
        : Promise.resolve(),
      user?.companyId
        ? db.insert(activityLog).values({
            userId: data.userId,
            companyId: user.companyId,
            action: 'question_answered',
            metadata: JSON.stringify({ questionId: data.questionId, isCorrect }),
          })
        : Promise.resolve(),
    ])

    return { isCorrect, attemptNumber: data.attemptNumber }
  })

export const completeLessonFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; lessonId: string }) => data)
  .handler(async ({ data }) => {
    const now = new Date()

    // Look up user for companyId (needed for activity log)
    const [user] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, data.userId)).limit(1)

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

    await Promise.all([
      existing
        ? db.update(lessonProgress).set({ status: 'passed', completedAt: now, updatedAt: now }).where(eq(lessonProgress.id, existing.id))
        : db.insert(lessonProgress).values({
            userId: data.userId,
            lessonId: data.lessonId,
            status: 'passed',
            maxWatchedPosition: 0,
            attemptCount: 1,
            completedAt: now,
          }),
      user?.companyId
        ? db.insert(activityLog).values({
            userId: data.userId,
            companyId: user.companyId,
            action: 'lesson_completed',
            metadata: JSON.stringify({ lessonId: data.lessonId }),
          })
        : Promise.resolve(),
    ])

    return { success: true }
  })
