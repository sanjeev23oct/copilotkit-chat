// Test OpenRouter API connection
const OpenAI = require('openai');
require('dotenv').config({ path: './backend/.env' });

async function testOpenRouter() {
  console.log('🧪 Testing OpenRouter Connection...\n');
  
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'mistralai/mistral-7b-instruct';
  
  console.log(`API Key: ${apiKey?.substring(0, 20)}...`);
  console.log(`Model: ${model}\n`);
  
  if (!apiKey) {
    console.error('❌ No API key found!');
    console.log('Please set OPENROUTER_API_KEY or LLM_API_KEY in backend/.env');
    return;
  }
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3010',
      'X-Title': 'PostgreSQL Agent Test',
    },
  });
  
  try {
    console.log('📡 Sending test request to OpenRouter...\n');
    
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: 'Say "Hello, I am working!" in exactly those words.' }
      ],
      temperature: 0,
      max_tokens: 50,
    });
    
    console.log('✅ SUCCESS!\n');
    console.log('Response:', response.choices[0]?.message?.content);
    console.log('\nModel Info:', {
      model: response.model,
      usage: response.usage,
    });
    
  } catch (error) {
    console.error('❌ ERROR!\n');
    console.error('Status:', error.status);
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    
    if (error.status === 401) {
      console.log('\n💡 Troubleshooting 401 Error:');
      console.log('1. Check your API key is correct');
      console.log('2. Verify your OpenRouter account is active');
      console.log('3. Ensure you have credits in your account');
      console.log('4. Try generating a new API key at https://openrouter.ai/keys');
      console.log('\n📝 To add credits:');
      console.log('   Go to https://openrouter.ai/credits');
    }
    
    if (error.status === 402) {
      console.log('\n💡 Payment Required:');
      console.log('You need to add credits to your OpenRouter account');
      console.log('Go to: https://openrouter.ai/credits');
    }
    
    console.log('\nFull error:', error);
  }
}

testOpenRouter();
