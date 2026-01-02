// Test script to create sample avatar items
// Run with: npx tsx scripts/create-test-avatar-items.ts

import { PrismaClient, AvatarSlot, ItemRarity } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🎨 Creating test avatar items...')

  // Create some default avatar items
  const items: Array<{
    name: string
    description: string
    slot: AvatarSlot
    modelUrl: string
    thumbnailUrl: string
    rarity: ItemRarity
    isDefault: boolean
  }> = [
    {
      name: 'Classic Black Hair',
      description: 'Sleek black hairstyle',
      slot: 'HAIR',
      modelUrl: '/models/avatar/hair/black-short.glb',
      thumbnailUrl: '/images/avatar/thumbnails/hair-black.png',
      rarity: 'COMMON',
      isDefault: true,
    },
    {
      name: 'Cool Beanie',
      description: 'Warm winter beanie',
      slot: 'HEADWEAR',
      modelUrl: '/models/avatar/headwear/beanie.glb',
      thumbnailUrl: '/images/avatar/thumbnails/beanie.png',
      rarity: 'UNCOMMON',
      isDefault: true,
    },
    {
      name: 'Classic White Tee',
      description: 'Simple white t-shirt',
      slot: 'TOP',
      modelUrl: '/models/avatar/top/white-tee.glb',
      thumbnailUrl: '/images/avatar/thumbnails/white-tee.png',
      rarity: 'COMMON',
      isDefault: true,
    },
    {
      name: 'Blue Jeans',
      description: 'Classic denim jeans',
      slot: 'BOTTOM',
      modelUrl: '/models/avatar/bottom/blue-jeans.glb',
      thumbnailUrl: '/images/avatar/thumbnails/blue-jeans.png',
      rarity: 'COMMON',
      isDefault: true,
    },
    {
      name: 'White Sneakers',
      description: 'Clean white sneakers',
      slot: 'SHOES',
      modelUrl: '/models/avatar/shoes/white-sneakers.glb',
      thumbnailUrl: '/images/avatar/thumbnails/white-sneakers.png',
      rarity: 'COMMON',
      isDefault: true,
    },
    {
      name: 'Gold Chain',
      description: 'Bling bling!',
      slot: 'ACCESSORY',
      modelUrl: '/models/avatar/accessory/gold-chain.glb',
      thumbnailUrl: '/images/avatar/thumbnails/gold-chain.png',
      rarity: 'RARE',
      isDefault: false,
    },
    {
      name: 'Streetwear Hoodie',
      description: 'Limited edition hoodie',
      slot: 'OUTERWEAR',
      modelUrl: '/models/avatar/outerwear/hoodie.glb',
      thumbnailUrl: '/images/avatar/thumbnails/hoodie.png',
      rarity: 'EPIC',
      isDefault: false,
    },
  ]

  for (const item of items) {
    const created = await prisma.avatarItem.create({
      data: item,
    })
    console.log(`✅ Created: ${created.name} (${created.slot})`)
  }

  console.log('\n🎉 Test avatar items created successfully!')
  console.log('\n📝 Note: The 3D model files (.glb) and thumbnails need to be added to public/ folder')
  console.log('   For now, the avatar will show the base body without the items rendered.')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
