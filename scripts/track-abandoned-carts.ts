#!/usr/bin/env tsx

/**
 * Manually trigger abandoned cart tracking for testing
 * Usage: npx tsx scripts/track-abandoned-carts.ts
 */

async function trackAbandonedCarts() {
  try {
    const response = await fetch('http://localhost:3000/api/cron/track-abandoned-carts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-secret-123',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Success:', result);
    console.log(`\n📊 Processed ${result.cartsProcessed} carts, created ${result.created} new records`);
  } catch (error) {
    console.error('❌ Failed to track abandoned carts:', error);
    process.exit(1);
  }
}

console.log('🔍 Tracking abandoned carts...\n');
trackAbandonedCarts();
