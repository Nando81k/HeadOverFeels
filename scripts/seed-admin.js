const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = 'kommandernando@outlook.com'; // lowercase for case-insensitive matching
  const password = 'Nando1220@';
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const existing = await prisma.customer.findUnique({ where: { email } });
  
  if (existing) {
    const updated = await prisma.customer.update({
      where: { email },
      data: { 
        isAdmin: true,
        emailVerified: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        password: hashedPassword,
      },
    });
    console.log('Updated existing user to admin (unverified):', updated.email);
  } else {
    const tier = await prisma.loyaltyTier.findFirst({ where: { slug: 'head' } });
    
    const admin = await prisma.customer.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Nando',
        isAdmin: true,
        emailVerified: null, // Unverified for testing email flow
        termsAcceptedAt: new Date(),
        loyaltyTierId: tier?.id,
      },
    });
    console.log('Created admin (unverified):', admin.email);
  }
  
  await prisma.$disconnect();
}

seedAdmin().catch(console.error);
