#!/bin/bash

# Script to manually mark pending orders as PAID
# Use this to fix old orders that were created before webhook was set up

echo "🔍 Finding orders with PENDING payment status..."

# Count pending orders
PENDING_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM orders WHERE paymentStatus = 'PENDING';")
echo "Found $PENDING_COUNT orders with PENDING payment status"

if [ "$PENDING_COUNT" -eq 0 ]; then
    echo "✅ No pending orders to update"
    exit 0
fi

echo ""
echo "📋 Orders that will be updated:"
sqlite3 -header -column prisma/dev.db "SELECT orderNumber, status, createdAt FROM orders WHERE paymentStatus = 'PENDING';"

echo ""
read -p "⚠️  Do you want to mark these orders as PAID? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Operation cancelled"
    exit 0
fi

echo ""
echo "💳 Updating payment status to PAID..."

# Update all PENDING orders to PAID
sqlite3 prisma/dev.db "UPDATE orders SET paymentStatus = 'PAID' WHERE paymentStatus = 'PENDING';"

# Verify update
UPDATED_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM orders WHERE paymentStatus = 'PAID';")

echo "✅ Updated! Total PAID orders: $UPDATED_COUNT"
echo ""
echo "📊 Current payment status distribution:"
sqlite3 -header -column prisma/dev.db "SELECT paymentStatus, COUNT(*) as count FROM orders GROUP BY paymentStatus;"
