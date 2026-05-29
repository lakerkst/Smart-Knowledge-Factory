import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { loginFn } from '~/lib/server-fns/auth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await loginFn({ data: { email, password } })

      if ('error' in result) {
        setError(result.error as string)
        setLoading(false)
        return
      }

      const user = (result as { user: { role: string } }).user
      if (user.role === 'super_admin') {
        navigate({ to: '/super' })
      } else {
        navigate({ to: '/admin' })
      }
    } catch {
      setError(t('login.serverError'))
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-gradient-to-br from-primary via-primary-dark to-primary-700 lg:flex lg:items-center lg:justify-center">
        <div className="max-w-md px-12 animate-fade-in">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">Smart Knowledge Factory</h2>
          <p className="mt-4 text-lg text-white/70">
            {t('login.platformDescription')}
          </p>
          <div className="mt-8 space-y-4">
            {[
              t('login.feature1'),
              t('login.feature2'),
              t('login.feature3'),
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <ArrowRight className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-white/80">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold text-text">SKF</span>
          </div>

          <h1 className="text-2xl font-bold text-text">{t('login.title')}</h1>
          <p className="mt-2 text-sm text-text-muted">
            {t('login.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  type="email"
                  placeholder="admin@company.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('login.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.enterPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger animate-fade-in">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? t('login.signingIn') : t('login.signIn')}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 rounded-xl bg-surface-dim p-4 text-xs text-text-muted">
            <p className="font-medium text-text-secondary mb-1">{t('login.demoAccounts')}</p>
            <p>{t('login.companyAdmin')}: admin@technostar.ru / demo123</p>
            <p>{t('login.superAdminLabel')}: super@skf.ru / demo123</p>
          </div>
        </div>
      </div>
    </div>
  )
}
