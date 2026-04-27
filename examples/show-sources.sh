#!/bin/bash
# Show sources for a question
# Usage: ./examples/show-sources.sh "Your question here"

QUESTION="${1:-What is our remote work policy?}"

echo "Question: $QUESTION"
echo ""
echo "Sources:"
echo ""

curl -s -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"$QUESTION\"}" \
  | jq -r '.sources[] | "[\(.title)](\(.url))"'
