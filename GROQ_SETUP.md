# Groq Setup - 2 Minutes! ⚡

## Why Groq?

- ✅ **FREE** - Generous free tier
- ✅ **FASTEST** - Fastest inference in the world
- ✅ **EASY** - 2-minute setup
- ✅ **POWERFUL** - Mixtral 8x7B, Llama 3 70B, and more

## Quick Setup

### Step 1: Get API Key (1 minute)

1. Go to https://console.groq.com/
2. Click "Sign In" (use Google/GitHub)
3. Go to "API Keys" section
4. Click "Create API Key"
5. Copy the key (starts with `gsk_...`)

### Step 2: Update `.env` (30 seconds)

Edit `backend/.env`:

```env
LLM_PROVIDER=groq
LLM_API_KEY=gsk_your_key_here
LLM_MODEL=mixtral-8x7b-32768
```

### Step 3: Restart Backend (30 seconds)

```bash
cd backend
npm run dev
```

### Step 4: Test! (30 seconds)

```bash
# Check model
curl http://localhost:3010/api/postgres-agent/model-info

# Test query
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all users"}'
```

---

## Available Models

### Llama 3.3 (NEWEST, BEST!)
```env
LLM_MODEL=llama-3.3-70b-versatile   # Latest, most capable, 128K context!
```

### Llama 3.1 (Excellent)
```env
LLM_MODEL=llama-3.1-70b-versatile   # Very capable, 128K context
LLM_MODEL=llama-3.1-8b-instant      # Fast, good quality
```

### Llama 3 (Reliable)
```env
LLM_MODEL=llama3-70b-8192           # Reliable, 8K context
LLM_MODEL=llama3-8b-8192            # Fast, good quality
```

### Gemma (Google)
```env
LLM_MODEL=gemma2-9b-it              # Google's latest
LLM_MODEL=gemma-7b-it               # Smaller, faster
```

---

## Model Comparison

| Model | Speed | Quality | Context | Best For |
|-------|-------|---------|---------|----------|
| **llama-3.3-70b-versatile** | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 128K | SQL, Complex queries |
| **llama-3.1-70b-versatile** | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 128K | SQL, General |
| **llama-3.1-8b-instant** | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 128K | Fast queries |
| **llama3-70b-8192** | ⚡⚡⚡ | ⭐⭐⭐⭐ | 8K | Reliable |
| **gemma2-9b-it** | ⚡⚡⚡⚡ | ⭐⭐⭐ | 8K | General |

---

## Why Groq is Amazing

### 1. Speed
- **10-100x faster** than other providers
- Responses in milliseconds
- Perfect for real-time applications

### 2. Free Tier
- Generous limits
- No credit card required
- Perfect for testing

### 3. Quality
- Top-tier models (Mixtral, Llama 3)
- Excellent for SQL generation
- Great for code tasks

---

## Testing Different Models

```bash
# Test Mixtral
LLM_MODEL=mixtral-8x7b-32768

# Test Llama 3 70B
LLM_MODEL=llama3-70b-8192

# Test Llama 3 8B
LLM_MODEL=llama3-8b-8192
```

Just change `LLM_MODEL` in `.env` and restart!

---

## Rate Limits

**Free Tier:**
- 30 requests per minute
- 14,400 requests per day
- More than enough for testing!

**Paid Tier:**
- Higher limits
- Very affordable
- Pay per use

---

## Troubleshooting

### Invalid API Key
- Ensure key starts with `gsk_`
- No spaces before/after key
- Generate new key if needed

### Rate Limit
- Wait a few seconds
- Upgrade to paid tier if needed

### Model Not Found
- Check model name at https://console.groq.com/docs/models
- Use exact model ID

---

## Comparison with Other Providers

| Provider | Speed | Cost | Setup | Best For |
|----------|-------|------|-------|----------|
| **Groq** | ⚡⚡⚡⚡⚡ | FREE | 2 min | Testing, Production |
| OpenRouter | ⚡⚡⚡ | Paid | 2 min | Multiple models |
| DeepSeek | ⚡⚡⚡ | Cheap | 2 min | Code/SQL |
| Ollama | ⚡⚡ | FREE | 5 min | Local, Private |

---

## Recommended Configuration

### For SQL Generation (BEST!)
```env
LLM_PROVIDER=groq
LLM_API_KEY=your_groq_key
LLM_MODEL=llama-3.3-70b-versatile
```

### For Complex Queries
```env
LLM_PROVIDER=groq
LLM_API_KEY=your_groq_key
LLM_MODEL=llama-3.1-70b-versatile
```

### For Speed
```env
LLM_PROVIDER=groq
LLM_API_KEY=your_groq_key
LLM_MODEL=llama-3.1-8b-instant
```

---

## Next Steps

1. **Get Groq API key** from https://console.groq.com/
2. **Paste it** in `backend/.env`
3. **Restart backend**
4. **Test immediately** - it's FAST!

---

## Resources

- **Groq Console**: https://console.groq.com/
- **Documentation**: https://console.groq.com/docs
- **Models**: https://console.groq.com/docs/models
- **Pricing**: https://wow.groq.com/

---

## Summary

**Groq is perfect for:**
- ✅ Testing (FREE)
- ✅ Production (FAST)
- ✅ SQL generation (ACCURATE)
- ✅ Real-time apps (INSTANT)

**Get your key and start using the fastest LLM in the world!** 🚀
