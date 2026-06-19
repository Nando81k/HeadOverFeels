import { describe, it, expect, vi, beforeEach } from 'vitest'

const ticketFindUnique = vi.fn()
const ticketUpdate = vi.fn()
const ticketUpdateMany = vi.fn()
const messageCreate = vi.fn()
const messageCount = vi.fn()
const cannedCreate = vi.fn()
const cannedUpdate = vi.fn()
const customerFindUnique = vi.fn()
const adminUserFindUnique = vi.fn()
const chatSessionFindUnique = vi.fn()
const chatSessionUpdate = vi.fn()
const chatMessageCreate = vi.fn()
const availabilityUpsert = vi.fn()
const availabilityUpdate = vi.fn()
const availabilityFindUnique = vi.fn()
const refundFindFirst = vi.fn()
const refundCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      findUnique: ticketFindUnique,
      update: ticketUpdate,
      updateMany: ticketUpdateMany,
    },
    supportMessage: { create: messageCreate, count: messageCount },
    cannedResponse: { create: cannedCreate, update: cannedUpdate },
    customer: { findUnique: customerFindUnique },
    adminUser: { findUnique: adminUserFindUnique },
    liveChatSession: { findUnique: chatSessionFindUnique, update: chatSessionUpdate },
    liveChatMessage: { create: chatMessageCreate },
    adminAvailability: {
      upsert: availabilityUpsert,
      update: availabilityUpdate,
      findUnique: availabilityFindUnique,
    },
    refundRecord: { findFirst: refundFindFirst, create: refundCreate },
  },
}))

const requireAdmin = vi.fn()
const requireAdminRole = vi.fn()
vi.mock('@/lib/auth/admin', () => ({ requireAdmin, requireAdminRole }))

const checkRefundEligibility = vi.fn()
const generateReturnLabel = vi.fn()
const initiateRefund = vi.fn()
vi.mock('@/lib/support/refund-helpers', () => ({
  checkRefundEligibility,
  generateReturnLabel,
  initiateRefund,
}))

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath }))

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue('cust-admin-1')
  requireAdminRole.mockResolvedValue('cust-admin-1')
  // Default identity resolution: Customer.id -> email -> AdminUser.id
  customerFindUnique.mockResolvedValue({ email: 'agent@hof.com', name: 'Agent A' })
  adminUserFindUnique.mockResolvedValue({ id: 'au1' })
})

describe('replyToTicket', () => {
  it('sets firstRespondedAt on the first public admin message', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      status: 'OPEN',
      firstRespondedAt: null,
    })
    messageCreate.mockResolvedValue({ id: 'm1' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    const res = await replyToTicket('t1', 'hello there')
    expect(res.ok).toBe(true)
    expect(messageCreate.mock.calls[0][0].data.message).toBe('hello there')
    expect(messageCreate.mock.calls[0][0].data.isInternal).toBe(false)
    expect(messageCreate.mock.calls[0][0].data.senderType).toBe('admin')
    // first-response set-once guard
    const updateCall = ticketUpdate.mock.calls.find(
      (c) => c[0].where && c[0].where.firstRespondedAt === null,
    )
    expect(updateCall).toBeTruthy()
    expect(updateCall![0].data.firstRespondedAt).toBeInstanceOf(Date)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/support/tickets/t1')
  })

  it('does NOT set firstRespondedAt when already responded', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      status: 'IN_PROGRESS',
      firstRespondedAt: new Date(),
    })
    messageCreate.mockResolvedValue({ id: 'm2' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    await replyToTicket('t1', 'follow up')
    const frCall = ticketUpdate.mock.calls.find(
      (c) => c[0].data && 'firstRespondedAt' in c[0].data,
    )
    expect(frCall).toBeFalsy()
  })

  it('does NOT set firstRespondedAt for an internal reply', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', status: 'OPEN', firstRespondedAt: null })
    messageCreate.mockResolvedValue({ id: 'm3' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    await replyToTicket('t1', 'note', { isInternal: true })
    expect(messageCreate.mock.calls[0][0].data.isInternal).toBe(true)
    const frCall = ticketUpdate.mock.calls.find(
      (c) => c[0].data && 'firstRespondedAt' in c[0].data,
    )
    expect(frCall).toBeFalsy()
  })

  it('reopens a RESOLVED ticket on a public reply', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      status: 'RESOLVED',
      firstRespondedAt: new Date(),
    })
    messageCreate.mockResolvedValue({ id: 'm4' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    await replyToTicket('t1', 'one more thing')
    const reopen = ticketUpdate.mock.calls.find(
      (c) => c[0].data && c[0].data.status === 'IN_PROGRESS',
    )
    expect(reopen).toBeTruthy()
  })

  it('rejects empty body', async () => {
    const { replyToTicket } = await import('@/app/admin/support/actions')
    const res = await replyToTicket('t1', '   ')
    expect(res.ok).toBe(false)
    expect(messageCreate).not.toHaveBeenCalled()
  })

  it('returns error when ticket not found', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { replyToTicket } = await import('@/app/admin/support/actions')
    const res = await replyToTicket('nope', 'hi')
    expect(res.ok).toBe(false)
  })
})

