#!/usr/bin/env node

/**
 * Automated Icon Migration Script: Lucide React → Phosphor Icons
 * 
 * This script automatically migrates all Lucide React icons to Phosphor Icons
 * across the entire codebase, except for WishlistIcon which should remain unchanged.
 * 
 * Usage:
 *   node scripts/migrate-icons-to-phosphor.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be changed without making actual changes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Icon mapping: Lucide → Phosphor
const ICON_MAPPING = {
  // Navigation & UI
  'Search': 'MagnifyingGlass',
  'Menu': 'List',
  'Home': 'House',
  'ChevronLeft': 'CaretLeft',
  'ChevronRight': 'CaretRight',
  'ChevronDown': 'CaretDown',
  'ChevronUp': 'CaretUp',
  'X': 'X',
  
  // Shopping
  'ShoppingBag': 'Bag',
  'ShoppingCart': 'ShoppingCart',
  'Package': 'Package',
  'Trash2': 'Trash',
  'Heart': 'Heart',
  
  // Actions & Status
  'Plus': 'Plus',
  'Minus': 'Minus',
  'Check': 'Check',
  'Loader2': 'CircleNotch',
  'RotateCcw': 'ArrowClockwise',
  'RefreshCw': 'ArrowClockwise',
  'ArrowLeft': 'ArrowLeft',
  'ArrowRight': 'ArrowRight',
  'ArrowUp': 'ArrowUp',
  'ArrowDown': 'ArrowDown',
  'ArrowUpRight': 'ArrowUpRight',
  
  // Feedback & Alerts
  'AlertCircle': 'Warning',
  'AlertTriangle': 'Warning',
  'CheckCircle': 'CheckCircle',
  'CheckCircle2': 'CheckCircle',
  'XCircle': 'XCircle',
  
  // User & Account
  'User': 'User',
  'UserPlus': 'UserPlus',
  'Users': 'Users',
  'LogIn': 'SignIn',
  'LogOut': 'SignOut',
  
  // Communication
  'Mail': 'EnvelopeSimple',
  'MessageCircle': 'ChatCircle',
  'MessageSquare': 'ChatText',
  'Send': 'PaperPlaneTilt',
  'Bell': 'Bell',
  
  // Media & Files
  'Image': 'Image',
  'FileText': 'FileText',
  'FileJson': 'FileJs',
  'Download': 'Download',
  'FileDown': 'FileArrowDown',
  
  // Business & Commerce
  'DollarSign': 'CurrencyDollar',
  'CreditCard': 'CreditCard',
  'Target': 'Target',
  'TrendingUp': 'TrendingUp',
  'TrendingDown': 'TrendingDown',
  'BarChart3': 'ChartBar',
  
  // Location & Navigation
  'MapPin': 'MapPin',
  'Truck': 'Truck',
  'Clock': 'Clock',
  'Calendar': 'Calendar',
  
  // Social & Sharing
  'Share2': 'ShareNetwork',
  'Instagram': 'InstagramLogo',
  'Twitter': 'TwitterLogo',
  'Facebook': 'FacebookLogo',
  
  // UI Elements
  'Lock': 'Lock',
  'Eye': 'Eye',
  'EyeOff': 'EyeSlash',
  'Settings': 'Gear',
  'Filter': 'Funnel',
  'SlidersHorizontal': 'Faders',
  'Star': 'Star',
  'Crown': 'Crown',
  'Award': 'Medal',
  'Trophy': 'Trophy',
  'Gift': 'Gift',
  'Sparkles': 'Sparkles',
  'Zap': 'Lightning',
  'Flame': 'Flame',
  'Shield': 'Shield',
  'LayoutDashboard': 'SquaresFour',
  'Wallet': 'Wallet',
  'ThumbsUp': 'ThumbsUp',
  'ThumbsDown': 'ThumbsDown',
  'ArrowUpDown': 'ArrowsDownUp',
  
  // Special
  'Coins': 'Coins',
  'Gem': 'Diamond',
  'GripVertical': 'DotsSixVertical',
  'Edit': 'PencilSimple',
  'Trash': 'Trash',
  'Flag': 'Flag',
  'Minus': 'Minus',
  'Phone': 'Phone',
  'Tag': 'Tag',
  'Save': 'FloppyDisk',
  'ExternalLink': 'ArrowSquareOut',
};

// Size conversion: Tailwind classes → numeric pixels
const SIZE_CONVERSIONS = {
  'w-3 h-3': 12,
  'w-4 h-4': 16,
  'w-5 h-5': 20,
  'w-6 h-6': 24,
  'w-8 h-8': 32,
  'w-10 h-10': 40,
  'w-12 h-12': 48,
  'w-16 h-16': 64,
  'w-20 h-20': 80,
  'w-24 h-24': 96,
};

// Weight conversion
const WEIGHT_CONVERSIONS = {
  'strokeWidth={1}': 'weight="thin"',
  'strokeWidth={1.5}': 'weight="light"',
  'strokeWidth={2}': 'weight="regular"',
  // Default to bold if no strokeWidth specified
};

const dryRun = process.argv.includes('--dry-run');
let filesModified = 0;
let filesSkipped = 0;
const errors = [];

console.log('🚀 Starting Lucide → Phosphor Icons Migration');
console.log(dryRun ? '📝 DRY RUN MODE - No files will be modified\n' : '');

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
  // Skip node_modules, .next, etc.
  if (filePath.includes('node_modules') || 
      filePath.includes('.next') || 
      filePath.includes('dist') ||
      filePath.includes('.git')) {
    return false;
  }
  
  // Only process .tsx, .ts, .jsx, .js files
  return /\.(tsx?|jsx?)$/.test(filePath);
}

/**
 * Check if file contains WishlistIcon (should be skipped)
 */
