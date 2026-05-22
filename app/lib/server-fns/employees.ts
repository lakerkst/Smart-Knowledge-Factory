import { createServerFn } from '@tanstack/react-start'
import { mockUsers, mockCourseAssignments, mockLessonProgress, mockCourses, mockLessons } from '../mock-data'
import { generateToken } from '../utils'

const localUsers = [...mockUsers]

export const getEmployeesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const employees = localUsers.filter(
      (u) => u.companyId === data.companyId && u.role === 'employee'
    )

    return employees.map((emp) => {
      const assignments = mockCourseAssignments.filter((a) => a.userId === emp.id)
      const totalLessons = assignments.reduce((acc, a) => {
        return acc + mockLessons.filter((l) => l.courseId === a.courseId).length
      }, 0)
      const completedLessons = mockLessonProgress.filter(
        (lp) => lp.userId === emp.id && lp.status === 'passed'
      ).length

      let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'
      if (completedLessons > 0 && completedLessons >= totalLessons) status = 'completed'
      else if (completedLessons > 0 || mockLessonProgress.some((lp) => lp.userId === emp.id))
        status = 'in_progress'

      return {
        id: emp.id,
        name: emp.name,
        personalToken: emp.personalToken,
        isActive: emp.isActive,
        createdAt: emp.createdAt,
        lastLoginAt: emp.lastLoginAt,
        status,
        coursesAssigned: assignments.length,
        lessonsCompleted: completedLessons,
        totalLessons,
        progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      }
    })
  })

export const createEmployeeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; companyId: string }) => data)
  .handler(async ({ data }) => {
    const token = generateToken(24)
    const newEmployee = {
      id: `emp-${Date.now()}`,
      email: null,
      passwordHash: null,
      name: data.name,
      role: 'employee' as const,
      companyId: data.companyId,
      personalToken: token,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    localUsers.push(newEmployee)
    return { employee: newEmployee }
  })

export const generateLinkFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { employeeId: string }) => data)
  .handler(async ({ data }) => {
    const user = localUsers.find((u) => u.id === data.employeeId)
    if (!user) return { error: 'Сотрудник не найден' }

    const token = generateToken(24)
    user.personalToken = token

    return { token, link: `/learn/${token}` }
  })
