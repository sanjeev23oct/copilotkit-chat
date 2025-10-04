# Model Switching Guide - Easy Configuration

## 🎯 Switch Models in 3 Lines!

Just update these 3 values in `backend/.env`:

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=your_api_key
LLM_MODEL=mistralai/mistral-7b-instruct
```

**That's it!** Restart the backend and you're using a different model.

---

## 🚀 Quick Start with OpenRouter

### Step 1: Get OpenRouter API Key

1. Go to https://openrouter.ai/
2. Sign up / Log in
3. Go to Keys section
4. Create a new API key
5. Copy the key

### Step 2: Update `.env`

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=mistralai/mistral-7b-instruct
```

### Step 3: Restart Backend

```bash
cd backend
npm run dev
```

### Step 4: Test

```bash
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all users"}'
```

---

## 📊 Available Models

### OpenRouter Models (Recommended for Testing)

#### Mistral Models
```env
# Mistral 7B - Fast, good quality
LLM_PROVIDER=openrouter
LLM_MODEL=mistralai/mistral-7b-instruct

# Mistral 7B v0.3 - Latest
LLM_MODEL=mistralai/mistral-7b-instruct-v0.3

# Mixtral 8x7B - More capable
LLM_MODEL=mistralai/mixtral-8x7b-instruct

# Mistral Small - Balanced
LLM_MODEL=mistralai/mistral-small

# Mistral Medium - More capable
LLM_MODEL=mistralai/mistral-medium
```

#### Qwen Models
```env
# Qwen 2 7B - Good for code
LLM_PROVIDER=openrouter
LLM_MODEL=qwen/qwen-2-7b-instruct

# Qwen 2 72B - Most capable
LLM_MODEL=qwen/qwen-2-72b-instruct

# Qwen 1.5 32B - Balanced
LLM_MODEL=qwen/qwen-1.5-32b-chat
```

#### DeepSeek Models
```env
# DeepSeek Chat - Good for code
LLM_PROVIDER=openrouter
LLM_MODEL=deepseek/deepseek-chat

# DeepSeek Coder - Best for code
LLM_MODEL=deepseek/deepseek-coder
```

#### Other Popular Models
```env
# Llama 3 8B - Fast, capable
LLM_MODEL=meta-llama/llama-3-8b-instruct

# Llama 3 70B - Most capable
LLM_MODEL=meta-llama/llama-3-70b-instruct

# Gemma 7B - Google's model
LLM_MODEL=google/gemma-7b-it

# Claude 3 Haiku - Fast, good quality
LLM_MODEL=anthropic/claude-3-haiku

# GPT-4 Turbo - OpenAI
LLM_MODEL=openai/gpt-4-turbo
```

---

## 🔧 Configuration Examples

### Example 1: Mistral 7B (OpenRouter)

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=mistralai/mistral-7b-instruct
```

### Example 2: Qwen 2 7B (OpenRouter)

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=qwen/qwen-2-7b-instruct
```

### Example 3: DeepSeek (OpenRouter)

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=deepseek/deepseek-chat
```

### Example 4: DeepSeek (Direct)

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-your-deepseek-key
LLM_MODEL=deepseek-chat
```

### Example 5: Ollama (Local)

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=mistral:7b
```

### Example 6: Groq (Fast Cloud)

```env
LLM_PROVIDER=groq
LLM_API_KEY=your-groq-key
LLM_MODEL=mixtral-8x7b-32768
```

### Example 7: On-Prem (vLLM/TGI)

```env
LLM_PROVIDER=onprem
LLM_BASE_URL=http://your-server:8000/v1
LLM_API_KEY=your-api-key
LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

---

## 🎯 Model Comparison

### For Natural Language to SQL

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| **Mistral 7B** | Fast | Good | Low | General queries |
| **Qwen 2 7B** | Fast | Better | Low | Code/SQL queries |
| **DeepSeek** | Fast | Good | Low | Code/SQL queries |
| **Mixtral 8x7B** | Medium | Better | Medium | Complex queries |
| **Llama 3 8B** | Fast | Good | Low | General queries |
| **Llama 3 70B** | Slow | Best | High | Complex queries |

### Recommendations

**For Testing (OpenRouter):**
1. Start with: `mistralai/mistral-7b-instruct`
2. Try: `qwen/qwen-2-7b-instruct`
3. Compare: `deepseek/deepseek-chat`

**For Production (On-Prem):**
1. Deploy: Mistral 7B or Qwen 2 7B
2. Use: Ollama or vLLM
3. Same config, just change `LLM_PROVIDER` and `LLM_BASE_URL`

---

## 🔄 Switching Between Models

### Test Different Models

Create test configs:

**`.env.mistral`**
```env
LLM_PROVIDER=openrouter
LLM_MODEL=mistralai/mistral-7b-instruct
```

**`.env.qwen`**
```env
LLM_PROVIDER=openrouter
LLM_MODEL=qwen/qwen-2-7b-instruct
```

