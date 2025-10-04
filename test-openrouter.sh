#!/bin/bash

# Test OpenRouter API
echo "🧪 Testing OpenRouter Connection..."
echo ""

API_KEY="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"
MODEL="mistralai/mistral-7b-instruct"

echo "API Key: ${API_KEY:0:20}..."
echo "Model: $MODEL"
echo ""

echo "📡 Sending test request..."
echo ""

curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "HTTP-Referer: http://localhost:3010" \
  -H "X-Title: PostgreSQL Agent Test" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Say 'Hello, I am working!' in exactly those words.\"}
    ],
    \"temperature\": 0,
    \"max_tokens\": 50
  }"

echo ""
echo ""
echo "✅ If you see a response above, OpenRouter is working!"
echo "❌ If you see an error, check:"
echo "   1. API key is valid"
echo "   2. Account has credits"
echo "   3. Account is active"
