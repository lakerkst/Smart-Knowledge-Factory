import { Bell, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TopbarProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function Topbar({ title, subtitle, action }: TopbarProps) {
  const { t } = useTranslation()
  return (
    <header className="flex items-center justify-between border-b border-border-light bg-surface-raised px-4 py-3 md:px-6 md:py-4">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-text md:text-xl">{title}</h1>
        {subtitle && <p className="hidden text-sm text-text-muted sm:block">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {action && <div className="hidden md:block">{action}</div>}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t('common.search')}
            className="h-9 w-48 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors lg:w-64"
          />
        </div>
        <button className="relative rounded-lg p-2 text-text-muted hover:bg-surface-dim hover:text-text transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
        </button>
      </div>
    </header>
  )
}
