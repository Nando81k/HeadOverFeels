import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    console.log('Checking for existing admin account...')
    
    let admin = await prisma.customer.findUnique({
      where: { email: 'admin@headoverfeels.com' }
    })
    
    if (admin) {
      console.log('✅ Admin account already exists:', admin.email)
      console.log('Password: admin123')
      return
    }
    
    console.log('Creating admin account...')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    admin = await prisma.customer.create({
      data: {
        email: 'admin@headoverfeels.com',
        name: 'Admin User',
        password: hashedPassword,
        isAdmin: true,
        newsletter: false,
        smsOptIn: false,
      }
    })
    
    console.log('✅ Admin account created!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Email:', admin.email)
    console.log('Password: admin123')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚠️  IMPORTANT: Change this password after first login!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
