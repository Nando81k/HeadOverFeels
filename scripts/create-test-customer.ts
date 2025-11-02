import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTestCustomer() {
  try {
    console.log('Checking for existing test customer...')
    
    let customer = await prisma.customer.findUnique({
      where: { email: 'test@example.com' }
    })
    
    if (customer) {
      console.log('✅ Test customer already exists:', customer.email)
      console.log('Password: test123')
      return
    }
    
    console.log('Creating test customer...')
    const hashedPassword = await bcrypt.hash('test123', 10)
    
    customer = await prisma.customer.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
        newsletter: false,
        smsOptIn: false,
      }
    })
    
    console.log('✅ Test customer created!')
    console.log('Email: test@example.com')
    console.log('Password: test123')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestCustomer()
