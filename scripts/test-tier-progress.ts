/**
 * Test script to verify tier progress calculations
 * Now based on annual points earned (not spend)
 */

import { calculateTierProgress, TIER_HIERARCHY } from '../lib/loyalty/tier-progress'

console.log('\n🧪 Testing Tier Progress Calculations\n')
console.log('━'.repeat(60))

// Test scenarios - now using points instead of spend
const testCases = [
  { tier: 'head', points: 0, description: 'New customer (Head tier, 0 points)' },
  { tier: 'head', points: 50, description: 'Head tier, 50 points earned' },
  { tier: 'head', points: 125, description: 'Head tier, 125 points earned' },
  { tier: 'head', points: 199, description: 'Head tier, 199 points (almost Heart)' },
  { tier: 'heart', points: 200, description: 'Just reached Heart tier' },
  { tier: 'heart', points: 350, description: 'Heart tier, halfway to Mind' },
  { tier: 'mind', points: 500, description: 'Just reached Mind tier' },
  { tier: 'overdrive', points: 2000, description: 'Max tier (Overdrive)' },
  { tier: 'overdrive', points: 5000, description: 'Max tier with many points' },
]

console.log('\n📊 Tier Hierarchy:')
TIER_HIERARCHY.forEach((tier, index) => {
  console.log(`${index + 1}. ${tier.name}: ${tier.minAnnualPoints}+ points/year (${tier.pointMultiplier}x multiplier)`)
})

console.log('\n' + '━'.repeat(60))
console.log('\n🧮 Test Cases:\n')

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.description}`)
  console.log('─'.repeat(60))
  
  const progress = calculateTierProgress(testCase.tier, testCase.points)
  
  console.log(`Current Tier: ${progress.currentTier.name}`)
  console.log(`Points Earned This Year: ${progress.currentPointsEarned.toLocaleString()}`)
  
  if (progress.isMaxTier) {
    console.log('Status: 🎉 MAX TIER REACHED!')
  } else {
    console.log(`Next Tier: ${progress.nextTier?.name}`)
    console.log(`Progress: ${progress.progressPercentage.toFixed(2)}%`)
    console.log(`Points Needed: ${progress.pointsNeeded.toLocaleString()}`)
    
    // Visual progress bar
    const barLength = 40
    const filled = Math.round((progress.progressPercentage / 100) * barLength)
    const empty = barLength - filled
    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    console.log(`[${bar}] ${progress.progressPercentage.toFixed(1)}%`)
  }
})

console.log('\n' + '━'.repeat(60))

// Test edge cases
console.log('\n🔍 Edge Case Tests:\n')

console.log('1. Testing with undefined annualPointsEarned:')
const undefinedTest = calculateTierProgress('head', undefined as any)
console.log(`   Result: ${undefinedTest.pointsNeeded.toLocaleString()} points needed (should be 200)`)
console.log(`   Status: ${isNaN(undefinedTest.pointsNeeded) ? '❌ FAIL' : '✅ PASS'}`)

console.log('\n2. Testing with null annualPointsEarned:')
const nullTest = calculateTierProgress('head', null as any)
console.log(`   Result: ${nullTest.pointsNeeded.toLocaleString()} points needed (should be 200)`)
console.log(`   Status: ${isNaN(nullTest.pointsNeeded) ? '❌ FAIL' : '✅ PASS'}`)

console.log('\n3. Testing with NaN annualPointsEarned:')
const nanTest = calculateTierProgress('head', NaN)
console.log(`   Result: ${nanTest.pointsNeeded.toLocaleString()} points needed (should be 200)`)
console.log(`   Status: ${isNaN(nanTest.pointsNeeded) ? '❌ FAIL' : '✅ PASS'}`)

console.log('\n4. Testing with negative annualPointsEarned:')
const negativeTest = calculateTierProgress('head', -100)
console.log(`   Result: ${negativeTest.pointsNeeded.toLocaleString()} points needed (should be 200)`)
console.log(`   Status: ${isNaN(negativeTest.pointsNeeded) ? '❌ FAIL' : '✅ PASS'}`)

console.log('\n5. Testing with invalid tier slug:')
const invalidTierTest = calculateTierProgress('invalid-tier', 100)
console.log(`   Tier: ${invalidTierTest.currentTier.name} (should default to Head)`)
console.log(`   Status: ${invalidTierTest.currentTier.slug === 'head' ? '✅ PASS' : '❌ FAIL'}`)

console.log('\n' + '━'.repeat(60))
console.log('\n✅ All tier progress calculations complete!\n')
