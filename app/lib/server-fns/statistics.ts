import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, gte } from 'drizzle-orm'
import { db } from '~/../db'
import {
  users,
  courses,
  lessons,
  lessonProgress,
  courseAssignments,
  companies,
  activityLog,
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
    const employeeStats = await Promise.all(
      employees.map(async (emp) => {
        const empAssignments = await db
          .select()
          .from(courseAssignments)
          .where(eq(courseAssignments.userId, emp.id))

        let totalLessons = 0
        for (const a of empAssignments) {
          totalLessons += allLessons.filter((l) => l.courseId === a.courseId).length
        }

        const completedLessons = allProgress.filter(
          (lp) => lp.userId === emp.id && lp.status === 'passed'
        ).length

        return {
          id: emp.id,
          name: emp.name,
          progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          completedLessons,
          totalLessons,
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
