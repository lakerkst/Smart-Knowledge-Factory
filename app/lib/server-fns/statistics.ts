import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm'
import { db } from '~/../db'
import {
  users,
  courses,
  lessons,
  lessonProgress,
  courseAssignments,
  companies,
  activityLog,
  questions,
  questionAttempts,
  finalTestAttempts,
} from '~/../db/schema'

export const getCompanyStatsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    // Get employees
    const employees = await db
      .select()
      .from(users)
      .where(
        and(eq(users.companyId, data.companyId), eq(users.role, 'employee'))
      )

    // Get company courses
    const companyCourses = await db
      .select()
      .from(courses)
      .where(eq(courses.companyId, data.companyId))

    // Get all lessons for these courses
    const courseIds = companyCourses.map((c) => c.id)
    let allLessons: typeof lessons.$inferSelect[] = []
    if (courseIds.length > 0) {
      allLessons = await db
        .select()
        .from(lessons)
        .where(sql`${lessons.courseId} IN ${courseIds}`)
    }

    // Get progress for all employees
    const employeeIds = employees.map((e) => e.id)
    let allProgress: typeof lessonProgress.$inferSelect[] = []
    if (employeeIds.length > 0) {
      allProgress = await db
        .select()
        .from(lessonProgress)
        .where(sql`${lessonProgress.userId} IN ${employeeIds}`)
    }

    // Calculate status distribution
    let completedAll = 0
    let inProgressCount = 0
    let notStarted = 0

    for (const emp of employees) {
      const empAssignments = await db
        .select()
        .from(courseAssignments)
        .where(eq(courseAssignments.userId, emp.id))

      if (empAssignments.length === 0) {
        notStarted++
        continue
      }

      let totalLessons = 0
      for (const a of empAssignments) {
        totalLessons += allLessons.filter((l) => l.courseId === a.courseId).length
      }

      const completedLessons = allProgress.filter(
        (lp) => lp.userId === emp.id && lp.status === 'passed'
      ).length

      if (completedLessons >= totalLessons && totalLessons > 0) {
        completedAll++
      } else if (completedLessons > 0 || allProgress.some((lp) => lp.userId === emp.id)) {
        inProgressCount++
      } else {
        notStarted++
      }
    }

    // Course stats
    const courseStats = await Promise.all(
      companyCourses.map(async (course) => {
        const courseLessons = allLessons.filter((l) => l.courseId === course.id)
        const [assignedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(courseAssignments)
          .where(eq(courseAssignments.courseId, course.id))

        const totalPossible = assignedCount.count * courseLessons.length
        let completed = 0
        if (totalPossible > 0) {
          const assignments = await db
            .select()
            .from(courseAssignments)
            .where(eq(courseAssignments.courseId, course.id))

          for (const a of assignments) {
            completed += allProgress.filter(
              (lp) =>
                lp.userId === a.userId &&
                lp.status === 'passed' &&
                courseLessons.some((l) => l.id === lp.lessonId)
            ).length
          }
        }

        return {
          id: course.id,
          title: course.title,
          assignedCount: assignedCount.count,
          progress: totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0,
        }
      })
    )

    // Employee stats
    const now = new Date()
    const employeeStats = await Promise.all(
      employees.map(async (emp) => {
        const empAssignments = await db
          .select()
          .from(courseAssignments)
          .where(eq(courseAssignments.userId, emp.id))

        const empProgress = allProgress.filter((lp) => lp.userId === emp.id)

        let totalLessons = 0
        const courseBreakdown = empAssignments.map((a) => {
          const course = companyCourses.find((c) => c.id === a.courseId)
          const courseLessons = allLessons.filter((l) => l.courseId === a.courseId)
          totalLessons += courseLessons.length

          const lessonDetail = courseLessons.map((l) => {
            const p = empProgress.find((lp) => lp.lessonId === l.id)
            return {
              id: l.id,
              title: l.title,
              orderIndex: l.orderIndex,
              status: p?.status ?? null,
              completedAt: p?.completedAt ?? null,
              attemptCount: p?.attemptCount ?? 0,
            }
          }).sort((a, b) => a.orderIndex - b.orderIndex)

          const courseLessonIds = new Set(courseLessons.map((l) => l.id))
          const passedInCourse = empProgress.filter(
            (p) => p.status === 'passed' && courseLessonIds.has(p.lessonId)
          ).length
          const courseCompleted = courseLessons.length > 0 && passedInCourse >= courseLessons.length
          const deadline = a.deadline ?? null
          const isOverdue = deadline !== null && !courseCompleted && deadline < now

          return {
            courseId: a.courseId,
            courseTitle: course?.title ?? '—',
            deadline,
            isOverdue,
            lessons: lessonDetail,
          }
        })

        const completedLessons = empProgress.filter((lp) => lp.status === 'passed').length

        return {
          id: emp.id,
          name: emp.name,
          lastLoginAt: emp.lastLoginAt,
          progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          completedLessons,
          totalLessons,
          courses: courseBreakdown,
        }
      })
    )

    // Activity log (last 14 days)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const activityData = await db
      .select()
      .from(activityLog)
      .where(
        and(
          eq(activityLog.companyId, data.companyId),
          gte(activityLog.createdAt, fourteenDaysAgo)
        )
      )

    // Group activity by date
    const activityByDate = new Map<string, { logins: number; lessonsCompleted: number; questionsAnswered: number }>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      activityByDate.set(d.toISOString().split('T')[0], { logins: 0, lessonsCompleted: 0, questionsAnswered: 0 })
    }

    for (const log of activityData) {
      const dateKey = log.createdAt.toISOString().split('T')[0]
      const entry = activityByDate.get(dateKey)
      if (entry) {
        if (log.action === 'login') entry.logins++
        if (log.action === 'lesson_completed') entry.lessonsCompleted++
        if (log.action === 'question_answered') entry.questionsAnswered++
      }
    }

    const activityLogResult = Array.from(activityByDate.entries()).map(([date, data]) => ({
      date,
      ...data,
    }))

    return {
      totals: {
        employees: employees.length,
        courses: companyCourses.length,
        lessons: allLessons.length,
        completed: completedAll,
        inProgress: inProgressCount,
        notStarted,
      },
      statusDistribution: [
        { name: 'Завершили', value: completedAll, fill: 'var(--color-success)' },
        { name: 'В процессе', value: inProgressCount, fill: 'var(--color-warning)' },
        { name: 'Не начали', value: notStarted, fill: 'var(--color-border)' },
      ],
      activityLog: activityLogResult,
      courseStats,
      employeeStats,
    }
  })

