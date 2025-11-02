import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateOrderStatuses() {
  console.log('📊 Updating Order Statuses for Analytics...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const orders = await prisma.order.findMany({
    where: { status: 'PENDING' },
    include: { items: true, customer: true },
    orderBy: { createdAt: 'asc' }
  })

  if (orders.length === 0) {
    console.log('✓ No pending orders to update')
    await prisma.$disconnect()
    return
  }

  console.log(`Found ${orders.length} pending orders\n`)

  // Update orders to various completed statuses for realistic analytics
  const statuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
  
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i]
    // Distribute orders across different statuses
    const newStatus = statuses[i % statuses.length]
    
    await prisma.order.update({
      where: { id: order.id },
      data: { status: newStatus }
    })
    
    console.log(`✓ Order #${order.orderNumber || order.id.slice(0, 8)}`)
    console.log(`  Status: PENDING → ${newStatus}`)
    console.log(`  Total: $${order.total.toFixed(2)}`)
    console.log(`  Items: ${order.items.length}`)
    console.log(`  Customer: ${order.customer?.email || 'Unknown'}`)
    console.log('')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Order statuses updated successfully!')
  console.log('\n📈 Analytics graphs will now show:')
  console.log('  - Revenue data from completed orders')
  console.log('  - Product performance metrics')
  console.log('  - Order status distribution')
  console.log('  - Customer acquisition trends')

  await prisma.$disconnect()
}

updateOrderStatuses()
  .catch((error) => {
    console.error('Error updating order statuses:', error)
    process.exit(1)
  })
