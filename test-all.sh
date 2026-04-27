#!/bin/bash
# test-all.sh - Run all tests in sequence
#
# This script runs a comprehensive test suite for the Glean RAG Chatbot:
# 1. Smoke test (environment and API connectivity)
# 2. Server startup test
# 3. Health check
# 4. Config endpoint
# 5. Search API
# 6. Ask API (full RAG pipeline)
#
# Exit code 0 on success, 1 on any failure.

set -e  # Exit on error

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================================="
echo "  Glean RAG Chatbot - Comprehensive Test Suite"
echo "================================================================="
echo ""

# Test 1: Smoke Test
echo -e "${YELLOW}Test 1: Smoke Test${NC}"
echo "Running pre-flight checks..."
npm run test --silent
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Smoke test passed${NC}"
else
  echo -e "${RED}✗ Smoke test failed${NC}"
  exit 1
fi
echo ""

# Test 2: Start Server
echo -e "${YELLOW}Test 2: Server Startup${NC}"
echo "Starting backend server..."
npm run dev:server > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

# Check if server is still running
if kill -0 $SERVER_PID 2>/dev/null; then
  echo -e "${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
else
  echo -e "${RED}✗ Server failed to start${NC}"
  exit 1
fi
echo ""

# Test 3: Health Check
echo -e "${YELLOW}Test 3: Health Check${NC}"
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -f http://localhost:3001/health)
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
  echo "  Response: $HEALTH_RESPONSE"
else
  echo -e "${RED}✗ Health check failed${NC}"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Test 4: Config Endpoint
echo -e "${YELLOW}Test 4: Config Endpoint${NC}"
echo "Testing config endpoint..."
CONFIG_RESPONSE=$(curl -s -f http://localhost:3001/api/config)
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Config check passed${NC}"
  echo "  Response: $CONFIG_RESPONSE"
else
  echo -e "${RED}✗ Config check failed${NC}"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Test 5: Search API
echo -e "${YELLOW}Test 5: Search API${NC}"
echo "Testing search endpoint..."
SEARCH_RESPONSE=$(curl -s -f -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "remote work", "maxResults": 1}')
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Search API test passed${NC}"
  # Extract result count if jq is available
  if command -v jq &> /dev/null; then
    RESULT_COUNT=$(echo $SEARCH_RESPONSE | jq '.results.results | length')
    echo "  Results found: $RESULT_COUNT"
  fi
else
  echo -e "${RED}✗ Search API test failed${NC}"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Test 6: Ask API (Full RAG Pipeline)
echo -e "${YELLOW}Test 6: Ask API (Full RAG Pipeline)${NC}"
echo "Testing ask endpoint with full RAG flow..."
ASK_RESPONSE=$(curl -s -f -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}')
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Ask API test passed${NC}"
  # Extract answer preview if jq is available
  if command -v jq &> /dev/null; then
    ANSWER=$(echo $ASK_RESPONSE | jq -r '.answer' | head -c 100)
    SOURCE_COUNT=$(echo $ASK_RESPONSE | jq '.sources | length')
    TOTAL_MS=$(echo $ASK_RESPONSE | jq '.meta.latencyMs.totalMs')
    echo "  Answer preview: ${ANSWER}..."
    echo "  Sources: $SOURCE_COUNT"
    echo "  Total latency: ${TOTAL_MS}ms"
  fi
else
  echo -e "${RED}✗ Ask API test failed${NC}"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Test 7: Error Handling
echo -e "${YELLOW}Test 7: Error Handling${NC}"
echo "Testing invalid request handling..."
ERROR_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE="${ERROR_RESPONSE: -3}"
if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Error handling test passed${NC}"
  echo "  Correctly returned HTTP 400 for invalid request"
else
  echo -e "${RED}✗ Error handling test failed${NC}"
  echo "  Expected HTTP 400, got HTTP $HTTP_CODE"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Cleanup
echo "Cleaning up..."
kill $SERVER_PID 2>/dev/null
sleep 1
echo -e "${GREEN}✓ Server stopped${NC}"
echo ""

# Summary
echo "================================================================="
echo -e "${GREEN}  All Tests Passed! 🎉${NC}"
echo "================================================================="
echo ""
echo "Test Summary:"
echo "  ✓ Smoke test (environment & API connectivity)"
echo "  ✓ Server startup"
echo "  ✓ Health check"
echo "  ✓ Config endpoint"
echo "  ✓ Search API"
echo "  ✓ Ask API (full RAG pipeline)"
echo "  ✓ Error handling"
echo ""
echo "Your Glean RAG Chatbot is ready for use!"
echo ""
echo "Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Open: http://localhost:5173"
echo "  3. Start asking questions!"
echo ""

exit 0
