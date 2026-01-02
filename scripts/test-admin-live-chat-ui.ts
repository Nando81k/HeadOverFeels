#!/usr/bin/env tsx

/**
 * Quick Test Script for Admin Live Chat Integration
 * 
 * This script creates test data and simulates customer chat requests
 * to help test the admin live chat interface.
 * 
 * Usage:
 *   npx tsx scripts/test-admin-live-chat-ui.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Testing Admin Live Chat UI Integration\n')

  try {
    // 1. Find or create test customer
    console.log('📝 Step 1: Finding/creating test customer...')
    const customer = await prisma.customer.upsert({
      where: { email: 'chat-test@example.com' },
      update: {},
      create: {
        email: 'chat-test@example.com',
        name: 'Chat Test Customer',
        password: 'test-hash' // Placeholder password
      }
    })
    console.log(`✅ Customer: ${customer.name} (${customer.email})`)

    // 2. Find or create test ticket
    console.log('\n📝 Step 2: Finding/creating test ticket...')
    let ticket = await prisma.supportTicket.findFirst({
      where: {
        customerId: customer.id,
        status: 'OPEN'
      }
    })

    if (!ticket) {
      const ticketNumber = `TKT-CHAT-${Date.now()}`
      ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber,
          customerId: customer.id,
          customerEmail: customer.email,
          customerName: customer.name || 'Chat Test Customer',
          subject: 'Test Chat Request - Need Help with Order',
          type: 'ORDER_ISSUE',
          status: 'OPEN',
          priority: 'HIGH',
          aiAssisted: false
        }
      })
      console.log(`✅ Created ticket: ${ticket.ticketNumber}`)
    } else {
      console.log(`✅ Found existing ticket: ${ticket.ticketNumber}`)
    }

    // 3. Create live chat session
    console.log('\n📝 Step 3: Creating live chat session...')
    const sessionId = `chat-test-${Date.now()}`
    
    const session = await prisma.liveChatSession.create({
      data: {
        sessionId,
        ticketId: ticket.id,
        customerId: customer.id,
        status: 'WAITING',
        customerName: customer.name || 'Chat Test Customer',
        customerEmail: customer.email,
      }
    })
    console.log(`✅ Chat session created: ${session.sessionId}`)
    console.log(`   Status: ${session.status}`)

    // 4. Add initial customer message
    console.log('\n📝 Step 4: Adding initial customer message...')
    await prisma.liveChatMessage.create({
      data: {
        sessionId: session.id,
        message: 'Hello! I need help with my recent order. It hasn\'t arrived yet and I\'m getting worried.',
        senderType: 'customer',
        senderName: customer.name || 'Chat Test Customer',
        isRead: false
      }
    })
    console.log('✅ Initial message added')

    // 5. Verify queue
    console.log('\n📝 Step 5: Verifying chat queue...')
    const queueSessions = await prisma.liveChatSession.findMany({
      where: {
        status: 'WAITING'
      },
      include: {
        ticket: true,
        customer: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    console.log(`✅ Queue has ${queueSessions.length} waiting customer(s)`)

    // 6. Display test instructions
    console.log('\n' + '='.repeat(70))
    console.log('🎯 TESTING INSTRUCTIONS')
    console.log('='.repeat(70))
    console.log('\n1. Start dev server (if not running):')
    console.log('   npm run dev')
    console.log('\n2. Navigate to admin tickets page:')
    console.log('   http://localhost:3000/admin/support/tickets')
    console.log('\n3. Click "Live Chat Queue" tab')
    console.log('   - You should see a red badge with number 1 (or more)')
    console.log('   - Customer card should display:')
    console.log(`     * Name: ${customer.name}`)
    console.log(`     * Email: ${customer.email}`)
    console.log(`     * Ticket: ${ticket.ticketNumber}`)
    console.log('     * Priority: HIGH (orange badge)')
    console.log('     * Subject: Test Chat Request - Need Help with Order')
    console.log('\n4. Click "Accept Chat" button')
    console.log('   - Chat panel should slide in from right')
    console.log('   - Customer info displayed in header')
    console.log('   - Initial message visible in chat')
    console.log('\n5. Test messaging:')
    console.log('   - Type: "Hello! I\'m here to help. Let me check your order status."')
    console.log('   - Click Send')
    console.log('   - Message should appear as blue bubble on right')
    console.log('   - Message should have timestamp and checkmark (read receipt)')
    console.log('\n6. Test close chat:')
    console.log('   - Check "Resolve ticket" checkbox (optional)')
    console.log('   - Enter notes: "Provided order tracking information"')
    console.log('   - Click "Close Chat" button')
    console.log('   - Panel should close')
    console.log('   - Queue count badge should decrement')
    console.log('\n7. Verify database:')
    console.log('   npx prisma studio')
    console.log('   - Check LiveChatSession table:')
    console.log('     * status should be "CLOSED"')
    console.log('     * duration should be set')
    console.log('     * closedAt should have timestamp')
    console.log('   - Check LiveChatMessage table:')
    console.log('     * Should see both customer and admin messages')
    console.log('     * isRead should be true')

    // 7. API endpoint testing
    console.log('\n' + '='.repeat(70))
    console.log('🔧 API ENDPOINTS TO TEST')
    console.log('='.repeat(70))
    console.log('\n1. Get queue (should show waiting customers):')
    console.log('   curl http://localhost:3000/api/chat/live/admin/queue')
    console.log('\n2. Accept chat (replace <sessionId> with actual value):')
    console.log(`   curl -X POST http://localhost:3000/api/chat/live/admin/accept \\`)
    console.log('     -H "Content-Type: application/json" \\')
    console.log(`     -d '{"sessionId":"${session.sessionId}","adminId":"temp-admin-id"}'`)
    console.log('\n3. Get session details:')
    console.log(`   curl http://localhost:3000/api/chat/live/session/${session.sessionId}`)
    console.log('\n4. Send message:')
    console.log('   curl -X POST http://localhost:3000/api/chat/live/message \\')
    console.log('     -H "Content-Type: application/json" \\')
    console.log(`     -d '{"sessionId":"${session.sessionId}","message":"Test message from curl","senderType":"admin","senderName":"Admin"}'`)
    console.log('\n5. Close chat:')
    console.log(`   curl -X POST http://localhost:3000/api/chat/live/close/${session.sessionId} \\`)
    console.log('     -H "Content-Type: application/json" \\')
    console.log('     -d \'{"resolveTicket":true,"resolutionNotes":"Test resolution"}\'')

    // 8. Socket.IO testing notes
    console.log('\n' + '='.repeat(70))
    console.log('🔌 SOCKET.IO TESTING NOTES')
    console.log('='.repeat(70))
    console.log('\nEvents to watch in browser console:')
    console.log('  - chat:join (when panel opens)')
    console.log('  - chat:session-details (session data received)')
    console.log('  - chat:send-message (when sending message)')
    console.log('  - chat:new-message (when receiving message)')
    console.log('  - chat:typing (typing indicator)')
    console.log('  - chat:mark-read (marking messages as read)')
    console.log('  - chat:session-closed (when chat closes)')
    console.log('\nOpen browser DevTools:')
    console.log('  - Console tab: Watch for socket events')
    console.log('  - Network tab: Filter by WS (WebSocket) to see Socket.IO connection')

    // 9. Additional test scenarios
    console.log('\n' + '='.repeat(70))
    console.log('🧪 ADDITIONAL TEST SCENARIOS')
    console.log('='.repeat(70))
    console.log('\n1. Test Multiple Customers:')
    console.log('   - Run this script 3 times to create 3 chat requests')
    console.log('   - Queue badge should show "3"')
    console.log('   - Queue positions should show #1, #2, #3')
    console.log('   - Accept one → badge should show "2"')
    console.log('\n2. Test Priority Sorting:')
    console.log('   - Create chat with priority URGENT')
    console.log('   - Create chat with priority LOW')
    console.log('   - Verify URGENT appears first in queue')
    console.log('\n3. Test Wait Time Alerts:')
    console.log('   - Wait 3+ minutes without accepting chat')
    console.log('   - Yellow warning should appear on customer card')
    console.log('\n4. Test Tab Switching:')
    console.log('   - Switch between "Support Tickets" and "Live Chat Queue"')
    console.log('   - Verify no errors in console')
    console.log('   - Verify data loads correctly in each tab')
    console.log('\n5. Test Chat Panel Overlay:')
    console.log('   - Accept chat while viewing ticket table')
    console.log('   - Panel should slide in from right')
    console.log('   - Should not navigate away from page')
    console.log('   - Can still see tickets in background')

    // 10. Cleanup instructions
    console.log('\n' + '='.repeat(70))
    console.log('🧹 CLEANUP')
    console.log('='.repeat(70))
    console.log('\nTo clean up test data:')
    console.log('  npx prisma studio')
    console.log('  - Delete test LiveChatSession records')
    console.log('  - Delete test LiveChatMessage records')
    console.log('  - Optionally delete test ticket and customer')
    console.log('\nOr run cleanup script:')
    console.log('  npx tsx scripts/cleanup-test-chat-data.ts')

    console.log('\n' + '='.repeat(70))
    console.log('✨ Test data created successfully!')
    console.log('🚀 Ready to test admin live chat UI')
    console.log('='.repeat(70) + '\n')

  } catch (error) {
    console.error('❌ Error creating test data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