describe('addInternalNote', () => {
  it('creates an internal admin message and never sets firstRespondedAt', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', status: 'OPEN', firstRespondedAt: null })
    messageCreate.mockResolvedValue({ id: 'm5' })
    const { addInternalNote } = await import('@/app/admin/support/actions')
    const res = await addInternalNote('t1', 'private')
    expect(res.ok).toBe(true)
    expect(messageCreate.mock.calls[0][0].data.isInternal).toBe(true)
    const frCall = ticketUpdate.mock.calls.find(
      (c) => c[0].data && 'firstRespondedAt' in c[0].data,
    )
    expect(frCall).toBeFalsy()
  })
})

describe('setTicketStatus / escalate / resolve / close', () => {
  it('setTicketStatus updates status', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { setTicketStatus } = await import('@/app/admin/support/actions')
    const res = await setTicketStatus('t1', 'WAITING_CUSTOMER')
    expect(res.ok).toBe(true)
    expect(ticketUpdate.mock.calls[0][0].data.status).toBe('WAITING_CUSTOMER')
  })

  it('escalateTicket sets ESCALATED', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { escalateTicket } = await import('@/app/admin/support/actions')
    await escalateTicket('t1')
    expect(ticketUpdate.mock.calls[0][0].data.status).toBe('ESCALATED')
  })

  it('resolveTicket sets RESOLVED + resolvedAt + resolvedBy + resolution', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { resolveTicket } = await import('@/app/admin/support/actions')
    await resolveTicket('t1', 'Fixed it')
    const data = ticketUpdate.mock.calls[0][0].data
    expect(data.status).toBe('RESOLVED')
    expect(data.resolvedAt).toBeInstanceOf(Date)
    expect(data.resolution).toBe('Fixed it')
    expect(data.resolvedBy).toBeTruthy()
  })

  it('closeTicket sets CLOSED', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { closeTicket } = await import('@/app/admin/support/actions')
    await closeTicket('t1')
    expect(ticketUpdate.mock.calls[0][0].data.status).toBe('CLOSED')
  })
})

describe('assignTicket', () => {
  it('sets assignedToId + assignedAt', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { assignTicket } = await import('@/app/admin/support/actions')
    await assignTicket('t1', 'au2')
    const data = ticketUpdate.mock.calls[0][0].data
    expect(data.assignedToId).toBe('au2')
    expect(data.assignedAt).toBeInstanceOf(Date)
  })
  it('clears assignment with null', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { assignTicket } = await import('@/app/admin/support/actions')
    await assignTicket('t1', null)
    const data = ticketUpdate.mock.calls[0][0].data
    expect(data.assignedToId).toBeNull()
    expect(data.assignedAt).toBeNull()
  })
})

describe('bulk actions', () => {
  it('bulkAssign updates many with one batch', async () => {
    ticketUpdateMany.mockResolvedValue({ count: 2 })
    const { bulkAssign } = await import('@/app/admin/support/actions')
    const res = await bulkAssign(['t1', 't2'], 'au2')
    expect(res.ok).toBe(true)
    expect(ticketUpdateMany.mock.calls[0][0].where.id.in).toEqual(['t1', 't2'])
    expect(ticketUpdateMany.mock.calls[0][0].data.assignedToId).toBe('au2')
  })

  it('bulkSetStatus updates many', async () => {
    ticketUpdateMany.mockResolvedValue({ count: 2 })
    const { bulkSetStatus } = await import('@/app/admin/support/actions')
    await bulkSetStatus(['t1', 't2'], 'CLOSED')
    expect(ticketUpdateMany.mock.calls[0][0].data.status).toBe('CLOSED')
  })

  it('bulkCloseTickets requires SUPER_ADMIN', async () => {
    requireAdminRole.mockRejectedValueOnce(new Error('Unauthorized — requires role SUPER_ADMIN'))
    const { bulkCloseTickets } = await import('@/app/admin/support/actions')
    const res = await bulkCloseTickets(['t1'])
    expect(res.ok).toBe(false)
    expect(ticketUpdateMany).not.toHaveBeenCalled()
  })

  it('bulkCloseTickets closes when SUPER_ADMIN', async () => {
    ticketUpdateMany.mockResolvedValue({ count: 1 })
    const { bulkCloseTickets } = await import('@/app/admin/support/actions')
    const res = await bulkCloseTickets(['t1'])
    expect(requireAdminRole).toHaveBeenCalledWith('SUPER_ADMIN')
    expect(res.ok).toBe(true)
    expect(ticketUpdateMany.mock.calls[0][0].data.status).toBe('CLOSED')
  })
})

