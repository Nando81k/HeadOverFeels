// Script to create a Limited Edition Drop Product
// Run with: npx tsx scripts/create-limited-drop.ts

const createLimitedDropProduct = async () => {
  // Calculate drop dates (starts now, ends in 7 days)
  const now = new Date()
  const dropEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

  const productData = {
    name: "MIDNIGHT LEGEND HOODIE [LIMITED DROP]",
    slug: "midnight-legend-hoodie-limited",
    description: "🔥 LIMITED EDITION DROP - Only 100 pieces worldwide!\n\nExclusive midnight black premium heavyweight hoodie with embroidered Head Over Feels logo. Features custom gold threading, oversized fit, and ultra-soft fleece interior. This drop ends in 7 days - once they're gone, they're gone forever.\n\n✨ Limited to 100 units globally\n⏰ Drop ends in 7 days\n🎯 Collectors item - will never be restocked",
    price: 120,
    compareAtPrice: 180,
    materials: "80% Premium Cotton, 20% Polyester blend. Custom gold embroidery thread.",
    careGuide: "Machine wash cold inside out. Tumble dry low. Do not iron over embroidery.",
    categoryId: null, // You can set this to an actual category ID if needed
    isActive: true,
    isFeatured: true,
    
    // LIMITED EDITION DROP FIELDS
    isLimitedEdition: true,
    releaseDate: now.toISOString(),
    dropEndDate: dropEndDate.toISOString(),
    maxQuantity: 100,
    
    // Product variants with limited inventory
    variants: [
      {
        sku: "MDNT-HOOD-S-BLK",
        size: "S",
        color: "Midnight Black",
        price: 120,
        inventory: 20,
        isActive: true
      },
      {
        sku: "MDNT-HOOD-M-BLK",
        size: "M",
        color: "Midnight Black",
        price: 120,
        inventory: 30,
        isActive: true
      },
      {
        sku: "MDNT-HOOD-L-BLK",
        size: "L",
        color: "Midnight Black",
        price: 120,
        inventory: 30,
        isActive: true
      },
      {
        sku: "MDNT-HOOD-XL-BLK",
        size: "XL",
        color: "Midnight Black",
        price: 120,
        inventory: 20,
        isActive: true
      }
    ],
    
    // Add product images (you'll need to upload actual images)
    images: [
      // Replace these with actual Cloudinary URLs after uploading
      "https://via.placeholder.com/800x1000/000000/FFD700?text=MIDNIGHT+LEGEND+HOODIE",
      "https://via.placeholder.com/800x1000/000000/FFFFFF?text=BACK+VIEW",
      "https://via.placeholder.com/800x1000/000000/FFFFFF?text=DETAIL+SHOT"
    ]
  }

  try {
    const response = await fetch('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create product')
    }

    const result = await response.json()
    console.log('✅ Limited Edition Drop Product Created Successfully!')
    console.log('📦 Product ID:', result.id)
    console.log('🔗 Product Name:', result.name)
    console.log('⏰ Drop Ends:', new Date(result.dropEndDate).toLocaleString())
    console.log('🎯 Max Quantity:', result.maxQuantity)
    console.log('📊 Total Inventory:', result.variants.reduce((sum: number, v: any) => sum + v.inventory, 0))
    console.log('\n🌐 View at: http://localhost:3000/products/' + result.slug)
    
    return result
  } catch (error) {
    console.error('❌ Error creating limited drop product:', error)
    throw error
  }
}

// Run the script
createLimitedDropProduct()
  .then(() => {
    console.log('\n✨ Done! Your limited edition drop is live!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error.message)
    process.exit(1)
  })
