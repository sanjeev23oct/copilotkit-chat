const BASE_URL = 'http://100.100.100.125:1234/v1';

async function testConnection() {
  console.log('Testing on-prem LLM connection...\n');
  
  try {
    // Test 1: Check if server is reachable
    console.log('1. Testing server reachability...');
    const modelsResponse = await fetch(`${BASE_URL}/models`);
    const models = await modelsResponse.json();
    console.log('✓ Server is reachable');
    console.log('Available models:', JSON.stringify(models, null, 2));
    
    // Test 2: Simple chat completion
    console.log('\n2. Testing chat completion...');
    const startTime = Date.now();
    
    const chatResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama-3.1-8b-instruct',
        messages: [
          { role: 'user', content: 'Say "Hello, I am working!" in exactly those words.' }
        ],
        temperature: 0,
        max_tokens: 50
      }),
    });
    
    const duration = Date.now() - startTime;
    const chatData = await chatResponse.json();
    
    console.log(`✓ Chat completion successful (${duration}ms)`);
    console.log('Response:', chatData.choices[0]?.message?.content);
    
    // Test 3: SQL generation test
    console.log('\n3. Testing SQL generation...');
    const sqlStartTime = Date.now();
    
    const sqlResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama-3.1-8b-instruct',
        messages: [
          { 
            role: 'system', 
            content: 'Convert natural language to SQL. Return only JSON: {"sql":"SELECT...","explanation":"...","confidence":0.95}'
          },
          { 
            role: 'user', 
            content: 'Show me all products'
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      }),
    });
    
    const sqlDuration = Date.now() - sqlStartTime;
    const sqlData = await sqlResponse.json();
    
    console.log(`✓ SQL generation successful (${sqlDuration}ms)`);
    console.log('Response:', sqlData.choices[0]?.message?.content);
    
    console.log('\n✅ All tests passed!');
    console.log(`\nPerformance:`);
    console.log(`- Simple query: ${duration}ms`);
    console.log(`- SQL generation: ${sqlDuration}ms`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if LM Studio server is running on 100.100.100.125:1234');
    console.error('2. Verify the model is loaded in LM Studio');
    console.error('3. Check firewall settings');
    console.error('4. Try accessing http://100.100.100.125:1234/v1/models in browser');
  }
}

testConnection();
