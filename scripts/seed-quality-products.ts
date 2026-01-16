// Script to seed database with high-quality products with proper variant images
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// High-quality Unsplash images organized by product type and color
const productImages = {
  // HOODIES
  hoodies: {
    black: [
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509942774463-acf339cf87d5?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&h=1000&fit=crop&q=80',
    ],
    grey: [
      'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542406775-ade58c52d2e4?w=800&h=1000&fit=crop&q=80',
    ],
    white: [
      'https://images.unsplash.com/photo-1618354691438-25bc04584c23?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1614975059251-992f11792b9f?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1614975059303-1ddb8a242e37?w=800&h=1000&fit=crop&q=80',
    ],
    navy: [
      'https://images.unsplash.com/photo-1611312449408-fcece27cdbb7?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620799139652-715e2815651b?w=800&h=1000&fit=crop&q=80',
    ],
    olive: [
      'https://images.unsplash.com/photo-1618354691229-88d47f285158?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=800&h=1000&fit=crop&q=80',
    ],
  },
  // T-SHIRTS
  tshirts: {
    black: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618517351616-38fb9c5210c6?w=800&h=1000&fit=crop&q=80',
    ],
    white: [
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&h=1000&fit=crop&q=80',
    ],
    grey: [
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&h=1000&fit=crop&q=80',
    ],
    navy: [
      'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618354691792-d1d42acfd860?w=800&h=1000&fit=crop&q=80',
    ],
    burgundy: [
      'https://images.unsplash.com/photo-1618354691321-e851c56960ea?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608748010993-4fe24f3296c3?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618354691554-b959f892bf4c?w=800&h=1000&fit=crop&q=80',
    ],
    sage: [
      'https://images.unsplash.com/photo-1618354691792-d1d42acfd860?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&h=1000&fit=crop&q=80',
    ],
  },
  // PANTS & BOTTOMS
  pants: {
    black: [
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=1000&fit=crop&q=80',
    ],
    khaki: [
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&h=1000&fit=crop&q=80',
    ],
    grey: [
      'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800&h=1000&fit=crop&q=80',
    ],
    navy: [
      'https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602293589930-45aad59ba3ab?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=800&h=1000&fit=crop&q=80',
    ],
    olive: [
      'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800&h=1000&fit=crop&q=80',
    ],
  },
  // JACKETS & OUTERWEAR
  jackets: {
    black: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=1000&fit=crop&q=80',
    ],
    brown: [
      'https://images.unsplash.com/photo-1520975954732-35dd22299614?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?w=800&h=1000&fit=crop&q=80',
    ],
    olive: [
      'https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1489286696299-aa7486820bd5?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=1000&fit=crop&q=80',
    ],
    navy: [
      'https://images.unsplash.com/photo-1548624149-f09c9ccc8f05?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1516826957135-700dedea698c?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=1000&fit=crop&q=80',
    ],
  },
  // ACCESSORIES
  accessories: {
    black: [
      'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&h=1000&fit=crop&q=80',
    ],
    white: [
      'https://images.unsplash.com/photo-1534215754734-18e55d13e346?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&h=1000&fit=crop&q=80',
    ],
    navy: [
      'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1533055640609-24b498dfd74c?w=800&h=1000&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&h=1000&fit=crop&q=80',
    ],
  },
};

// Color hex codes
const colorHexMap: Record<string, string> = {
  'Black': '#0a0a0a',
  'White': '#ffffff',
  'Off-White': '#faf8f5',
  'Cream': '#fffdd0',
  'Grey': '#6b7280',
  'Heather Grey': '#9ca3af',
  'Charcoal': '#374151',
  'Navy': '#1e3a5f',
  'Navy Blue': '#1e3a5f',
  'Olive': '#556b2f',
  'Olive Green': '#556b2f',
  'Sage': '#9dc183',
  'Sage Green': '#9dc183',
  'Burgundy': '#722f37',
  'Wine': '#722f37',
  'Brown': '#8b4513',
  'Tan': '#d2b48c',
  'Khaki': '#c3b091',
  'Forest Green': '#228b22',
  'Stone': '#9a9181',
  'Sand': '#c2b280',
  'Washed Black': '#2d2d2d',
  'Vintage Grey': '#808080',
};

