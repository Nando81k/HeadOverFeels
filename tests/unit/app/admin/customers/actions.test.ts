// tests/unit/app/admin/customers/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerFindUnique = vi.fn()
const customerUpdate = vi.fn()
const customerFindMany = vi.fn()
const customerCount = vi.fn()
const noteCreate = vi.fn()
const noteUpdate = vi.fn()
const noteDelete = vi.fn()
const addressCreate = vi.fn()
const addressUpdate = vi.fn()
const addressDelete = vi.fn()
const addressUpdateMany = vi.fn()
const txMock = vi.fn(async (fn: (tx: unknown) => unknown) =>
  fn({
    address: { update: addressUpdate, updateMany: addressUpdateMany },
  }),
)

const awardPoints = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: customerFindUnique,
      update: customerUpdate,
      findMany: customerFindMany,
      count: customerCount,
    },
    customerNote: {
      create: noteCreate,
      update: noteUpdate,
      delete: noteDelete,
    },
    address: {
      create: addressCreate,
      update: addressUpdate,
      delete: addressDelete,
      updateMany: addressUpdateMany,
    },
    $transaction: (fn: (tx: unknown) => unknown) => txMock(fn),
  },
}))

vi.mock('@/lib/loyalty/service', () => ({
  awardPoints: (...a: unknown[]) => awardPoints(...a),
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue('admin-1'),
  requireAdminRole: vi.fn().mockResolvedValue('admin-1'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('updateCustomerProfile', () => {
  it('strips undefined values and updates the customer', async () => {
    customerUpdate.mockResolvedValue({ id: 'c1' })
    const { updateCustomerProfile } = await import('@/app/admin/customers/actions')
    const r = await updateCustomerProfile('c1', { name: 'Ada', newsletter: true })
    expect(r.ok).toBe(true)
    const data = customerUpdate.mock.calls[0][0].data
    expect(data.name).toBe('Ada')
    expect(data.newsletter).toBe(true)
    expect(data.phone).toBeUndefined()
  })
})

describe('CustomerNote actions', () => {
  it('createCustomerNote persists with isImportant flag', async () => {
    noteCreate.mockResolvedValue({ id: 'n1' })
    customerFindUnique.mockResolvedValue({ id: 'a1', name: 'Admin', email: 'a@e.com' })
    const { createCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await createCustomerNote('c1', 'VIP', true)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.id).toBe('n1')
    expect(noteCreate.mock.calls[0][0].data.isImportant).toBe(true)
  })

  it('createCustomerNote rejects empty content', async () => {
    const { createCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await createCustomerNote('c1', '   ')
    expect(r.ok).toBe(false)
  })

  it('updateCustomerNote sets isImportant + content', async () => {
    noteUpdate.mockResolvedValue({})
    const { updateCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await updateCustomerNote('n1', 'Updated', false)
    expect(r.ok).toBe(true)
    expect(noteUpdate.mock.calls[0][0].data.content).toBe('Updated')
    expect(noteUpdate.mock.calls[0][0].data.isImportant).toBe(false)
  })

  it('deleteCustomerNote calls prisma.customerNote.delete', async () => {
    noteDelete.mockResolvedValue({})
    const { deleteCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await deleteCustomerNote('n1')
    expect(r.ok).toBe(true)
  })
})

describe('Address actions (schema field names)', () => {
  it('createAddress uses firstName/lastName/address1/state/postalCode', async () => {
    addressCreate.mockResolvedValue({ id: 'a1' })
    const { createAddress } = await import('@/app/admin/customers/actions')
    const r = await createAddress('c1', {
      firstName: 'Ada', lastName: 'Lovelace',
      address1: '1 Main St', address2: 'Apt 2',
      city: 'NYC', state: 'NY', postalCode: '10001',
      country: 'US', isDefault: false, type: 'SHIPPING',
    })
    expect(r.ok).toBe(true)
    const data = addressCreate.mock.calls[0][0].data
    expect(data.firstName).toBe('Ada')
    expect(data.address1).toBe('1 Main St')
    expect(data.state).toBe('NY')
  })

  it('updateAddress strips undefined', async () => {
    addressUpdate.mockResolvedValue({})
    const { updateAddress } = await import('@/app/admin/customers/actions')
    const r = await updateAddress('a1', { city: 'LA' })
    expect(r.ok).toBe(true)
    const data = addressUpdate.mock.calls[0][0].data
    expect(data.city).toBe('LA')
    expect(data.firstName).toBeUndefined()
  })

  it('deleteAddress returns FK-violation error on failure', async () => {
    addressDelete.mockRejectedValue(new Error('Foreign key constraint failed'))
    const { deleteAddress } = await import('@/app/admin/customers/actions')
    const r = await deleteAddress('a1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/referenced by orders|Foreign key/i)
  })

  it('setDefaultAddress runs the unset-then-set transaction', async () => {
    addressUpdateMany.mockResolvedValue({ count: 2 })
    addressUpdate.mockResolvedValue({})
    const { setDefaultAddress } = await import('@/app/admin/customers/actions')
    const r = await setDefaultAddress('c1', 'a1')
    expect(r.ok).toBe(true)
    expect(addressUpdateMany).toHaveBeenCalledWith({
      where: { customerId: 'c1' }, data: { isDefault: false },
    })
    expect(addressUpdate.mock.calls[0][0].where.id).toBe('a1')
    expect(addressUpdate.mock.calls[0][0].data.isDefault).toBe(true)
  })
})

describe('bulkGiftPoints (SUPER_ADMIN)', () => {
  it('wraps awardPoints with gift-${batchId}-${customerId} idempotency', async () => {
    awardPoints.mockResolvedValue({ id: 'pt1' })
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1', 'c2'], 100, 'Promo')
    expect(r.ok).toBe(true)
    expect(awardPoints).toHaveBeenCalledTimes(2)
    const k1 = awardPoints.mock.calls[0][4].idempotencyKey
    const k2 = awardPoints.mock.calls[1][4].idempotencyKey
    expect(k1).toMatch(/^gift-/)
    expect(k1.split('-')[1]).toBe(k2.split('-')[1])
    expect(k1.endsWith('c1')).toBe(true)
    expect(k2.endsWith('c2')).toBe(true)
  })

  it('rejects zero or non-finite delta', async () => {
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1'], 0, 'Promo')
    expect(r.ok).toBe(false)
  })

  it('rejects empty reason', async () => {
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1'], 100, '   ')
    expect(r.ok).toBe(false)
  })

  it('collects per-customer failures + continues batch', async () => {
    awardPoints
      .mockResolvedValueOnce({ id: 'pt1' })
      .mockRejectedValueOnce(new Error('boom'))
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1', 'c2'], 100, 'Promo')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) {
      expect(r.data.succeeded).toEqual(['c1'])
      expect(r.data.failed).toHaveLength(1)
      expect(r.data.failed[0].id).toBe('c2')
    }
  })
})

describe('bulkExportCustomersCsv', () => {
  it('emits CSV with email + name + tier + totalSpent', async () => {
    customerCount.mockResolvedValue(1)
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada',
        totalOrders: 3, totalSpent: 450, currentPoints: 200,
        lastOrderDate: new Date('2026-05-15'),
        loyaltyTier: { name: 'Silver' } },
    ])
    const { bulkExportCustomersCsv } = await import('@/app/admin/customers/actions')
    const r = await bulkExportCustomersCsv(['c1'])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.csv).toContain('a@e.com')
      expect(r.data?.csv).toContain('Silver')
    }
  })

  it('rejects over 10,000 rows', async () => {
    customerCount.mockResolvedValue(20000)
    const ids = Array.from({ length: 20000 }, (_, i) => `c${i}`)
    const { bulkExportCustomersCsv } = await import('@/app/admin/customers/actions')
    const r = await bulkExportCustomersCsv(ids)
    expect(r.ok).toBe(false)
  })
})

describe('anonymizeCustomer (SUPER_ADMIN)', () => {
  it('rejects on typedConfirmEmail mismatch', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'real@e.com', anonymizedAt: null,
    })
    const { anonymizeCustomer } = await import('@/app/admin/customers/actions')
    const r = await anonymizeCustomer('c1', 'wrong@e.com')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/email mismatch/i)
  })

  it('rejects already-anonymized', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'real@e.com', anonymizedAt: new Date(),
    })
    const { anonymizeCustomer } = await import('@/app/admin/customers/actions')
    const r = await anonymizeCustomer('c1', 'real@e.com')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/already anonymized/i)
  })

  it('scrubs PII + sets anonymizedAt with the not-yet-anonymized guard', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'real@e.com', anonymizedAt: null,
    })
    customerUpdate.mockResolvedValue({ id: 'c1' })
    const { anonymizeCustomer } = await import('@/app/admin/customers/actions')
    const r = await anonymizeCustomer('c1', 'Real@E.com  ') // case + whitespace ok
    expect(r.ok).toBe(true)
    const call = customerUpdate.mock.calls[0][0]
    expect(call.where.id).toBe('c1')
    expect(call.where.anonymizedAt).toBeNull()
    expect(call.data.email).toBe('deleted-c1@anonymized.local')
    expect(call.data.name).toBeNull()
    expect(call.data.phone).toBeNull()
    expect(call.data.birthday).toBeNull()
    expect(call.data.profilePictureUrl).toBeNull()
    expect(call.data.anonymizedAt).toBeInstanceOf(Date)
  })
})

describe('getCustomerHeaderForRefresh', () => {
  it('returns null for missing customer', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { getCustomerHeaderForRefresh } = await import('@/app/admin/customers/actions')
    expect(await getCustomerHeaderForRefresh('missing')).toBeNull()
  })
})
