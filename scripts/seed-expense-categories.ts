import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Default expense categories for e-commerce business
const defaultExpenseCategories = [
  {
    name: 'Uncategorized',
    slug: 'uncategorized',
    description: 'General expenses that don\'t fit other categories',
    color: '#6B7280',
    icon: 'Question',
    sortOrder: 0
  },
  {
    name: 'Cost of Goods Sold',
    slug: 'cost-of-goods-sold',
    description: 'Product manufacturing, raw materials, and direct costs',
    color: '#EF4444',
    icon: 'Package',
    sortOrder: 1
  },
  {
    name: 'Shipping & Fulfillment',
    slug: 'shipping-fulfillment',
    description: 'Shipping supplies, postage, and fulfillment services',
    color: '#F97316',
    icon: 'Truck',
    sortOrder: 2
  },
  {
    name: 'Marketing & Advertising',
    slug: 'marketing-advertising',
    description: 'Paid ads, social media marketing, influencer costs, promotions',
    color: '#8B5CF6',
    icon: 'Megaphone',
    sortOrder: 3
  },
  {
    name: 'Software & Subscriptions',
    slug: 'software-subscriptions',
    description: 'SaaS tools, hosting, platforms, and recurring software fees',
    color: '#3B82F6',
    icon: 'Code',
    sortOrder: 4
  },
  {
    name: 'Office Supplies',
    slug: 'office-supplies',
    description: 'Stationery, printing, packaging materials, and office equipment',
    color: '#10B981',
    icon: 'Briefcase',
    sortOrder: 5
  },
  {
    name: 'Professional Services',
    slug: 'professional-services',
    description: 'Legal, accounting, consulting, and freelance services',
    color: '#6366F1',
    icon: 'UserCircle',
    sortOrder: 6
  },
  {
    name: 'Rent & Utilities',
    slug: 'rent-utilities',
    description: 'Office rent, warehouse, electricity, internet, and phone',
    color: '#14B8A6',
    icon: 'Buildings',
    sortOrder: 7
  },
  {
    name: 'Payroll & Contractors',
    slug: 'payroll-contractors',
    description: 'Employee wages, contractor payments, and payroll taxes',
    color: '#F59E0B',
    icon: 'Users',
    sortOrder: 8
  },
  {
    name: 'Payment Processing',
    slug: 'payment-processing',
    description: 'Credit card fees, Stripe/PayPal fees, and transaction costs',
    color: '#EC4899',
    icon: 'CreditCard',
    sortOrder: 9
  },
  {
    name: 'Equipment & Hardware',
    slug: 'equipment-hardware',
    description: 'Computers, machinery, tools, and physical equipment',
    color: '#78716C',
    icon: 'Desktop',
    sortOrder: 10
  },
  {
    name: 'Insurance',
    slug: 'insurance',
    description: 'Business insurance, liability, and product insurance',
    color: '#0EA5E9',
    icon: 'Shield',
    sortOrder: 11
  },
  {
    name: 'Travel & Entertainment',
    slug: 'travel-entertainment',
    description: 'Business travel, meals, accommodation, and client entertainment',
    color: '#A855F7',
    icon: 'Airplane',
    sortOrder: 12
  },
  {
    name: 'Bank Fees & Interest',
    slug: 'bank-fees-interest',
    description: 'Bank charges, loan interest, and financial fees',
    color: '#64748B',
    icon: 'Bank',
    sortOrder: 13
  },
  {
    name: 'Taxes & Licenses',
    slug: 'taxes-licenses',
    description: 'Business licenses, permits, and estimated tax payments',
    color: '#DC2626',
    icon: 'FileText',
    sortOrder: 14
  },
  {
    name: 'Training & Education',
    slug: 'training-education',
    description: 'Courses, certifications, conferences, and professional development',
    color: '#059669',
    icon: 'GraduationCap',
    sortOrder: 15
  },
  {
    name: 'Inventory Loss',
    slug: 'inventory-loss',
    description: 'Damaged goods, returns, write-offs, and shrinkage',
    color: '#B91C1C',
    icon: 'Warning',
    sortOrder: 16
  },
  {
    name: 'Photography & Content',
    slug: 'photography-content',
    description: 'Product photography, videography, and content creation',
    color: '#D946EF',
    icon: 'Camera',
    sortOrder: 17
  }
]

async function seedExpenseCategories() {
  console.log('🏷️  Seeding expense categories...\n')

  let created = 0
  let skipped = 0

  for (const category of defaultExpenseCategories) {
    // Check if category already exists
    const existing = await prisma.expenseCategory.findFirst({
      where: {
        OR: [
          { name: category.name },
          { slug: category.slug }
        ]
      }
    })

    if (existing) {
      console.log(`⏭️  Skipping "${category.name}" - already exists`)
      skipped++
      continue
    }

    // Create the category
    await prisma.expenseCategory.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        color: category.color,
        icon: category.icon,
        sortOrder: category.sortOrder,
        isActive: true
      }
    })

    console.log(`✅ Created: ${category.name}`)
    created++
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Created: ${created}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Total categories: ${defaultExpenseCategories.length}`)
}

seedExpenseCategories()
  .then(() => {
    console.log('\n✨ Expense categories seeded successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error seeding expense categories:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
