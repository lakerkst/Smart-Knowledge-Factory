import { cn } from '~/lib/utils'

export interface DateRange {
  from: Date
  to: Date
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const PRESETS = [
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
  { label: '90 дней', days: 90 },
  { label: 'Год', days: 365 },
]

function toInputDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function isPresetActive(value: DateRange, days: number) {
  const expectedFrom = new Date()
  expectedFrom.setDate(expectedFrom.getDate() - days + 1)
  expectedFrom.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return (
    toInputDate(value.from) === toInputDate(expectedFrom) &&
    toInputDate(value.to) === toInputDate(today)
  )
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const applyPreset = (days: number) => {
    const to = new Date()
    to.setHours(23, 59, 59, 999)
    const from = new Date()
    from.setDate(from.getDate() - days + 1)
    from.setHours(0, 0, 0, 0)
    onChange({ from, to })
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => applyPreset(p.days)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            isPresetActive(value, p.days)
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface-dim text-text-muted hover:bg-surface-raised hover:text-text'
          )}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1.5 ml-1">
        <input
          type="date"
          value={toInputDate(value.from)}
          max={toInputDate(value.to)}
          onChange={(e) => e.target.value && onChange({ ...value, from: new Date(e.target.value) })}
          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <span className="text-xs text-text-muted">—</span>
        <input
          type="date"
          value={toInputDate(value.to)}
          min={toInputDate(value.from)}
          max={toInputDate(new Date())}
          onChange={(e) => e.target.value && onChange({ ...value, to: new Date(e.target.value) })}
          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  )
}
