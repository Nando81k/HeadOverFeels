#!/bin/bash

# 🔒 Security Testing Script for Head Over Feels
# Run this to verify all security measures are working

echo "🔒 Head Over Feels Security Test Suite"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="${1:-http://localhost:3000}"
echo "Testing against: $BASE_URL"
echo ""

# Function to test endpoint
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local expected_status=$5
  
  echo -n "Testing $name... "
  
  status=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint" \
    -H "Content-Type: application/json" \
    -d "$data")
  
  if [ "$status" == "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Status: $status)"
  else
    echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status)"
  fi
}

# Test 1: Security Headers
echo "1️⃣  Security Headers Test"
echo "------------------------"
headers=$(curl -s -I "$BASE_URL" | grep -E "(X-Frame-Options|X-Content-Type|X-XSS-Protection|Content-Security-Policy)")
if [ ! -z "$headers" ]; then
  echo -e "${GREEN}✓ Security headers present${NC}"
  echo "$headers" | sed 's/^/   /'
else
  echo -e "${RED}✗ Security headers missing${NC}"
fi
echo ""

# Test 2: Rate Limiting
echo "2️⃣  Rate Limiting Test (Auth Endpoint)"
echo "------------------------------------"
echo "Sending 6 rapid login attempts..."
success_count=0
fail_count=0

for i in {1..6}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrongpassword"}')
  
  if [ "$status" == "429" ]; then
    ((fail_count++))
  else
    ((success_count++))
  fi
  
  sleep 0.5
done

echo "   Allowed: $success_count requests"
echo "   Blocked: $fail_count requests"

if [ $fail_count -gt 0 ]; then
  echo -e "${GREEN}✓ Rate limiting is working${NC}"
else
  echo -e "${YELLOW}⚠ Rate limiting may not be active${NC}"
fi
echo ""

# Test 3: Origin Validation
echo "3️⃣  Origin Validation Test (CSRF Protection)"
echo "------------------------------------------"
echo -n "Testing invalid origin... "

status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/products" \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil-site.com" \
  -d '{"name":"Test"}')

if [ "$status" == "403" ] || [ "$status" == "401" ]; then
  echo -e "${GREEN}✓ PASS${NC} (Rejected with $status)"
else
  echo -e "${YELLOW}⚠ WARNING${NC} (Got $status, expected 403 or 401)"
fi
echo ""

# Test 4: HTTPS Redirect (Production only)
if [[ $BASE_URL == https://* ]]; then
  echo "4️⃣  HTTPS Test"
  echo "-------------"
  
  http_url="${BASE_URL/https/http}"
  echo -n "Testing HTTP redirect... "
  
  status=$(curl -s -o /dev/null -w "%{http_code}" -L "$http_url")
  
  if [ "$status" == "200" ]; then
    echo -e "${GREEN}✓ HTTPS redirect working${NC}"
  else
    echo -e "${RED}✗ HTTPS redirect failed${NC} (Status: $status)"
  fi
  echo ""
fi

# Test 5: Admin Route Protection
echo "5️⃣  Admin Route Protection Test"
echo "------------------------------"
echo -n "Testing unauthenticated admin access... "

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin")

if [ "$status" == "307" ] || [ "$status" == "302" ] || [ "$status" == "401" ]; then
  echo -e "${GREEN}✓ PASS${NC} (Redirected/blocked with $status)"
else
  echo -e "${RED}✗ FAIL${NC} (Got $status, expected redirect)"
fi
echo ""

# Test 6: Content Security Policy
echo "6️⃣  Content Security Policy Test"
echo "-------------------------------"
csp=$(curl -s -I "$BASE_URL" | grep -i "content-security-policy")
if [ ! -z "$csp" ]; then
  echo -e "${GREEN}✓ CSP header present${NC}"
  echo "   $csp" | sed 's/^/   /'
else
  echo -e "${RED}✗ CSP header missing${NC}"
fi
echo ""

# Test 7: XSS Protection
echo "7️⃣  XSS Protection Test"
echo "---------------------"
xss_test='<script>alert("xss")</script>'
echo -n "Testing XSS in input... "

# This should either reject the input or sanitize it
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/drop-notifications" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$xss_test\",\"productId\":\"test\"}")

if [ "$status" == "400" ]; then
  echo -e "${GREEN}✓ PASS${NC} (Input rejected)"
elif [ "$status" == "200" ]; then
  echo -e "${YELLOW}⚠ WARNING${NC} (Input accepted - verify sanitization)"
else
  echo -e "${YELLOW}⚠ UNKNOWN${NC} (Status: $status)"
fi
echo ""

# Test 8: SQL Injection (should be impossible with Prisma)
echo "8️⃣  SQL Injection Test"
echo "--------------------"
echo -n "Testing SQL injection pattern... "

sql_injection="' OR '1'='1"
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$sql_injection\",\"password\":\"test\"}")

if [ "$status" == "400" ] || [ "$status" == "401" ]; then
  echo -e "${GREEN}✓ PASS${NC} (SQL injection blocked)"
else
  echo -e "${RED}✗ FAIL${NC} (Unexpected status: $status)"
fi
echo ""

# Test 9: Weak Password Rejection
echo "9️⃣  Password Strength Test"
echo "-------------------------"
echo -n "Testing weak password... "

weak_pass="weak"
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@test.com\",\"password\":\"$weak_pass\",\"firstName\":\"Test\",\"lastName\":\"User\"}")

if [ "$status" == "400" ]; then
  echo -e "${GREEN}✓ PASS${NC} (Weak password rejected)"
else
  echo -e "${YELLOW}⚠ WARNING${NC} (Status: $status)"
fi
echo ""

# Summary
echo "======================================"
echo "🎉 Security Test Suite Complete"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Review any warnings or failures above"
echo "2. Check server logs for suspicious activity"
echo "3. Run 'npm audit' to check dependencies"
echo "4. Consider using SecurityHeaders.com for external validation"
echo ""
echo "For more info, see /docs/SECURITY.md"
