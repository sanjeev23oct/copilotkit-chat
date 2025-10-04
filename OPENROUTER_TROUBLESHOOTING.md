# OpenRouter Troubleshooting Guide

## Error: "401 User not found"

This error means OpenRouter cannot authenticate your request.

### Solution Steps:

#### 1. Verify Your API Key

1. Go to https://openrouter.ai/keys
2. Check if your key is listed and active
3. If not, create a new key
4. Copy the FULL key (starts with `sk-or-v1-...`)

#### 2. Update `.env` File

Make sure your key is correctly set in `backend/.env`:

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-your-full-key-here
OPENROUTER_API_KEY=sk-or-v1-your-full-key-here
LLM_MODEL=mistralai/mistral-7b-instruct
```

**Important:** 
- No spaces before or after the key
- Copy the ENTIRE key
- Don't add quotes around the key

#### 3. Add Credits to Your Account

OpenRouter requires credits to use:

1. Go to https://openrouter.ai/credits
2. Click "Add Credits"
3. Add at least $5 (recommended $10-20 for testing)
4. Wait for payment to process

#### 4. Verify Account

1. Go to https://openrouter.ai/settings
2. Ensure your account is verified
3. Check email for verification link if needed

#### 5. Test the Connection

After updating, restart the backend:

```bash
cd backend
npm run dev
```

Then test:

```bash
curl http://localhost:3010/api/postgres-agent/test-llm
```

---

## Alternative: Use DeepSeek (Already Working)

If you want to test immediately while setting up OpenRouter, use DeepSeek:

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-9009ee66fcfd45ee80e2390da604331e
LLM_MODEL=deepseek-chat
```

This should work immediately since you already have a DeepSeek key.

---

## Alternative: Use Ollama (Free, Local)

For completely free testing:

```bash
# Install Ollama
# Windows: Download from https://ollama.com/download

# Pull model
ollama serve
ollama pull mistral:7b

# Update .env
LLM_PROVIDER=ollama
LLM_MODEL=mistral:7b
```

---

## Alternative: Use Groq (Free, Fast)

Get a free Groq API key:

1. Go to https://console.groq.com/
2. Sign up (free)
3. Get API key
4. Update `.env`:

```env
LLM_PROVIDER=groq
LLM_API_KEY=your_groq_key
LLM_MODEL=mixtral-8x7b-32768
```

---

## Quick Fix: Switch Back to DeepSeek

Your DeepSeek key is already in `.env` and working. To use it:

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-9009ee66fcfd45ee80e2390da604331e
LLM_MODEL=deepseek-chat
```

Restart backend:
```bash
cd backend
npm run dev
```

Test:
```bash
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all users"}'
```

---

## Debugging Steps

### 1. Check Current Configuration

```bash
curl http://localhost:3010/api/postgres-agent/model-info
```

### 2. Check Backend Logs

Look for error messages in the terminal where backend is running.

### 3. Test API Key Manually

```bash
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "HTTP-Referer: http://localhost:3010" \
  -d '{
    "model": "mistralai/mistral-7b-instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## Common Issues

### Issue: "Invalid API key format"
**Solution:** Ensure key starts with `sk-or-v1-`

### Issue: "Insufficient credits"
**Solution:** Add credits at https://openrouter.ai/credits

### Issue: "Model not found"
**Solution:** Check model name at https://openrouter.ai/models

### Issue: "Rate limit exceeded"
**Solution:** Wait a few seconds and try again

---

## Recommended Action

**For immediate testing:**

1. Switch to DeepSeek (already working):
   ```env
   LLM_PROVIDER=deepseek
   ```

2. Or use Groq (free, fast):
   - Get key from https://console.groq.com/
   - Update `.env`

3. Fix OpenRouter in parallel:
   - Verify account
   - Add credits
   - Generate new key

**Once OpenRouter is working, switch back:**
```env
LLM_PROVIDER=openrouter
```

---

## Support

- **OpenRouter Discord**: https://discord.gg/openrouter
- **OpenRouter Docs**: https://openrouter.ai/docs
- **Status Page**: https://status.openrouter.ai/

---

## Summary

The "401 User not found" error means:
1. ✅ Your code is correct
2. ❌ OpenRouter account needs setup
3. 💡 Use DeepSeek or Groq while fixing OpenRouter

**Quick fix:** Change `LLM_PROVIDER=deepseek` in `.env` and restart!
