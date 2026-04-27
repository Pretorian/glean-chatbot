#!/bin/bash
# Ask multiple questions and show short answers
# Usage: ./examples/multiple-questions.sh

questions=(
  "What is our remote work policy?"
  "Who is eligible for remote work?"
  "What equipment does the company provide?"
  "Can I work from another country?"
  "What are the core working hours?"
)

echo "================================"
echo "  Asking Multiple Questions"
echo "================================"
echo ""

for q in "${questions[@]}"; do
  echo "Q: $q"
  echo "A: "
  curl -s -X POST http://localhost:3001/api/ask \
    -H "Content-Type: application/json" \
    -d "{\"question\": \"$q\"}" \
    | jq -r '.answer' | head -n 3
  echo ""
  echo "---"
  echo ""
done