describe('approveReturn / denyReturn', () => {
  it('approveReturn without label only flips returnApproved', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { approveReturn } = await import('@/app/admin/support/actions')
    const res = await approveReturn('t1')
    expect(res.ok).toBe(true)
    expect(generateReturnLabel).not.toHaveBeenCalled()
    expect(ticketUpdate.mock.calls[0][0].data.returnApproved).toBe(true)
  })

  it('approveReturn with generateLabel calls generateReturnLabel + stores label', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    generateReturnLabel.mockResolvedValue({ labelUrl: 'https://label/abc' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { approveReturn } = await import('@/app/admin/support/actions')
    const res = await approveReturn('t1', { generateLabel: true })
    expect(res.ok).toBe(true)
    expect(generateReturnLabel).toHaveBeenCalledWith('o1')
    expect(ticketUpdate.mock.calls[0][0].data.returnLabel).toBe('https://label/abc')
  })

  it('approveReturn errors when no order linked', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: null })
    const { approveReturn } = await import('@/app/admin/support/actions')
    const res = await approveReturn('t1', { generateLabel: true })
    expect(res.ok).toBe(false)
    expect(generateReturnLabel).not.toHaveBeenCalled()
  })

  it('denyReturn sets returnApproved=false + reason', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { denyReturn } = await import('@/app/admin/support/actions')
    const res = await denyReturn('t1', 'Out of window')
    expect(res.ok).toBe(true)
    expect(ticketUpdate.mock.calls[0][0].data.returnApproved).toBe(false)
  })
})

describe('issueRefund', () => {
  it('requires SUPER_ADMIN', async () => {
    requireAdminRole.mockRejectedValueOnce(new Error('Unauthorized — requires role SUPER_ADMIN'))
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 10, type: 'FULL', reason: 'damaged' })
    expect(res.ok).toBe(false)
    expect(initiateRefund).not.toHaveBeenCalled()
  })

  it('processes a refund + writes a RefundRecord with idempotency tag', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    refundFindFirst.mockResolvedValue(null) // no existing idempotent record
    initiateRefund.mockResolvedValue({ success: true, message: 'ok', refundId: 're_123' })
    refundCreate.mockResolvedValue({ id: 'rr1' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 25, type: 'PARTIAL', reason: 'partial damage' })
    expect(requireAdminRole).toHaveBeenCalledWith('SUPER_ADMIN')
    expect(initiateRefund).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 't1', orderId: 'o1', amount: 25 }),
    )
    expect(refundCreate.mock.calls[0][0].data.reason).toContain('[idem:')
    expect(refundCreate.mock.calls[0][0].data.createdById).toBe('cust-admin-1')
    expect(res.ok).toBe(true)
  })

  it('is idempotent: skips when a matching RefundRecord already exists', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    refundFindFirst.mockResolvedValue({ id: 'rr-existing' })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 25, type: 'PARTIAL', reason: 'partial damage' })
    expect(res.ok).toBe(true)
    expect(initiateRefund).not.toHaveBeenCalled()
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('errors when ticket has no order', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: null })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 10, type: 'FULL', reason: 'x' })
    expect(res.ok).toBe(false)
    expect(initiateRefund).not.toHaveBeenCalled()
  })

  it('propagates a failed Stripe refund as an error', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    refundFindFirst.mockResolvedValue(null)
    initiateRefund.mockResolvedValue({ success: false, message: 'card declined' })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 10, type: 'FULL', reason: 'x' })
    expect(res.ok).toBe(false)
    expect(refundCreate).not.toHaveBeenCalled()
  })
})

describe('canned response CRUD', () => {
  it('createCannedResponse stores createdById', async () => {
    cannedCreate.mockResolvedValue({ id: 'cr1' })
    const { createCannedResponse } = await import('@/app/admin/support/actions')
    const res = await createCannedResponse({ title: 'T', body: 'B', category: 'returns' })
    expect(res.ok).toBe(true)
    expect(cannedCreate.mock.calls[0][0].data.createdById).toBe('cust-admin-1')
    if (res.ok) expect(res.data?.id).toBe('cr1')
  })

  it('createCannedResponse rejects empty title/body', async () => {
    const { createCannedResponse } = await import('@/app/admin/support/actions')
    const res = await createCannedResponse({ title: '', body: '' })
    expect(res.ok).toBe(false)
    expect(cannedCreate).not.toHaveBeenCalled()
  })

  it('updateCannedResponse patches provided fields', async () => {
    cannedUpdate.mockResolvedValue({ id: 'cr1' })
    const { updateCannedResponse } = await import('@/app/admin/support/actions')
    await updateCannedResponse('cr1', { title: 'New', isActive: true })
    const data = cannedUpdate.mock.calls[0][0].data
    expect(data.title).toBe('New')
    expect(data.isActive).toBe(true)
    expect('body' in data).toBe(false)
  })

  it('deleteCannedResponse is a soft delete (isActive=false)', async () => {
    cannedUpdate.mockResolvedValue({ id: 'cr1' })
    const { deleteCannedResponse } = await import('@/app/admin/support/actions')
    const res = await deleteCannedResponse('cr1')
    expect(res.ok).toBe(true)
    expect(cannedUpdate.mock.calls[0][0].data).toEqual({ isActive: false })
  })
})

