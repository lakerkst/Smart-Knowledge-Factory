import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  uuid,
  real,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const roleEnum = pgEnum('user_role', ['employee', 'company_admin', 'super_admin'])
export const lessonStatusEnum = pgEnum('lesson_status', ['locked', 'available', 'in_progress', 'passed'])

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: text('logo'),
  isActive: boolean('is_active').notNull().default(true),
  subscriptionExpiresAt: timestamp('subscription_expires_at'),
  features: text('features'), // JSON: CompanyFeatures — null means all defaults (all enabled)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const siteSettings = pgTable('site_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }),
  passwordHash: text('password_hash'),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('employee'),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  personalToken: varchar('personal_token', { length: 64 }).unique(),
  position: varchar('position', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  isPublished: boolean('is_published').notNull().default(false),
  quizMode: varchar('quiz_mode', { length: 16 }).notNull().default('confirm'), // 'confirm' | 'instant'
  finalTestEnabled: boolean('final_test_enabled').notNull().default(false),
  passingScore: integer('passing_score').notNull().default(80),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  vimeoId: varchar('vimeo_id', { length: 64 }),
  duration: integer('duration').notNull().default(0),
  orderIndex: integer('order_index').notNull().default(0),
  coverImage: text('cover_image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  options: text('options').notNull(),
  correctIndex: integer('correct_index').notNull(),
  timecodeStart: real('timecode_start').notNull(),
  timecodeTrigger: real('timecode_trigger').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
})

export const courseAssignments = pgTable('course_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  deadline: timestamp('deadline'),
})

export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  status: lessonStatusEnum('status').notNull().default('locked'),
  maxWatchedPosition: real('max_watched_position').notNull().default(0),
  attemptCount: integer('attempt_count').notNull().default(0),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const questionAttempts = pgTable('question_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  selectedIndex: integer('selected_index').notNull(),
  isCorrect: boolean('is_correct').notNull(),
  attemptNumber: integer('attempt_number').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 64 }).notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const learningPaths = pgTable('learning_paths', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const learningPathCourses = pgTable('learning_path_courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  pathId: uuid('path_id').notNull().references(() => learningPaths.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull().default(0),
})

export const learningPathAssignments = pgTable('learning_path_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  pathId: uuid('path_id').notNull().references(() => learningPaths.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
})

export const lessonFeedback = pgTable('lesson_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const finalTestQuestions = pgTable('final_test_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  options: text('options').notNull(),
  correctIndex: integer('correct_index').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
})

export const finalTestAttempts = pgTable('final_test_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  passed: boolean('passed').notNull(),
  answers: text('answers').notNull().default('[]'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  courses: many(courses),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
  courseAssignments: many(courseAssignments),
  lessonProgress: many(lessonProgress),
}))

export const coursesRelations = relations(courses, ({ one, many }) => ({
  company: one(companies, { fields: [courses.companyId], references: [companies.id] }),
  lessons: many(lessons),
  assignments: many(courseAssignments),
}))

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
  questions: many(questions),
  progress: many(lessonProgress),
}))

export const questionsRelations = relations(questions, ({ one }) => ({
  lesson: one(lessons, { fields: [questions.lessonId], references: [lessons.id] }),
}))

export const learningPathsRelations = relations(learningPaths, ({ one, many }) => ({
  company: one(companies, { fields: [learningPaths.companyId], references: [companies.id] }),
  pathCourses: many(learningPathCourses),
  assignments: many(learningPathAssignments),
}))

export const learningPathCoursesRelations = relations(learningPathCourses, ({ one }) => ({
  path: one(learningPaths, { fields: [learningPathCourses.pathId], references: [learningPaths.id] }),
  course: one(courses, { fields: [learningPathCourses.courseId], references: [courses.id] }),
}))

export const learningPathAssignmentsRelations = relations(learningPathAssignments, ({ one }) => ({
  path: one(learningPaths, { fields: [learningPathAssignments.pathId], references: [learningPaths.id] }),
  user: one(users, { fields: [learningPathAssignments.userId], references: [users.id] }),
}))

export const lessonFeedbackRelations = relations(lessonFeedback, ({ one }) => ({
  user: one(users, { fields: [lessonFeedback.userId], references: [users.id] }),
  lesson: one(lessons, { fields: [lessonFeedback.lessonId], references: [lessons.id] }),
}))

export const finalTestQuestionsRelations = relations(finalTestQuestions, ({ one }) => ({
  course: one(courses, { fields: [finalTestQuestions.courseId], references: [courses.id] }),
}))

export const finalTestAttemptsRelations = relations(finalTestAttempts, ({ one }) => ({
  user: one(users, { fields: [finalTestAttempts.userId], references: [users.id] }),
  course: one(courses, { fields: [finalTestAttempts.courseId], references: [courses.id] }),
}))
