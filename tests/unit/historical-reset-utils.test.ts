import { describe, expect, it } from 'vitest'
import { hasAnyAdminIdentity, inspectDatabaseTarget } from '@/lib/seed/historical/reset'

describe('historical reset helpers', () => {
  it('parses database target metadata', () => {
    const target = inspectDatabaseTarget('postgresql://user:pass@host.example.com:5432/headoverfeels?schema=public')

    expect(target.provider).toBe('postgresql')
    expect(target.host).toBe('host.example.com:5432')
    expect(target.database).toBe('headoverfeels')
    expect(target.schema).toBe('public')
  })

  it('detects admin identity presence', () => {
    expect(
      hasAnyAdminIdentity({
        adminUsers: [],
        adminCustomers: [],
      })
    ).toBe(false)

    expect(
      hasAnyAdminIdentity({
        adminUsers: [{ id: 'a', email: 'a@test.com', name: 'A', password: 'x', role: 'ADMIN', isActive: true }],
        adminCustomers: [],
      })
    ).toBe(true)
  })
})
