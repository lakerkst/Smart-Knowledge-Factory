import { createServerFn } from '@tanstack/react-start'
import {
  mockUsers,
  mockCourses,
  mockLessons,
  mockLessonProgress,
  mockCourseAssignments,
  mockActivityLog,
  mockCompanies,
} from '../mock-data'

export const getCompanyStatsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const employees = mockUsers.filter(
      (u) => u.companyId === data.companyId && u.role === 'employee'
    )
    const courses = mockCourses.filter((c) => c.companyId === data.companyId)
    const lessons = mockLessons.filter((l) =>
      courses.some((c) => c.id === l.courseId)
    )

    const employeeIds = employees.map((e) => e.id)
    const progress = mockLessonProgress.filter((lp) =>
      employeeIds.includes(lp.userId)
    )

    const completedAll = employees.filter((emp) => {
      const assigned = mockCourseAssignments.filter((a) => a.userId === emp.id)
      if (assigned.length === 0) return false
      const totalLessons = assigned.reduce(
        (acc, a) => acc + mockLessons.filter((l) => l.courseId === a.courseId).length,
        0
      )
      const completed = progress.filter(
        (lp) => lp.userId === emp.id && lp.status === 'passed'
      ).length
      return completed >= totalLessons && totalLessons > 0
    }).length

    const inProgress = employees.filter((emp) => {
      const empProgress = progress.filter((lp) => lp.userId === emp.id)
      return empProgress.length > 0 && !employees.some(() => false)
    }).length

    const notStarted = employees.length - completedAll - inProgress

    const courseStats = courses.map((course) => {
      const courseLessons = lessons.filter((l) => l.courseId === course.id)
      const assigned = mockCourseAssignments.filter((a) => a.courseId === course.id)
      const totalPossible = assigned.length * courseLessons.length

      const completed = assigned.reduce((acc, a) => {
        return (
          acc +
          progress.filter(
            (lp) =>
              lp.userId === a.userId &&
              lp.status === 'passed' &&
              courseLessons.some((l) => l.id === lp.lessonId)
          ).length
        )
      }, 0)

      return {
        id: course.id,
        title: course.title,
        assignedCount: assigned.length,
        progress: totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0,
      }
    })

    const employeeStats = employees.map((emp) => {
      const assigned = mockCourseAssignments.filter((a) => a.userId === emp.id)
      const totalLessons = assigned.reduce(
        (acc, a) => acc + mockLessons.filter((l) => l.courseId === a.courseId).length,
        0
      )
      const completed = progress.filter(
        (lp) => lp.userId === emp.id && lp.status === 'passed'
      ).length

      return {
        id: emp.id,
        name: emp.name,
        progress: totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0,
        completedLessons: completed,
        totalLessons,
      }
    })

    return {
      totals: {
        employees: employees.length,
        courses: courses.length,
        lessons: lessons.length,
        completed: completedAll,
        inProgress: Math.max(0, inProgress - completedAll),
        notStarted: Math.max(0, notStarted),
      },
      statusDistribution: [
        { name: 'Завершили', value: completedAll, fill: 'var(--color-success)' },
        { name: 'В процессе', value: Math.max(0, inProgress - completedAll), fill: 'var(--color-warning)' },
        { name: 'Не начали', value: Math.max(0, notStarted), fill: 'var(--color-border)' },
      ],
      activityLog: mockActivityLog,
      courseStats,
      employeeStats,
    }
  })

export const getSuperStatsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const companies = mockCompanies
  const totalEmployees = mockUsers.filter((u) => u.role === 'employee').length
  const totalCourses = mockCourses.length
  const totalAdmins = mockUsers.filter((u) => u.role === 'company_admin').length

  const companyStats = companies.map((company) => {
    const employees = mockUsers.filter(
      (u) => u.companyId === company.id && u.role === 'employee'
    )
    const courses = mockCourses.filter((c) => c.companyId === company.id)

    return {
      id: company.id,
      name: company.name,
      isActive: company.isActive,
      createdAt: company.createdAt,
      employeeCount: employees.length,
      courseCount: courses.length,
      adminName:
        mockUsers.find(
          (u) => u.companyId === company.id && u.role === 'company_admin'
        )?.name || 'Не назначен',
    }
  })

  const newCompaniesPerMonth = [
    { month: 'Янв', count: 1 },
    { month: 'Фев', count: 1 },
    { month: 'Мар', count: 1 },
    { month: 'Апр', count: 0 },
    { month: 'Май', count: 0 },
  ]

  return {
    totals: {
      companies: companies.length,
      employees: totalEmployees,
      courses: totalCourses,
      admins: totalAdmins,
      activeCompanies: companies.filter((c) => c.isActive).length,
    },
    companyStats,
    newCompaniesPerMonth,
    topByEmployees: [...companyStats].sort((a, b) => b.employeeCount - a.employeeCount).slice(0, 5),
    topByCourses: [...companyStats].sort((a, b) => b.courseCount - a.courseCount).slice(0, 5),
  }
})
