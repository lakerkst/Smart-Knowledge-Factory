import { describe, it, expect } from 'vitest'

// Inline the logic from TimecodeInput so these tests stay pure (no React imports)
function secondsToMMSS(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function mmssToSeconds(str: string): number | null {
  const trimmed = str.trim()
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed)
  const match = trimmed.match(/^(\d{0,3}):(\d{0,2})$/)
  if (match) {
    return (parseInt(match[1] || '0') || 0) * 60 + (parseInt(match[2] || '0') || 0)
  }
  return null
}

describe('secondsToMMSS', () => {
  it('converts 0 to 00:00', () => {
    expect(secondsToMMSS(0)).toBe('00:00')
  })

  it('converts 90 to 01:30', () => {
    expect(secondsToMMSS(90)).toBe('01:30')
  })

  it('converts 3600 to 60:00', () => {
    expect(secondsToMMSS(3600)).toBe('60:00')
  })

  it('pads seconds with leading zero', () => {
    expect(secondsToMMSS(65)).toBe('01:05')
  })
})

describe('mmssToSeconds', () => {
  it('parses 01:30 as 90', () => {
    expect(mmssToSeconds('01:30')).toBe(90)
  })

  it('parses plain integer string as seconds', () => {
    expect(mmssToSeconds('90')).toBe(90)
  })

  it('parses 00:00 as 0', () => {
    expect(mmssToSeconds('00:00')).toBe(0)
  })

  it('returns null for invalid input', () => {
    expect(mmssToSeconds('abc')).toBeNull()
    expect(mmssToSeconds('1:2:3')).toBeNull()
  })

  it('round-trips with secondsToMMSS', () => {
    for (const secs of [0, 30, 90, 125, 3600]) {
      expect(mmssToSeconds(secondsToMMSS(secs))).toBe(secs)
    }
  })
})
