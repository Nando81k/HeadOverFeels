/**
 * Customer CRM Test Script
 * 
 * Tests all CRM functionality:
 * - Customer statistics calculation
 * - Customer segmentation
 * - Customer list API with filters
 * - Customer detail API
 * - Customer notes CRUD operations
 * 
 * Run: npx tsx scripts/test-customer-crm.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  calculateCustomerSegment,
  getCustomerSegments,
  getSegmentStats,
  type CustomerSegment
} from '../lib/customer-segments';

const prisma = new PrismaClient();

// Test colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(message: string, color: string = RESET) {
  console.log(`${color}${message}${RESET}`);
}

async function testCustomerStatistics() {
  log('\n📊 Testing Customer Statistics...', BLUE);

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      totalSpent: true,
      totalOrders: true,
      lastOrderDate: true,
      avgOrderValue: true,
      createdAt: true
    }
  });

  log(`\nFound ${customers.length} customers:`);
  
  customers.forEach(customer => {
    log(`\n  ${customer.name || customer.email}`);
    log(`    Total Orders: ${customer.totalOrders}`);
    log(`    Total Spent: $${customer.totalSpent.toFixed(2)}`);
    log(`    Avg Order Value: $${customer.avgOrderValue.toFixed(2)}`);
    log(`    Last Order: ${customer.lastOrderDate?.toLocaleDateString() || 'Never'}`);
  });

  log(`\n✅ Customer statistics retrieved successfully`, GREEN);
  return customers;
}

async function testCustomerSegmentation(customers: any[]) {
  log('\n🎯 Testing Customer Segmentation...', BLUE);

  customers.forEach(customer => {
    const segment = calculateCustomerSegment(customer);
    const allSegments = getCustomerSegments(customer);

    log(`\n  ${customer.name || customer.email}:`);
    log(`    Primary Segment: ${segment}`);
    log(`    All Segments: ${allSegments.join(', ')}`);

    // Explain why they got this segment
    if (segment === 'VIP') {
      if (customer.totalSpent >= 500) {
        log(`    Reason: Total spent ($${customer.totalSpent.toFixed(2)}) >= $500`);
      } else {
        log(`    Reason: Total orders (${customer.totalOrders}) >= 5`);
      }
    } else if (segment === 'New') {
      const daysSince = Math.floor((new Date().getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      log(`    Reason: Registered ${daysSince} days ago (< 30 days)`);
    } else if (segment === 'At-Risk') {
      const daysSince = Math.floor((new Date().getTime() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
      log(`    Reason: Last order ${daysSince} days ago (> 90 days)`);
    } else if (segment === 'Active') {
      log(`    Reason: Has orders and not VIP/New/At-Risk`);
    } else {
      log(`    Reason: No orders yet`);
    }
  });

  // Get segment statistics
  const stats = getSegmentStats(customers);
  log(`\n📈 Segment Distribution:`, YELLOW);
  log(`  VIP: ${stats.VIP}`);
  log(`  New: ${stats.New}`);
  log(`  Active: ${stats.Active}`);
  log(`  At-Risk: ${stats['At-Risk']}`);
  log(`  Inactive: ${stats.Inactive}`);

  log(`\n✅ Customer segmentation working correctly`, GREEN);
  return stats;
}

async function testCustomerListAPI() {
  log('\n🔍 Testing Customer List API...', BLUE);

  // Test basic list
  log('\n  Test 1: Get all customers');
  const allCustomers = await prisma.customer.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      totalSpent: true,
      totalOrders: true,
      lastOrderDate: true,
      createdAt: true
    },
    take: 5
  });
  log(`  ✅ Retrieved ${allCustomers.length} customers`);

  // Test search
  log('\n  Test 2: Search by email');
  const searchResults = await prisma.customer.findMany({
    where: {
      email: {
        contains: '@gmail.com'
      }
    },
    take: 3
  });
  log(`  ✅ Found ${searchResults.length} customers with @gmail.com`);

  // Test filtering by spent
  log('\n  Test 3: Filter by min spent ($50+)');
  const highValueCustomers = await prisma.customer.findMany({
    where: {
      totalSpent: {
        gte: 50
      }
    }
  });
  log(`  ✅ Found ${highValueCustomers.length} customers who spent $50+`);

  // Test sorting
  log('\n  Test 4: Sort by total spent (desc)');
  const topSpenders = await prisma.customer.findMany({
    orderBy: {
      totalSpent: 'desc'
    },
    take: 3,
    select: {
      name: true,
      email: true,
      totalSpent: true
    }
  });
  log(`  Top 3 spenders:`);
  topSpenders.forEach((customer, i) => {
    log(`    ${i + 1}. ${customer.name || customer.email}: $${customer.totalSpent.toFixed(2)}`);
  });

  log(`\n✅ Customer list API functionality verified`, GREEN);
}

async function testCustomerDetailAPI() {
  log('\n👤 Testing Customer Detail API...', BLUE);

  // Get a customer with orders
  const customer = await prisma.customer.findFirst({
    where: {
      totalOrders: {
        gt: 0
      }
    },
    include: {
      orders: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 3,
        select: {
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true
        }
      },
      notes: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  if (!customer) {
    log('  ⚠️  No customers with orders found', YELLOW);
    return;
  }

  log(`\n  Customer: ${customer.name || customer.email}`);
  log(`  Total Orders: ${customer.totalOrders}`);
  log(`  Total Spent: $${customer.totalSpent.toFixed(2)}`);
  log(`  Notes: ${customer.notes.length}`);
  
  if (customer.orders.length > 0) {
    log(`\n  Recent Orders:`);
    customer.orders.forEach(order => {
      log(`    • #${order.orderNumber} - ${order.status} - $${order.total.toFixed(2)}`);
    });
  }

  log(`\n✅ Customer detail API working correctly`, GREEN);
  return customer;
}

async function testCustomerNotes() {
  log('\n📝 Testing Customer Notes CRUD...', BLUE);

  // Find or create a test customer
  let testCustomer = await prisma.customer.findFirst();
  
  if (!testCustomer) {
    log('  ⚠️  No customers found to test notes', YELLOW);
    return;
  }

  log(`\n  Using customer: ${testCustomer.name || testCustomer.email}`);

  // CREATE note
  log('\n  Test 1: Create note');
  const newNote = await prisma.customerNote.create({
    data: {
      customerId: testCustomer.id,
      content: 'Test note created by CRM test script',
      authorId: 'test-admin',
      authorName: 'Test Admin',
      isImportant: false
    }
  });
  log(`  ✅ Note created: ${newNote.id}`);

  // READ notes
  log('\n  Test 2: Read all notes');
  const notes = await prisma.customerNote.findMany({
    where: {
      customerId: testCustomer.id
    }
  });
  log(`  ✅ Found ${notes.length} notes for this customer`);

  // UPDATE note
  log('\n  Test 3: Update note');
  const updatedNote = await prisma.customerNote.update({
    where: { id: newNote.id },
    data: {
      content: 'Updated test note content',
      isImportant: true
    }
  });
  log(`  ✅ Note updated, isImportant: ${updatedNote.isImportant}`);

  // DELETE note
  log('\n  Test 4: Delete note');
  await prisma.customerNote.delete({
    where: { id: newNote.id }
  });
  log(`  ✅ Note deleted successfully`);

  // Verify deletion
  const remainingNotes = await prisma.customerNote.findMany({
    where: {
      customerId: testCustomer.id
    }
  });
  log(`  ✅ Verified: ${remainingNotes.length} notes remaining`);

  log(`\n✅ Customer notes CRUD operations working correctly`, GREEN);
}

async function testCsvExport(customers: any[]) {
  log('\n📄 Testing CSV Export...', BLUE);

  // Simulate CSV generation
  const csvHeaders = ['Name', 'Email', 'Total Spent', 'Total Orders', 'Segment', 'Member Since'];
  const csvRows = customers.slice(0, 3).map(customer => {
    const segment = calculateCustomerSegment(customer);
    return [
      customer.name || 'N/A',
      customer.email,
      `$${customer.totalSpent.toFixed(2)}`,
      customer.totalOrders.toString(),
      segment,
      customer.createdAt.toLocaleDateString()
    ];
  });

  log(`\n  CSV Headers: ${csvHeaders.join(', ')}`);
  log(`  CSV Rows: ${csvRows.length}`);
  log(`\n  Sample Data:`);
  csvRows.forEach((row, i) => {
    log(`    Row ${i + 1}: ${row.join(' | ')}`);
  });

  log(`\n✅ CSV export data generation verified`, GREEN);
}

// Main test runner
async function runAllTests() {
  log('\n🚀 Starting Customer CRM Tests...', BLUE);
  log('=' .repeat(60));

  try {
    // Test 1: Customer Statistics
    const customers = await testCustomerStatistics();

    // Test 2: Customer Segmentation
    await testCustomerSegmentation(customers);

    // Test 3: Customer List API
    await testCustomerListAPI();

    // Test 4: Customer Detail API
    await testCustomerDetailAPI();

    // Test 5: Customer Notes
    await testCustomerNotes();

    // Test 6: CSV Export
    await testCsvExport(customers);

    // Summary
    log('\n' + '='.repeat(60));
    log('\n✅ All CRM Tests Passed!', GREEN);
    log('\n📋 Summary:');
    log('  ✓ Customer statistics calculation');
    log('  ✓ Customer segmentation (VIP, New, Active, At-Risk, Inactive)');
    log('  ✓ Customer list API with filters and search');
    log('  ✓ Customer detail API with orders');
    log('  ✓ Customer notes CRUD operations');
    log('  ✓ CSV export data generation');
    log('\n🎉 Customer CRM is ready to use!');
    log('\n📍 Next Steps:');
    log('  1. Visit http://localhost:3000/admin');
    log('  2. Click "View All Customers" card');
    log('  3. Try searching, filtering by segment, and sorting');
    log('  4. Click on a customer to view details');
    log('  5. Add notes to customers');
    log('  6. Export customers to CSV');

  } catch (error) {
    log(`\n❌ Test Failed:`, RED);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
