import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check for existing admins
  const admins = await prisma.customer.findMany({ 
    where: { isAdmin: true }, 
    select: { id: true, email: true, name: true } 
  });
  
  if (admins.length > 0) {
    console.log('Existing admin accounts:');
    admins.forEach(a => console.log(`  - ${a.email} (${a.name})`));
  } else {
    console.log('No admin accounts found. Creating one...');
    
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    await prisma.customer.create({
      data: {
        email: 'admin@headoverfeels.com',
        password: hashedPassword,
        name: 'Admin',
        isAdmin: true,
      }
    });
    console.log('Created admin account:');
    console.log('  Email: admin@headoverfeels.com');
    console.log('  Password: Admin123!');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
