export const ROLES = {
  EMPLOYEE: 'employee',
  COMPANY_ADMIN: 'company_admin',
  SUPER_ADMIN: 'super_admin',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const LESSON_STATUS = {
  LOCKED: 'locked',
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  PASSED: 'passed',
} as const

export type LessonStatus = (typeof LESSON_STATUS)[keyof typeof LESSON_STATUS]

export const EMPLOYEE_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const

export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[keyof typeof EMPLOYEE_STATUS]
