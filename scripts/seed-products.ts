// Script to seed database with categories and products
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Placeholder image generator using placeholder.com service
const getPlaceholderImage = (type: string) => {
  const placeholders: Record<string, string[]> = {
    hoodie: [
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&h=1000&fit=crop',
    ],
    tshirt: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=1000&fit=crop',
    ],
    pants: [
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&h=1000&fit=crop',
    ],
    accessories: [
      'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1529958030586-3aae4ca485ff?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=800&h=1000&fit=crop',
    ],
    shoes: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&h=1000&fit=crop',
      'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&h=1000&fit=crop',
    ],
  };
  
  const images = placeholders[type] || placeholders.tshirt;
  return images[Math.floor(Math.random() * images.length)];
};

async function main() {
  console.log('🌱 Starting seed...');

  // Create categories
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

  const createdCategories = await Promise.all(
    categories.map((cat) =>
      prisma.category.upsert({
        where: { slug: cat.slug },
        update: cat,
        create: cat,
      })
    )
  );

  console.log(`✅ Created ${createdCategories.length} categories`);

  // Create products
  const products = [
    // HOODIES
    {
      name: 'Essential Oversized Hoodie',
      description: 'The perfect everyday hoodie. Premium 400gsm cotton blend with dropped shoulders and relaxed fit. Embroidered logo on chest.\n\n✨ Oversized fit\n🌟 Ultra-soft fleece interior\n🎯 Ribbed cuffs and hem',
      slug: 'essential-oversized-hoodie',
      price: 85,
      compareAtPrice: 120,
      categoryId: createdCategories.find((c) => c.slug === 'hoodies')!.id,
      images: JSON.stringify([getPlaceholderImage('hoodie')]),
      materials: '80% Premium Cotton, 20% Polyester. 400gsm heavyweight fabric.',
      careGuide: 'Machine wash cold inside out. Tumble dry low. Do not bleach.',
      isActive: true,
      isFeatured: true,
      variants: [
        { sku: 'ESS-HOOD-S-BLK', size: 'S', color: 'Black', inventory: 25 },
        { sku: 'ESS-HOOD-M-BLK', size: 'M', color: 'Black', inventory: 40 },
        { sku: 'ESS-HOOD-L-BLK', size: 'L', color: 'Black', inventory: 35 },
        { sku: 'ESS-HOOD-XL-BLK', size: 'XL', color: 'Black', inventory: 20 },
      ],
    },
    {
      name: 'Vintage Washed Hoodie',
      description: 'Lived-in comfort from day one. Garment-dyed and stonewashed for a vintage feel. Unique fading on each piece.\n\n🔥 Vintage wash finish\n💫 Soft hand feel\n🎨 Each piece unique',
      slug: 'vintage-washed-hoodie',
      price: 95,
      compareAtPrice: 130,
      categoryId: createdCategories.find((c) => c.slug === 'hoodies')!.id,
      images: JSON.stringify([getPlaceholderImage('hoodie')]),
      materials: '100% Ring-spun Cotton. Garment dyed.',
      careGuide: 'Wash separately. Machine wash cold. Tumble dry low.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'VTG-HOOD-S-GRY', size: 'S', color: 'Stone Grey', inventory: 15 },
        { sku: 'VTG-HOOD-M-GRY', size: 'M', color: 'Stone Grey', inventory: 30 },
        { sku: 'VTG-HOOD-L-GRY', size: 'L', color: 'Stone Grey', inventory: 25 },
        { sku: 'VTG-HOOD-XL-GRY', size: 'XL', color: 'Stone Grey', inventory: 15 },
      ],
    },
    {
      name: 'Embroidered Script Hoodie',
      description: 'Statement piece with bold embroidered script across chest. Premium heavyweight construction with kangaroo pocket.\n\n🎯 Large embroidered script\n⚡ Heavyweight 450gsm\n🔥 Oversized kangaroo pocket',
      slug: 'embroidered-script-hoodie',
      price: 105,
      compareAtPrice: 145,
      categoryId: createdCategories.find((c) => c.slug === 'hoodies')!.id,
      images: JSON.stringify([getPlaceholderImage('hoodie')]),
      materials: '85% Cotton, 15% Polyester. Custom embroidery thread.',
      careGuide: 'Machine wash cold inside out. Do not iron over embroidery. Tumble dry low.',
      isActive: true,
      isFeatured: true,
      variants: [
        { sku: 'EMB-HOOD-S-WHT', size: 'S', color: 'Cream White', inventory: 20 },
        { sku: 'EMB-HOOD-M-WHT', size: 'M', color: 'Cream White', inventory: 35 },
        { sku: 'EMB-HOOD-L-WHT', size: 'L', color: 'Cream White', inventory: 30 },
        { sku: 'EMB-HOOD-XL-WHT', size: 'XL', color: 'Cream White', inventory: 18 },
      ],
    },

    // T-SHIRTS
    {
      name: 'Signature Logo Tee',
      description: 'The foundation of any wardrobe. Soft-hand screenprint logo on premium heavyweight tee. True to size relaxed fit.\n\n✨ 220gsm heavyweight cotton\n🎨 Soft-hand screenprint\n💯 Reinforced shoulders',
      slug: 'signature-logo-tee',
      price: 35,
      compareAtPrice: 50,
      categoryId: createdCategories.find((c) => c.slug === 'tshirts')!.id,
      images: JSON.stringify([getPlaceholderImage('tshirt')]),
      materials: '100% Premium Cotton. 220gsm.',
      careGuide: 'Machine wash cold. Tumble dry low. Do not iron directly on print.',
      isActive: true,
      isFeatured: true,
      variants: [
        { sku: 'SIG-TEE-S-BLK', size: 'S', color: 'Black', inventory: 50 },
        { sku: 'SIG-TEE-M-BLK', size: 'M', color: 'Black', inventory: 75 },
        { sku: 'SIG-TEE-L-BLK', size: 'L', color: 'Black', inventory: 60 },
        { sku: 'SIG-TEE-XL-BLK', size: 'XL', color: 'Black', inventory: 40 },
        { sku: 'SIG-TEE-XXL-BLK', size: 'XXL', color: 'Black', inventory: 25 },
      ],
    },
    {
      name: 'Oversized Graphic Tee',
      description: 'Make a statement. Oversized fit with bold front graphic. Drop shoulder construction for that perfect relaxed look.\n\n🔥 Oversized fit\n🎨 Large front graphic\n⚡ Drop shoulder seams',
      slug: 'oversized-graphic-tee',
      price: 45,
      compareAtPrice: 65,
      categoryId: createdCategories.find((c) => c.slug === 'tshirts')!.id,
      images: JSON.stringify([getPlaceholderImage('tshirt')]),
      materials: '100% Organic Cotton. 240gsm heavyweight.',
      careGuide: 'Wash inside out. Machine wash cold. Hang dry recommended.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'OVR-TEE-S-WHT', size: 'S', color: 'Off-White', inventory: 30 },
        { sku: 'OVR-TEE-M-WHT', size: 'M', color: 'Off-White', inventory: 45 },
        { sku: 'OVR-TEE-L-WHT', size: 'L', color: 'Off-White', inventory: 40 },
        { sku: 'OVR-TEE-XL-WHT', size: 'XL', color: 'Off-White', inventory: 28 },
      ],
    },
    {
      name: 'Vintage Band Tee',
      description: 'Throwback vibes. Distressed graphics with vintage wash for authentic worn-in feel. Each piece has unique character.\n\n🎸 Vintage band graphics\n💫 Distressed wash\n🔥 Each piece unique',
      slug: 'vintage-band-tee',
      price: 48,
      compareAtPrice: 68,
      categoryId: createdCategories.find((c) => c.slug === 'tshirts')!.id,
      images: JSON.stringify([getPlaceholderImage('tshirt')]),
      materials: '100% Cotton. Garment washed and distressed.',
      careGuide: 'Wash separately first time. Machine wash cold. Tumble dry low.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'VTG-TEE-S-CHR', size: 'S', color: 'Charcoal', inventory: 22 },
        { sku: 'VTG-TEE-M-CHR', size: 'M', color: 'Charcoal', inventory: 38 },
        { sku: 'VTG-TEE-L-CHR', size: 'L', color: 'Charcoal', inventory: 35 },
        { sku: 'VTG-TEE-XL-CHR', size: 'XL', color: 'Charcoal', inventory: 20 },
      ],
    },
    {
      name: 'Essential Pocket Tee',
      description: 'Simple done right. Classic chest pocket tee in premium heavyweight cotton. Versatile piece for any occasion.\n\n✨ Chest pocket detail\n💯 Heavyweight construction\n🎯 True to size fit',
      slug: 'essential-pocket-tee',
      price: 38,
      compareAtPrice: 55,
      categoryId: createdCategories.find((c) => c.slug === 'tshirts')!.id,
      images: JSON.stringify([getPlaceholderImage('tshirt')]),
      materials: '100% Premium Cotton. 210gsm.',
      careGuide: 'Machine wash cold. Tumble dry low.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'POC-TEE-S-NVY', size: 'S', color: 'Navy', inventory: 35 },
        { sku: 'POC-TEE-M-NVY', size: 'M', color: 'Navy', inventory: 50 },
        { sku: 'POC-TEE-L-NVY', size: 'L', color: 'Navy', inventory: 45 },
        { sku: 'POC-TEE-XL-NVY', size: 'XL', color: 'Navy', inventory: 30 },
      ],
    },

    // BOTTOMS
    {
      name: 'Relaxed Cargo Pants',
      description: 'Utility meets style. Relaxed fit cargo pants with multiple pockets. Adjustable drawstring waist for perfect fit.\n\n🎯 Multiple cargo pockets\n⚡ Adjustable waist\n💫 Relaxed fit',
      slug: 'relaxed-cargo-pants',
      price: 95,
      compareAtPrice: 130,
      categoryId: createdCategories.find((c) => c.slug === 'bottoms')!.id,
      images: JSON.stringify([getPlaceholderImage('pants')]),
      materials: '100% Cotton twill. Reinforced stitching.',
      careGuide: 'Machine wash cold. Tumble dry low. Iron on low if needed.',
      isActive: true,
      isFeatured: true,
      variants: [
        { sku: 'CRG-PNT-28-BLK', size: '28', color: 'Black', inventory: 15 },
        { sku: 'CRG-PNT-30-BLK', size: '30', color: 'Black', inventory: 25 },
        { sku: 'CRG-PNT-32-BLK', size: '32', color: 'Black', inventory: 30 },
        { sku: 'CRG-PNT-34-BLK', size: '34', color: 'Black', inventory: 22 },
        { sku: 'CRG-PNT-36-BLK', size: '36', color: 'Black', inventory: 18 },
      ],
    },
    {
      name: 'Essential Sweatpants',
      description: 'Maximum comfort. Premium fleece sweatpants with tapered fit. Elastic waistband and ankle cuffs.\n\n✨ Premium fleece interior\n🎯 Tapered fit\n💯 Elastic waist and cuffs',
      slug: 'essential-sweatpants',
      price: 75,
      compareAtPrice: 100,
      categoryId: createdCategories.find((c) => c.slug === 'bottoms')!.id,
      images: JSON.stringify([getPlaceholderImage('pants')]),
      materials: '80% Cotton, 20% Polyester. Brushed fleece interior.',
      careGuide: 'Machine wash cold. Tumble dry low. Do not bleach.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'SWT-PNT-S-GRY', size: 'S', color: 'Heather Grey', inventory: 30 },
        { sku: 'SWT-PNT-M-GRY', size: 'M', color: 'Heather Grey', inventory: 45 },
        { sku: 'SWT-PNT-L-GRY', size: 'L', color: 'Heather Grey', inventory: 40 },
        { sku: 'SWT-PNT-XL-GRY', size: 'XL', color: 'Heather Grey', inventory: 25 },
      ],
    },
    {
      name: 'Wide Leg Jeans',
      description: 'Modern silhouette. Wide leg denim with vintage wash. Mid-rise with button fly closure.\n\n🔥 Wide leg fit\n💫 Vintage wash\n🎨 Button fly closure',
      slug: 'wide-leg-jeans',
      price: 110,
      compareAtPrice: 150,
      categoryId: createdCategories.find((c) => c.slug === 'bottoms')!.id,
      images: JSON.stringify([getPlaceholderImage('pants')]),
      materials: '100% Cotton denim. 14oz heavyweight.',
      careGuide: 'Wash inside out. Machine wash cold. Hang dry recommended.',
      isActive: true,
      isFeatured: true,
      variants: [
        { sku: 'WID-JEN-28-IND', size: '28', color: 'Indigo', inventory: 18 },
        { sku: 'WID-JEN-30-IND', size: '30', color: 'Indigo', inventory: 28 },
        { sku: 'WID-JEN-32-IND', size: '32', color: 'Indigo', inventory: 32 },
        { sku: 'WID-JEN-34-IND', size: '34', color: 'Indigo', inventory: 24 },
      ],
    },

    // OUTERWEAR
    {
      name: 'Oversized Coach Jacket',
      description: 'Streetwear staple. Oversized coach jacket with snap button closure. Water-resistant nylon shell.\n\n⚡ Oversized fit\n💧 Water-resistant\n🎯 Snap button closure',
      slug: 'oversized-coach-jacket',
      price: 125,
      compareAtPrice: 170,
      categoryId: createdCategories.find((c) => c.slug === 'outerwear')!.id,
      images: JSON.stringify([getPlaceholderImage('hoodie')]),
      materials: '100% Nylon shell. Mesh lining. Water-resistant coating.',
      careGuide: 'Spot clean only. Do not machine wash. Do not bleach.',
      isActive: true,
      isFeatured: true,
      variants: [
        { sku: 'CCH-JKT-S-BLK', size: 'S', color: 'Black', inventory: 20 },
        { sku: 'CCH-JKT-M-BLK', size: 'M', color: 'Black', inventory: 30 },
        { sku: 'CCH-JKT-L-BLK', size: 'L', color: 'Black', inventory: 25 },
        { sku: 'CCH-JKT-XL-BLK', size: 'XL', color: 'Black', inventory: 15 },
      ],
    },
    {
      name: 'Puffer Vest',
      description: 'Layering essential. Quilted puffer vest with zippered pockets. Lightweight warmth.\n\n✨ Quilted construction\n🎯 Zip pockets\n💫 Lightweight fill',
      slug: 'puffer-vest',
      price: 95,
      compareAtPrice: 130,
      categoryId: createdCategories.find((c) => c.slug === 'outerwear')!.id,
      images: JSON.stringify([getPlaceholderImage('hoodie')]),
      materials: '100% Nylon shell. Synthetic fill. Polyester lining.',
      careGuide: 'Machine wash cold gentle cycle. Tumble dry low with tennis balls.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'PUF-VST-S-NVY', size: 'S', color: 'Navy', inventory: 25 },
        { sku: 'PUF-VST-M-NVY', size: 'M', color: 'Navy', inventory: 35 },
        { sku: 'PUF-VST-L-NVY', size: 'L', color: 'Navy', inventory: 30 },
        { sku: 'PUF-VST-XL-NVY', size: 'XL', color: 'Navy', inventory: 20 },
      ],
    },

    // ACCESSORIES
    {
      name: 'Embroidered Dad Hat',
      description: 'Classic 6-panel dad hat with embroidered logo. Adjustable strap for perfect fit.\n\n🧢 6-panel construction\n🎨 Embroidered logo\n⚡ Adjustable strap',
      slug: 'embroidered-dad-hat',
      price: 32,
      compareAtPrice: 45,
      categoryId: createdCategories.find((c) => c.slug === 'accessories')!.id,
      images: JSON.stringify([getPlaceholderImage('accessories')]),
      materials: '100% Cotton twill. Embroidered applique.',
      careGuide: 'Spot clean only. Do not machine wash.',
      isActive: true,
      isFeatured: true,
      variants: [
        { sku: 'DAD-HAT-OS-BLK', size: 'One Size', color: 'Black', inventory: 100 },
        { sku: 'DAD-HAT-OS-WHT', size: 'One Size', color: 'White', inventory: 80 },
        { sku: 'DAD-HAT-OS-NVY', size: 'One Size', color: 'Navy', inventory: 60 },
      ],
    },
    {
      name: 'Canvas Tote Bag',
      description: 'Everyday essential. Heavy-duty canvas tote with screenprinted logo. Perfect for groceries or gym.\n\n💪 Heavy-duty canvas\n🎨 Screenprinted logo\n✨ Reinforced handles',
      slug: 'canvas-tote-bag',
      price: 28,
      compareAtPrice: 40,
      categoryId: createdCategories.find((c) => c.slug === 'accessories')!.id,
      images: JSON.stringify([getPlaceholderImage('accessories')]),
      materials: '100% Heavy-duty cotton canvas. Screenprinted graphic.',
      careGuide: 'Machine wash cold. Air dry flat. Iron on reverse side.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'TOT-BAG-OS-NAT', size: 'One Size', color: 'Natural', inventory: 150 },
        { sku: 'TOT-BAG-OS-BLK', size: 'One Size', color: 'Black', inventory: 120 },
      ],
    },
    {
      name: 'Ribbed Beanie',
      description: 'Cold weather essential. Ribbed knit beanie with woven label. One size fits most.\n\n❄️ Ribbed knit\n🏷️ Woven label\n💯 Stretchy fit',
      slug: 'ribbed-beanie',
      price: 25,
      compareAtPrice: 35,
      categoryId: createdCategories.find((c) => c.slug === 'accessories')!.id,
      images: JSON.stringify([getPlaceholderImage('accessories')]),
      materials: '100% Acrylic. Ribbed knit construction.',
      careGuide: 'Hand wash cold. Lay flat to dry. Do not wring.',
      isActive: true,
      isFeatured: false,
      variants: [
        { sku: 'RIB-BEN-OS-BLK', size: 'One Size', color: 'Black', inventory: 80 },
        { sku: 'RIB-BEN-OS-GRY', size: 'One Size', color: 'Grey', inventory: 70 },
        { sku: 'RIB-BEN-OS-NVY', size: 'One Size', color: 'Navy', inventory: 60 },
      ],
    },
  ];

  // Create products with variants
  for (const productData of products) {
    const { variants, ...product } = productData;

    await prisma.product.create({
      data: {
        ...product,
        variants: {
          create: variants.map((v) => ({
            ...v,
            isActive: true,
          })),
        },
      },
    });

    console.log(`✅ Created product: ${product.name}`);
  }

  console.log(`\n🎉 Seed completed! Created ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
