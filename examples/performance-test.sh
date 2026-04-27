#!/bin/bash
# Test performance with different maxSources values
# Usage: ./examples/performance-test.sh

QUESTION="What is our remote work policy?"

echo "Testing performance with different maxSources values"
echo "Question: $QUESTION"
echo ""

for sources in 1 3 5; do
  echo "Testing with maxSources=$sources..."

  result=$(curl -s -X POST http://localhost:3001/api/ask \
    -H "Content-Type: application/json" \
    -d "{\"question\": \"$QUESTION\", \"maxSources\": $sources}")

  search_ms=$(echo $result | jq -r '.meta.latencyMs.searchMs')
  chat_ms=$(echo $result | jq -r '.meta.latencyMs.chatMs')
  total_ms=$(echo $result | jq -r '.meta.latencyMs.totalMs')

  echo "  Search:  ${search_ms}ms"
  echo "  Chat:    ${chat_ms}ms"
  echo "  Total:   ${total_ms}ms"
  echo ""
done
