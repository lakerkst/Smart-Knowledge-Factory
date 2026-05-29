import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Save, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { Topbar } from '~/components/layout/topbar'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { getLandingConfigFn, updateLandingConfigFn, type LandingConfig } from '~/lib/server-fns/landing'
import { toast } from '~/components/ui/toaster'

export const Route = createFileRoute('/super/landing')({
  loader: async () => {
    const config = await getLandingConfigFn()
    return { config }
  },
  component: LandingEditor,
})

// ── Stable child components (defined outside to prevent remounting) ──────────

interface SectionProps {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Section({ title, isOpen, onToggle, children }: SectionProps) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-4 hover:bg-surface-dim/50 transition-colors rounded-2xl"
      >
        <span className="text-sm font-semibold text-text">{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>
      {isOpen && <CardContent className="border-t border-border-light pt-5 pb-5">{children}</CardContent>}
    </Card>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
  hint?: string
}

function Field({ label, value, onChange, multiline = false, placeholder = '', hint }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-muted">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

// ── Main editor ──────────────────────────────────────────────────────────────

function LandingEditor() {
  const { config: initial } = Route.useLoaderData()
  const { t } = useTranslation()
  const [config, setConfig] = useState<LandingConfig>(() => JSON.parse(JSON.stringify(initial)))
  const [saving, setSaving] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['nav', 'hero']))

