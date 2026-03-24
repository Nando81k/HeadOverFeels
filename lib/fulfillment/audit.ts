import type { NextRequest } from 'next/server'
import { createAuditLogger } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

function getClientIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim()
  }
  return request.headers.get('x-real-ip') || undefined
}

export async function getFulfillmentAuditLogger(adminId: string, request: NextRequest) {
  const admin = await prisma.customer.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  return createAuditLogger({
    adminId,
    adminEmail: admin?.email || 'admin@headoverfeels.com',
    adminName: admin?.name || 'Admin User',
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent') || undefined,
  })
}