export const getQuestionStatsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    // 1. Employee IDs for this company
    const employees = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.companyId, data.companyId), eq(users.role, 'employee')))
    const employeeIds = employees.map((e) => e.id)
    if (!employeeIds.length) return { questionStats: [] }

    // 2. Courses for this company
    const companyCourses = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.companyId, data.companyId))
    const courseIds = companyCourses.map((c) => c.id)
    if (!courseIds.length) return { questionStats: [] }

    // 3. Lessons
    const courseLessons = await db
      .select({ id: lessons.id, title: lessons.title, courseId: lessons.courseId })
      .from(lessons)
      .where(inArray(lessons.courseId, courseIds))
    const lessonIds = courseLessons.map((l) => l.id)
    if (!lessonIds.length) return { questionStats: [] }

    // 4. Questions
    const lessonQuestions = await db
      .select()
      .from(questions)
      .where(inArray(questions.lessonId, lessonIds))
    const questionIds = lessonQuestions.map((q) => q.id)
    if (!questionIds.length) return { questionStats: [] }

    // 5. First attempts only
    const attempts = await db
      .select()
      .from(questionAttempts)
      .where(
        and(
          inArray(questionAttempts.userId, employeeIds),
          inArray(questionAttempts.questionId, questionIds),
          eq(questionAttempts.attemptNumber, 1)
        )
      )

    // 6. Aggregate per question
    const statsMap = new Map<string, { total: number; correct: number }>()
    for (const a of attempts) {
      const entry = statsMap.get(a.questionId) ?? { total: 0, correct: 0 }
      entry.total++
      if (a.isCorrect) entry.correct++
      statsMap.set(a.questionId, entry)
    }

    const questionStats = lessonQuestions
      .filter((q) => statsMap.has(q.id))
      .map((q) => {
        const s = statsMap.get(q.id)!
        const lesson = courseLessons.find((l) => l.id === q.lessonId)
        const course = companyCourses.find((c) => c.id === lesson?.courseId)
        return {
          questionId: q.id,
          questionText: q.text,
          lessonTitle: lesson?.title ?? '—',
          courseTitle: course?.title ?? '—',
          totalAttempts: s.total,
          correctRate: Math.round((s.correct / s.total) * 100),
          errorRate: Math.round(((s.total - s.correct) / s.total) * 100),
        }
      })
      .sort((a, b) => a.correctRate - b.correctRate) // worst first
      .slice(0, 15)

    return { questionStats }
  })

