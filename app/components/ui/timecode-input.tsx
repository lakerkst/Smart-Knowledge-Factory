import { useState, useEffect } from 'react'
import { cn } from '~/lib/utils'

function secondsToMMSS(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function mmssToSeconds(str: string): number | null {
  const trimmed = str.trim()
  // Plain integer — treat as seconds
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed)
  // MM:SS format
  const match = trimmed.match(/^(\d{0,3}):(\d{0,2})$/)
  if (match) {
    return (parseInt(match[1] || '0') || 0) * 60 + (parseInt(match[2] || '0') || 0)
  }
  return null
}

interface TimecodeInputProps {
  value: number
  onChange: (seconds: number) => void
  placeholder?: string
  className?: string
}

export function TimecodeInput({
  value,
  onChange,
  placeholder = '00:00',
  className,
}: TimecodeInputProps) {
  const [text, setText] = useState(() => secondsToMMSS(value))

  // Sync when external value changes (e.g. form reset)
  useEffect(() => {
    setText(secondsToMMSS(value))
  }, [value])

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const secs = mmssToSeconds(text)
        if (secs !== null && secs >= 0) {
          onChange(secs)
          setText(secondsToMMSS(secs))
        } else {
          // Revert to last known good value
          setText(secondsToMMSS(value))
        }
      }}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2 font-mono text-sm text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
        className
      )}
    />
  )
}
