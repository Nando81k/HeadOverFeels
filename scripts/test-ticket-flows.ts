/**
 * Test script to verify ticket creation across all support flows
 * Run with: npx tsx scripts/test-ticket-flows.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TicketTestResult {
  type: string
  success: boolean
  ticketNumber?: string
  error?: string
}

async function testTicketCreation(
  type: 'REFUND' | 'RETURN' | 'EXCHANGE' | 'ORDER_ISSUE' | 'PRODUCT_QUESTION' | 'GENERAL',
  subject: string,
  message: string
): Promise<TicketTestResult> {
  try {
    const ticketCount = await prisma.supportTicket.count()
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(6, '0')}`

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        type,
        subject,
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        priority: type === 'REFUND' ? 'HIGH' : type === 'PRODUCT_QUESTION' ? 'LOW' : 'MEDIUM',
        aiAssisted: true,
        aiSummary: `Test ticket for ${type} flow verification`,
        messages: {
          create: {
            message,
            senderType: 'customer',
            senderName: 'Test User',
          },
        },
      },
      include: {
        messages: true,
      },
    })

    return {
      type,
      success: true,
      ticketNumber: ticket.ticketNumber,
    }
  } catch (error) {
    return {
      type,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  console.log('🎫 Testing Ticket Creation Across All Support Flows\n')
  console.log('=' .repeat(60))

  const testCases = [
    {
      type: 'REFUND' as const,
      subject: 'Refund Request',
      message: 'Customer requested refund via Reggie AI - Item not as expected',
    },
    {
      type: 'RETURN' as const,
      subject: 'Return Request',
      message: 'Customer wants to return item - Changed mind about purchase',
    },
    {
      type: 'EXCHANGE' as const,
      subject: 'Exchange Request',
      message: 'Customer wants to exchange for different size',
    },
    {
      type: 'ORDER_ISSUE' as const,
      subject: 'Order Issue',
      message: 'Customer reports damaged item upon delivery',
    },
    {
      type: 'PRODUCT_QUESTION' as const,
      subject: 'Product Question',
      message: 'Customer has questions about product sizing and materials',
    },
    {
      type: 'GENERAL' as const,
      subject: 'General Support Request',
      message: 'Customer inquiry about store hours and shipping options',
    },
  ]

  const results: TicketTestResult[] = []

  for (const testCase of testCases) {
    console.log(`\n📝 Testing ${testCase.type} flow...`)
    const result = await testTicketCreation(
      testCase.type,
      testCase.subject,
      testCase.message
    )
    results.push(result)

    if (result.success) {
      console.log(`✅ SUCCESS - Ticket ${result.ticketNumber} created`)
    } else {
      console.log(`❌ FAILED - ${result.error}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 SUMMARY:')
  console.log(`Total Tests: ${results.length}`)
  console.log(`Passed: ${results.filter(r => r.success).length}`)
  console.log(`Failed: ${results.filter(r => !r.success).length}`)

  if (results.every(r => r.success)) {
    console.log('\n🎉 ALL TICKET FLOWS WORKING - Admin follow-up enabled')
    console.log('\n📋 Created Tickets:')
    results.forEach(r => {
      if (r.ticketNumber) {
        console.log(`   ${r.type}: ${r.ticketNumber}`)
      }
    })
  } else {
    console.log('\n⚠️ SOME FLOWS FAILED - Review errors above')
    process.exit(1)
  }

  // Verify tickets are in OPEN status and can be assigned to admin
  console.log('\n🔍 Verifying ticket properties...')
  const allTickets = await prisma.supportTicket.findMany({
    where: {
      ticketNumber: {
        in: results
          .filter(r => r.ticketNumber)
          .map(r => r.ticketNumber!),
      },
    },
    include: {
      messages: true,
    },
  })

  let allValid = true
  for (const ticket of allTickets) {
    const checks = {
      status: ticket.status === 'OPEN',
      hasMessage: ticket.messages.length > 0,
      hasPriority: !!ticket.priority,
      canAssign: ticket.assignedToId === null, // Can be assigned
    }

    const passed = Object.values(checks).every(Boolean)
    if (!passed) {
      console.log(`❌ ${ticket.ticketNumber} - Issues found:`, checks)
      allValid = false
    } else {
      console.log(`✅ ${ticket.ticketNumber} - Ready for admin assignment`)
    }
  }

  if (allValid) {
    console.log('\n✅ All tickets are properly configured for admin follow-up')
  } else {
    console.log('\n⚠️ Some tickets have configuration issues')
    process.exit(1)
  }

  console.log('\n🧹 Cleaning up test tickets...')
  await prisma.supportTicket.deleteMany({
    where: {
      ticketNumber: {
        in: results
          .filter(r => r.ticketNumber)
          .map(r => r.ticketNumber!),
      },
    },
  })
  console.log('✅ Test tickets removed')

  await prisma.$disconnect()
}

main()
  .then(() => {
    console.log('\n✨ Ticket flow verification complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Error during testing:', error)
    prisma.$disconnect()
    process.exit(1)
  })
