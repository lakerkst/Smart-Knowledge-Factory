export type CompanyFeatures = {
  statActivity: boolean
  statEmployeeStatus: boolean
  statCourseProgress: boolean
  statHardQuestions: boolean
  statLessonRating: boolean
  statComments: boolean
  statEmployeeProgress: boolean
}

export const DEFAULT_FEATURES: CompanyFeatures = {
  statActivity: true,
  statEmployeeStatus: true,
  statCourseProgress: true,
  statHardQuestions: true,
  statLessonRating: true,
  statComments: true,
  statEmployeeProgress: true,
}

export function parseFeatures(raw: string | null | undefined): CompanyFeatures {
  if (!raw) return { ...DEFAULT_FEATURES }
  try {
    return { ...DEFAULT_FEATURES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_FEATURES }
  }
}

export function serializeFeatures(features: CompanyFeatures): string {
  return JSON.stringify(features)
}

// Human-readable labels for the super-admin UI
export const FEATURE_LABELS: Record<keyof CompanyFeatures, string> = {
  statActivity: 'Активность',
  statEmployeeStatus: 'Статусы сотрудников',
  statCourseProgress: 'Прогресс по курсам',
  statHardQuestions: 'Сложные вопросы',
  statLessonRating: 'Рейтинг уроков',
  statComments: 'Последние комментарии',
  statEmployeeProgress: 'Прогресс по сотрудникам',
}
