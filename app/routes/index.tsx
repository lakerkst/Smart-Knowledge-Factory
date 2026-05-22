import { createFileRoute, Link } from '@tanstack/react-router'
import {
  GraduationCap,
  Shield,
  BarChart3,
  Video,
  CheckCircle2,
  ArrowRight,
  Play,
  Users,
  BookOpen,
  Building2,
  ChevronRight,
} from 'lucide-react'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-light/50 bg-surface-raised/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-text">SKF</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-text-secondary hover:text-text transition-colors">
              Возможности
            </a>
            <a href="#how" className="text-sm text-text-secondary hover:text-text transition-colors">
              Как это работает
            </a>
            <a href="#stats" className="text-sm text-text-secondary hover:text-text transition-colors">
              Результаты
            </a>
          </nav>
          <Link to="/login">
            <Button variant="outline" size="sm">
              Войти
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-40 right-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 animate-fade-in">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">Платформа корпоративного обучения</span>
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-text sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              Обучение, которое{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                работает
              </span>
            </h1>

            <p className="mt-6 text-lg text-text-secondary md:text-xl animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
              Контролируемое видео-обучение с интерактивными тестами.
              Сотрудники не смогут пропустить материал — система гарантирует усвоение знаний.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" className="w-full text-base sm:w-auto">
                  Начать бесплатно
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/learn/token-ivan-abc123" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full text-base sm:w-auto">
                  <Play className="h-4 w-4" />
                  Демо для сотрудника
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 rounded-2xl border border-border-light bg-surface-raised p-2 shadow-card-hover animate-slide-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
            <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-primary-50 via-surface to-accent-light flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 backdrop-blur">
                  <Play className="h-8 w-8 text-primary ml-1" />
                </div>
                <p className="text-text-secondary">Интерактивная демонстрация платформы</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-surface-dim">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">
              Возможности
            </p>
            <h2 className="mt-3 text-3xl font-bold text-text md:text-4xl">
              Всё для эффективного обучения
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Video,
                title: 'Контроль просмотра',
                desc: 'Система отслеживает реальный просмотр видео. Перемотка вперёд заблокирована — только честное прохождение.',
              },
              {
                icon: CheckCircle2,
                title: 'Тесты на таймкодах',
                desc: 'Вопросы привязаны к конкретным моментам видео. При ошибке — автоматический возврат к нужному фрагменту.',
              },
              {
                icon: Shield,
                title: 'Три уровня доступа',
                desc: 'Сотрудник, админ компании и супер-админ. Каждый видит только свои данные благодаря RLS-политикам.',
              },
              {
                icon: BarChart3,
                title: 'Детальная аналитика',
                desc: 'Прогресс каждого сотрудника, статистика по курсам, активность за 14 дней, сравнение компаний.',
              },
              {
                icon: Users,
                title: 'Персональные ссылки',
                desc: 'Сотрудники входят без логина и пароля — по уникальной ссылке. Мгновенный старт обучения.',
              },
              {
                icon: Building2,
                title: 'Мультикомпания',
                desc: 'Каждая компания изолирована. Свои сотрудники, курсы и статистика. Супер-админ видит всех.',
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border-light bg-surface-raised p-6 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-1"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary-50 p-3 transition-colors group-hover:bg-primary-100">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-text">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">
              Процесс
            </p>
            <h2 className="mt-3 text-3xl font-bold text-text md:text-4xl">
              Как это работает
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { step: '01', title: 'Персональная ссылка', desc: 'Сотрудник получает уникальную ссылку и сразу начинает обучение без регистрации' },
              { step: '02', title: 'Видео + вопросы', desc: 'Просмотр контролируемого видео с автоматическими тестами в ключевых моментах' },
              { step: '03', title: 'Гарантия результата', desc: 'При ошибке — повторный просмотр. Курс считается пройденным только после всех тестов' },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                <span className="text-6xl font-black text-primary/10">{item.step}</span>
                <h3 className="mt-2 text-lg font-semibold text-text">{item.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{item.desc}</p>
                {i < 2 && (
                  <ChevronRight className="absolute right-0 top-8 hidden h-6 w-6 text-border md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="stats" className="py-20 bg-surface-dim">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { value: '95%', label: 'Завершают курс', icon: CheckCircle2 },
              { value: '3x', label: 'Выше усвоение', icon: BookOpen },
              { value: '< 2 мин', label: 'Старт обучения', icon: Play },
              { value: '24/7', label: 'Доступ к курсам', icon: GraduationCap },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="text-3xl font-bold text-text">{stat.value}</p>
                <p className="mt-1 text-sm text-text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-text md:text-4xl">
            Готовы начать?
          </h2>
          <p className="mt-4 text-text-secondary">
            Попробуйте демо-версию прямо сейчас или войдите в панель управления
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to="/login">
              <Button size="lg">
                Панель управления
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-8 rounded-xl bg-surface-dim p-4 text-sm text-text-muted">
            <p className="font-medium text-text-secondary mb-1">Демо-доступ:</p>
            <p>Админ: admin@technostar.ru / demo123</p>
            <p>Супер-админ: super@skf.ru / demo123</p>
            <p>Сотрудник: /learn/token-ivan-abc123</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border-light bg-surface-raised py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-text">Smart Knowledge Factory</span>
          </div>
          <p className="text-xs text-text-muted">&copy; 2025 SKF. Все права защищены.</p>
        </div>
      </footer>
    </div>
  )
}
