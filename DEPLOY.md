# Деплой на Vercel

## Предварительные требования

1. Аккаунт на [Vercel](https://vercel.com)
2. Аккаунт на [GitHub](https://github.com) (или GitLab/Bitbucket)
3. Установленный [Node.js](https://nodejs.org) v20+
4. Установленный [Git](https://git-scm.com)

---

## Шаг 1: Подготовка репозитория

```bash
# Инициализация git
cd "Smart Knowledge Factory"
git init
git add .
git commit -m "Initial commit: SKF LMS platform"

# Создайте репозиторий на GitHub и пушьте
git remote add origin https://github.com/ВАШ_ЮЗЕРНЕЙМ/smart-knowledge-factory.git
git branch -M main
git push -u origin main
```

---

## Шаг 2: Создание базы данных (Neon PostgreSQL)

1. Зайдите на [neon.tech](https://neon.tech) и создайте аккаунт (бесплатный план)
2. Создайте новый проект (например, `skf-lms`)
3. Скопируйте **Connection string** — она выглядит так:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Запустите миграции:
   ```bash
   # В терминале проекта
   set DATABASE_URL=ваша_строка_подключения
   npm run db:push
   npm run db:seed
   ```

---

## Шаг 3: Деплой на Vercel

### Вариант А: Через веб-интерфейс (рекомендуется)

1. Зайдите на [vercel.com/new](https://vercel.com/new)
2. Нажмите **Import Git Repository**
3. Выберите репозиторий `smart-knowledge-factory`
4. В настройках проекта:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.output`
5. Добавьте **Environment Variables**:
   - `DATABASE_URL` = ваша строка подключения Neon
   - `JWT_SECRET` = случайная строка (минимум 32 символа)
6. Нажмите **Deploy**

### Вариант Б: Через CLI

```bash
# Установите Vercel CLI
npm i -g vercel

# Авторизуйтесь
vercel login

# Деплой
vercel

# При первом запуске ответьте на вопросы:
# - Set up and deploy? → Y
# - Which scope? → выберите ваш аккаунт
# - Link to existing project? → N
# - Project name? → smart-knowledge-factory
# - Directory? → ./
# - Override settings? → N

# Добавьте переменные окружения
vercel env add DATABASE_URL
vercel env add JWT_SECRET

# Продакшен-деплой
vercel --prod
```

---

## Шаг 4: Проверка

После деплоя проверьте:

1. **Лендинг**: `https://ваш-проект.vercel.app/`
2. **Логин админа**: `https://ваш-проект.vercel.app/login`
   - Email: `admin@technostar.ru`
   - Пароль: `demo123`
3. **Логин супер-админа**:
   - Email: `super@skf.ru`
   - Пароль: `demo123`
4. **Вход сотрудника**: `https://ваш-проект.vercel.app/learn/token-ivan-abc123`

---

## Переменные окружения

| Переменная     | Описание                          | Пример                                      |
|----------------|-----------------------------------|----------------------------------------------|
| `DATABASE_URL` | Строка подключения PostgreSQL     | `postgresql://user:pass@host:5432/db`        |
| `JWT_SECRET`   | Секретный ключ для JWT-токенов    | `my-super-secret-key-at-least-32-chars`      |

---

## Обновление

При каждом пуше в ветку `main` Vercel автоматически пересобирает и деплоит проект.

```bash
git add .
git commit -m "Update: описание изменений"
git push
```

---

## Структура проекта

```
app/
├── routes/           # Страницы (file-based routing)
│   ├── __root.tsx    # Корневой layout
│   ├── index.tsx     # Лендинг
│   ├── login.tsx     # Авторизация
│   ├── learn/
│   │   └── $token.tsx  # Экран обучения сотрудника
│   ├── admin/        # Панель админа компании
│   │   ├── route.tsx   # Layout с sidebar
│   │   ├── index.tsx   # Дашборд
│   │   ├── employees.tsx  # Управление сотрудниками
│   │   ├── statistics.tsx # Статистика
│   │   └── courses/
│   │       ├── index.tsx    # Список курсов
│   │       └── $courseId.tsx # Редактор курса
│   └── super/        # Панель супер-админа
│       ├── route.tsx   # Layout
│       └── index.tsx   # Дашборд
├── components/       # UI-компоненты
├── lib/              # Утилиты, auth, server functions
└── styles/           # CSS (Tailwind + oklch переменные)
db/
├── schema.ts         # Drizzle ORM схема
├── index.ts          # Подключение к БД
└── seed.ts           # Начальные данные
```
