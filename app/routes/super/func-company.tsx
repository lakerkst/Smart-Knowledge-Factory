import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2, Search, Save, ChevronRight,
} from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { getCompaniesListFn, setCompanyFeaturesFn } from '~/lib/server-fns/company'
import {
  parseFeatures, serializeFeatures, FEATURE_LABELS,
  type CompanyFeatures,
} from '~/lib/features'
import { cn } from '~/lib/utils'
import { toast } from '~/components/ui/toaster'

export const Route = createFileRoute('/super/func-company')({
  loader: async () => {
    const companies = await getCompaniesListFn()
    return { companies }
  },
  component: FuncCompanyPage,
})

function FuncCompanyPage() {
  const { companies } = Route.useLoaderData()
  const router = useRouter()
  const { t } = useTranslation()

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [featuresForm, setFeaturesForm] = useState<CompanyFeatures | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedCompany = companies.find((c) => c.id === selectedId)

  const handleSelect = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId)
    if (!company) return
    setSelectedId(companyId)
    setFeaturesForm(parseFeatures(company.features))
  }

  const handleToggle = (key: keyof CompanyFeatures) => {
    setFeaturesForm((prev) => prev ? { ...prev, [key]: !prev[key] } : prev)
  }

  const handleSave = async () => {
    if (!selectedId || !featuresForm) return
    setSaving(true)
    try {
      await setCompanyFeaturesFn({
        data: { companyId: selectedId, features: serializeFeatures(featuresForm) },
      })
      router.invalidate()
      toast.success(t('super.funcCompany.saved'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Topbar
        title={t('super.funcCompany.title')}
        subtitle={t('super.funcCompany.subtitle')}
      />

      <div className="p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* ── Company list ── */}
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder={t('super.funcCompany.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border-light">
                  {filtered.map((company) => {
                    const features = parseFeatures(company.features)
                    const enabledCount = Object.values(features).filter(Boolean).length
                    const totalCount = Object.keys(FEATURE_LABELS).length
                    const isSelected = selectedId === company.id

                    return (
                      <button
                        key={company.id}
                        onClick={() => handleSelect(company.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                          isSelected
                            ? 'bg-primary-50'
                            : 'hover:bg-surface-dim/50'
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xs font-bold text-primary">
                          {company.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-text">
                              {company.name}
                            </p>
                            <Badge
                              variant={company.isActive ? 'success' : 'danger'}
                              className="shrink-0"
                            >
                              {company.isActive ? t('super.funcCompany.activeStatus') : t('super.funcCompany.inactiveStatus')}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">
                            {t('super.funcCompany.statsCount', { enabled: enabledCount, total: totalCount })}
                          </p>
                        </div>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 shrink-0 text-text-muted transition-colors',
                            isSelected && 'text-primary'
                          )}
                        />
                      </button>
                    )
                  })}
                  {filtered.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-text-muted">
                      {t('super.funcCompany.companiesNotFound')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Feature config panel ── */}
          <div>
            {selectedCompany && featuresForm ? (
              <Card className="sticky top-6">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                      {selectedCompany.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-text">
                        {selectedCompany.name}
                      </p>
                      <p className="text-xs text-text-muted">{t('super.funcCompany.statsSections')}</p>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted mb-2 px-1">
                    {t('super.funcCompany.addFunctionality')}
                    {' '}{t('super.funcCompany.belowStatsSections')}
                  </p>

                  <div className="space-y-1">
                    {/* Configurable stat sections */}
                    {(Object.keys(FEATURE_LABELS) as (keyof CompanyFeatures)[]).map(
                      (key) => (
                        <div
                          key={key}
                          onClick={() => handleToggle(key)}
                          className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-surface-dim/60"
                        >
                          <div>
                            <p className="text-sm font-medium text-text">
                              {FEATURE_LABELS[key]}
                            </p>
                            <p className="text-xs text-text-muted">
                              {featuresForm[key] ? t('common.enabled') : t('common.disabled')}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                              featuresForm[key] ? 'bg-primary' : 'bg-border'
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                                featuresForm[key]
                                  ? 'translate-x-4'
                                  : 'translate-x-0.5'
                              )}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border-light">
                    <Button
                      className="w-full"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? t('common.saving') : t('common.save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Building2 className="h-10 w-10 text-text-muted/40 mb-3" />
                  <p className="text-sm font-medium text-text-muted">
                    {t('super.funcCompany.selectCompany')}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {t('super.funcCompany.selectCompanyHint')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
