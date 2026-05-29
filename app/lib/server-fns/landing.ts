import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '~/../db'
import { siteSettings } from '~/../db/schema'

export type LandingConfig = {
  nav: {
    brand: string
    items: { label: string; href: string }[]
    ctaText: string
  }
  hero: {
    badge: string
    titleLine1: string
    titleHighlight: string
    subtitle: string
    ctaPrimary: string
    ctaSecondary: string
  }
  features: {
    eyebrow: string
    title: string
    items: { icon: string; title: string; desc: string }[]
  }
  howItWorks: {
    eyebrow: string
    title: string
    steps: { step: string; title: string; desc: string }[]
  }
  stats: { value: string; label: string; icon: string }[]
  cta: { title: string; subtitle: string; buttonText: string }
  contacts: { email: string; phone: string; address: string }
  footer: { brand: string; copyright: string }
}

export const DEFAULT_LANDING: LandingConfig = {
  nav: {
    brand: 'SKF',
    items: [
      { label: 'Возможности', href: '#features' },
      { label: 'Как это работает', href: '#how' },
      { label: 'Результаты', href: '#stats' },
    ],
    ctaText: 'Войти',
  },
  hero: {
    badge: 'Платформа корпоративного обучения',
    titleLine1: 'Обучение, которое',
    titleHighlight: 'работает',
    subtitle: 'Контролируемое видео-обучение с интерактивными тестами. Сотрудники не смогут пропустить материал — система гарантирует усвоение знаний.',
    ctaPrimary: 'Начать бесплатно',
    ctaSecondary: 'Демо для сотрудника',
  },
  features: {
    eyebrow: 'Возможности',
    title: 'Всё для эффективного обучения',
    items: [
      { icon: 'Video', title: 'Контроль просмотра', desc: 'Система отслеживает реальный просмотр видео. Перемотка вперёд заблокирована — только честное прохождение.' },
      { icon: 'CheckCircle2', title: 'Тесты на таймкодах', desc: 'Вопросы привязаны к конкретным моментам видео. При ошибке — автоматический возврат к нужному фрагменту.' },
      { icon: 'Shield', title: 'Три уровня доступа', desc: 'Сотрудник, админ компании и супер-админ. Каждый видит только свои данные.' },
      { icon: 'BarChart3', title: 'Детальная аналитика', desc: 'Прогресс каждого сотрудника, статистика по курсам и активность за любой период.' },
      { icon: 'Users', title: 'Персональные ссылки', desc: 'Сотрудники входят без логина и пароля — по уникальной ссылке. Мгновенный старт.' },
      { icon: 'Building2', title: 'Мультикомпания', desc: 'Каждая компания изолирована. Свои сотрудники, курсы и статистика.' },
    ],
  },
  howItWorks: {
    eyebrow: 'Процесс',
    title: 'Как это работает',
    steps: [
      { step: '01', title: 'Персональная ссылка', desc: 'Сотрудник получает уникальную ссылку и сразу начинает обучение без регистрации' },
      { step: '02', title: 'Видео + вопросы', desc: 'Просмотр контролируемого видео с автоматическими тестами в ключевых моментах' },
      { step: '03', title: 'Гарантия результата', desc: 'При ошибке — повторный просмотр. Курс считается пройденным только после всех тестов' },
    ],
  },
  stats: [
    { value: '95%', label: 'Завершают курс', icon: 'CheckCircle2' },
    { value: '3x', label: 'Выше усвоение', icon: 'BookOpen' },
    { value: '< 2 мин', label: 'Старт обучения', icon: 'Play' },
    { value: '24/7', label: 'Доступ к курсам', icon: 'GraduationCap' },
  ],
  cta: {
    title: 'Готовы начать?',
    subtitle: 'Попробуйте демо-версию прямо сейчас или войдите в панель управления',
    buttonText: 'Панель управления',
  },
  contacts: { email: '', phone: '', address: '' },
  footer: { brand: 'Smart Knowledge Factory', copyright: '© 2025 SKF. Все права защищены.' },
}

export const getLandingConfigFn = createServerFn({ method: 'GET' }).handler(async () => {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, 'landing')).limit(1)
  if (!row) return DEFAULT_LANDING
  try {
    return JSON.parse(row.value) as LandingConfig
  } catch {
    return DEFAULT_LANDING
  }
})

export const updateLandingConfigFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { config: LandingConfig }) => data)
  .handler(async ({ data }) => {
    const value = JSON.stringify(data.config)
    await db
      .insert(siteSettings)
      .values({ key: 'landing', value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } })
    return { success: true }
  })
