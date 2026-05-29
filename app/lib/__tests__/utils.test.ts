import { describe, it, expect } from 'vitest'
import { formatDuration, formatDate, generateToken } from '../utils'

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats 90 seconds as 1:30', () => {
    expect(formatDuration(90)).toBe('1:30')
  })

  it('formats 3600 seconds as 60:00', () => {
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('pads single-digit seconds', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('handles fractional seconds', () => {
    expect(formatDuration(90.9)).toBe('1:30')
  })
})

describe('formatDate', () => {
  it('returns a non-empty string for a valid date', () => {
    const result = formatDate(new Date('2024-01-15'))
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('accepts a string date', () => {
    const result = formatDate('2024-06-01')
    expect(typeof result).toBe('string')
  })
})

describe('generateToken', () => {
  it('generates a token of the requested length', () => {
    const token = generateToken(24)
    expect(token.length).toBe(24)
  })

  it('generates unique tokens', () => {
    const a = generateToken(16)
    const b = generateToken(16)
    expect(a).not.toBe(b)
  })

  it('only contains alphanumeric characters', () => {
    const token = generateToken(32)
    expect(/^[A-Za-z0-9]+$/.test(token)).toBe(true)
  })
})
