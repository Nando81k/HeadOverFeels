// app/admin/customers/actions.ts
'use server'

/**
 * Phase 8 — Admin Customers Server Actions (~12 actions).
 *
 * Auth gates:
 *   - requireAdmin() (no-arg) for all read + most write actions.
 *   - requireAdminRole('SUPER_ADMIN') for: bulkGiftPoints, anonymizeCustomer.
 *
 * Points mutations:
 *   bulkGiftPoints routes through lib/loyalty/service.ts.awardPoints with a
 *   per-customer idempotencyKey of `gift-${batchId}-${customerId}`.
 *   batchId is one crypto.randomUUID() per call.
 *
 * GDPR anonymize-in-place:
 *   prisma.customer.update with where: { id, anonymizedAt: null } is the
 *   atomic not-already-anonymized guard. Email comparison case-insensitive
 *   after trim.
 *
 * PARALLEL-SAFETY NOTE:
 *   getCustomerHeaderForRefresh inlines its Prisma query because Task 2
 *   (lib/admin/customers.ts) executes concurrently on a separate branch.
 *   Refactor deferred to Phase 8.5.
 */

import { revalidatePath } from 'next/cache'
import type { AddressType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import { awardPoints } from '@/lib/loyalty/service'

// ============================================================
// Return shapes
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export interface BulkResultData {
  succeeded: string[]
  failed: { id: string; error: string }[]
}
export type BulkResult = ActionResult<BulkResultData>

const CUSTOMERS_PATH = '/admin/customers'
const CSV_MAX_ROWS = 10000

function revalidateCustomers(id?: string) {
  revalidatePath(CUSTOMERS_PATH)
  if (id) revalidatePath(`${CUSTOMERS_PATH}/${id}`)
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.join(',')
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  return body ? `${head}\n${body}` : head
}

// ============================================================
// Re-exported detail shapes (so client components can import type)
// ============================================================

export interface CustomerHeaderRefresh {
  id: string
  email: string
  name: string | null
  phone: string | null
  profilePictureUrl: string | null
  birthday: Date | null
  newsletter: boolean
  smsOptIn: boolean
  currentPoints: number
  lifetimePoints: number
  totalSpent: number
  totalOrders: number
  isAnonymized: boolean
}

// ============================================================
// Input shapes
// ============================================================

export interface UpdateCustomerProfileInput {
  name?: string | null
  phone?: string | null
  birthday?: Date | null
  newsletter?: boolean
  smsOptIn?: boolean
}

export interface AddressInput {
  firstName: string
  lastName: string
  company?: string | null
  address1: string
  address2?: string | null
  city: string
  state: string
  postalCode: string
  country?: string
  isDefault?: boolean
  type: AddressType
}

export type UpdateAddressInput = Partial<AddressInput>

// ============================================================
// PROFILE
// ============================================================

export async function updateCustomerProfile(
  id: string,
  input: UpdateCustomerProfileInput,
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateCustomerProfileInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.customer.update({ where: { id }, data })
    revalidateCustomers(id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update profile' }
  }
}

export async function getCustomerHeaderForRefresh(
  id: string,
): Promise<CustomerHeaderRefresh | null> {
  await requireAdmin()
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, phone: true, profilePictureUrl: true,
      birthday: true, newsletter: true, smsOptIn: true,
      currentPoints: true, lifetimePoints: true, totalSpent: true, totalOrders: true,
      anonymizedAt: true,
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    profilePictureUrl: c.profilePictureUrl ?? null,
    birthday: c.birthday ?? null,
    newsletter: c.newsletter,
    smsOptIn: c.smsOptIn,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    totalSpent: Number(c.totalSpent ?? 0),
    totalOrders: c.totalOrders,
    isAnonymized: c.anonymizedAt !== null,
  }
}

// ============================================================
// NOTES (CustomerNote: id, customerId, content, authorId, authorName, isImportant)
// ============================================================

