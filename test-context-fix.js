const { unifiedLLMService } = require('./backend/src/services/llm/unified.ts');

async function testContextFix() {
  try {
    console.log('Testing LLM with context length fix...');
    
    // Get model info including context length
    const modelInfo = unifiedLLMService.getModelInfo();
    console.log('Model Info:', modelInfo);
    
    // Test with a simple message
    const response = await unifiedLLMService.chat([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello and confirm you received this message.' }
    ]);
    
    console.log('Response:', response.choices[0]?.message?.content);
    console.log('✅ Context fix test successful!');
    
  } catch (error) {
    console.error('❌ Context fix test failed:', error.message);
    
    // Log specific error details
    if (error.message.includes('context')) {
      console.error('Context-related error detected. Check your LM Studio settings.');
    }
  }
}

testContextFix();