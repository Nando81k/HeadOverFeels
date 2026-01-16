#!/usr/bin/env npx tsx
/**
 * Development Database Seeder
 * 
 * This script populates the development database with fake data for testing.
 * Run with: npm run db:seed:dev
 * 
 * WARNING: This script will clear existing data in the development database!
 */

import { PrismaClient, AdminRole, OrderStatus, PaymentStatus, AddressType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Fake data generators
const generateFakeCustomers = async (count: number) => {
  const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'William'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  // Create dedicated admin user first
  const adminUser = {
    id: 'dev-admin',
    email: 'admin@dev.local',
    name: 'Dev Admin',
    password: adminPassword,
    isAdmin: true,
    totalSpent: 0,
    totalOrders: 0,
    lifetimePoints: 0,
    currentPoints: 0,
    newsletter: false,
  };
  
  // Create regular test customers
  const customers = Array.from({ length: count }, (_, i) => ({
    id: `fake-customer-${i + 1}`,
    email: `testuser${i + 1}@fake.headoverfeels.dev`,
    name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
    password: hashedPassword,
    isAdmin: false,
    totalSpent: Math.floor(Math.random() * 1000),
    totalOrders: Math.floor(Math.random() * 10),
    lifetimePoints: Math.floor(Math.random() * 5000),
    currentPoints: Math.floor(Math.random() * 1000),
    newsletter: Math.random() > 0.3,
  }));
  
  return [adminUser, ...customers];
};

const generateFakeCategories = () => [
  { id: 'cat-hoodies', name: 'Hoodies & Sweatshirts', slug: 'hoodies', description: 'Premium heavyweight hoodies', isActive: true, sortOrder: 1 },
  { id: 'cat-tshirts', name: 'T-Shirts', slug: 'tshirts', description: 'Essential tees and graphic shirts', isActive: true, sortOrder: 2 },
  { id: 'cat-bottoms', name: 'Bottoms', slug: 'bottoms', description: 'Pants, joggers, and shorts', isActive: true, sortOrder: 3 },
  { id: 'cat-accessories', name: 'Accessories', slug: 'accessories', description: 'Hats, bags, and more', isActive: true, sortOrder: 4 },
  { id: 'cat-outerwear', name: 'Outerwear', slug: 'outerwear', description: 'Jackets and coats', isActive: true, sortOrder: 5 },
];

const generateFakeProducts = () => {
  const products = [
    // Hoodies
    { name: 'Classic Logo Hoodie', slug: 'dev-classic-logo-hoodie', price: 89.99, categoryId: 'cat-hoodies', isFeatured: true },
    { name: 'Oversized Comfort Hoodie', slug: 'dev-oversized-comfort-hoodie', price: 99.99, categoryId: 'cat-hoodies' },
    { name: 'Vintage Wash Hoodie', slug: 'dev-vintage-wash-hoodie', price: 79.99, categoryId: 'cat-hoodies' },
    // T-Shirts
    { name: 'Essential Cotton Tee', slug: 'dev-essential-cotton-tee', price: 34.99, categoryId: 'cat-tshirts', isFeatured: true },
    { name: 'Graphic Print Tee', slug: 'dev-graphic-print-tee', price: 44.99, categoryId: 'cat-tshirts' },
    { name: 'Premium Heavyweight Tee', slug: 'dev-premium-heavyweight-tee', price: 49.99, categoryId: 'cat-tshirts' },
    // Bottoms
    { name: 'Relaxed Fit Joggers', slug: 'dev-relaxed-fit-joggers', price: 69.99, categoryId: 'cat-bottoms' },
    { name: 'Classic Chinos', slug: 'dev-classic-chinos', price: 79.99, categoryId: 'cat-bottoms' },
    // Accessories
    { name: 'Embroidered Cap', slug: 'dev-embroidered-cap', price: 29.99, categoryId: 'cat-accessories', isFeatured: true },
    { name: 'Canvas Tote Bag', slug: 'dev-canvas-tote-bag', price: 39.99, categoryId: 'cat-accessories' },
    // Limited Edition
    { name: 'Limited Drop Hoodie', slug: 'dev-limited-drop-hoodie', price: 129.99, categoryId: 'cat-hoodies', isLimitedEdition: true },
  ];

  return products.map((p, i) => ({
    id: `fake-product-${i + 1}`,
    ...p,
    description: `High-quality ${p.name.toLowerCase()} from Head Over Feels. Perfect for everyday wear.`,
    compareAtPrice: p.price * 1.2,
    costPrice: p.price * 0.4,
    images: JSON.stringify([
      `https://placehold.co/800x1000/1a1a1a/white?text=${encodeURIComponent(p.name)}`,
      `https://placehold.co/800x1000/2a2a2a/white?text=${encodeURIComponent(p.name + ' Back')}`,
    ]),
    isActive: true,
    isFeatured: p.isFeatured || false,
    isLimitedEdition: p.isLimitedEdition || false,
  }));
};

const generateProductVariants = (products: ReturnType<typeof generateFakeProducts>) => {
  const sizes = ['S', 'M', 'L', 'XL'];
  const colors = [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Navy', hex: '#000080' },
  ];
  
  const variants: Array<{
    id: string;
    productId: string;
    sku: string;
    size: string;
    color: string;
    colorHex: string;
    inventory: number;
    isActive: boolean;
  }> = [];
  
  let variantIndex = 0;
  products.forEach((product, productIndex) => {
    // Skip accessories for size variants
    const isAccessory = product.categoryId === 'cat-accessories';
    const productSizes = isAccessory ? ['ONE'] : sizes;
    
    productSizes.forEach((size) => {
      colors.forEach((color) => {
        variantIndex++;
        variants.push({
          id: `fake-variant-${variantIndex}`,
          productId: product.id,
          sku: `DEV-${String(productIndex + 1).padStart(3, '0')}-${size}-${color.name.substring(0, 3).toUpperCase()}`,
          size,
          color: color.name,
          colorHex: color.hex,
          inventory: Math.floor(Math.random() * 50) + 5,
          isActive: true,
        });
      });
    });
  });
  
  return variants;
};

const generateFakeOrders = async (customerIds: string[], products: ReturnType<typeof generateFakeProducts>) => {
  const statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const paymentStatuses: PaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
  const orders = [];

  for (let i = 0; i < 25; i++) {
    const subtotal = Math.floor(Math.random() * 200) + 50;
    const tax = subtotal * 0.08;
    const shipping = subtotal > 100 ? 0 : 9.99;
    const isPaid = i < 20;
    const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
    const customerIndex = customerIds.indexOf(customerId) + 1;
    
    // Create addresses for this order
    const shippingAddress = await prisma.address.create({
      data: {
        id: `fake-ship-addr-${i + 1}`,
        customerId,
        firstName: 'Test',
        lastName: `Customer${customerIndex}`,
        address1: `${Math.floor(Math.random() * 9999)} Test Street`,
        city: 'Test City',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
        type: 'SHIPPING',
      }
    });
    
    const billingAddress = await prisma.address.create({
      data: {
        id: `fake-bill-addr-${i + 1}`,
        customerId,
        firstName: 'Test',
        lastName: `Customer${customerIndex}`,
        address1: `${Math.floor(Math.random() * 9999)} Billing Ave`,
        city: 'Test City',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
        type: 'BILLING',
      }
    });
    
    orders.push({
      id: `fake-order-${i + 1}`,
      orderNumber: `DEV-${String(100000 + i)}`,
      customerId,
      customerEmail: `testuser${customerIndex}@fake.headoverfeels.dev`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      paymentStatus: isPaid ? 'PAID' as PaymentStatus : paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
      subtotal,
      tax,
      shipping,
      discount: Math.random() > 0.7 ? subtotal * 0.1 : 0,
      total: subtotal + tax + shipping,
      shippingAddressId: shippingAddress.id,
      billingAddressId: billingAddress.id,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
    });
  }
  
  return orders;
};

async function main() {
  console.log('🧹 Clearing development database...\n');
  
  // Clear existing fake data (only delete records with fake- prefix to be safe)
  try {
    await prisma.orderItem.deleteMany({ where: { orderId: { startsWith: 'fake-' } } });
    await prisma.order.deleteMany({ where: { id: { startsWith: 'fake-' } } });
    await prisma.address.deleteMany({ where: { id: { startsWith: 'fake-' } } });
    await prisma.productVariant.deleteMany({ where: { id: { startsWith: 'fake-' } } });
    await prisma.product.deleteMany({ where: { id: { startsWith: 'fake-' } } });
    await prisma.category.deleteMany({ where: { id: { startsWith: 'cat-' } } });
    await prisma.customer.deleteMany({ where: { id: { startsWith: 'fake-' } } });
    await prisma.adminUser.deleteMany({ where: { id: { startsWith: 'dev-' } } });
  } catch (e) {
    // Tables might not exist yet, that's OK
    console.log('   Note: Some tables may not exist yet, continuing...\n');
  }

  console.log('🌱 Seeding development database with fake data...\n');

  // Create admin user (for AdminUser table - legacy)
  console.log('👤 Creating admin user in AdminUser table (legacy)...');
  const adminUserPassword = await bcrypt.hash('adminpassword123', 10);
  await prisma.adminUser.create({
    data: {
      id: 'dev-admin-1',
      email: 'admin@fake.headoverfeels.dev',
      name: 'Dev Admin (Legacy)',
      password: adminUserPassword,
      role: 'SUPER_ADMIN' as AdminRole,
      isActive: true,
    },
  });
  console.log('   ✓ Legacy AdminUser created\n');

  // Create customers (including the real admin user)
  console.log('👥 Creating fake customers...');
  const customers = await generateFakeCustomers(10);
  for (const customer of customers) {
    await prisma.customer.create({ data: customer });
  }
  console.log(`   ✓ Created ${customers.length} test customers`);
  console.log('   ✓ Admin: admin@dev.local / admin123');
  console.log('   ✓ Test user: testuser1@fake.headoverfeels.dev / testpassword123\n');

  // Create categories
  console.log('📁 Creating categories...');
  const categories = generateFakeCategories();
  for (const category of categories) {
    await prisma.category.create({ data: category });
  }
  console.log(`   ✓ Created ${categories.length} categories\n`);

  // Create products
  console.log('🛍️  Creating products...');
  const products = generateFakeProducts();
  for (const product of products) {
    await prisma.product.create({ data: product });
  }
  console.log(`   ✓ Created ${products.length} products\n`);

  // Create product variants
  console.log('📦 Creating product variants...');
  const variants = generateProductVariants(products);
  for (const variant of variants) {
    await prisma.productVariant.create({ data: variant });
  }
  console.log(`   ✓ Created ${variants.length} variants\n`);

  // Create orders
  console.log('🧾 Creating orders...');
  const customerIds = customers.map(c => c.id);
  const orders = await generateFakeOrders(customerIds, products);
  for (const order of orders) {
    await prisma.order.create({ data: order });
  }
  console.log(`   ✓ Created ${orders.length} orders\n`);

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Development database seeded successfully!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n📋 Summary:');
  console.log('   • 1 admin user');
  console.log(`   • ${customers.length} test customers (including admin)`);
  console.log(`   • ${categories.length} categories`);
  console.log(`   • ${products.length} products`);
  console.log(`   • ${variants.length} product variants`);
  console.log(`   • ${orders.length} orders`);
  console.log('\n🔐 Test Credentials:');
  console.log('   Admin:    admin@dev.local / admin123');
  console.log('   Customer: testuser1@fake.headoverfeels.dev / testpassword123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
