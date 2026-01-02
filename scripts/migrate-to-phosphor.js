#!/usr/bin/env node

/**
 * Script to migrate from Lucide React icons to Phosphor Icons
 * 
 * This script will:
 * 1. Find all files importing from 'lucide-react'
 * 2. Map Lucide icon names to Phosphor equivalents
 * 3. Update imports
 * 4. Update icon usage (className -> size, strokeWidth -> weight)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Icon name mappings from Lucide to Phosphor
const iconMappings = {
  // Search/Navigation
  'Search': 'MagnifyingGlass',
  'Menu': 'List',
  'Home': 'House',
  'ChevronDown': 'CaretDown',
  'ChevronUp': 'CaretUp',
  'ChevronLeft': 'CaretLeft',
  'ChevronRight': 'CaretRight',
  'ArrowLeft': 'ArrowLeft',
  'ArrowRight': 'ArrowRight',
  'ArrowUp': 'ArrowUp',
  'ArrowDown': 'ArrowDown',
  'ArrowUpRight': 'ArrowUpRight',
  
  // E-commerce
  'ShoppingCart': 'ShoppingCart',
  'ShoppingBag': 'Bag',
  'Package': 'Package',
  'Truck': 'Truck',
  'DollarSign': 'CurrencyDollar',
  'Tag': 'Tag',
  
  // User/Auth
  'User': 'User',
  'Users': 'Users',
  'Lock': 'Lock',
  'Mail': 'Envelope',
  'Send': 'PaperPlaneTilt',
  
  // Actions
  'X': 'X',
  'Plus': 'Plus',
  'Minus': 'Minus',
  'Check': 'Check',
  'Trash2': 'Trash',
  'RotateCcw': 'ArrowClockwise',
  'RefreshCw': 'ArrowsClockwise',
  'Download': 'Download',
  'FileDown': 'FileArrowDown',
  
  // Notifications
  'Bell': 'Bell',
  'AlertCircle': 'Warning',
  'AlertTriangle': 'WarningTriangle',
  'CheckCircle': 'CheckCircle',
  
  // UI Elements
  'Settings': 'Gear',
  'Filter': 'Funnel',
  'SlidersHorizontal': 'Sliders',
  'Calendar': 'Calendar',
  'Clock': 'Clock',
  
  // Feedback/Status
  'Loader2': 'CircleNotch',
  'Sparkles': 'Sparkles',
  'Star': 'Star',
  'Heart': 'Heart',
  'Shield': 'Shield',
  'Crown': 'Medal',
  'Award': 'Medal',
  'Trophy': 'Trophy',
  'Target': 'Target',
  'Flame': 'Flame',
  'Zap': 'Lightning',
  
  // Analytics
  'TrendingUp': 'TrendingUp',
  'TrendingDown': 'TrendingDown',
  'BarChart3': 'ChartBar',
  
  // Files
  'FileText': 'FileText',
  'FileJson': 'File',
  
  // Loyalty/Rewards
  'Gift': 'Gift',
  'Coins': 'Coins',
  'Gem': 'Diamond',
  
  // Communication
  'MessageCircle': 'Chat',
};

// Get all TypeScript/TSX files with lucide-react imports
function findFilesWithLucideImports() {
  try {
    const result = execSync(
      'grep -r -l "from \'lucide-react\'" --include="*.tsx" --include="*.ts" .',
      { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
    );
    return result.trim().split('\n').filter(f => f && !f.includes('node_modules'));
  } catch (error) {
    console.log('No files found or error occurred');
    return [];
  }
}

// Determine if file is a server component (no 'use client' directive)
function isServerComponent(content) {
  return !content.trim().startsWith("'use client'") && !content.trim().startsWith('"use client"');
}

// Extract Lucide imports from a file
function extractLucideImports(content) {
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g;
  const matches = [...content.matchAll(importRegex)];
  
  if (matches.length === 0) return null;
  
  const imports = matches[0][1]
    .split(',')
    .map(i => i.trim())
    .filter(i => i && i !== 'LucideIcon');
  
  return imports;
}

// Map Lucide icons to Phosphor equivalents
function mapToPhosphorIcons(lucideIcons) {
  return lucideIcons.map(icon => iconMappings[icon] || icon);
}

// Update file content
function updateFileContent(filePath, content) {
  const lucideIcons = extractLucideImports(content);
  if (!lucideIcons) return content;
  
  const isServer = isServerComponent(content);
  const phosphorIcons = mapToPhosphorIcons(lucideIcons);
  
  // Update import statement
  const importPath = isServer ? '@phosphor-icons/react/dist/ssr' : '@phosphor-icons/react';
  const newImport = `import { ${phosphorIcons.join(', ')} } from '${importPath}'`;
  
  let updatedContent = content.replace(
    /import\s+{[^}]+}\s+from\s+['"]lucide-react['"]/g,
    newImport
  );
  
  // Update icon usage: className="w-X h-X" -> size={X}
  lucideIcons.forEach((lucideIcon, index) => {
    const phosphorIcon = phosphorIcons[index];
    if (lucideIcon !== phosphorIcon) {
      // Replace icon name
      const iconRegex = new RegExp(`<${lucideIcon}\\b`, 'g');
      updatedContent = updatedContent.replace(iconRegex, `<${phosphorIcon}`);
    }
  });
  
  // Update common prop patterns
  // className="w-4 h-4" -> size={16}
  updatedContent = updatedContent.replace(/className="w-3 h-3"/g, 'size={12}');
  updatedContent = updatedContent.replace(/className="w-4 h-4"/g, 'size={16}');
  updatedContent = updatedContent.replace(/className="w-5 h-5"/g, 'size={20}');
  updatedContent = updatedContent.replace(/className="w-6 h-6"/g, 'size={24}');
  updatedContent = updatedContent.replace(/className="w-8 h-8"/g, 'size={32}');
  updatedContent = updatedContent.replace(/className="w-10 h-10"/g, 'size={40}');
  updatedContent = updatedContent.replace(/className="w-12 h-12"/g, 'size={48}');
  updatedContent = updatedContent.replace(/className="w-16 h-16"/g, 'size={64}');
  updatedContent = updatedContent.replace(/className="w-20 h-20"/g, 'size={80}');
  updatedContent = updatedContent.replace(/className="w-24 h-24"/g, 'size={96}');
  
  // strokeWidth={1} -> weight="thin"
  // strokeWidth={1.5} -> weight="light"
  // strokeWidth={2} -> weight="regular"
  updatedContent = updatedContent.replace(/strokeWidth=\{1\.5\}/g, 'weight="light"');
  updatedContent = updatedContent.replace(/strokeWidth=\{1\}/g, 'weight="thin"');
  updatedContent = updatedContent.replace(/strokeWidth=\{2\}/g, 'weight="regular"');
  
  return updatedContent;
}

// Main execution
console.log('🔍 Finding files with Lucide React imports...');
const files = findFilesWithLucideImports();
console.log(`📁 Found ${files.length} files to migrate\n`);

let successCount = 0;
let errorCount = 0;

files.forEach(file => {
  try {
    const fullPath = path.join(__dirname, '..', file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const updatedContent = updateFileContent(file, content);
    
    if (content !== updatedContent) {
      fs.writeFileSync(fullPath, updatedContent, 'utf-8');
      console.log(`✅ ${file}`);
      successCount++;
    } else {
      console.log(`⏭️  ${file} (no changes needed)`);
    }
  } catch (error) {
    console.error(`❌ ${file}: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n📊 Migration complete:`);
console.log(`   ✅ ${successCount} files updated`);
console.log(`   ❌ ${errorCount} files failed`);
console.log(`\n⚠️  Note: Manual review required for:`);
console.log(`   - Complex icon usage patterns`);
console.log(`   - Icons with multiple className props`);
console.log(`   - Custom size/weight combinations`);