**`.env.deepseek`**
```env
LLM_PROVIDER=openrouter
LLM_MODEL=deepseek/deepseek-chat
```

**Switch:**
```bash
# Test Mistral
cp .env.mistral .env && npm run dev

# Test Qwen
cp .env.qwen .env && npm run dev

# Test DeepSeek
cp .env.deepseek .env && npm run dev
```

### Compare Results

```bash
# Test query with each model
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me users from New York with age > 25"}'
```

---

## 🏠 Transition to On-Prem

### Phase 1: Test with OpenRouter

```env
LLM_PROVIDER=openrouter
LLM_MODEL=mistralai/mistral-7b-instruct
```

### Phase 2: Test Locally with Ollama

```bash
# Install Ollama
ollama serve

# Pull model
ollama pull mistral:7b

# Update .env
LLM_PROVIDER=ollama
LLM_MODEL=mistral:7b
```

### Phase 3: Deploy to On-Prem

```bash
# Deploy vLLM/TGI on your server
# Update .env
LLM_PROVIDER=onprem
LLM_BASE_URL=http://your-server:8000/v1
LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

**Same code, just different configuration!**

---

## 📊 Testing Script

Create `test-models.sh`:

```bash
#!/bin/bash

MODELS=(
  "mistralai/mistral-7b-instruct"
  "qwen/qwen-2-7b-instruct"
  "deepseek/deepseek-chat"
)

for model in "${MODELS[@]}"; do
  echo "Testing $model..."
  
  # Update .env
  sed -i "s/LLM_MODEL=.*/LLM_MODEL=$model/" backend/.env
  
  # Restart backend (in background)
  cd backend && npm run dev &
  PID=$!
  sleep 5
  
  # Test query
  curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
    -H "Content-Type: application/json" \
    -d '{"query": "Show me all users"}' \
    > "results_${model//\//_}.json"
  
  # Stop backend
  kill $PID
  
  echo "Results saved to results_${model//\//_}.json"
done
```

---

## 🔍 Model Selection Guide

### Choose Based On:

**Speed Priority:**
- Mistral 7B
- Qwen 2 7B
- Groq (Mixtral 8x7B)

**Quality Priority:**
- Llama 3 70B
- Mixtral 8x7B
- Qwen 2 72B

**Cost Priority:**
- Ollama (local, free)
- Mistral 7B (cheap)
- Qwen 2 7B (cheap)

**SQL/Code Priority:**
- DeepSeek Coder
- Qwen 2 7B
- Mistral 7B

---

## 💡 Pro Tips

### 1. Use OpenRouter for Testing

- Access to 100+ models
- Pay per use
- Easy switching
- No infrastructure needed

### 2. Test Multiple Models

```bash
# Create test configs
for model in mistral qwen deepseek; do
  echo "LLM_MODEL=$model" > .env.$model
done

# Test each
for model in mistral qwen deepseek; do
  cp .env.$model .env
  npm run dev
  # Run tests
done
```

### 3. Monitor Performance

```javascript
// Add to your code
const startTime = Date.now();
const result = await llmService.convertNaturalLanguageToSQL(query);
const duration = Date.now() - startTime;
console.log(`Model: ${model}, Time: ${duration}ms, Confidence: ${result.confidence}`);
```

### 4. Use Model Info Endpoint

```bash
# Check current model
curl http://localhost:3010/api/postgres-agent/model-info
```

---

## 🆘 Troubleshooting

### Model Not Found

**Problem:** `Model not found` error

**Solution:** Check model name on OpenRouter:
- https://openrouter.ai/models

### API Key Invalid

**Problem:** `Invalid API key`

**Solution:**
1. Check key is correct
2. Ensure no extra spaces
3. Verify key has credits

### Slow Responses

**Problem:** Queries take too long

**Solution:**
1. Try smaller model (7B instead of 70B)
2. Use Groq for fastest inference
3. Deploy locally with Ollama

### Different Results

**Problem:** Models give different SQL

**Solution:**
- This is normal
- Test with multiple queries
- Choose model with best average results
- Consider using ensemble (multiple models)

---

## 📚 Resources

- **OpenRouter**: https://openrouter.ai/
- **Ollama**: https://ollama.com/
- **Groq**: https://console.groq.com/
- **Model Comparison**: https://openrouter.ai/models

---

## 🎉 Summary

**Switch models in 3 lines:**
```env
LLM_PROVIDER=openrouter
LLM_API_KEY=your-key
LLM_MODEL=mistralai/mistral-7b-instruct
```

**Supported providers:**
- ✅ OpenRouter (100+ models)
- ✅ DeepSeek
- ✅ OpenAI
- ✅ Ollama (local)
- ✅ Groq (fast)
- ✅ Together.ai
- ✅ On-prem (vLLM, TGI, etc.)

**No code changes needed - just configuration!** 🚀