export const getSuperStatsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const allCompanies = await db.select().from(companies)
  const allUsers = await db.select().from(users)
  const allCourses = await db.select().from(courses)

  const totalEmployees = allUsers.filter((u) => u.role === 'employee').length
  const totalAdmins = allUsers.filter((u) => u.role === 'company_admin').length

  const companyStats = allCompanies.map((company) => {
    const companyEmployees = allUsers.filter(
      (u) => u.companyId === company.id && u.role === 'employee'
    )
    const companyCourses = allCourses.filter((c) => c.companyId === company.id)
    const admin = allUsers.find(
      (u) => u.companyId === company.id && u.role === 'company_admin'
    )

    return {
      id: company.id,
      name: company.name,
      isActive: company.isActive,
      createdAt: company.createdAt,
      subscriptionExpiresAt: company.subscriptionExpiresAt ?? null,
      employeeCount: companyEmployees.length,
      courseCount: companyCourses.length,
      adminName: admin?.name || 'Не назначен',
    }
  })

  // Group companies by creation month
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
  const companyByMonth = new Map<string, number>()

  // Last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    companyByMonth.set(monthNames[d.getMonth()], 0)
  }

  for (const company of allCompanies) {
    const monthName = monthNames[company.createdAt.getMonth()]
    if (companyByMonth.has(monthName)) {
      companyByMonth.set(monthName, (companyByMonth.get(monthName) || 0) + 1)
    }
  }

  const newCompaniesPerMonth = Array.from(companyByMonth.entries()).map(([month, count]) => ({
    month,
    count,
  }))

  return {
    totals: {
      companies: allCompanies.length,
      employees: totalEmployees,
      courses: allCourses.length,
      admins: totalAdmins,
      activeCompanies: allCompanies.filter((c) => c.isActive).length,
    },
    companyStats,
    newCompaniesPerMonth,
    topByEmployees: [...companyStats].sort((a, b) => b.employeeCount - a.employeeCount).slice(0, 5),
    topByCourses: [...companyStats].sort((a, b) => b.courseCount - a.courseCount).slice(0, 5),
  }
})

// ─── Activity log with custom date range (used by both admin and super admin) ───

export const getActivityLogFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string; dateFrom: string; dateTo: string }) => data)
  .handler(async ({ data }) => {
    const from = new Date(data.dateFrom)
    const to = new Date(data.dateTo)
    to.setHours(23, 59, 59, 999)

    const rows = await db
      .select()
      .from(activityLog)
      .where(
        and(
          eq(activityLog.companyId, data.companyId),
          gte(activityLog.createdAt, from),
          lte(activityLog.createdAt, to)
        )
      )

    // Build date map covering every day in range
    const dateMap = new Map<string, { logins: number; lessonsCompleted: number }>()
    const cur = new Date(from)
    while (cur <= to) {
      dateMap.set(cur.toISOString().split('T')[0], { logins: 0, lessonsCompleted: 0 })
      cur.setDate(cur.getDate() + 1)
    }

    for (const log of rows) {
      const key = log.createdAt.toISOString().split('T')[0]
      const entry = dateMap.get(key)
      if (entry) {
        if (log.action === 'login') entry.logins++
        if (log.action === 'lesson_completed') entry.lessonsCompleted++
      }
    }

    return Array.from(dateMap.entries()).map(([date, v]) => ({ date, ...v }))
  })

// ─── Platform-wide activity (all companies) ──────────────────────────────────

export const getPlatformActivityFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { dateFrom: string; dateTo: string }) => data)
  .handler(async ({ data }) => {
    const from = new Date(data.dateFrom)
    const to = new Date(data.dateTo)
    to.setHours(23, 59, 59, 999)

    const rows = await db
      .select()
      .from(activityLog)
      .where(and(gte(activityLog.createdAt, from), lte(activityLog.createdAt, to)))

    const dateMap = new Map<string, { logins: number; lessonsCompleted: number }>()
    const cur = new Date(from)
    while (cur <= to) {
      dateMap.set(cur.toISOString().split('T')[0], { logins: 0, lessonsCompleted: 0 })
      cur.setDate(cur.getDate() + 1)
    }

    for (const log of rows) {
      const key = log.createdAt.toISOString().split('T')[0]
      const entry = dateMap.get(key)
      if (entry) {
        if (log.action === 'login') entry.logins++
        if (log.action === 'lesson_completed') entry.lessonsCompleted++
      }
    }

    return Array.from(dateMap.entries()).map(([date, v]) => ({ date, ...v }))
  })

// ─── Per-company engagement (avg progress + active last 7 days) ──────────────

