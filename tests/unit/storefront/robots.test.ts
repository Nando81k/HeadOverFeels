// tests/unit/storefront/robots.test.ts — app/robots.ts (Phase 5, Task 4)
import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'

describe('robots', () => {
  const config = robots()
  const rules = Array.isArray(config.rules) ? config.rules : [config.rules]
  const everyone = rules.find((rule) => rule.userAgent === '*')
  const disallow = ([] as string[]).concat(everyone?.disallow ?? [])

  it('keeps the private surfaces out of the index', () => {
    for (const path of ['/admin/', '/api/', '/cart/', '/account/', '/wishlist', '/search', '/signin/']) {
      expect(disallow).toContain(path)
    }
  })

  it('no longer lists the legacy customer routes removed in Phase 4', () => {
    expect(disallow).not.toContain('/profile/')
    expect(disallow).not.toContain('/orders/')
  })

  it('points at the sitemap on the site origin', () => {
    expect(config.sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