  const toggleSection = (s: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateLandingConfigFn({ data: { config } })
      toast.success(t('super.landing.saved'))
    } catch {
      toast.error(t('super.landing.saveError'))
    } finally {
      setSaving(false)
    }
  }

  // helpers for inline array edits
  const updNav = (patch: Partial<LandingConfig['nav']>) =>
    setConfig((c) => ({ ...c, nav: { ...c.nav, ...patch } }))
  const updHero = (patch: Partial<LandingConfig['hero']>) =>
    setConfig((c) => ({ ...c, hero: { ...c.hero, ...patch } }))
  const updFeatures = (patch: Partial<LandingConfig['features']>) =>
    setConfig((c) => ({ ...c, features: { ...c.features, ...patch } }))
  const updHow = (patch: Partial<LandingConfig['howItWorks']>) =>
    setConfig((c) => ({ ...c, howItWorks: { ...c.howItWorks, ...patch } }))
  const updCta = (patch: Partial<LandingConfig['cta']>) =>
    setConfig((c) => ({ ...c, cta: { ...c.cta, ...patch } }))
  const updContacts = (patch: Partial<LandingConfig['contacts']>) =>
    setConfig((c) => ({ ...c, contacts: { ...c.contacts, ...patch } }))
  const updFooter = (patch: Partial<LandingConfig['footer']>) =>
    setConfig((c) => ({ ...c, footer: { ...c.footer, ...patch } }))

  return (
    <div>
      <Topbar
        title={t('super.landing.title')}
        subtitle={t('super.landing.subtitle')}
        action={
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        }
      />

      <div className="p-6 space-y-4 max-w-4xl">
        {/* ── Navigation ── */}
        <Section title={t('super.landing.navigation')} isOpen={openSections.has('nav')} onToggle={() => toggleSection('nav')}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('super.landing.brandName')}
                value={config.nav.brand}
                onChange={(v) => updNav({ brand: v })}
                placeholder="SKF"
              />
              <Field
                label={t('super.landing.loginBtnText')}
                value={config.nav.ctaText}
                onChange={(v) => updNav({ ctaText: v })}
                placeholder="Войти"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.landing.menuItems')}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updNav({ items: [...config.nav.items, { label: '', href: '' }] })}
                >
                  <Plus className="h-3 w-3" /> {t('common.add')}
                </Button>
              </div>
              <div className="space-y-2">
                {config.nav.items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={t('super.landing.menuItemName')}
                      value={item.label}
                      onChange={(e) => {
                        const items = [...config.nav.items]
                        items[i] = { ...items[i], label: e.target.value }
                        updNav({ items })
                      }}
                    />
                    <Input
                      placeholder={t('super.landing.menuItemLink')}
                      value={item.href}
                      onChange={(e) => {
                        const items = [...config.nav.items]
                        items[i] = { ...items[i], href: e.target.value }
                        updNav({ items })
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-danger hover:text-danger"
                      onClick={() => updNav({ items: config.nav.items.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {config.nav.items.length === 0 && (
                  <p className="py-2 text-xs text-text-muted">{t('super.landing.noMenuItems')}</p>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Hero ── */}
        <Section title={t('super.landing.heroSection')} isOpen={openSections.has('hero')} onToggle={() => toggleSection('hero')}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('super.landing.heroBadge')}
              value={config.hero.badge}
              onChange={(v) => updHero({ badge: v })}
              placeholder="Платформа корпоративного обучения"
            />
            <div /> {/* spacer */}
            <Field
              label={t('super.landing.heroTitleLine1')}
              value={config.hero.titleLine1}
              onChange={(v) => updHero({ titleLine1: v })}
              placeholder="Обучение, которое"
            />
            <Field
              label={t('super.landing.heroHighlight')}
              value={config.hero.titleHighlight}
              onChange={(v) => updHero({ titleHighlight: v })}
              placeholder="работает"
            />
            <div className="col-span-2">
              <Field
                label={t('super.landing.heroSubtitle')}
                value={config.hero.subtitle}
                onChange={(v) => updHero({ subtitle: v })}
                multiline
                placeholder="Описание платформы..."
              />
            </div>
            <Field
              label={t('super.landing.heroPrimaryBtn')}
              value={config.hero.ctaPrimary}
              onChange={(v) => updHero({ ctaPrimary: v })}
              placeholder="Начать бесплатно"
            />
            <Field
              label={t('super.landing.heroSecondaryBtn')}
              value={config.hero.ctaSecondary}
              onChange={(v) => updHero({ ctaSecondary: v })}
              placeholder="Демо для сотрудника"
            />
          </div>
        </Section>

        {/* ── Features ── */}
        <Section title={t('super.landing.featuresSection')} isOpen={openSections.has('features')} onToggle={() => toggleSection('features')}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('super.landing.eyebrow')}
                value={config.features.eyebrow}
                onChange={(v) => updFeatures({ eyebrow: v })}
              />
              <Field
                label={t('super.landing.sectionTitle')}
                value={config.features.title}
                onChange={(v) => updFeatures({ title: v })}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.landing.featureCards')}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updFeatures({ items: [...config.features.items, { icon: 'Star', title: '', desc: '' }] })}
                >
                  <Plus className="h-3 w-3" /> {t('common.add')}
                </Button>
              </div>
              <div className="space-y-3">
                {config.features.items.map((item, i) => (
                  <div key={i} className="rounded-xl border border-border-light p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-text-muted">{t('super.landing.cardN', { n: i + 1 })}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-danger hover:text-danger"
                        onClick={() => updFeatures({ items: config.features.items.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field
                        label={t('super.landing.iconName')}
                        value={item.icon}
                        onChange={(v) => {
                          const items = [...config.features.items]
                          items[i] = { ...items[i], icon: v }
                          updFeatures({ items })
                        }}
                        placeholder="Video, Shield..."
                        hint="Video, CheckCircle2, Shield, BarChart3, Users, Building2, BookOpen"
                      />
                      <div className="col-span-2">
                        <Field
                          label={t('super.landing.cardTitle')}
                          value={item.title}
                          onChange={(v) => {
                            const items = [...config.features.items]
                            items[i] = { ...items[i], title: v }
                            updFeatures({ items })
                          }}
                        />
                      </div>
                    </div>
                    <Field
                      label={t('super.landing.cardDescription')}
                      value={item.desc}
                      onChange={(v) => {
                        const items = [...config.features.items]
                        items[i] = { ...items[i], desc: v }
                        updFeatures({ items })
                      }}
                      multiline
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── How It Works ── */}
        <Section title={t('super.landing.howSection')} isOpen={openSections.has('how')} onToggle={() => toggleSection('how')}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('super.landing.eyebrow')}
                value={config.howItWorks.eyebrow}
                onChange={(v) => updHow({ eyebrow: v })}
              />
              <Field
                label={t('super.landing.sectionTitle')}
                value={config.howItWorks.title}
                onChange={(v) => updHow({ title: v })}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.landing.steps')}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const n = config.howItWorks.steps.length + 1
                    updHow({ steps: [...config.howItWorks.steps, { step: String(n).padStart(2, '0'), title: '', desc: '' }] })
                  }}
                >
                  <Plus className="h-3 w-3" /> {t('common.add')}
                </Button>
              </div>
              <div className="space-y-3">
                {config.howItWorks.steps.map((step, i) => (
                  <div key={i} className="rounded-xl border border-border-light p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-text-muted">{t('super.landing.stepN', { n: i + 1 })}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-danger hover:text-danger"
                        onClick={() => updHow({ steps: config.howItWorks.steps.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Field
                        label={t('super.landing.stepNumber')}
                        value={step.step}
                        onChange={(v) => {
                          const steps = [...config.howItWorks.steps]
                          steps[i] = { ...steps[i], step: v }
                          updHow({ steps })
                        }}
                        placeholder="01"
                      />
                      <div className="col-span-3">
                        <Field
                          label={t('super.landing.cardTitle')}
                          value={step.title}
                          onChange={(v) => {
                            const steps = [...config.howItWorks.steps]
                            steps[i] = { ...steps[i], title: v }
                            updHow({ steps })
                          }}
                        />
                      </div>
                    </div>
                    <Field
                      label={t('super.landing.cardDescription')}
                      value={step.desc}
                      onChange={(v) => {
                        const steps = [...config.howItWorks.steps]
                        steps[i] = { ...steps[i], desc: v }
                        updHow({ steps })
                      }}
                      multiline
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Stats ── */}
        <Section title={t('super.landing.statsSection')} isOpen={openSections.has('stats')} onToggle={() => toggleSection('stats')}>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('super.landing.blocks')}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfig((c) => ({ ...c, stats: [...c.stats, { value: '', label: '', icon: 'CheckCircle2' }] }))}
              >
                <Plus className="h-3 w-3" /> {t('common.add')}
              </Button>
            </div>
            <div className="space-y-2">
              {config.stats.map((stat, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="w-28">
                    <label className="mb-1 block text-xs text-text-muted">{t('super.landing.statValue')}</label>
                    <Input
                      placeholder="95%"
                      value={stat.value}
                      onChange={(e) => {
                        const stats = [...config.stats]
                        stats[i] = { ...stats[i], value: e.target.value }
                        setConfig((c) => ({ ...c, stats }))
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-text-muted">{t('super.landing.statLabel')}</label>
                    <Input
                      placeholder="Завершают курс"
                      value={stat.label}
                      onChange={(e) => {
                        const stats = [...config.stats]
                        stats[i] = { ...stats[i], label: e.target.value }
                        setConfig((c) => ({ ...c, stats }))
                      }}
                    />
                  </div>
                  <div className="w-36">
                    <label className="mb-1 block text-xs text-text-muted">{t('super.landing.statIcon')}</label>
                    <Input
                      placeholder="CheckCircle2"
                      value={stat.icon}
                      onChange={(e) => {
                        const stats = [...config.stats]
                        stats[i] = { ...stats[i], icon: e.target.value }
                        setConfig((c) => ({ ...c, stats }))
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-danger hover:text-danger"
                    onClick={() => setConfig((c) => ({ ...c, stats: c.stats.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── CTA ── */}
        <Section title={t('super.landing.ctaSection')} isOpen={openSections.has('cta')} onToggle={() => toggleSection('cta')}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('super.landing.ctaTitle')}
              value={config.cta.title}
              onChange={(v) => updCta({ title: v })}
              placeholder="Готовы начать?"
            />
            <Field
              label={t('super.landing.ctaButtonText')}
              value={config.cta.buttonText}
              onChange={(v) => updCta({ buttonText: v })}
              placeholder="Панель управления"
            />
            <div className="col-span-2">
              <Field
                label={t('super.landing.ctaSubtitle')}
                value={config.cta.subtitle}
                onChange={(v) => updCta({ subtitle: v })}
                multiline
                placeholder="Попробуйте демо-версию..."
              />
            </div>
          </div>
        </Section>

        {/* ── Contacts ── */}
        <Section title={t('super.landing.contactsSection')} isOpen={openSections.has('contacts')} onToggle={() => toggleSection('contacts')}>
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Email"
              value={config.contacts.email}
              onChange={(v) => updContacts({ email: v })}
              placeholder="contact@example.com"
            />
            <Field
              label={t('super.landing.contactPhone')}
              value={config.contacts.phone}
              onChange={(v) => updContacts({ phone: v })}
              placeholder="+7 (999) 123-45-67"
            />
            <Field
              label={t('super.landing.contactAddress')}
              value={config.contacts.address}
              onChange={(v) => updContacts({ address: v })}
              placeholder="г. Москва, ул. ..."
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">{t('super.landing.contactsHint')}</p>
        </Section>

        {/* ── Footer ── */}
        <Section title={t('super.landing.footerSection')} isOpen={openSections.has('footer')} onToggle={() => toggleSection('footer')}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('super.landing.footerBrand')}
              value={config.footer.brand}
              onChange={(v) => updFooter({ brand: v })}
              placeholder="Smart Knowledge Factory"
            />
            <Field
              label={t('super.landing.footerCopyright')}
              value={config.footer.copyright}
              onChange={(v) => updFooter({ copyright: v })}
              placeholder="© 2025 SKF. Все права защищены."
            />
          </div>
        </Section>

        {/* ── Save bar ── */}
        <div className="flex items-center justify-between rounded-2xl border border-border-light bg-surface-raised px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Globe className="h-4 w-4" />
            {t('super.landing.changesApply')} <a href="/" target="_blank" className="text-primary hover:underline">/</a>
          </div>
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4" />
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
