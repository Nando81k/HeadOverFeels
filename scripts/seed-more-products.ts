// Script to add more products to each category
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding more products to each category...\n');

  // Get all categories
  const categories = await prisma.category.findMany();
  console.log(`Found ${categories.length} categories\n`);

  const hoodiesCategory = categories.find(c => c.slug === 'hoodies');
  const tshirtsCategory = categories.find(c => c.slug === 'tshirts');
  const bottomsCategory = categories.find(c => c.slug === 'bottoms');
  const outerwearCategory = categories.find(c => c.slug === 'outerwear');
  const accessoriesCategory = categories.find(c => c.slug === 'accessories');
  const headwearCategory = categories.find(c => c.slug === 'headwear');
  const footwearCategory = categories.find(c => c.slug === 'footwear');

  // New Hoodies (10 items)
  const newHoodies = [
    { name: 'Midnight Black Zip Hoodie', slug: 'midnight-black-zip-hoodie', price: 89, description: 'Full zip hoodie with premium black finish. Perfect for layering.' },
    { name: 'Graffiti Art Hoodie', slug: 'graffiti-art-hoodie', price: 95, description: 'Street art inspired graphic hoodie. Bold and expressive.' },
    { name: 'Tokyo Nights Hoodie', slug: 'tokyo-nights-hoodie', price: 98, description: 'Japanese-inspired design with neon accents. Urban edge.' },
    { name: 'Cropped Box Hoodie', slug: 'cropped-box-hoodie', price: 78, description: 'Cropped boxy fit for modern streetwear look.' },
    { name: 'Heavyweight Champion Hoodie', slug: 'heavyweight-champion-hoodie', price: 115, description: '500gsm ultra-heavyweight hoodie. Maximum warmth.' },
    { name: 'Acid Wash Distressed Hoodie', slug: 'acid-wash-distressed-hoodie', price: 105, description: 'Unique acid wash treatment on every piece.' },
    { name: 'Split Colorblock Hoodie', slug: 'split-colorblock-hoodie', price: 92, description: 'Two-tone split design. Stand out from the crowd.' },
    { name: 'Reflective Logo Hoodie', slug: 'reflective-logo-hoodie', price: 88, description: '3M reflective logo that glows in low light.' },
    { name: 'Sherpa Lined Hoodie', slug: 'sherpa-lined-hoodie', price: 125, description: 'Cozy sherpa fleece interior for ultimate comfort.' },
    { name: 'Embossed Logo Hoodie', slug: 'embossed-logo-hoodie', price: 82, description: 'Subtle embossed logo on chest. Minimalist style.' },
  ];

  // New T-Shirts (10 items)
  const newTshirts = [
    { name: 'Boxy Crop Tee', slug: 'boxy-crop-tee', price: 38, description: 'Cropped boxy fit tee. Perfect for high-waisted looks.' },
    { name: 'Long Sleeve Essential Tee', slug: 'long-sleeve-essential-tee', price: 45, description: 'Long sleeve version of our signature tee.' },
    { name: 'Mesh Panel Tee', slug: 'mesh-panel-tee', price: 52, description: 'Breathable mesh panel details. Athletic inspired.' },
    { name: 'Tie-Dye Spiral Tee', slug: 'tie-dye-spiral-tee', price: 48, description: 'Hand-dyed spiral pattern. Each piece unique.' },
    { name: 'Cut & Sew Panel Tee', slug: 'cut-sew-panel-tee', price: 55, description: 'Multi-panel construction for unique look.' },
    { name: 'Raw Edge Muscle Tee', slug: 'raw-edge-muscle-tee', price: 42, description: 'Sleeveless with raw cut edges. Gym ready.' },
    { name: 'Gradient Wash Tee', slug: 'gradient-wash-tee', price: 46, description: 'Beautiful gradient color fade effect.' },
    { name: 'Baseball Raglan Tee', slug: 'baseball-raglan-tee', price: 44, description: 'Classic raglan sleeves in contrast color.' },
    { name: 'Heavyweight Boxy Tee', slug: 'heavyweight-boxy-tee', price: 58, description: '280gsm heavyweight with boxy silhouette.' },
    { name: 'Double Layer Mesh Tee', slug: 'double-layer-mesh-tee', price: 62, description: 'Layered mesh construction. High fashion streetwear.' },
  ];

  // New Bottoms (10 items)
  const newBottoms = [
    { name: 'Parachute Cargo Pants', slug: 'parachute-cargo-pants', price: 98, description: 'Trendy parachute style with adjustable legs.' },
    { name: 'Baggy Skate Jeans', slug: 'baggy-skate-jeans', price: 105, description: 'Extra wide leg jeans. Skater approved.' },
    { name: 'Tech Fleece Joggers', slug: 'tech-fleece-joggers', price: 85, description: 'Premium tech fleece with zippered pockets.' },
    { name: 'Carpenter Work Pants', slug: 'carpenter-work-pants', price: 92, description: 'Utility carpenter pants with hammer loop.' },
    { name: 'Mesh Basketball Shorts', slug: 'mesh-basketball-shorts', price: 55, description: 'Breathable mesh shorts with side stripes.' },
    { name: 'Corduroy Wide Leg Pants', slug: 'corduroy-wide-leg-pants', price: 88, description: 'Retro corduroy in modern wide leg cut.' },
    { name: 'Ripstop Utility Shorts', slug: 'ripstop-utility-shorts', price: 65, description: 'Durable ripstop fabric with cargo pockets.' },
    { name: 'Pleated Trouser Pants', slug: 'pleated-trouser-pants', price: 110, description: 'Elevated streetwear with pleated front.' },
    { name: 'Drawstring Linen Pants', slug: 'drawstring-linen-pants', price: 78, description: 'Lightweight linen blend for summer.' },
    { name: 'Stacked Flare Sweatpants', slug: 'stacked-flare-sweatpants', price: 82, description: 'Flared leg with stacked bottom. Y2K vibes.' },
  ];

  // New Outerwear (10 items)
  const newOuterwear = [
    { name: 'Varsity Letterman Jacket', slug: 'varsity-letterman-jacket', price: 165, description: 'Classic varsity jacket with leather sleeves.' },
    { name: 'Cropped Puffer Jacket', slug: 'cropped-puffer-jacket', price: 145, description: 'Cropped length puffer for streetwear styling.' },
    { name: 'Denim Trucker Jacket', slug: 'denim-trucker-jacket', price: 125, description: 'Vintage wash denim with sherpa collar option.' },
    { name: 'Windbreaker Anorak', slug: 'windbreaker-anorak', price: 98, description: 'Half-zip anorak with front pouch pocket.' },
    { name: 'Quilted Shirt Jacket', slug: 'quilted-shirt-jacket', price: 135, description: 'Lightweight quilted overshirt. Layer essential.' },
    { name: 'Fleece Full Zip Jacket', slug: 'fleece-full-zip-jacket', price: 88, description: 'Cozy polar fleece with contrast zipper.' },
    { name: 'Bomber Jacket MA-1', slug: 'bomber-jacket-ma1', price: 155, description: 'Military inspired MA-1 bomber. Orange lining.' },
    { name: 'Raincoat Trench', slug: 'raincoat-trench', price: 175, description: 'Waterproof trench coat. Stay dry in style.' },
    { name: 'Corduroy Overshirt', slug: 'corduroy-overshirt', price: 95, description: 'Thick corduroy shirt jacket for layering.' },
    { name: 'Track Jacket Retro', slug: 'track-jacket-retro', price: 85, description: '90s inspired track jacket with side stripes.' },
  ];

  // New Accessories (10 items)
  const newAccessories = [
    { name: 'Crossbody Shoulder Bag', slug: 'crossbody-shoulder-bag', price: 48, description: 'Compact crossbody bag for essentials.' },
    { name: 'Chain Link Necklace', slug: 'chain-link-necklace', price: 35, description: 'Chunky chain necklace. Stainless steel.' },
    { name: 'Embroidered Socks 3-Pack', slug: 'embroidered-socks-3pack', price: 28, description: 'Logo socks in 3 colorways.' },
    { name: 'Leather Belt Logo Buckle', slug: 'leather-belt-logo-buckle', price: 55, description: 'Premium leather with custom buckle.' },
    { name: 'Woven Lanyard Keychain', slug: 'woven-lanyard-keychain', price: 18, description: 'Woven lanyard with metal clip.' },
    { name: 'Knit Scarf Oversized', slug: 'knit-scarf-oversized', price: 45, description: 'Chunky knit oversized scarf.' },
    { name: 'Phone Crossbody Pouch', slug: 'phone-crossbody-pouch', price: 32, description: 'Hands-free phone carrier with strap.' },
    { name: 'Enamel Pin Set', slug: 'enamel-pin-set', price: 22, description: 'Collectible enamel pins. Set of 4.' },
    { name: 'Bandana Print Set', slug: 'bandana-print-set', price: 24, description: 'Classic bandanas in 2-pack.' },
    { name: 'Duffle Weekender Bag', slug: 'duffle-weekender-bag', price: 85, description: 'Large duffle for travel or gym.' },
  ];

  // New Headwear (10 items)
  const newHeadwear = [
    { name: 'Snapback Flat Brim Cap', slug: 'snapback-flat-brim-cap', price: 35, description: 'Classic snapback with flat brim.' },
    { name: 'Bucket Hat Reversible', slug: 'bucket-hat-reversible', price: 38, description: 'Two looks in one. Reversible bucket hat.' },
    { name: 'Trucker Mesh Cap', slug: 'trucker-mesh-cap', price: 32, description: 'Breathable mesh back trucker style.' },
    { name: 'Cuffed Beanie Logo', slug: 'cuffed-beanie-logo', price: 28, description: 'Cuffed beanie with woven logo patch.' },
    { name: 'Corduroy 5-Panel Cap', slug: 'corduroy-5panel-cap', price: 36, description: 'Soft corduroy in 5-panel construction.' },
    { name: 'Balaclava Face Mask', slug: 'balaclava-face-mask', price: 42, description: 'Full face coverage for cold weather.' },
    { name: 'Visor Sun Cap', slug: 'visor-sun-cap', price: 25, description: 'Open top visor for sunny days.' },
    { name: 'Newsboy Baker Cap', slug: 'newsboy-baker-cap', price: 45, description: 'Vintage newsboy style. Wool blend.' },
    { name: 'Fitted Baseball Cap', slug: 'fitted-baseball-cap', price: 38, description: 'Structured fitted cap. Multiple sizes.' },
    { name: 'Slouchy Beanie Oversized', slug: 'slouchy-beanie-oversized', price: 30, description: 'Relaxed slouchy fit beanie.' },
  ];

  // New Footwear (10 items)
  const newFootwear = [
    { name: 'Canvas High Top Sneakers', slug: 'canvas-high-top-sneakers', price: 75, description: 'Classic canvas high tops with logo.' },
    { name: 'Leather Low Top Sneakers', slug: 'leather-low-top-sneakers', price: 95, description: 'Premium leather low top shoes.' },
    { name: 'Platform Chunky Sneakers', slug: 'platform-chunky-sneakers', price: 125, description: 'Elevated chunky sole platform shoes.' },
    { name: 'Suede Skate Shoes', slug: 'suede-skate-shoes', price: 85, description: 'Durable suede for skating. Vulcanized sole.' },
    { name: 'Slip-On Canvas Shoes', slug: 'slip-on-canvas-shoes', price: 55, description: 'Easy slip-on style. Elastic sides.' },
    { name: 'Chelsea Boots Leather', slug: 'chelsea-boots-leather', price: 145, description: 'Classic chelsea boot in smooth leather.' },
    { name: 'Combat Boots Lace Up', slug: 'combat-boots-lace-up', price: 135, description: 'Military inspired combat boots.' },
    { name: 'Running Sneakers Mesh', slug: 'running-sneakers-mesh', price: 98, description: 'Breathable mesh runners. Lightweight.' },
    { name: 'Slide Sandals Logo', slug: 'slide-sandals-logo', price: 45, description: 'Comfortable slides with embossed logo.' },
    { name: 'Mule Clogs Leather', slug: 'mule-clogs-leather', price: 88, description: 'Trendy mule style with leather upper.' },
  ];

  // Helper function to create products
  const createProducts = async (products: any[], categoryId: string | undefined, categoryName: string) => {
    if (!categoryId) {
      console.log(`⚠️  Category "${categoryName}" not found, skipping...`);
      return 0;
    }

    let created = 0;
    for (const product of products) {
      try {
        // Check if product already exists
        const existing = await prisma.product.findUnique({
          where: { slug: product.slug }
        });

        if (existing) {
          console.log(`  ⊘ ${product.name} (already exists)`);
          continue;
        }

        await prisma.product.create({
          data: {
            name: product.name,
            slug: product.slug,
            price: product.price,
            description: product.description,
            categoryId: categoryId,
            images: '[]',
            isActive: true,
            isFeatured: false,
            variants: {
              create: [
                { sku: `${product.slug}-s`, size: 'S', color: 'Black', inventory: 20, isActive: true },
                { sku: `${product.slug}-m`, size: 'M', color: 'Black', inventory: 30, isActive: true },
                { sku: `${product.slug}-l`, size: 'L', color: 'Black', inventory: 25, isActive: true },
                { sku: `${product.slug}-xl`, size: 'XL', color: 'Black', inventory: 15, isActive: true },
              ]
            }
          }
        });
        console.log(`  ✓ ${product.name}`);
        created++;
      } catch (error) {
        console.log(`  ✗ ${product.name}: ${error}`);
      }
    }
    return created;
  };

  // Create all products
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📦 HOODIES & SWEATSHIRTS:');
  const hoodiesCreated = await createProducts(newHoodies, hoodiesCategory?.id, 'hoodies');

  console.log('\n👕 T-SHIRTS:');
  const tshirtsCreated = await createProducts(newTshirts, tshirtsCategory?.id, 'tshirts');

  console.log('\n👖 BOTTOMS:');
  const bottomsCreated = await createProducts(newBottoms, bottomsCategory?.id, 'bottoms');

  console.log('\n🧥 OUTERWEAR:');
  const outerwearCreated = await createProducts(newOuterwear, outerwearCategory?.id, 'outerwear');

  console.log('\n🎒 ACCESSORIES:');
  const accessoriesCreated = await createProducts(newAccessories, accessoriesCategory?.id, 'accessories');

  console.log('\n🧢 HEADWEAR:');
  const headwearCreated = await createProducts(newHeadwear, headwearCategory?.id, 'headwear');

  console.log('\n👟 FOOTWEAR:');
  const footwearCreated = await createProducts(newFootwear, footwearCategory?.id, 'footwear');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const total = hoodiesCreated + tshirtsCreated + bottomsCreated + outerwearCreated + accessoriesCreated + headwearCreated + footwearCreated;
  console.log(`\n🎉 Done! Created ${total} new products.`);

  // Show final counts
  const productCount = await prisma.product.count();
  console.log(`📊 Total products in database: ${productCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
