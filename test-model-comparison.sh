#!/bin/bash

echo "🧪 Model Comparison Test"
echo "========================"
echo ""

# Test queries
QUERIES=(
  "Show me all users"
  "Count users by city"
  "Show me users from New York with age greater than 25"
  "Show me all orders with user names and product names"
)

# Current model info
echo "📊 Current Model:"
curl -s http://localhost:3010/api/postgres-agent/model-info | json_pp
echo ""
echo "---"
echo ""

# Test each query
for i in "${!QUERIES[@]}"; do
  query="${QUERIES[$i]}"
  echo "Query $((i+1)): $query"
  echo ""
  
  start_time=$(date +%s%N)
  
  result=$(curl -s -X POST http://localhost:3010/api/postgres-agent/nl-query \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$query\"}")
  
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))
  
  echo "Time: ${duration}ms"
  echo "Result:"
  echo "$result" | json_pp
  echo ""
  echo "---"
  echo ""
done

echo "✅ Test complete!"
echo ""
echo "💡 To test another model:"
echo "1. Edit backend/.env"
echo "2. Uncomment a different model"
echo "3. Restart backend: npm run dev"
echo "4. Run this script again"
