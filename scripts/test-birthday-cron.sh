#!/bin/bash

# Birthday Points Cron Test Script
# This script helps you test the birthday points automation locally

echo "🎂 Testing Birthday Points Cron..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "1️⃣  Checking if dev server is running..."
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Dev server is running${NC}"
else
    echo -e "${RED}❌ Dev server not running${NC}"
    echo "   Run: npm run dev"
    exit 1
fi
echo ""

# Check if CRON_SECRET is set
echo "2️⃣  Checking environment variable..."
if [ -f .env.local ] && grep -q "CRON_SECRET" .env.local; then
    CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d '=' -f2)
    echo -e "${GREEN}✅ CRON_SECRET found: ${CRON_SECRET:0:20}...${NC}"
else
    echo -e "${RED}❌ CRON_SECRET not found in .env.local${NC}"
    exit 1
fi
echo ""

# Test the endpoint
echo "3️⃣  Testing birthday points endpoint..."
echo "   Calling: POST http://localhost:3000/api/cron/birthday-points"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST http://localhost:3000/api/cron/birthday-points \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "Response:"
echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
echo ""

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Endpoint responded successfully (200 OK)${NC}"
    
    # Check if any birthdays were processed
    SUCCESS_COUNT=$(echo "$HTTP_BODY" | jq -r '.stats.successful' 2>/dev/null)
    if [ "$SUCCESS_COUNT" = "null" ] || [ -z "$SUCCESS_COUNT" ]; then
        SUCCESS_COUNT=0
    fi
    
    if [ "$SUCCESS_COUNT" -gt 0 ]; then
        echo -e "${GREEN}🎉 $SUCCESS_COUNT birthday points awarded!${NC}"
    else
        echo -e "${YELLOW}⚠️  No customers have birthdays today${NC}"
        echo ""
        echo "To test with a real birthday:"
        echo "  1. Run: npx prisma studio"
        echo "  2. Open Customer table"
        echo "  3. Set a customer's birthday to today"
        echo "  4. Run this script again"
    fi
else
    echo -e "${RED}❌ Endpoint failed (HTTP $HTTP_STATUS)${NC}"
    exit 1
fi
echo ""

echo "4️⃣  Additional Test Commands:"
echo ""
echo "# Test without authorization (should fail with 401):"
echo "curl -X POST http://localhost:3000/api/cron/birthday-points"
echo ""
echo "# Check customer's loyalty stats:"
echo "curl http://localhost:3000/api/loyalty/customers/CUSTOMER_ID/stats"
echo ""
echo "# View database in browser:"
echo "npx prisma studio"
echo ""

echo -e "${GREEN}✅ Test complete!${NC}"
