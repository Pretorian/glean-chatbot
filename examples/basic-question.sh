#!/bin/bash
# Basic question example
# Usage: ./examples/basic-question.sh

echo "Asking: What is our remote work policy?"
echo ""

curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is our remote work policy?"
  }' | jq '.'
