import { prisma } from '../lib/prisma.js'

async function fixDropActivation() {
  console.log('🔍 Checking Limited Edition drops...\n')

  const drops = await prisma.product.findMany({
    where: { isLimitedEdition: true },
    include: { variants: true },
    orderBy: { createdAt: 'desc' }
  })

  if (drops.length === 0) {
    console.log('❌ No Limited Edition drops found in database.')
    console.log('\nTo create a test drop, run:')
    console.log('  npx tsx scripts/create-limited-drop.ts\n')
    process.exit(0)
  }

  console.log(`Found ${drops.length} Limited Edition drop(s):\n`)

  const now = new Date()
  const inactiveDrops: typeof drops = []

  drops.forEach((drop, i) => {
    const releaseDate = drop.releaseDate ? new Date(drop.releaseDate) : null
    const dropEndDate = drop.dropEndDate ? new Date(drop.dropEndDate) : null
    const totalInventory = drop.variants.reduce((sum, v) => sum + v.inventory, 0)

    let status = '❓ Unknown'
    if (releaseDate && dropEndDate) {
      if (now < releaseDate) status = '⏳ Upcoming'
      else if (now >= releaseDate && now <= dropEndDate) status = '🔴 Live'
      else status = '⚫ Ended'
    }

    console.log(`${i + 1}. "${drop.name}"`)
    console.log(`   ID: ${drop.id}`)
    console.log(`   Status: ${status}`)
    console.log(`   Active: ${drop.isActive ? '✅ YES' : '❌ NO'}`)
    console.log(`   Inventory: ${totalInventory} units`)
    console.log(`   Release: ${releaseDate?.toLocaleString() || 'Not set'}`)
    console.log(`   End: ${dropEndDate?.toLocaleString() || 'Not set'}`)

    if (!drop.isActive) {
      inactiveDrops.push(drop)
      console.log(`   🚨 ISSUE: Product is INACTIVE - won't show on home page!`)
    }

    console.log('')
  })

  if (inactiveDrops.length > 0) {
    console.log(`\n🔧 Found ${inactiveDrops.length} inactive drop(s). Activating them...\n`)

    for (const drop of inactiveDrops) {
      await prisma.product.update({
        where: { id: drop.id },
        data: { isActive: true }
      })
      console.log(`✅ Activated: "${drop.name}"`)
    }

    console.log(`\n🎉 Success! All drops are now active.`)
    console.log(`   Refresh your home page to see the Limited Edition drop.\n`)
  } else {
    console.log('✅ All drops are already active!\n')
  }

  await prisma.$disconnect()
}

fixDropActivation().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
