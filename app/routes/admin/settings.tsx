import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Save, User } from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { changePasswordFn } from '~/lib/server-fns/auth'
import { toast } from '~/components/ui/toaster'

export const Route = createFileRoute('/admin/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()
  const { user } = Route.useRouteContext()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordsNoMatch'))
      return
    }
    if (newPassword.length < 6) {
      toast.error(t('settings.passwordTooShort'))
      return
    }
    setSaving(true)
    try {
      const result = await changePasswordFn({
        data: { userId: user.userId, currentPassword, newPassword },
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('settings.passwordChanged'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Topbar title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="p-6 max-w-lg space-y-6">
        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary" />
              {t('settings.account')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">{t('common.name')}</span>
              <span className="font-medium text-text">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">{t('common.email')}</span>
              <span className="font-medium text-text">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">{t('settings.role')}</span>
              <span className="font-medium text-text">
                {user.role === 'super_admin' ? t('nav.superAdmin') : t('settings.administrator')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-primary" />
              {t('settings.changePassword')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                {t('settings.currentPassword')}
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                {t('settings.newPassword')}
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.minChars')}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                {t('settings.confirmPassword')}
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings.repeatPassword')}
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={
                saving ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="w-full"
            >
              <Save className="h-4 w-4" />
              {saving ? t('common.saving') : t('settings.changePasswordBtn')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
