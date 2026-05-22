import { createServerFn } from '@tanstack/react-start'
import { mockLessonProgress } from '../mock-data'

const localProgress = [...mockLessonProgress]

export const updateProgressFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { userId: string; lessonId: string; maxWatchedPosition: number }) => data
  )
  .handler(async ({ data }) => {
    let progress = localProgress.find(
      (lp) => lp.userId === data.userId && lp.lessonId === data.lessonId
    )

    if (!progress) {
      progress = {
        id: `lp-${Date.now()}`,
        userId: data.userId,
        lessonId: data.lessonId,
        status: 'in_progress' as const,
        maxWatchedPosition: data.maxWatchedPosition,
        attemptCount: 0,
        completedAt: null,
      }
      localProgress.push(progress)
    } else {
      if (data.maxWatchedPosition > progress.maxWatchedPosition) {
        progress.maxWatchedPosition = data.maxWatchedPosition
      }
      if (progress.status === 'locked' || progress.status === 'available') {
        progress.status = 'in_progress'
      }
    }

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

    let progress = localProgress.find(
      (lp) => lp.userId === data.userId && lp.lessonId === data.lessonId
    )

    if (progress) {
      progress.attemptCount = data.attemptNumber
    }

    return {
      isCorrect,
      attemptNumber: data.attemptNumber,
    }
  })

export const completeLessonFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; lessonId: string }) => data)
  .handler(async ({ data }) => {
    let progress = localProgress.find(
      (lp) => lp.userId === data.userId && lp.lessonId === data.lessonId
    )

    if (progress) {
      progress.status = 'passed'
      progress.completedAt = new Date()
    } else {
      localProgress.push({
        id: `lp-${Date.now()}`,
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
