# OpenRouter Quick Start - 2 Minutes! ⚡

## 🎯 Get Started in 3 Steps

### Step 1: Get Your OpenRouter API Key (30 seconds)

1. Go to https://openrouter.ai/
2. Click "Sign In" (use Google/GitHub)
3. Go to "Keys" section
4. Click "Create Key"
5. Copy the key (starts with `sk-or-v1-...`)

### Step 2: Update `.env` (30 seconds)

Edit `backend/.env`:

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=mistralai/mistral-7b-instruct
```

### Step 3: Restart Backend (1 minute)

```bash
cd backend
npm run dev
```

## ✅ Test It!

```bash
# Check current model
curl http://localhost:3010/api/postgres-agent/model-info

# Test natural language query
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all users from New York"}'
```

---

## 🎨 Try Different Models

Just change `LLM_MODEL` in `.env` and restart:

### Mistral Models
```env
LLM_MODEL=mistralai/mistral-7b-instruct        # Fast, good
LLM_MODEL=mistralai/mixtral-8x7b-instruct      # Better quality
```

### Qwen Models (Good for SQL)
```env
LLM_MODEL=qwen/qwen-2-7b-instruct              # Fast, good for code
LLM_MODEL=qwen/qwen-2-72b-instruct             # Best quality
```

### DeepSeek Models (Best for Code/SQL)
```env
LLM_MODEL=deepseek/deepseek-chat               # Good for SQL
LLM_MODEL=deepseek/deepseek-coder              # Best for code
```

### Other Popular Models
```env
LLM_MODEL=meta-llama/llama-3-8b-instruct       # Fast, capable
LLM_MODEL=meta-llama/llama-3-70b-instruct      # Most capable
LLM_MODEL=google/gemma-7b-it                   # Google's model
```

---

## 💰 Pricing

OpenRouter charges per token:
- **Mistral 7B**: ~$0.07 per 1M tokens
- **Qwen 2 7B**: ~$0.07 per 1M tokens
- **Mixtral 8x7B**: ~$0.24 per 1M tokens
- **Llama 3 70B**: ~$0.59 per 1M tokens

**Typical query cost**: $0.0001 - $0.001 (very cheap!)

---

## 🔄 Switch to On-Prem Later

When your on-prem is ready:

```env
# From OpenRouter
LLM_PROVIDER=openrouter
LLM_MODEL=mistralai/mistral-7b-instruct

# To On-Prem (same model!)
LLM_PROVIDER=onprem
LLM_BASE_URL=http://your-server:8000/v1
LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

**Same code, just different config!**

---

## 📊 Compare Models

Create test configs:

```bash
# Mistral
echo "LLM_MODEL=mistralai/mistral-7b-instruct" > .env.mistral

# Qwen
echo "LLM_MODEL=qwen/qwen-2-7b-instruct" > .env.qwen

# DeepSeek
echo "LLM_MODEL=deepseek/deepseek-chat" > .env.deepseek
```

Test each:
```bash
cp .env.mistral .env && npm run dev
# Test queries, note results

cp .env.qwen .env && npm run dev
# Test queries, note results

cp .env.deepseek .env && npm run dev
# Test queries, note results
```

---

## 🎯 Recommended Models for SQL

**Best for SQL Generation:**
1. `qwen/qwen-2-7b-instruct` - Best balance
2. `deepseek/deepseek-chat` - Good for code
3. `mistralai/mistral-7b-instruct` - Fast, reliable

**Try all three and pick the best!**

---

## 💡 Pro Tips

### 1. Check Current Model
```bash
curl http://localhost:3010/api/postgres-agent/model-info
```

### 2. Monitor Usage
Check your usage at: https://openrouter.ai/activity

### 3. Set Budget Limits
Set spending limits in OpenRouter dashboard

### 4. Use Credits
Add credits to your account for uninterrupted service

---

## 🆘 Troubleshooting

**API Key Not Working?**
- Check for extra spaces
- Ensure key starts with `sk-or-v1-`
- Verify you have credits

**Model Not Found?**
- Check model name at https://openrouter.ai/models
- Use exact model ID

**Slow Responses?**
- Try smaller model (7B instead of 70B)
- Check your internet connection
- Consider using Groq for fastest inference

---

## 📚 Full Documentation

- **Model Switching**: See `MODEL_SWITCHING_GUIDE.md`
- **Local Models**: See `LOCAL_MODEL_SETUP_GUIDE.md`
- **OpenRouter Docs**: https://openrouter.ai/docs

---

## 🎉 You're Ready!

**Current Setup:**
- ✅ OpenRouter configured
- ✅ Can switch models instantly
- ✅ Can test multiple models
- ✅ Ready for on-prem transition

**Just paste your OpenRouter API key and start testing!** 🚀
