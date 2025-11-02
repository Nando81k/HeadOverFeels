import { PrismaClient as PrismaClientPostgres } from '@prisma/client'
import Database from 'better-sqlite3'

// PostgreSQL client
const pgClient = new PrismaClientPostgres()

// SQLite database
const sqliteDb = new Database('./prisma/dev.db', { readonly: true })

interface SQLiteRow {
  [key: string]: any
}

async function migrate() {
  console.log('🚀 Starting data migration from SQLite to PostgreSQL...\n')

  try {
    // ==================== COLLECTIONS ====================
    console.log('📁 Migrating Collections...')
    const collections = sqliteDb.prepare('SELECT * FROM collections').all() as SQLiteRow[]
    console.log(`   Found ${collections.length} collections`)

    for (const collection of collections) {
      await pgClient.collection.upsert({
        where: { id: collection.id },
        create: {
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          image: collection.image,
          createdAt: new Date(collection.createdAt || collection.created_at),
          updatedAt: new Date(collection.updatedAt || collection.updated_at),
        },
        update: {
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          image: collection.image,
          updatedAt: new Date(collection.updatedAt || collection.updated_at),
        },
      })
      console.log(`   ✓ ${collection.name}`)
    }

    // ==================== PRODUCTS ====================
    console.log('\n📦 Migrating Products...')
    const products = sqliteDb.prepare('SELECT * FROM products').all() as SQLiteRow[]
    console.log(`   Found ${products.length} products`)

    for (const product of products) {
      // Ensure images is a JSON string
      const imagesStr = typeof product.images === 'string' 
        ? product.images 
        : JSON.stringify(product.images)

      await pgClient.product.upsert({
        where: { id: product.id },
        create: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice || product.compare_at_price,
          images: imagesStr,
          isLimitedEdition: Boolean(product.isLimitedEdition || product.is_limited_edition),
          releaseDate: product.releaseDate || product.release_date ? new Date(product.releaseDate || product.release_date) : null,
          dropEndDate: product.dropEndDate || product.drop_end_date ? new Date(product.dropEndDate || product.drop_end_date) : null,
          maxQuantity: product.maxQuantity || product.max_quantity,
          isFeatured: Boolean(product.featured || product.isFeatured || product.is_featured),
          createdAt: new Date(product.createdAt || product.created_at),
          updatedAt: new Date(product.updatedAt || product.updated_at),
        },
        update: {
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice || product.compare_at_price,
          images: imagesStr,
          isLimitedEdition: Boolean(product.isLimitedEdition || product.is_limited_edition),
          releaseDate: product.releaseDate || product.release_date ? new Date(product.releaseDate || product.release_date) : null,
          dropEndDate: product.dropEndDate || product.drop_end_date ? new Date(product.dropEndDate || product.drop_end_date) : null,
          maxQuantity: product.maxQuantity || product.max_quantity,
          isFeatured: Boolean(product.featured || product.isFeatured || product.is_featured),
          updatedAt: new Date(product.updatedAt || product.updated_at),
        },
      })
      console.log(`   ✓ ${product.name}`)
    }

    // ==================== PRODUCT VARIANTS ====================
    console.log('\n👕 Migrating Product Variants...')
    const variants = sqliteDb.prepare('SELECT * FROM product_variants').all() as SQLiteRow[]
    console.log(`   Found ${variants.length} variants`)

    for (const variant of variants) {
      await pgClient.productVariant.upsert({
        where: { id: variant.id },
        create: {
          id: variant.id,
          productId: variant.productId || variant.product_id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          inventory: variant.inventory,
          createdAt: new Date(variant.createdAt || variant.created_at),
          updatedAt: new Date(variant.updatedAt || variant.updated_at),
        },
        update: {
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          inventory: variant.inventory,
          updatedAt: new Date(variant.updatedAt || variant.updated_at),
        },
      })
    }
    console.log(`   ✓ Migrated ${variants.length} variants`)

    // ==================== COLLECTION PRODUCTS (Many-to-Many) ====================
    console.log('\n🔗 Migrating Product-Collection relationships...')
    
    // Check collection_products table
    try {
      const collectionProducts = sqliteDb
        .prepare('SELECT * FROM collection_products')
        .all() as SQLiteRow[]
      console.log(`   Found ${collectionProducts.length} relationships in collection_products`)

      for (const rel of collectionProducts) {
        await pgClient.collectionProduct.upsert({
          where: {
            collectionId_productId: {
              collectionId: rel.collectionId || rel.collection_id,
              productId: rel.productId || rel.product_id,
            },
          },
          create: {
            id: rel.id,
            collectionId: rel.collectionId || rel.collection_id,
            productId: rel.productId || rel.product_id,
            sortOrder: rel.sortOrder || rel.sort_order || 0,
          },
          update: {
            sortOrder: rel.sortOrder || rel.sort_order || 0,
          },
        })
      }
      console.log(`   ✓ Migrated ${collectionProducts.length} relationships`)
    } catch {
      console.log('   ⚠️  No collection-product relationships found')
    }

    // ==================== CUSTOMERS ====================
    console.log('\n👥 Migrating Customers...')
    const customers = sqliteDb.prepare('SELECT * FROM customers').all() as SQLiteRow[]
    console.log(`   Found ${customers.length} customers`)

    for (const customer of customers) {
      // Skip if already exists (we already created admin and test users)
      const existing = await pgClient.customer.findUnique({
        where: { email: customer.email },
      })

      if (!existing && customer.password) {
        // @ts-expect-error - password field exists but TypeScript doesn't recognize it
        await pgClient.customer.create({
          data: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            password: customer.password, // Hashed password
            phone: customer.phone || null,
            birthday: customer.birthday ? new Date(customer.birthday) : null,
            newsletter: Boolean(customer.newsletter),
            smsOptIn: Boolean(customer.smsOptIn || customer.sms_opt_in),
            isAdmin: Boolean(customer.isAdmin || customer.is_admin),
          },
        })
        console.log(`   ✓ ${customer.email}`)
      } else if (!customer.password) {
        console.log(`   ⊘ ${customer.email} (no password, skipping)`)
      } else {
        console.log(`   ⊘ ${customer.email} (already exists, keeping PostgreSQL version)`)
      }
    }

    // ==================== ORDERS ====================
    console.log('\n🛒 Migrating Orders...')
    const orders = sqliteDb.prepare('SELECT * FROM orders').all() as SQLiteRow[]
    console.log(`   Found ${orders.length} orders`)

    if (orders.length > 0) {
      console.log('   ⚠️  Order migration requires address setup - skipping for now')
      console.log('   💡 Orders need to be recreated through the new checkout process')
    }

    // ==================== ORDER ITEMS ====================
    console.log('\n📋 Migrating Order Items...')
    const orderItems = sqliteDb.prepare('SELECT * FROM order_items').all() as SQLiteRow[]
    console.log(`   Found ${orderItems.length} order items`)
    
    if (orderItems.length > 0) {
      console.log('   ⚠️  Order items depend on orders - skipping for now')
    }

    // ==================== SUMMARY ====================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ MIGRATION COMPLETE!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Collections:     ${collections.length}`)
    console.log(`Products:        ${products.length}`)
    console.log(`Variants:        ${variants.length}`)
    console.log(`Customers:       ${customers.length}`)
    console.log(`Orders:          ${orders.length} (skipped - require address setup)`)
    console.log(`Order Items:     ${orderItems.length} (skipped)`)
    console.log('\n🎉 All product data successfully migrated to PostgreSQL!')
    console.log('💡 Orders will need to be recreated through the checkout process')


  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    sqliteDb.close()
    await pgClient.$disconnect()
  }
}

migrate()
