# Model Comparison Guide - 7B vs 70B

## 🎯 Quick Comparison Setup

Your `.env` is now configured with multiple model options. Just uncomment the one you want to test!

## 📊 Available Models for Testing

### Lighter Models (7B-9B) - Fast & Efficient

#### 1. Groq Llama 3.1 8B (RECOMMENDED) ⭐
```env
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-8b-instant
```
- **Speed**: ⚡⚡⚡⚡⚡ (Fastest)
- **Quality**: ⭐⭐⭐⭐ (Very Good)
- **Cost**: FREE
- **Context**: 128K tokens
- **Best for**: Fast SQL generation, testing

#### 2. Groq Gemma 2 9B
```env
LLM_PROVIDER=groq
LLM_MODEL=gemma2-9b-it
```
- **Speed**: ⚡⚡⚡⚡⚡ (Very Fast)
- **Quality**: ⭐⭐⭐ (Good)
- **Cost**: FREE
- **Context**: 8K tokens
- **Best for**: General queries

#### 3. DeepSeek Chat
```env
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
```
- **Speed**: ⚡⚡⚡ (Fast)
- **Quality**: ⭐⭐⭐⭐ (Very Good for SQL)
- **Cost**: Very Cheap (~$0.14/1M tokens)
- **Context**: 64K tokens
- **Best for**: Code/SQL generation

#### 4. OpenRouter Mistral 7B (needs credits)
```env
LLM_PROVIDER=openrouter
LLM_MODEL=mistralai/mistral-7b-instruct
```
- **Speed**: ⚡⚡⚡ (Fast)
- **Quality**: ⭐⭐⭐⭐ (Very Good)
- **Cost**: ~$0.07/1M tokens
- **Context**: 32K tokens
- **Best for**: General SQL

#### 5. OpenRouter Qwen 2.5 7B (needs credits)
```env
LLM_PROVIDER=openrouter
LLM_MODEL=qwen/qwen-2.5-7b-instruct
```
- **Speed**: ⚡⚡⚡ (Fast)
- **Quality**: ⭐⭐⭐⭐⭐ (Excellent for SQL)
- **Cost**: ~$0.07/1M tokens
- **Context**: 128K tokens
- **Best for**: SQL/Code generation

### Heavier Models (70B) - Maximum Quality

#### 6. Groq Llama 3.3 70B
```env
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
```
- **Speed**: ⚡⚡⚡ (Fast for 70B)
- **Quality**: ⭐⭐⭐⭐⭐ (Excellent)
- **Cost**: FREE
- **Context**: 128K tokens
- **Best for**: Complex queries, best quality

#### 7. Groq Llama 3.1 70B
```env
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-70b-versatile
```
- **Speed**: ⚡⚡⚡ (Fast for 70B)
- **Quality**: ⭐⭐⭐⭐⭐ (Excellent)
- **Cost**: FREE
- **Context**: 128K tokens
- **Best for**: Complex queries

---

## 🧪 How to Compare Models

### Method 1: Quick Switch (Recommended)

1. **Edit `.env`** - Uncomment the model you want
2. **Restart backend** - `npm run dev`
3. **Test query** - Use same query for all models
4. **Note results** - Compare SQL quality, speed, accuracy

### Method 2: Automated Testing

Create test configs:

```bash
# Create config files
echo "LLM_MODEL=llama-3.1-8b-instant" > .env.llama8b
echo "LLM_MODEL=gemma2-9b-it" > .env.gemma9b
echo "LLM_MODEL=llama-3.3-70b-versatile" > .env.llama70b
```

Test each:
```bash
for model in llama8b gemma9b llama70b; do
  echo "Testing $model..."
  cp .env.$model .env
  # Restart backend
  # Run test queries
  # Save results
done
```

---

## 📝 Test Queries for Comparison

Use these queries to compare models:

### Simple Query
```
"Show me all users"
```

### Aggregation Query
```
"Count users by city"
```

### Filter Query
```
"Show me users from New York with age greater than 25"
```

### Join Query
```
"Show me all orders with user names and product names"
```

