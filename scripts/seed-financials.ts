/**
 * Seed Financial/Accounting Data
 * 
 * Seeds expense categories, expenses, invoices, budgets, and tax records
 * for the financial dashboard.
 * 
 * Run with: npx tsx scripts/seed-financials.ts
 */

import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

async function seedFinancials() {
  console.log('\n' + '═'.repeat(60))
  console.log('💰 SEEDING FINANCIAL DATA')
  console.log('═'.repeat(60))

  // ============================================
  // 1. EXPENSE CATEGORIES
  // ============================================
  console.log('\n📊 Seeding Expense Categories...')
  
  const expenseCategories = [
    { id: 'exp-cat-inventory', name: 'Inventory & COGS', slug: 'inventory-cogs', color: '#3B82F6', icon: 'Package', description: 'Cost of goods sold and inventory purchases' },
    { id: 'exp-cat-shipping', name: 'Shipping & Fulfillment', slug: 'shipping', color: '#10B981', icon: 'Truck', description: 'Shipping costs, packaging materials, and fulfillment fees' },
    { id: 'exp-cat-marketing', name: 'Marketing & Advertising', slug: 'marketing', color: '#F59E0B', icon: 'Megaphone', description: 'Ads, influencer partnerships, and promotional costs' },
    { id: 'exp-cat-software', name: 'Software & Tools', slug: 'software', color: '#8B5CF6', icon: 'Code', description: 'SaaS subscriptions, hosting, and development tools' },
    { id: 'exp-cat-payroll', name: 'Payroll & Contractors', slug: 'payroll', color: '#EC4899', icon: 'Users', description: 'Employee wages, contractor fees, and benefits' },
    { id: 'exp-cat-rent', name: 'Rent & Utilities', slug: 'rent-utilities', color: '#6366F1', icon: 'Building', description: 'Office/warehouse rent, electricity, internet' },
    { id: 'exp-cat-fees', name: 'Payment Processing Fees', slug: 'payment-fees', color: '#EF4444', icon: 'CreditCard', description: 'Stripe fees, payment gateway charges' },
    { id: 'exp-cat-other', name: 'Other Expenses', slug: 'other', color: '#6B7280', icon: 'DotsThree', description: 'Miscellaneous business expenses' },
  ]

  for (let i = 0; i < expenseCategories.length; i++) {
    const cat = expenseCategories[i]
    await prisma.expenseCategory.upsert({
      where: { id: cat.id },
      update: cat,
      create: { ...cat, sortOrder: i, isActive: true },
    })
    console.log(`   ✅ ${cat.name}`)
  }

  // ============================================
  // 2. BUDGETS
  // ============================================
  console.log('\n💵 Seeding Budgets...')
  
  const startOfYear = new Date('2026-01-01')
  const endOfYear = new Date('2026-12-31')
  
  const budgets = [
    { id: 'budget-inventory', categoryId: 'exp-cat-inventory', name: 'Monthly Inventory Budget', amount: 8000, period: 'MONTHLY' as const },
    { id: 'budget-shipping', categoryId: 'exp-cat-shipping', name: 'Monthly Shipping Budget', amount: 3000, period: 'MONTHLY' as const },
    { id: 'budget-marketing', categoryId: 'exp-cat-marketing', name: 'Monthly Marketing Budget', amount: 2500, period: 'MONTHLY' as const },
    { id: 'budget-software', categoryId: 'exp-cat-software', name: 'Monthly Software Budget', amount: 500, period: 'MONTHLY' as const },
    { id: 'budget-payroll', categoryId: 'exp-cat-payroll', name: 'Monthly Payroll Budget', amount: 12000, period: 'MONTHLY' as const },
    { id: 'budget-rent', categoryId: 'exp-cat-rent', name: 'Monthly Rent & Utilities', amount: 2000, period: 'MONTHLY' as const },
  ]

  for (const budget of budgets) {
    await prisma.budget.upsert({
      where: { id: budget.id },
      update: budget,
      create: {
        ...budget,
        startDate: startOfYear,
        endDate: endOfYear,
        warningThreshold: 75,
        criticalThreshold: 90,
        isActive: true,
      },
    })
    console.log(`   ✅ ${budget.name} ($${budget.amount.toLocaleString()}/mo)`)
  }

  // ============================================
  // 3. INVOICES
  // ============================================
  console.log('\n📄 Seeding Invoices...')

  const vendors = [
    { name: 'Premium Apparel Co', email: 'billing@premiumapparel.com', address: '123 Manufacturing Ave, Los Angeles, CA 90001' },
    { name: 'FastShip Logistics', email: 'accounts@fastship.com', address: '456 Warehouse Blvd, Phoenix, AZ 85001' },
    { name: 'Meta Platforms Inc', email: 'ads-billing@meta.com', address: '1 Hacker Way, Menlo Park, CA 94025' },
    { name: 'Google Ads', email: 'noreply@google.com', address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043' },
    { name: 'Vercel Inc', email: 'billing@vercel.com', address: '340 S Lemon Ave, Walnut, CA 91789' },
    { name: 'Stripe Inc', email: 'billing@stripe.com', address: '354 Oyster Point Blvd, South San Francisco, CA 94080' },
    { name: 'Cloudinary Ltd', email: 'billing@cloudinary.com', address: '3400 Central Expressway, Santa Clara, CA 95051' },
    { name: 'USPS', email: 'business@usps.com', address: '475 L\'Enfant Plaza SW, Washington, DC 20260' },
    { name: 'UPS', email: 'billing@ups.com', address: '55 Glenlake Pkwy NE, Atlanta, GA 30328' },
    { name: 'Box & Packaging Supply', email: 'orders@boxsupply.com', address: '789 Industrial Park, Dallas, TX 75201' },
  ]

  const invoiceData = []
  let invoiceCounter = 1000

  // Generate invoices for the last 3 months
  for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() - monthOffset
    const startOfMonth = new Date(year, month, 1)
    // For current month, use today; otherwise use end of month
    const endOfMonth = monthOffset === 0 
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
      : new Date(year, month + 1, 0)
    
    // 3-5 invoices per month
    const invoiceCount = faker.number.int({ min: 3, max: 5 })
    
    for (let i = 0; i < invoiceCount; i++) {
      invoiceCounter++
      const vendor = faker.helpers.arrayElement(vendors)
      const issueDate = faker.date.between({ from: startOfMonth, to: endOfMonth })
      const dueDate = new Date(issueDate)
      dueDate.setDate(dueDate.getDate() + 30)
      
      const subtotal = faker.number.float({ min: 200, max: 5000, fractionDigits: 2 })
      const tax = subtotal * 0.08
      const total = subtotal + tax
      
      const isPaid = monthOffset > 0 || faker.datatype.boolean({ probability: 0.6 })
      // Ensure paidDate is between issueDate and today
      const maxPaidDate = new Date()
      const paidDate = isPaid && issueDate < maxPaidDate 
        ? faker.date.between({ from: issueDate, to: maxPaidDate }) 
        : null
      
      invoiceData.push({
        id: `inv-${invoiceCounter}`,
        invoiceNumber: `INV-${invoiceCounter}`,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        vendorAddress: vendor.address,
        description: faker.helpers.arrayElement([
          'Monthly service invoice',
          'Product order fulfillment',
          'Advertising campaign',
          'Shipping services',
          'Platform subscription',
        ]),
        subtotal,
        tax,
        total,
        issueDate,
        dueDate,
        paidDate,
        status: isPaid ? 'PAID' as const : (dueDate < new Date() ? 'OVERDUE' as const : 'PENDING' as const),
        paymentMethod: isPaid ? faker.helpers.arrayElement(['Bank Transfer', 'Credit Card', 'ACH']) : null,
        paymentReference: isPaid ? faker.string.alphanumeric(12).toUpperCase() : null,
      })
    }
  }

  for (const invoice of invoiceData) {
    await prisma.invoice.upsert({
      where: { id: invoice.id },
      update: invoice,
      create: invoice,
    })
    console.log(`   ✅ ${invoice.invoiceNumber} - ${invoice.vendorName} ($${invoice.total.toFixed(2)}) [${invoice.status}]`)
  }

  // ============================================
  // 4. EXPENSES
  // ============================================
  console.log('\n💸 Seeding Expenses...')

  const expenseTemplates = [
    // Inventory expenses
    { categoryId: 'exp-cat-inventory', descriptions: ['Hoodie inventory restock', 'T-shirt bulk order', 'Seasonal inventory purchase', 'Limited edition materials'], minAmount: 1500, maxAmount: 8000, vendors: ['Premium Apparel Co', 'Textile Suppliers Inc'] },
    // Shipping expenses
    { categoryId: 'exp-cat-shipping', descriptions: ['USPS shipping costs', 'UPS shipping batch', 'FedEx express shipments', 'Packaging materials'], minAmount: 200, maxAmount: 2000, vendors: ['USPS', 'UPS', 'FedEx', 'Box & Packaging Supply'] },
    // Marketing expenses
    { categoryId: 'exp-cat-marketing', descriptions: ['Instagram ads campaign', 'Facebook ads', 'TikTok promotion', 'Influencer partnership', 'Google Ads'], minAmount: 300, maxAmount: 2500, vendors: ['Meta Platforms Inc', 'Google Ads', 'TikTok Ads', 'Various Influencers'] },
    // Software expenses
    { categoryId: 'exp-cat-software', descriptions: ['Vercel hosting', 'Cloudinary storage', 'Stripe fees', 'Email service (Resend)', 'Analytics tools'], minAmount: 29, maxAmount: 299, vendors: ['Vercel Inc', 'Cloudinary Ltd', 'Resend', 'Mixpanel'] },
    // Payment processing
    { categoryId: 'exp-cat-fees', descriptions: ['Stripe processing fees', 'Payment gateway fees', 'Chargeback fees'], minAmount: 100, maxAmount: 800, vendors: ['Stripe Inc'] },
    // Other
    { categoryId: 'exp-cat-other', descriptions: ['Office supplies', 'Business insurance', 'Professional services', 'Equipment maintenance'], minAmount: 50, maxAmount: 500, vendors: ['Various', 'Insurance Co', 'Consulting LLC'] },
  ]

  const expenses = []
  let expenseCounter = 1

  // Generate expenses for the last 3 months
  for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() - monthOffset
    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 0)
    
    for (const template of expenseTemplates) {
      // 2-4 expenses per category per month
      const count = faker.number.int({ min: 2, max: 4 })
      
      for (let i = 0; i < count; i++) {
        expenseCounter++
        const date = faker.date.between({ from: startOfMonth, to: endOfMonth })
        
        expenses.push({
          id: `exp-${expenseCounter}`,
          categoryId: template.categoryId,
          description: faker.helpers.arrayElement(template.descriptions),
          amount: faker.number.float({ min: template.minAmount, max: template.maxAmount, fractionDigits: 2 }),
          date,
          vendor: faker.helpers.arrayElement(template.vendors),
          paymentMethod: faker.helpers.arrayElement(['Credit Card', 'Bank Transfer', 'ACH', 'Debit Card']),
          isTaxDeductible: faker.datatype.boolean({ probability: 0.8 }),
          isRecurring: faker.datatype.boolean({ probability: 0.2 }),
          status: 'RECORDED' as const,
        })
      }
    }
  }

  for (const expense of expenses) {
    await prisma.expense.upsert({
      where: { id: expense.id },
      update: expense,
      create: expense,
    })
  }
  console.log(`   ✅ Created ${expenses.length} expenses across all categories`)

  // Summarize by category
  const categoryTotals: Record<string, number> = {}
  for (const exp of expenses) {
    categoryTotals[exp.categoryId] = (categoryTotals[exp.categoryId] || 0) + exp.amount
  }
  
  for (const [catId, total] of Object.entries(categoryTotals)) {
    const cat = expenseCategories.find(c => c.id === catId)
    console.log(`      - ${cat?.name}: $${total.toFixed(2)}`)
  }

  // ============================================
  // 5. TAX RECORDS
  // ============================================
  console.log('\n📋 Seeding Tax Records...')

  // Get order revenue data
  const orders = await prisma.order.findMany({
    where: { paymentStatus: 'PAID' },
    select: { total: true, tax: true, createdAt: true },
  })

  // Calculate Q4 2025 and Q1 2026 data
  const taxRecords = [
    {
      id: 'tax-2025-q4',
      period: 'QUARTERLY' as const,
      year: 2025,
      quarter: 4,
      grossRevenue: faker.number.float({ min: 45000, max: 65000, fractionDigits: 2 }),
      taxableRevenue: faker.number.float({ min: 40000, max: 60000, fractionDigits: 2 }),
      salesTaxCollected: faker.number.float({ min: 3500, max: 5000, fractionDigits: 2 }),
      totalExpenses: faker.number.float({ min: 25000, max: 35000, fractionDigits: 2 }),
      deductibleExpenses: faker.number.float({ min: 20000, max: 30000, fractionDigits: 2 }),
      status: 'FILED' as const,
      taxPaid: faker.number.float({ min: 3000, max: 4500, fractionDigits: 2 }),
      paidDate: new Date('2026-01-15'),
    },
    {
      id: 'tax-2026-jan',
      period: 'MONTHLY' as const,
      year: 2026,
      month: 1,
      grossRevenue: orders.reduce((sum, o) => sum + o.total, 0) || faker.number.float({ min: 15000, max: 25000, fractionDigits: 2 }),
      taxableRevenue: orders.reduce((sum, o) => sum + (o.total - o.tax), 0) || faker.number.float({ min: 13000, max: 22000, fractionDigits: 2 }),
      salesTaxCollected: orders.reduce((sum, o) => sum + o.tax, 0) || faker.number.float({ min: 1200, max: 2000, fractionDigits: 2 }),
      totalExpenses: expenses.filter(e => e.date.getMonth() === 0).reduce((sum, e) => sum + e.amount, 0),
      deductibleExpenses: expenses.filter(e => e.date.getMonth() === 0 && e.isTaxDeductible).reduce((sum, e) => sum + e.amount, 0),
      status: 'DRAFT' as const,
    },
  ]

  for (const record of taxRecords) {
    const netIncome = record.grossRevenue - record.totalExpenses
    const estimatedTaxLiability = Math.max(0, netIncome * 0.25)
    
    await prisma.taxRecord.upsert({
      where: { id: record.id },
      update: { ...record, netIncome, estimatedTaxLiability },
      create: { ...record, netIncome, estimatedTaxLiability },
    })
    console.log(`   ✅ ${record.year} ${record.quarter ? `Q${record.quarter}` : `Month ${record.month}`} - Revenue: $${record.grossRevenue.toFixed(2)} [${record.status}]`)
  }

  // ============================================
  // 6. SALES GOALS
  // ============================================
  console.log('\n🎯 Seeding Sales Goals...')
  
  await prisma.salesGoals.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      dailyTarget: 750,
      weeklyTarget: 5000,
      monthlyTarget: 20000,
      quarterlyTarget: 60000,
      yearlyTarget: 250000,
    },
  })
  console.log('   ✅ Sales goals configured')

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '═'.repeat(60))
  console.log('🎉 FINANCIAL DATA SEED COMPLETE!')
  console.log('═'.repeat(60))

  const stats = {
    expenseCategories: await prisma.expenseCategory.count(),
    budgets: await prisma.budget.count(),
    invoices: await prisma.invoice.count(),
    expenses: await prisma.expense.count(),
    taxRecords: await prisma.taxRecord.count(),
  }

  console.log('\n📊 Financial Data Summary:')
  console.log(`   • Expense Categories: ${stats.expenseCategories}`)
  console.log(`   • Budgets: ${stats.budgets}`)
  console.log(`   • Invoices: ${stats.invoices}`)
  console.log(`   • Expenses: ${stats.expenses}`)
  console.log(`   • Tax Records: ${stats.taxRecords}`)
  
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalInvoices = invoiceData.reduce((sum, i) => sum + i.total, 0)
  
  console.log('\n💰 Financial Totals (Last 3 Months):')
  console.log(`   • Total Expenses: $${totalExpenses.toFixed(2)}`)
  console.log(`   • Total Invoices: $${totalInvoices.toFixed(2)}`)
  
  console.log('\n🔗 View at: http://localhost:3000/admin/financials')
  console.log('')
}

seedFinancials()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
