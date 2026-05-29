# Smart Knowledge Factory (SKF) — Project Context

## What is this
Corporate LMS (Learning Management System) for employee training.
- **Employees** learn via personal links (no login/password) — video lessons + quizzes
- **Company admins** manage employees, courses, statistics
- **Super admin** manages all companies on the platform

## Tech Stack
- **Framework**: TanStack Start (file-based routing, SSR)
- **DB**: Drizzle ORM + Neon serverless PostgreSQL
- **Video**: Vimeo (9:16 portrait format), custom player with seek protection
- **Auth**: JWT sessions via `jose`, personal tokens for employees
- **i18n**: i18next + react-i18next, languages: `ru` (Russian) and `kk` (Kazakh)
- **Styles**: Tailwind CSS v4 (CSS variables, `oklch` colors)
- **Deploy**: Vercel — `npx vercel --prod --yes` then `npx vercel alias <url> smart-knowledge-factory.vercel.app`

## Routes
```
/                          → public landing page
/login                     → login for admins
/learn/$token              → employee learning page (no auth, token-based)
/admin                     → company admin dashboard
/admin/employees           → employee management
/admin/courses             → course management
/admin/courses/$courseId   → course editor (lessons, questions, quiz settings)
/admin/statistics          → analytics
/admin/hr-report           → HR report with Excel export
/admin/settings            → change password
/super                     → super admin dashboard (all companies)
/super/landing             → landing page editor
/super/func-company        → per-company feature flags
```

## DB Schema (key tables)
- `users` — employees + admins + super_admin, `role` enum, `personalToken` for employees
- `companies` — company + features JSON + subscriptionExpiresAt
- `courses` — belongs to company, `quizMode: 'confirm'|'instant'`, `finalTestEnabled`
- `lessons` — belongs to course, `vimeoId`, `duration`
- `questions` — belongs to lesson, `timecodeStart` + `timecodeTrigger` (seconds), `options` (JSON), `correctIndex`
- `courseAssignments` — userId × courseId, optional `deadline`
- `lessonProgress` — userId × lessonId, `maxWatchedPosition`, `status`
- `questionAttempts` — tracks every answer attempt
- `learningPaths` — ordered chains of courses
- `finalTestQuestions` / `finalTestAttempts`
- `lessonFeedback` — rating + comment per lesson
- `activityLog` — logins, lesson completions

## Key Business Logic

### Quiz modes
- **`confirm`** (С подтверждением): select answer → click confirm button → feedback
- **`instant`** (Без подтверждения): click answer → immediate check

### Wrong answer logic (both modes)
1. **1st wrong** → small red popup "Неверно! Попробуйте ещё раз." (2.5s) → selection resets → user retries
2. **2nd wrong** → full-screen popup "Необходимо повторно просмотреть материал." (4s) → `handleWrongAnswer()` called
3. `handleWrongAnswer`: sets `replayPositionRef.current`, increments `replayCount` → VideoPlayer remounts with `maxAllowedPosition=0` → forward seek blocked

### Video seek protection
- `VideoPlayer` prop `maxAllowedPosition` sets `maxWatchedRef` on mount
- Forward seeking past `maxWatchedRef` is blocked in `seeked` event
- On replay: VideoPlayer key = `${lessonId}-${replayCount}` → remounts → `maxWatchedRef` resets to 0
- **Bug fixed**: `videoMaxPosition` is computed (not state) to avoid React render lag:
  ```js
  const videoMaxPosition = replayCount > 0 ? replayPositionRef.current : (currentLesson?.maxWatchedPosition || 0)
  ```

### Quiz question answer shuffling
- `QuizBlock` shuffles `options` on mount via `useMemo` (Fisher-Yates)
- `shuffledCorrectIndex` is recalculated to match new order
- QuizBlock remounts on each question (key={currentQuestionIndex}) → auto-reshuffles every appearance

### Learning Paths
- Ordered chains of courses — next course unlocks only after previous is completed
- `learningPathAssignments` links path to user

## i18n
- Locale files: `app/locales/ru.json` and `app/locales/kk.json`
- Config: `app/lib/i18n.ts` — uses localStorage key `skf-lang`, fallback `ru`
- Language switcher: bottom of sidebar (admin panel), floating button (learn page)
- Course/lesson **content** is NOT translated — admins create content in their own language

## Key Components
- `VideoPlayer` — custom Vimeo player, portrait 9:16, seek protection, `maxAllowedPosition` prop
- `QuizBlock` — answer options with shuffle, 2-attempt logic, two popup types
- `Sidebar` — nav + language switcher (РУС/ҚАЗ) at bottom
- `Topbar` — page title + optional action button

## Server Functions location
All in `app/lib/server-fns/`:
- `auth.ts` — login, logout, session, changePassword, getEmployeeByToken
- `employees.ts` — CRUD, generateLink, toggleActive, resetProgress, assign/unassign courses, delete, bulkDelete
- `courses.ts` — CRUD courses/lessons/questions, bulkAssign
- `statistics.ts` — company stats, HR report, super admin analytics
- `company.ts` — company management, impersonate, features
- `progress.ts` — updateProgress, submitAnswer, completeLesson
- `final-test.ts` — getFinalTest, submitFinalTest
- `feedback.ts` — submitFeedback, getLessonFeedbackStats
- `landing.ts` — getLandingConfig, updateLandingConfig
- `learning-paths.ts` — getEmployeePaths
- `import.ts` — importEmployees from Excel

## Deployment
```bash
npx vercel --prod --yes
npx vercel alias <new-url> smart-knowledge-factory.vercel.app
```
Live URL: https://smart-knowledge-factory.vercel.app
Demo: admin@technostar.ru / demo123 (company admin), super@skf.ru / demo123 (super admin)
