import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Plus,
  BookOpen,
  Clock,
  Users,
  ChevronRight,
  Video,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { mockCourses, mockLessons, mockCourseAssignments } from '~/lib/mock-data'
import { formatDuration } from '~/lib/utils'

export const Route = createFileRoute('/admin/courses/')({
  component: CoursesPage,
})

function CoursesPage() {
  const { user } = Route.useRouteContext()

  const courses = mockCourses
    .filter((c) => c.companyId === user.companyId)
    .map((course) => {
      const lessons = mockLessons.filter((l) => l.courseId === course.id)
      const assigned = mockCourseAssignments.filter((a) => a.courseId === course.id)
      return {
        ...course,
        lessonsCount: lessons.length,
        assignedCount: assigned.length,
        totalDuration: lessons.reduce((acc, l) => acc + l.duration, 0),
      }
    })

  return (
    <div>
      <Topbar title="Курсы" subtitle="Управление курсами компании" />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-text-muted">{courses.length} курсов</p>
          <Button>
            <Plus className="h-4 w-4" />
            Создать курс
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <div
              key={course.id}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
            >
              <Link
                to="/admin/courses/$courseId"
                params={{ courseId: course.id }}
                className="block"
              >
                <div className="group rounded-2xl border border-border-light bg-surface-raised shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5">
                  <div className="aspect-[16/9] rounded-t-2xl bg-gradient-to-br from-primary-50 via-surface to-primary-100 flex items-center justify-center">
                    <div className="text-center">
                      <Video className="mx-auto h-8 w-8 text-primary/50" />
                      <p className="mt-2 text-xs text-text-muted">{course.lessonsCount} уроков</p>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                        {course.title}
                      </h3>
                      <ChevronRight className="h-4 w-4 text-text-muted shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="mt-1 text-xs text-text-muted line-clamp-2">
                      {course.description}
                    </p>

                    <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.lessonsCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(course.totalDuration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.assignedCount}
                      </span>
                    </div>

                    <div className="mt-3">
                      <Badge variant={course.isPublished ? 'success' : 'secondary'}>
                        {course.isPublished ? 'Опубликован' : 'Черновик'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