describe('live chat actions', () => {
  it('acceptChatSession activates + increments availability', async () => {
    chatSessionFindUnique.mockResolvedValue({ id: 's1', sessionId: 'sess-1', status: 'WAITING' })
    chatSessionUpdate.mockResolvedValue({ id: 's1' })
    availabilityUpdate.mockResolvedValue({ adminId: 'au1' })
    const { acceptChatSession } = await import('@/app/admin/support/actions')
    const res = await acceptChatSession('sess-1')
    expect(res.ok).toBe(true)
    const data = chatSessionUpdate.mock.calls[0][0].data
    expect(data.status).toBe('ACTIVE')
    expect(data.adminId).toBe('au1')
    expect(data.acceptedAt).toBeInstanceOf(Date)
    expect(availabilityUpdate.mock.calls[0][0].data.activeChats.increment).toBe(1)
  })

  it('closeChatSession closes + decrements availability', async () => {
    chatSessionFindUnique.mockResolvedValue({
      id: 's1',
      sessionId: 'sess-1',
      status: 'ACTIVE',
      adminId: 'au1',
      acceptedAt: new Date(Date.now() - 60_000),
    })
    chatSessionUpdate.mockResolvedValue({ id: 's1' })
    availabilityFindUnique.mockResolvedValue({ adminId: 'au1', activeChats: 2 })
    availabilityUpdate.mockResolvedValue({ adminId: 'au1' })
    const { closeChatSession } = await import('@/app/admin/support/actions')
    const res = await closeChatSession('sess-1')
    expect(res.ok).toBe(true)
    expect(chatSessionUpdate.mock.calls[0][0].data.status).toBe('CLOSED')
    expect(chatSessionUpdate.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date)
    expect(availabilityUpdate.mock.calls[0][0].data.activeChats).toBe(1)
  })

  it('sendChatMessage writes an admin LiveChatMessage', async () => {
    chatSessionFindUnique.mockResolvedValue({ id: 's1', sessionId: 'sess-1', status: 'ACTIVE' })
    chatMessageCreate.mockResolvedValue({ id: 'cm1' })
    const { sendChatMessage } = await import('@/app/admin/support/actions')
    const res = await sendChatMessage('sess-1', 'how can I help?')
    expect(res.ok).toBe(true)
    const data = chatMessageCreate.mock.calls[0][0].data
    expect(data.message).toBe('how can I help?')
    expect(data.senderType).toBe('admin')
    expect(data.sessionId).toBe('s1')
  })

  it('sendChatMessage rejects empty body', async () => {
    const { sendChatMessage } = await import('@/app/admin/support/actions')
    const res = await sendChatMessage('sess-1', '  ')
    expect(res.ok).toBe(false)
    expect(chatMessageCreate).not.toHaveBeenCalled()
  })

  it('setAgentAvailability upserts the availability row', async () => {
    availabilityUpsert.mockResolvedValue({ adminId: 'au1' })
    const { setAgentAvailability } = await import('@/app/admin/support/actions')
    const res = await setAgentAvailability({ isOnline: true, maxChats: 5 })
    expect(res.ok).toBe(true)
    const call = availabilityUpsert.mock.calls[0][0]
    expect(call.where).toEqual({ adminId: 'au1' })
    expect(call.create.isOnline).toBe(true)
    expect(call.create.maxChats).toBe(5)
    expect(call.update.isOnline).toBe(true)
  })

  it('setAgentAvailability errors when admin identity unresolved', async () => {
    customerFindUnique.mockResolvedValue({ email: 'ghost@hof.com', name: 'Ghost' })
    adminUserFindUnique.mockResolvedValue(null)
    const { setAgentAvailability } = await import('@/app/admin/support/actions')
    const res = await setAgentAvailability({ isOnline: true })
    expect(res.ok).toBe(false)
    expect(availabilityUpsert).not.toHaveBeenCalled()
  })
})
