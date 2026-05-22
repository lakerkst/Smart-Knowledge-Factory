import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { hash } from 'bcryptjs'
import * as schema from './schema'

async function seed() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle(sql, { schema })

  console.log('Seeding database...')

  const [company1] = await db
    .insert(schema.companies)
    .values([
      { name: 'ТехноСтар', isActive: true },
      { name: 'ИнноВижн', isActive: true },
      { name: 'ДатаПро', isActive: false },
    ])
    .returning()

  console.log('Companies created')

  const passwordHash = await hash('demo123', 10)

  const companies = await db.select().from(schema.companies)
  const comp1 = companies[0]
  const comp2 = companies[1]

  await db.insert(schema.users).values([
    {
      email: 'super@skf.ru',
      passwordHash,
      name: 'Главный Администратор',
      role: 'super_admin',
      companyId: null,
    },
    {
      email: 'admin@technostar.ru',
      passwordHash,
      name: 'Анна Козлова',
      role: 'company_admin',
      companyId: comp1.id,
    },
    {
      email: 'admin@innovision.ru',
      passwordHash,
      name: 'Дмитрий Петров',
      role: 'company_admin',
      companyId: comp2.id,
    },
    {
      name: 'Иван Сидоров',
      role: 'employee',
      companyId: comp1.id,
      personalToken: 'token-ivan-abc123',
    },
    {
      name: 'Мария Иванова',
      role: 'employee',
      companyId: comp1.id,
      personalToken: 'token-maria-def456',
    },
    {
      name: 'Алексей Волков',
      role: 'employee',
      companyId: comp1.id,
      personalToken: 'token-alex-ghi789',
    },
    {
      name: 'Сергей Кузнецов',
      role: 'employee',
      companyId: comp2.id,
      personalToken: 'token-sergey-mno345',
    },
  ])

  console.log('Users created')

  const courses = await db
    .insert(schema.courses)
    .values([
      {
        companyId: comp1.id,
        title: 'Основы информационной безопасности',
        description: 'Комплексный курс по основам защиты информации на предприятии.',
        isPublished: true,
      },
      {
        companyId: comp1.id,
        title: 'Работа с персональными данными',
        description: 'Правила обработки персональных данных по 152-ФЗ.',
        isPublished: true,
      },
      {
        companyId: comp2.id,
        title: 'Техника безопасности на производстве',
        description: 'Обязательный инструктаж по технике безопасности.',
        isPublished: true,
      },
    ])
    .returning()

  console.log('Courses created')

  const lessons = await db
    .insert(schema.lessons)
    .values([
      {
        courseId: courses[0].id,
        title: 'Что такое информационная безопасность',
        description: 'Введение в основные понятия и принципы ИБ',
        duration: 480,
        orderIndex: 0,
      },
      {
        courseId: courses[0].id,
        title: 'Фишинг и социальная инженерия',
        description: 'Как распознать фишинговые атаки',
        duration: 600,
        orderIndex: 1,
      },
      {
        courseId: courses[0].id,
        title: 'Безопасные пароли',
        description: 'Правила создания надежных паролей',
        duration: 360,
        orderIndex: 2,
      },
    ])
    .returning()

  console.log('Lessons created')

  await db.insert(schema.questions).values([
    {
      lessonId: lessons[0].id,
      text: 'Что является основной целью информационной безопасности?',
      options: JSON.stringify([
        'Увеличение скорости интернета',
        'Защита информации от несанкционированного доступа',
        'Установка антивирусов',
        'Блокировка всех сайтов',
      ]),
      correctIndex: 1,
      timecodeStart: 30,
      timecodeTrigger: 120,
      orderIndex: 0,
    },
    {
      lessonId: lessons[0].id,
      text: 'Какие три ключевых принципа ИБ существуют?',
      options: JSON.stringify([
        'Скорость, надежность, доступность',
        'Конфиденциальность, целостность, доступность',
        'Шифрование, авторизация, аудит',
        'Защита, контроль, мониторинг',
      ]),
      correctIndex: 1,
      timecodeStart: 180,
      timecodeTrigger: 300,
      orderIndex: 1,
    },
  ])

  console.log('Questions created')
  console.log('Seed complete!')
}

seed().catch(console.error)
