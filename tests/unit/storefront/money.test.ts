import { describe, it, expect } from 'vitest'
import { formatMoney, isOnSale, toNumber } from '@/lib/storefront/money'

const usd = (amount: string) => ({ amount, currencyCode: 'USD' })

describe('formatMoney', () => {
  it('formats a decimal string as USD currency with two fraction digits', () => {
    expect(formatMoney(usd('42.5'))).toBe('$42.50')
  })

  it('keeps two fraction digits for whole amounts by default', () => {
    expect(formatMoney(usd('40.00'))).toBe('$40.00')
    expect(formatMoney(usd('40'))).toBe('$40.00')
  })

  it('trims trailing zeros only for whole amounts when trimZeros is set', () => {
    expect(formatMoney(usd('40.00'), { trimZeros: true })).toBe('$40')
    expect(formatMoney(usd('42.50'), { trimZeros: true })).toBe('$42.50')
    expect(formatMoney(usd('42.5'), { trimZeros: true })).toBe('$42.50')
  })

  it('honours the currency code', () => {
    expect(formatMoney({ amount: '12', currencyCode: 'EUR' })).toContain('12.00')
    expect(formatMoney({ amount: '12', currencyCode: 'EUR' })).toContain('€')
  })

  it('accepts a locale override', () => {
    const out = formatMoney({ amount: '1234.5', currencyCode: 'USD' }, { locale: 'de-DE' })
    expect(out).toContain('1.234,50')
  })

  it('formats zero', () => {
    expect(formatMoney(usd('0'))).toBe('$0.00')
    expect(formatMoney(usd('0'), { trimZeros: true })).toBe('$0')
  })

  it('falls back to 0 for a non-numeric amount', () => {
    expect(formatMoney(usd('not-a-number'))).toBe('$0.00')
  })
})

describe('toNumber', () => {
  it('parses the decimal string', () => {
    expect(toNumber(usd('42.50'))).toBe(42.5)
    expect(toNumber(usd('0'))).toBe(0)
  })

  it('returns 0 for a non-numeric amount', () => {
    expect(toNumber(usd(''))).toBe(0)
    expect(toNumber(usd('abc'))).toBe(0)
  })
})

describe('isOnSale', () => {
  it('is true when compare-at is strictly greater in the same currency', () => {
    expect(isOnSale(usd('42.50'), usd('60.00'))).toBe(true)
  })

  it('is false when compare-at is equal or lower', () => {
    expect(isOnSale(usd('42.50'), usd('42.50'))).toBe(false)
    expect(isOnSale(usd('42.50'), usd('10.00'))).toBe(false)
  })

  it('is false when compare-at is missing', () => {
    expect(isOnSale(usd('42.50'), null)).toBe(false)
    expect(isOnSale(usd('42.50'), undefined)).toBe(false)
  })

  it('is false across differing currencies', () => {
    expect(isOnSale(usd('42.50'), { amount: '60.00', currencyCode: 'EUR' })).toBe(false)
  })
})