export async function createCustomerNote(
  customerId: string,
  content: string,
  isImportant = false,
): Promise<ActionResult<{ id: string }>> {
  const adminId = await requireAdmin()
  const trimmed = content?.trim() ?? ''
  if (trimmed.length === 0) {
    return { ok: false, error: 'Note content is required' }
  }
  let authorName = 'Admin'
  try {
    const admin = await prisma.customer.findUnique({
      where: { id: adminId },
      select: { name: true, email: true },
    })
    authorName = admin?.name?.trim() || admin?.email || 'Admin'
  } catch {
    // best-effort author label only
  }
  try {
    const n = await prisma.customerNote.create({
      data: {
        customerId,
        content: trimmed,
        authorId: adminId,
        authorName,
        isImportant,
      },
    })
    revalidateCustomers(customerId)
    return { ok: true, data: { id: n.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create note' }
  }
}

export async function updateCustomerNote(
  noteId: string,
  content: string,
  isImportant?: boolean,
): Promise<ActionResult> {
  await requireAdmin()
  const trimmed = content?.trim() ?? ''
  if (trimmed.length === 0) {
    return { ok: false, error: 'Note content is required' }
  }
  const data: Record<string, unknown> = { content: trimmed }
  if (isImportant !== undefined) data.isImportant = isImportant
  try {
    await prisma.customerNote.update({ where: { id: noteId }, data })
    revalidateCustomers()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update note' }
  }
}

export async function deleteCustomerNote(noteId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.customerNote.delete({ where: { id: noteId } })
    revalidateCustomers()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete note' }
  }
}

// ============================================================
// ADDRESSES (firstName/lastName/address1/address2/city/state/postalCode/country/type)
// ============================================================

function validateAddressInput(input: AddressInput): string | null {
  if (!input.firstName?.trim()) return 'First name is required'
  if (!input.lastName?.trim()) return 'Last name is required'
  if (!input.address1?.trim()) return 'Address line 1 is required'
  if (!input.city?.trim()) return 'City is required'
  if (!input.state?.trim()) return 'State is required'
  if (!input.postalCode?.trim()) return 'Postal code is required'
  return null
}

export async function createAddress(
  customerId: string,
  input: AddressInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const err = validateAddressInput(input)
  if (err) return { ok: false, error: err }
  try {
    const a = await prisma.address.create({
      data: {
        customerId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        company: input.company ?? null,
        address1: input.address1.trim(),
        address2: input.address2 ?? null,
        city: input.city.trim(),
        state: input.state.trim(),
        postalCode: input.postalCode.trim(),
        country: input.country?.trim() || 'US',
        isDefault: input.isDefault ?? false,
        type: input.type,
      },
    })
    revalidateCustomers(customerId)
    return { ok: true, data: { id: a.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to create address' }
  }
}

export async function updateAddress(
  addressId: string,
  input: UpdateAddressInput,
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateAddressInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.address.update({ where: { id: addressId }, data })
    revalidateCustomers()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to update address' }
  }
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.address.delete({ where: { id: addressId } })
    revalidateCustomers()
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to delete address'
    if (/foreign key/i.test(msg)) {
      return { ok: false, error: 'Address is referenced by orders — cannot delete' }
    }
    return { ok: false, error: msg }
  }
}

export async function setDefaultAddress(
  customerId: string,
  addressId: string,
): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      })
      await tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      })
    })
    revalidateCustomers(customerId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to set default' }
  }
}

// ============================================================
// BULK GIFT POINTS (SUPER_ADMIN, wraps awardPoints)
// ============================================================

export async function bulkGiftPoints(
  customerIds: string[],
  delta: number,
  reason: string,
): Promise<BulkResult> {
  await requireAdminRole('SUPER_ADMIN')
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Delta must be a non-zero number' }
  }
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Reason is required' }
  }
  const batchId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '')
    .slice(0, 12)
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const customerId of customerIds) {
    try {
      await awardPoints(
        customerId,
        delta,
        'ADMIN_ADJUSTMENT',
        `Admin gift: ${reason.trim()}`,
        { idempotencyKey: `gift-${batchId}-${customerId}` },
      )
      succeeded.push(customerId)
    } catch (e) {
      failed.push({ id: customerId, error: e instanceof Error ? e.message : 'failed' })
    }
  }
  revalidateCustomers()
  return { ok: true, data: { succeeded, failed } }
}

// ============================================================
// BULK CSV EXPORT
// ============================================================

export async function bulkExportCustomersCsv(
  customerIds: string[],
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  if (customerIds.length > CSV_MAX_ROWS) {
    return { ok: false, error: 'Too many rows — narrow selection' }
  }
  const total = await prisma.customer.count({ where: { id: { in: customerIds } } })
  if (total > CSV_MAX_ROWS) {
    return { ok: false, error: 'Too many rows — narrow selection' }
  }
  const rows = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: {
      id: true, email: true, name: true,
      totalOrders: true, totalSpent: true, currentPoints: true,
      lastOrderDate: true,
      loyaltyTier: { select: { name: true } },
    },
  })
  const headers = ['id', 'email', 'name', 'tier', 'totalOrders', 'totalSpent', 'currentPoints', 'lastOrderDate']
  const csv = rowsToCsv(
    headers,
    rows.map((c) => [
      c.id, c.email, c.name ?? '',
      c.loyaltyTier?.name ?? '',
      c.totalOrders, Number(c.totalSpent ?? 0), c.currentPoints,
      c.lastOrderDate ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

// ============================================================
// GDPR ANONYMIZE (SUPER_ADMIN, atomic via anonymizedAt: null guard)
// ============================================================

export async function anonymizeCustomer(
  id: string,
  typedConfirmEmail: string,
): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  const c = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, email: true, anonymizedAt: true },
  })
  if (!c) return { ok: false, error: 'Customer not found' }
  if (c.anonymizedAt !== null) {
    return { ok: false, error: 'Customer already anonymized' }
  }
  const expected = c.email.trim().toLowerCase()
  const provided = (typedConfirmEmail ?? '').trim().toLowerCase()
  if (expected !== provided) {
    return { ok: false, error: 'Confirmation email mismatch' }
  }
  try {
    await prisma.customer.update({
      where: { id, anonymizedAt: null },
      data: {
        email: `deleted-${id}@anonymized.local`,
        name: null,
        phone: null,
        birthday: null,
        profilePictureUrl: null,
        anonymizedAt: new Date(),
      },
    })
    revalidateCustomers(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to anonymize' }
  }
}
