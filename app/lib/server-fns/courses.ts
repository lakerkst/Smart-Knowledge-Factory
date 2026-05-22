import { createServerFn } from '@tanstack/react-start'
import {
  mockCourses,
  mockLessons,
  mockQuestions,
  mockCourseAssignments,
  mockLessonProgress,
} from '../mock-data'

export const getCoursesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const courses = mockCourses.filter((c) => c.companyId === data.companyId)

    return courses.map((course) => {
      const lessons = mockLessons.filter((l) => l.courseId === course.id)
      const assignments = mockCourseAssignments.filter((a) => a.courseId === course.id)

      return {
        ...course,
        lessonsCount: lessons.length,
        assignedCount: assignments.length,
        totalDuration: lessons.reduce((acc, l) => acc + l.duration, 0),
      }
    })
  })

export const getCourseFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { courseId: string }) => data)
  .handler(async ({ data }) => {
    const course = mockCourses.find((c) => c.id === data.courseId)
    if (!course) return { course: null }

    const lessons = mockLessons
      .filter((l) => l.courseId === course.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((lesson) => ({
        ...lesson,
        questions: mockQuestions
          .filter((q) => q.lessonId === lesson.id)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((q) => ({
            ...q,
            options: JSON.parse(q.options) as string[],
          })),
      }))

    return { course: { ...course, lessons } }
  })

export const getEmployeeCourseFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string; courseId: string }) => data)
  .handler(async ({ data }) => {
    const course = mockCourses.find((c) => c.id === data.courseId)
    if (!course) return { course: null }

    const lessons = mockLessons
      .filter((l) => l.courseId === course.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)

    const lessonsWithProgress = lessons.map((lesson, index) => {
      const progress = mockLessonProgress.find(
        (lp) => lp.userId === data.userId && lp.lessonId === lesson.id
      )
      const questions = mockQuestions
        .filter((q) => q.lessonId === lesson.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({
          ...q,
          options: JSON.parse(q.options) as string[],
        }))

      let status: 'locked' | 'available' | 'in_progress' | 'passed' = 'locked'
      if (progress) {
        status = progress.status
      } else if (index === 0) {
        status = 'available'
      } else {
        const prevLesson = lessons[index - 1]
        const prevProgress = mockLessonProgress.find(
          (lp) => lp.userId === data.userId && lp.lessonId === prevLesson.id
        )
        if (prevProgress?.status === 'passed') status = 'available'
      }

      return {
        ...lesson,
        questions,
        status,
        maxWatchedPosition: progress?.maxWatchedPosition || 0,
        attemptCount: progress?.attemptCount || 0,
      }
    })

    return { course: { ...course, lessons: lessonsWithProgress } }
  })

export const getEmployeeCoursesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const assignments = mockCourseAssignments.filter((a) => a.userId === data.userId)

    return assignments.map((assignment) => {
      const course = mockCourses.find((c) => c.id === assignment.courseId)!
      const lessons = mockLessons.filter((l) => l.courseId === course.id)
      const completed = mockLessonProgress.filter(
        (lp) => lp.userId === data.userId && lp.status === 'passed' && lessons.some((l) => l.id === lp.lessonId)
      ).length

      return {
        ...course,
        lessonsCount: lessons.length,
        completedLessons: completed,
        progress: lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0,
      }
    })
  })