// Sizes
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const pantSizes = ['28', '30', '32', '34', '36', '38'];
const accessorySizes = ['One Size'];

async function main() {
  console.log('🌱 Starting quality product seed...');
  console.log('⚠️  This will delete existing products and replace them with new ones.');

  // Delete existing products and related records
  console.log('🗑️  Deleting existing data...');
  
  // Delete in order of dependencies
  await prisma.cartReservation.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.backInStockNotification.deleteMany({});
  await prisma.dropNotification.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.productView.deleteMany({});
  await prisma.productRecommendation.deleteMany({});
  await prisma.collectionProduct.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  
  console.log('✅ Cleaned up existing data');

  // Ensure categories exist
  const categories = [
    {
      name: 'Hoodies & Sweatshirts',
      slug: 'hoodies',
      description: 'Premium heavyweight hoodies and cozy sweatshirts',
      isActive: true,
      sortOrder: 1,
    },
    {
      name: 'T-Shirts',
      slug: 'tshirts',
      description: 'Essential tees and graphic shirts',
      isActive: true,
      sortOrder: 2,
    },
    {
      name: 'Bottoms',
      slug: 'bottoms',
      description: 'Pants, joggers, and shorts',
      isActive: true,
      sortOrder: 3,
    },
    {
      name: 'Outerwear',
      slug: 'outerwear',
      description: 'Jackets and coats for all seasons',
      isActive: true,
      sortOrder: 4,
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Hats, bags, and lifestyle essentials',
      isActive: true,
      sortOrder: 5,
    },
  ];

  const createdCategories: Record<string, { id: string }> = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    createdCategories[cat.slug] = created;
  }
  console.log(`✅ Categories ready`);

  // PRODUCT DEFINITIONS
  const productsToCreate = [
    // ============== HOODIES ==============
    {
      name: 'Essential Oversized Hoodie',
      description: 'The perfect everyday hoodie. Premium 400gsm cotton blend with dropped shoulders and relaxed fit. Embroidered logo on chest.\n\n✨ Oversized fit\n🌟 Ultra-soft fleece interior\n🎯 Ribbed cuffs and hem\n💎 Premium quality construction',
      slug: 'essential-oversized-hoodie',
      price: 89.00,
      compareAtPrice: 120.00,
      categorySlug: 'hoodies',
      imageType: 'hoodies',
      materials: '80% Premium Cotton, 20% Polyester. 400gsm heavyweight fabric.',
      careGuide: 'Machine wash cold inside out. Tumble dry low. Do not bleach.',
      isFeatured: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Heather Grey', colorKey: 'grey' },
        { color: 'Off-White', colorKey: 'white' },
        { color: 'Navy Blue', colorKey: 'navy' },
      ],
    },
    {
      name: 'Vintage Washed Hoodie',
      description: 'Lived-in comfort from day one. Garment-dyed and stonewashed for a vintage feel. Unique fading on each piece.\n\n🔥 Vintage wash finish\n💫 Soft hand feel\n🎨 Each piece unique\n⚡ Pre-shrunk fabric',
      slug: 'vintage-washed-hoodie',
      price: 95.00,
      compareAtPrice: 130.00,
      categorySlug: 'hoodies',
      imageType: 'hoodies',
      materials: '100% Ring-spun Cotton. Garment dyed.',
      careGuide: 'Wash separately. Machine wash cold. Tumble dry low.',
      isFeatured: false,
      variants: [
        { color: 'Vintage Grey', colorKey: 'grey' },
        { color: 'Washed Black', colorKey: 'black' },
        { color: 'Stone', colorKey: 'white' },
      ],
    },
    {
      name: 'Premium Heavyweight Hoodie',
      description: 'Our most luxurious hoodie yet. 500gsm heavyweight construction with double-lined hood and premium YKK hardware.\n\n🏆 500gsm heavyweight\n👑 Premium finishes\n🔒 YKK hardware\n💪 Built to last',
      slug: 'premium-heavyweight-hoodie',
      price: 125.00,
      compareAtPrice: 165.00,
      categorySlug: 'hoodies',
      imageType: 'hoodies',
      materials: '85% Cotton, 15% Polyester. 500gsm super heavyweight.',
      careGuide: 'Machine wash cold inside out. Hang dry recommended.',
      isFeatured: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Navy', colorKey: 'navy' },
        { color: 'Olive', colorKey: 'olive' },
      ],
    },
    {
      name: 'Embroidered Script Hoodie',
      description: 'Statement piece with bold embroidered script across chest. Premium heavyweight construction with kangaroo pocket.\n\n🎯 Large embroidered script\n⚡ Heavyweight 450gsm\n🔥 Oversized kangaroo pocket',
      slug: 'embroidered-script-hoodie',
      price: 105.00,
      compareAtPrice: 145.00,
      categorySlug: 'hoodies',
      imageType: 'hoodies',
      materials: '85% Cotton, 15% Polyester. Custom embroidery thread.',
      careGuide: 'Machine wash cold inside out. Do not iron over embroidery. Tumble dry low.',
      isFeatured: true,
      variants: [
        { color: 'Cream', colorKey: 'white' },
        { color: 'Black', colorKey: 'black' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },

    // ============== T-SHIRTS ==============
    {
      name: 'Signature Logo Tee',
      description: 'The foundation of any wardrobe. Soft-hand screenprint logo on premium heavyweight tee. True to size relaxed fit.\n\n✨ 220gsm heavyweight cotton\n🎨 Soft-hand screenprint\n💯 Reinforced shoulders\n🌟 Pre-shrunk',
      slug: 'signature-logo-tee',
      price: 38.00,
      compareAtPrice: 55.00,
      categorySlug: 'tshirts',
      imageType: 'tshirts',
      materials: '100% Premium Cotton. 220gsm.',
      careGuide: 'Machine wash cold. Tumble dry low. Do not iron directly on print.',
      isFeatured: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'White', colorKey: 'white' },
        { color: 'Heather Grey', colorKey: 'grey' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },
    {
      name: 'Oversized Graphic Tee',
      description: 'Make a statement. Oversized fit with bold front graphic. Drop shoulder construction for that perfect relaxed look.\n\n🔥 Oversized fit\n🎨 Large front graphic\n⚡ Drop shoulder seams\n💫 Box silhouette',
      slug: 'oversized-graphic-tee',
      price: 48.00,
      compareAtPrice: 68.00,
      categorySlug: 'tshirts',
      imageType: 'tshirts',
      materials: '100% Organic Cotton. 240gsm heavyweight.',
      careGuide: 'Wash inside out. Machine wash cold. Hang dry recommended.',
      isFeatured: true,
      variants: [
        { color: 'Off-White', colorKey: 'white' },
        { color: 'Black', colorKey: 'black' },
        { color: 'Sage Green', colorKey: 'sage' },
      ],
    },
    {
      name: 'Essential Boxy Tee',
      description: 'The perfect boxy fit tee for everyday wear. Slightly cropped length with wider body for a modern silhouette.\n\n📐 Boxy cropped fit\n🎯 Modern silhouette\n✨ Enzyme washed\n💎 Soft hand feel',
      slug: 'essential-boxy-tee',
      price: 42.00,
      compareAtPrice: 58.00,
      categorySlug: 'tshirts',
      imageType: 'tshirts',
      materials: '100% Cotton. 200gsm enzyme washed.',
      careGuide: 'Machine wash cold. Tumble dry low.',
      isFeatured: false,
      variants: [
        { color: 'White', colorKey: 'white' },
        { color: 'Black', colorKey: 'black' },
        { color: 'Grey', colorKey: 'grey' },
        { color: 'Navy', colorKey: 'navy' },
        { color: 'Burgundy', colorKey: 'burgundy' },
      ],
    },
    {
      name: 'Vintage Band Tee',
      description: 'Throwback vibes. Distressed graphics with vintage wash for authentic worn-in feel. Each piece has unique character.\n\n🎸 Vintage band graphics\n💫 Distressed wash\n🔥 Each piece unique',
      slug: 'vintage-band-tee',
      price: 52.00,
      compareAtPrice: 72.00,
      categorySlug: 'tshirts',
      imageType: 'tshirts',
      materials: '100% Cotton. Vintage washed.',
      careGuide: 'Wash inside out cold. Air dry recommended.',
      isFeatured: false,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Charcoal', colorKey: 'grey' },
      ],
    },

    // ============== BOTTOMS ==============
    {
      name: 'Essential Cargo Pants',
      description: 'Utility meets style. Relaxed fit cargo pants with multiple pockets and adjustable hem. Perfect for any occasion.\n\n🔧 6 functional pockets\n📐 Relaxed fit\n⚡ Adjustable hem\n💪 Durable ripstop fabric',
      slug: 'essential-cargo-pants',
      price: 98.00,
      compareAtPrice: 135.00,
      categorySlug: 'bottoms',
      imageType: 'pants',
      materials: '100% Cotton Ripstop. 280gsm.',
      careGuide: 'Machine wash cold. Tumble dry low.',
      isFeatured: true,
      usePantSizes: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Khaki', colorKey: 'khaki' },
        { color: 'Olive', colorKey: 'olive' },
      ],
    },
    {
      name: 'Premium Joggers',
      description: 'Elevated comfort. Premium French terry joggers with tapered leg and elastic cuff. Zip pockets for security.\n\n🏃 Tapered fit\n🔒 Zip pockets\n💫 French terry fabric\n✨ Elastic cuffs',
      slug: 'premium-joggers',
      price: 85.00,
      compareAtPrice: 115.00,
      categorySlug: 'bottoms',
      imageType: 'pants',
      materials: '80% Cotton, 20% Polyester. French terry.',
      careGuide: 'Machine wash cold. Tumble dry low.',
      isFeatured: true,
      usePantSizes: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Grey', colorKey: 'grey' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },
    {
      name: 'Relaxed Chinos',
      description: 'Classic with a twist. Relaxed fit chinos with modern details. Perfect for dressed up or casual.\n\n📐 Relaxed fit\n🎯 Modern details\n💎 Stretch comfort\n✨ Wrinkle resistant',
      slug: 'relaxed-chinos',
      price: 78.00,
      compareAtPrice: 105.00,
      categorySlug: 'bottoms',
      imageType: 'pants',
      materials: '98% Cotton, 2% Elastane. Stretch twill.',
      careGuide: 'Machine wash cold. Tumble dry low. Iron medium heat.',
      isFeatured: false,
      usePantSizes: true,
      variants: [
        { color: 'Khaki', colorKey: 'khaki' },
        { color: 'Black', colorKey: 'black' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },
    {
      name: 'Wide Leg Trousers',
      description: 'Statement silhouette. Wide leg trousers with high waist and pleated front. Drape and movement.\n\n👔 High waist\n📐 Wide leg\n✨ Pleated front\n💫 Beautiful drape',
      slug: 'wide-leg-trousers',
      price: 108.00,
      compareAtPrice: 145.00,
      categorySlug: 'bottoms',
      imageType: 'pants',
      materials: '100% Wool blend. Fully lined.',
      careGuide: 'Dry clean only.',
      isFeatured: false,
      usePantSizes: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Charcoal', colorKey: 'grey' },
      ],
    },

    // ============== OUTERWEAR ==============
    {
      name: 'Classic Bomber Jacket',
      description: 'Timeless silhouette. Satin bomber jacket with ribbed collar, cuffs, and hem. Quilted lining for warmth.\n\n✈️ Classic bomber fit\n🔥 Quilted lining\n⚡ Ribbed trims\n💎 Premium satin',
      slug: 'classic-bomber-jacket',
      price: 145.00,
      compareAtPrice: 195.00,
      categorySlug: 'outerwear',
      imageType: 'jackets',
      materials: '100% Nylon shell. Polyester quilted lining.',
      careGuide: 'Dry clean recommended. Spot clean when possible.',
      isFeatured: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Navy', colorKey: 'navy' },
        { color: 'Olive', colorKey: 'olive' },
      ],
    },
    {
      name: 'Oversized Denim Jacket',
      description: 'Wardrobe essential. Oversized denim jacket with vintage wash. Metal hardware and multiple pockets.\n\n👖 Premium denim\n📐 Oversized fit\n⚙️ Metal hardware\n🔥 Vintage wash',
      slug: 'oversized-denim-jacket',
      price: 128.00,
      compareAtPrice: 168.00,
      categorySlug: 'outerwear',
      imageType: 'jackets',
      materials: '100% Cotton denim. 12oz weight.',
      careGuide: 'Machine wash cold inside out. Hang dry.',
      isFeatured: true,
      variants: [
        { color: 'Washed Black', colorKey: 'black' },
        { color: 'Stone', colorKey: 'brown' },
      ],
    },
    {
      name: 'Utility Field Jacket',
      description: 'Built for adventure. Field jacket with multiple pockets and adjustable waist. Water-resistant finish.\n\n🎒 Utility pockets\n💧 Water resistant\n🔧 Adjustable waist\n⚡ Snap buttons',
      slug: 'utility-field-jacket',
      price: 165.00,
      compareAtPrice: 225.00,
      categorySlug: 'outerwear',
      imageType: 'jackets',
      materials: 'Cotton/Nylon blend with DWR coating.',
      careGuide: 'Machine wash cold. Do not tumble dry.',
      isFeatured: false,
      variants: [
        { color: 'Olive Green', colorKey: 'olive' },
        { color: 'Black', colorKey: 'black' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },
    {
      name: 'Puffer Vest',
      description: 'Layering essential. Lightweight puffer vest with synthetic down alternative. Packable design.\n\n🧥 Lightweight warmth\n📦 Packable design\n🌿 Synthetic down\n💨 Windproof',
      slug: 'puffer-vest',
      price: 98.00,
      compareAtPrice: 135.00,
      categorySlug: 'outerwear',
      imageType: 'jackets',
      materials: '100% Recycled nylon. Synthetic down fill.',
      careGuide: 'Machine wash cold gentle. Tumble dry low.',
      isFeatured: false,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },

    // ============== ACCESSORIES ==============
    {
      name: 'Classic Snapback Cap',
      description: 'Street essential. Structured snapback cap with embroidered logo. Adjustable closure for perfect fit.\n\n🧢 Structured crown\n🎯 Embroidered logo\n⚡ Adjustable snapback\n💎 Premium construction',
      slug: 'classic-snapback-cap',
      price: 35.00,
      compareAtPrice: 48.00,
      categorySlug: 'accessories',
      imageType: 'accessories',
      materials: '100% Cotton twill. Plastic snapback closure.',
      careGuide: 'Spot clean only. Do not machine wash.',
      isFeatured: true,
      useAccessorySizes: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'White', colorKey: 'white' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },
    {
      name: 'Beanie',
      description: 'Cold weather essential. Ribbed knit beanie with folded cuff. Soft acrylic for comfort.\n\n🧶 Ribbed knit\n📐 Cuffed design\n🔥 Warm and cozy\n✨ One size fits most',
      slug: 'essential-beanie',
      price: 28.00,
      compareAtPrice: 38.00,
      categorySlug: 'accessories',
      imageType: 'accessories',
      materials: '100% Soft acrylic knit.',
      careGuide: 'Hand wash cold. Lay flat to dry.',
      isFeatured: false,
      useAccessorySizes: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Grey', colorKey: 'white' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },
    {
      name: 'Canvas Tote Bag',
      description: 'Everyday carry. Heavy canvas tote bag with internal pocket. Screen printed logo.\n\n🛍️ Spacious interior\n📱 Internal pocket\n💪 Heavy canvas\n🎨 Screen print logo',
      slug: 'canvas-tote-bag',
      price: 45.00,
      compareAtPrice: 62.00,
      categorySlug: 'accessories',
      imageType: 'accessories',
      materials: '16oz heavyweight canvas. Cotton straps.',
      careGuide: 'Machine wash cold. Air dry.',
      isFeatured: true,
      useAccessorySizes: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Off-White', colorKey: 'white' },
      ],
    },
    {
      name: 'Crossbody Bag',
      description: 'Hands-free style. Compact crossbody bag with adjustable strap. Multiple compartments.\n\n👜 Compact design\n🔗 Adjustable strap\n📦 Multiple pockets\n⚡ Quick access',
      slug: 'crossbody-bag',
      price: 58.00,
      compareAtPrice: 78.00,
      categorySlug: 'accessories',
      imageType: 'accessories',
      materials: '100% Nylon with metal hardware.',
      careGuide: 'Wipe clean with damp cloth.',
      isFeatured: false,
      useAccessorySizes: true,
      variants: [
        { color: 'Black', colorKey: 'black' },
        { color: 'Navy', colorKey: 'navy' },
      ],
    },
  ];

  // Create products with variants
  let productCount = 0;
  let variantCount = 0;

  for (const productData of productsToCreate) {
    const { variants: variantConfigs, categorySlug, imageType, usePantSizes, useAccessorySizes, ...productInfo } = productData;

    // Get first variant images as main product images
    const firstColorKey = variantConfigs[0].colorKey;
    const mainImages = productImages[imageType as keyof typeof productImages]?.[firstColorKey as keyof typeof productImages.hoodies] || [];

    const product = await prisma.product.create({
      data: {
        name: productInfo.name,
        description: productInfo.description,
        slug: productInfo.slug,
        price: productInfo.price,
        compareAtPrice: productInfo.compareAtPrice,
        categoryId: createdCategories[categorySlug].id,
        images: JSON.stringify(mainImages),
        materials: productInfo.materials,
        careGuide: productInfo.careGuide,
        isActive: true,
        isFeatured: productInfo.isFeatured,
      },
    });

    productCount++;

    // Determine sizes based on product type
    const sizesToUse = usePantSizes ? pantSizes : useAccessorySizes ? accessorySizes : sizes;

    // Create variants for each color/size combination
    for (const variantConfig of variantConfigs) {
      const colorImages = productImages[imageType as keyof typeof productImages]?.[variantConfig.colorKey as keyof typeof productImages.hoodies] || mainImages;
      const colorHex = colorHexMap[variantConfig.color] || '#000000';

      for (const size of sizesToUse) {
        const skuBase = productInfo.slug
          .split('-')
          .map(word => word.charAt(0).toUpperCase())
          .join('');
        const colorCode = variantConfig.color.substring(0, 3).toUpperCase();
        const sku = `${skuBase}-${size}-${colorCode}-${Date.now().toString().slice(-4)}`;

        // Random inventory between 5-50 for variety
        const inventory = Math.floor(Math.random() * 46) + 5;

        await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku,
            size,
            color: variantConfig.color,
            colorHex,
            images: JSON.stringify(colorImages),
            inventory,
            isActive: true,
          },
        });

        variantCount++;
      }
    }

    console.log(`✅ Created: ${productInfo.name} (${variantConfigs.length} colors × ${sizesToUse.length} sizes)`);
  }

  console.log('\n🎉 Seed completed!');
  console.log(`📦 Created ${productCount} products`);
  console.log(`🏷️  Created ${variantCount} variants`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