export const getCompanyEngagementFn = createServerFn({ method: 'GET' }).handler(async () => {
  const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const results = await Promise.all(
    allCompanies.map(async (company) => {
      const employees = await db
        .select({ id: users.id, lastLoginAt: users.lastLoginAt })
        .from(users)
        .where(and(eq(users.companyId, company.id), eq(users.role, 'employee')))

      if (employees.length === 0) {
        return { id: company.id, name: company.name, avgProgress: 0, active7d: 0, totalEmployees: 0 }
      }

      // Count lessons for this company
      const companyCourses = await db.select({ id: courses.id }).from(courses).where(eq(courses.companyId, company.id))
      let totalCourseLessons = 0
      for (const c of companyCourses) {
        const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(lessons).where(eq(lessons.courseId, c.id))
        totalCourseLessons += r.count
      }

      let totalCompleted = 0
      const active7d = employees.filter((e) => e.lastLoginAt && new Date(e.lastLoginAt) >= sevenDaysAgo).length

      if (totalCourseLessons > 0) {
        for (const emp of employees) {
          const [r] = await db.select({ count: sql<number>`count(*)::int` })
            .from(lessonProgress)
            .where(and(eq(lessonProgress.userId, emp.id), eq(lessonProgress.status, 'passed')))
          totalCompleted += r.count
        }
      }

      const avgProgress = totalCourseLessons > 0
        ? Math.round((totalCompleted / (employees.length * totalCourseLessons)) * 100)
        : 0

      return { id: company.id, name: company.name, avgProgress, active7d, totalEmployees: employees.length }
    })
  )

  return results
})

// ─── HR report: one row per (employee × course assignment) ───────────────────

export const getHrReportFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const rows: Array<{
      employeeId: string
      employeeName: string
      courseId: string
      courseTitle: string
      status: 'completed' | 'in_progress' | 'not_started'
      completedAt: Date | null
      finalTestScore: number | null
      deadline: Date | null
      isOverdue: boolean
    }> = []

    const employees = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.companyId, data.companyId), eq(users.role, 'employee')))
    if (employees.length === 0) return { rows }
    const employeeIds = employees.map((e) => e.id)

    const companyCourses = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.companyId, data.companyId))
    if (companyCourses.length === 0) return { rows }
    const courseIds = companyCourses.map((c) => c.id)

    const [allAssignments, allLessons, allProgress, allFinalTests] = await Promise.all([
      db.select().from(courseAssignments).where(inArray(courseAssignments.userId, employeeIds)),
      db
        .select({ id: lessons.id, courseId: lessons.courseId })
        .from(lessons)
        .where(inArray(lessons.courseId, courseIds)),
      db.select().from(lessonProgress).where(inArray(lessonProgress.userId, employeeIds)),
      db.select().from(finalTestAttempts).where(inArray(finalTestAttempts.userId, employeeIds)),
    ])

    const now = new Date()

    for (const emp of employees) {
      const empAssignments = allAssignments.filter((a) => a.userId === emp.id)
      for (const assignment of empAssignments) {
        const course = companyCourses.find((c) => c.id === assignment.courseId)
        if (!course) continue

        const courseLessons = allLessons.filter((l) => l.courseId === assignment.courseId)
        const courseLessonIds = new Set(courseLessons.map((l) => l.id))
        const passedInCourse = allProgress.filter(
          (p) => p.userId === emp.id && p.status === 'passed' && courseLessonIds.has(p.lessonId)
        )

        let status: 'completed' | 'in_progress' | 'not_started'
        let completedAt: Date | null = null

        if (courseLessons.length > 0 && passedInCourse.length >= courseLessons.length) {
          status = 'completed'
          // The latest lesson completion date = when the course was effectively finished
          completedAt = passedInCourse.reduce((latest, p) => {
            if (!p.completedAt) return latest
            if (!latest) return p.completedAt
            return p.completedAt > latest ? p.completedAt : latest
          }, null as Date | null)
        } else if (
          passedInCourse.length > 0 ||
          allProgress.some((p) => p.userId === emp.id && courseLessonIds.has(p.lessonId))
        ) {
          status = 'in_progress'
        } else {
          status = 'not_started'
        }

        // Best final test result for this employee+course
        const empCourseTests = allFinalTests.filter(
          (t) => t.userId === emp.id && t.courseId === assignment.courseId
        )
        const bestTest =
          empCourseTests.length > 0
            ? empCourseTests.reduce((best, t) => (t.score > best.score ? t : best))
            : null

        const deadline = assignment.deadline ?? null
        const isOverdue = deadline !== null && status !== 'completed' && deadline < now

        rows.push({
          employeeId: emp.id,
          employeeName: emp.name,
          courseId: course.id,
          courseTitle: course.title,
          status,
          completedAt,
          finalTestScore: bestTest?.score ?? null,
          deadline,
          isOverdue,
        })
      }
    }

    // Overdue rows first, then alphabetically by employee
    rows.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      return a.employeeName.localeCompare(b.employeeName, 'ru')
    })

    return { rows }
  })