function containsWishlistIcon(content) {
  return content.includes('WishlistIcon') || content.includes('wishlist-icon');
}

/**
 * Migrate import statement
 */
function migrateImport(content, isServerComponent) {
  // Check if file has lucide-react import
  const lucideImportRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g;
  const matches = [...content.matchAll(lucideImportRegex)];
  
  if (matches.length === 0) return content;
  
  let newContent = content;
  
  for (const match of matches) {
    const importedIcons = match[1]
      .split(',')
      .map(icon => icon.trim())
      .filter(icon => icon !== 'LucideIcon'); // Skip type imports
    
    const phosphorIcons = importedIcons
      .map(icon => {
        const phosphorName = ICON_MAPPING[icon];
        if (!phosphorName) {
          console.warn(`  ⚠️  No mapping found for icon: ${icon}`);
          return icon;
        }
        return phosphorName;
      })
      .filter(Boolean);
    
    if (phosphorIcons.length > 0) {
      const phosphorPath = isServerComponent 
        ? '@phosphor-icons/react/dist/ssr'
        : '@phosphor-icons/react';
      
      const newImport = `import { ${phosphorIcons.join(', ')} } from '${phosphorPath}'`;
      newContent = newContent.replace(match[0], newImport);
    } else {
      // Remove the import if no icons to import
      newContent = newContent.replace(match[0], '');
    }
  }
  
  return newContent;
}

/**
 * Migrate icon usage in JSX
 */
function migrateIconUsage(content) {
  let newContent = content;
  
  // Pattern: <IconName className="..." />
  for (const [lucideIcon, phosphorIcon] of Object.entries(ICON_MAPPING)) {
    // Match: <IconName className="w-X h-X ..." />
    const classNameRegex = new RegExp(
      `<${lucideIcon}\\s+className="([^"]*)"\\s*/?>`,
      'g'
    );
    
    newContent = newContent.replace(classNameRegex, (match, className) => {
      // Extract size from className
      let size = 24; // default
      for (const [twClass, pixels] of Object.entries(SIZE_CONVERSIONS)) {
        if (className.includes(twClass)) {
          size = pixels;
          // Remove size classes from className
          className = className.replace(twClass, '').trim();
          break;
        }
      }
      
      // Determine weight (default to bold for most UI icons)
      let weight = 'bold';
      if (className.includes('font-light') || lucideIcon === 'Sparkles') {
        weight = 'fill';
      }
      
      // Build new icon element
      const classNameAttr = className ? ` className="${className}"` : '';
      return `<${phosphorIcon} size={${size}} weight="${weight}"${classNameAttr} />`;
    });
    
    // Match: <IconName /> (no className)
    const simpleRegex = new RegExp(`<${lucideIcon}\\s*/>`, 'g');
    newContent = newContent.replace(simpleRegex, 
      `<${phosphorIcon} size={24} weight="bold" />`
    );
  }
  
  return newContent;
}

/**
 * Check if file is a server component
 */
function isServerComponent(content) {
  // Client components have 'use client' directive
  return !content.includes("'use client'") && !content.includes('"use client"');
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if no lucide-react import
    if (!content.includes('lucide-react')) {
      return false;
    }
    
    // Skip files with WishlistIcon
    if (containsWishlistIcon(content)) {
      console.log(`  ⏭️  Skipped (contains WishlistIcon): ${filePath}`);
      filesSkipped++;
      return false;
    }
    
    const isServer = isServerComponent(content);
    let newContent = content;
    
    // Step 1: Migrate import
    newContent = migrateImport(newContent, isServer);
    
    // Step 2: Migrate icon usage
    newContent = migrateIconUsage(newContent);
    
    // Check if content changed
    if (newContent !== content) {
      if (!dryRun) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
      console.log(`  ✅ Migrated: ${filePath}`);
      filesModified++;
      return true;
    }
    
    return false;
  } catch (error) {
    errors.push({ file: filePath, error: error.message });
    console.error(`  ❌ Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Recursively find and process all files
 */
function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && shouldProcessFile(fullPath)) {
      processFile(fullPath);
    }
  }
}

/**
 * Main execution
 */
function main() {
  const projectRoot = path.resolve(__dirname, '..');
  
  console.log('📂 Processing directories:');
  console.log('  - app/');
  console.log('  - components/');
  console.log('');
  
  // Process main directories
  const dirsToProcess = [
    path.join(projectRoot, 'app'),
    path.join(projectRoot, 'components'),
  ];
  
  for (const dir of dirsToProcess) {
    if (fs.existsSync(dir)) {
      processDirectory(dir);
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`  ✅ Files modified: ${filesModified}`);
  console.log(`  ⏭️  Files skipped: ${filesSkipped}`);
  console.log(`  ❌ Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }
  
  if (dryRun) {
    console.log('\n📝 DRY RUN complete - no files were modified');
    console.log('   Run without --dry-run to apply changes');
  } else {
    console.log('\n✨ Migration complete!');
    console.log('\n📋 Next steps:');
    console.log('  1. Run: npm run build');
    console.log('  2. Check for any TypeScript errors');
    console.log('  3. Test critical pages visually');
    console.log('  4. Search for any remaining: grep -r "lucide-react" app/ components/');
  }
}

// Run the script
main();
