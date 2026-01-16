import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const newPassword = 'HeadOverFeels2026!';
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  await prisma.customer.update({
    where: { email: 'admin@headoverfeels.com' },
    data: { password: hashedPassword }
  });
  
  console.log('Password reset for admin@headoverfeels.com');
  console.log('New credentials:');
  console.log('  Email: admin@headoverfeels.com');
  console.log('  Password: HeadOverFeels2026!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
