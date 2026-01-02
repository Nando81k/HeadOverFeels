#!/bin/bash

# Fix all gradient class names to match Tailwind 4 conventions
# bg-gradient-to-* → bg-linear-to-*

echo "🔍 Finding files with gradient classes..."

# Find all TypeScript and TSX files
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.md" \) ! -path "./node_modules/*" ! -path "./.next/*" | while read file; do
  if grep -q "bg-gradient-to-" "$file"; then
    echo "📝 Fixing $file"
    
    # Replace all gradient-to variants with linear-to
    sed -i '' 's/bg-gradient-to-r/bg-linear-to-r/g' "$file"
    sed -i '' 's/bg-gradient-to-l/bg-linear-to-l/g' "$file"
    sed -i '' 's/bg-gradient-to-t/bg-linear-to-t/g' "$file"
    sed -i '' 's/bg-gradient-to-b/bg-linear-to-b/g' "$file"
    sed -i '' 's/bg-gradient-to-tr/bg-linear-to-tr/g' "$file"
    sed -i '' 's/bg-gradient-to-tl/bg-linear-to-tl/g' "$file"
    sed -i '' 's/bg-gradient-to-br/bg-linear-to-br/g' "$file"
    sed -i '' 's/bg-gradient-to-bl/bg-linear-to-bl/g' "$file"
    
    # Also fix hover variants
    sed -i '' 's/hover:bg-gradient-to-r/hover:bg-linear-to-r/g' "$file"
    sed -i '' 's/hover:bg-gradient-to-l/hover:bg-linear-to-l/g' "$file"
    sed -i '' 's/hover:bg-gradient-to-t/hover:bg-linear-to-t/g' "$file"
    sed -i '' 's/hover:bg-gradient-to-b/hover:bg-linear-to-b/g' "$file"
    sed -i '' 's/hover:bg-gradient-to-tr/hover:bg-linear-to-tr/g' "$file"
    sed -i '' 's/hover:bg-gradient-to-tl/hover:bg-linear-to-tl/g' "$file"
    sed -i '' 's/hover:bg-gradient-to-br/hover:bg-linear-to-br/g' "$file"
    sed -i '' 's/hover:bg-gradient-to-bl/hover:bg-linear-to-bl/g' "$file"
  fi
done

echo "✅ All gradient classes updated!"