### Complex Query
```
"What is the total order amount for each user, sorted by amount descending"
```

---

## 📊 Comparison Metrics

Track these for each model:

### 1. SQL Quality
- ✅ Correct syntax
- ✅ Proper JOINs
- ✅ Appropriate WHERE clauses
- ✅ Correct aggregations

### 2. Speed
- Time to generate SQL
- Total query time

### 3. Accuracy
- Does it answer the question?
- Are results correct?

### 4. Confidence Score
- Model's confidence (0-1)

---

## 🎯 Expected Results

### 7B-9B Models
- **Pros**: Fast, efficient, good for simple queries
- **Cons**: May struggle with complex JOINs
- **Best for**: 80% of queries

### 70B Models
- **Pros**: Excellent quality, handles complex queries
- **Cons**: Slower (but still fast on Groq)
- **Best for**: Complex queries, production

---

## 💡 Recommendations

### For Testing/Development
**Use**: Llama 3.1 8B (Groq)
- FREE
- Very fast
- Good quality
- Perfect for iteration

### For Production (Simple Queries)
**Use**: Llama 3.1 8B or Gemma 2 9B (Groq)
- FREE
- Fast enough
- Good quality
- Cost-effective

### For Production (Complex Queries)
**Use**: Llama 3.3 70B (Groq) or DeepSeek
- Still FREE (Groq) or very cheap (DeepSeek)
- Best quality
- Handles edge cases

### For Best SQL Quality
**Use**: Qwen 2.5 7B (OpenRouter) or DeepSeek
- Specialized for code/SQL
- Excellent results
- Worth the small cost

---

## 🔄 Quick Switch Commands

### Switch to 8B (Fast)
```env
LLM_MODEL=llama-3.1-8b-instant
```

### Switch to 9B (Balanced)
```env
LLM_MODEL=gemma2-9b-it
```

### Switch to 70B (Quality)
```env
LLM_MODEL=llama-3.3-70b-versatile
```

### Switch to DeepSeek (SQL Specialist)
```env
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
```

---

## 📈 Comparison Table

| Model | Params | Speed | Quality | Cost | SQL Score |
|-------|--------|-------|---------|------|-----------|
| **Llama 3.1 8B** | 8B | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | FREE | 8/10 |
| **Gemma 2 9B** | 9B | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | FREE | 7/10 |
| **DeepSeek** | ~7B | ⚡⚡⚡ | ⭐⭐⭐⭐ | $0.14/1M | 9/10 |
| **Mistral 7B** | 7B | ⚡⚡⚡ | ⭐⭐⭐⭐ | $0.07/1M | 8/10 |
| **Qwen 2.5 7B** | 7B | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | $0.07/1M | 9.5/10 |
| **Llama 3.3 70B** | 70B | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | FREE | 9.5/10 |

---

## 🧪 Sample Test Script

```bash
#!/bin/bash

# Test query
QUERY="Show me users from New York with age > 25"

# Models to test
MODELS=(
  "llama-3.1-8b-instant"
  "gemma2-9b-it"
  "llama-3.3-70b-versatile"
)

for model in "${MODELS[@]}"; do
  echo "Testing $model..."
  
  # Update .env
  sed -i "s/LLM_MODEL=.*/LLM_MODEL=$model/" backend/.env
  
  # Restart backend (you'll need to do this manually)
  # npm run dev
  
  # Test query
  curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$QUERY\"}" \
    > "result_$model.json"
  
  echo "Results saved to result_$model.json"
  echo "---"
done
```

---

## 🎯 Current Configuration

Your `.env` is set to: **Llama 3.1 8B (Groq)**

This is perfect for:
- ✅ Fast testing
- ✅ Good quality
- ✅ FREE
- ✅ Comparing with heavier models

**Just restart the backend and start testing!**

---

## 📚 Next Steps

1. **Test with 8B model** (current)
2. **Try 70B model** (uncomment in `.env`)
3. **Compare results**
4. **Choose best for your use case**

**All models are FREE on Groq - test as much as you want!** 🚀
