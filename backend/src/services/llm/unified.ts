import OpenAI from 'openai';
import logger from '../../utils/logger';

/**
 * Unified LLM Service
 * Supports: OpenRouter, DeepSeek, OpenAI, Ollama, Groq, and any OpenAI-compatible API
 * Switch models by changing .env configuration only!
 */
export class UnifiedLLMService {
  private client: OpenAI;
  private model: string;
  private provider: string;

  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'openrouter';
    this.model = process.env.LLM_MODEL || this.getDefaultModel();

    const config = this.getProviderConfig();

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.headers,
    });

    logger.info(`LLM Service initialized: ${this.provider} - ${this.model}`);
  }

  private getProviderConfig() {
    const provider = this.provider.toLowerCase();

    switch (provider) {
      case 'openrouter':
        return {
          apiKey: process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
          headers: {
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3010',
            'X-Title': 'PostgreSQL Agent',
          },
        };

      case 'deepseek':
        return {
          apiKey: process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY,
          baseURL: 'https://api.deepseek.com',
          headers: {},
        };

      case 'openai':
        return {
          apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY,
          baseURL: 'https://api.openai.com/v1',
          headers: {},
        };

      case 'ollama':
        return {
          apiKey: 'ollama', // Ollama doesn't need a real key
          baseURL: process.env.LLM_BASE_URL || 'http://localhost:11434/v1',
          headers: {},
        };

      case 'groq':
        return {
          apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY,
          baseURL: 'https://api.groq.com/openai/v1',
          headers: {},
        };

      case 'together':
        return {
          apiKey: process.env.TOGETHER_API_KEY || process.env.LLM_API_KEY,
          baseURL: 'https://api.together.xyz/v1',
          headers: {},
        };

      case 'custom':
      case 'onprem':
        return {
          apiKey: process.env.LLM_API_KEY || 'custom',
          baseURL: process.env.LLM_BASE_URL || 'http://localhost:8000/v1',
          headers: {},
        };

      default:
        logger.warn(`Unknown provider: ${provider}, using custom config`);
        return {
          apiKey: process.env.LLM_API_KEY || 'default',
          baseURL: process.env.LLM_BASE_URL || 'http://localhost:11434/v1',
          headers: {},
        };
    }
  }

  private getDefaultModel(): string {
    const provider = this.provider.toLowerCase();

    switch (provider) {
      case 'openrouter':
        return 'mistralai/mistral-7b-instruct';
      case 'deepseek':
        return 'deepseek-chat';
      case 'openai':
        return 'gpt-4';
      case 'ollama':
        return 'mistral:7b';
      case 'groq':
        return 'mixtral-8x7b-32768';
      case 'together':
        return 'mistralai/Mistral-7B-Instruct-v0.2';
      default:
        return 'mistral:7b';
    }
  }

  async chat(messages: any[], options?: any) {
    try {
      logger.info(`Calling LLM: ${this.provider} - ${this.model}`);
      const startTime = Date.now();

      // Set timeout based on provider (on-prem needs more time)
      const timeout = this.provider === 'onprem' || this.provider === 'custom' ? 60000 : 30000;
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`LLM request timeout after ${timeout/1000}s`)), timeout);
      });

      // Build request parameters with context length support
      const requestParams: any = {
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.max_tokens ?? 2000,
        stream: false,
      };

      // Add context length parameter for providers that support it
      const contextLength = this.getModelContextLength();
      if (contextLength > 4096) {
        // Add context window parameter based on provider
        if (this.provider === 'onprem' || this.provider === 'custom' || this.provider === 'ollama') {
          requestParams.context_length = contextLength;
          // Also try alternative parameter names
          requestParams.max_context = contextLength;
          requestParams.n_ctx = contextLength;
        }
      }

      const chatPromise = this.client.chat.completions.create(requestParams);

      const response = await Promise.race([chatPromise, timeoutPromise]) as any;
      
      const duration = Date.now() - startTime;
      logger.info(`LLM response received successfully in ${duration}ms`);
      return response;
    } catch (error: any) {
      logger.error(`LLM chat error (${this.provider} - ${this.model}):`, {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
        response: error.response?.data,
      });
      throw error;
    }
  }

  async *chatStream(messages: any[], options?: any) {
    try {
      // Build request parameters with context length support
      const requestParams: any = {
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.max_tokens ?? 2000,
        stream: true,
      };

      // Add context length parameter for providers that support it
      const contextLength = this.getModelContextLength();
      if (contextLength > 4096) {
        // Add context window parameter based on provider
        if (this.provider === 'onprem' || this.provider === 'custom' || this.provider === 'ollama') {
          requestParams.context_length = contextLength;
          requestParams.max_context = contextLength;
          requestParams.n_ctx = contextLength;
        }
      }

      const stream = await this.client.chat.completions.create(requestParams) as any;

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      logger.error(`LLM stream error (${this.provider}):`, error);
      throw error;
    }
  }

  async convertNaturalLanguageToSQL(
    naturalLanguageQuery: string,
    schema: any[],
    tableHints?: string[]
  ): Promise<{
    sql: string;
    explanation: string;
    confidence: number;
  }> {
    try {
      logger.info(`Converting natural language to SQL: "${naturalLanguageQuery}"`);

      const schemaInfo = this.formatSchemaForPrompt(schema);

      const systemPrompt = `Convert natural language to PostgreSQL SELECT queries.

${schemaInfo}

CRITICAL RULES:
1. ONLY use table/column names that EXIST in the schema above
2. NEVER guess or assume column names - only use what's shown
3. For JOINs, verify all referenced columns exist in both tables
4. For aggregates: ALL non-aggregated columns MUST be in GROUP BY
5. Use simple queries when possible - avoid complex JOINs unless necessary
6. Add LIMIT 100 for safety
7. NO table aliases unless absolutely necessary

SAFE PATTERNS:
- Single table: SELECT column1, column2 FROM table_name WHERE condition LIMIT 100
- Count: SELECT COUNT(*) FROM table_name WHERE condition
- Group by: SELECT column1, COUNT(*) FROM table_name GROUP BY column1 LIMIT 100

AVOID:
- Assuming foreign key column names
- Complex JOINs without verifying column names
- Table aliases like 'dcm', 's', etc. unless essential

Return ONLY JSON format: {"sql":"...","explanation":"...","confidence":0.0-1.0}`;

      const userPrompt = `Convert this natural language query to SQL: "${naturalLanguageQuery}"

${tableHints?.length ? `Focus on these tables: ${tableHints.join(', ')}` : ''}`;

      logger.info(`Sending request to LLM...`);

      const response = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.1, max_tokens: 1000 }
      );

      const content = response.choices[0]?.message?.content;
      logger.info(`LLM response content: ${content?.substring(0, 200)}...`);

      if (!content) {
        throw new Error('No response from LLM');
      }

      // Clean up response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(cleanContent);
        logger.info(`Successfully parsed SQL: ${parsed.sql}`);
        return {
          sql: parsed.sql,
          explanation: parsed.explanation,
          confidence: parsed.confidence || 0.8,
        };
      } catch (parseError) {
        logger.warn('Failed to parse JSON, trying fallback extraction');
        logger.warn(`Content was: ${cleanContent.substring(0, 500)}`);

        // Fallback: extract SQL from response
        const sqlMatch = cleanContent.match(/SELECT[\s\S]*?(?=;|$)/i);
        const sql = sqlMatch ? sqlMatch[0].trim() : '';
        logger.info(`Extracted SQL via fallback: ${sql}`);
        return {
          sql,
          explanation: 'Generated SQL query from natural language',
          confidence: 0.6,
        };
      }
    } catch (error: any) {
      logger.error('Error converting natural language to SQL:', {
        message: error.message,
        stack: error.stack,
        status: error.status,
        code: error.code,
      });
      throw new Error(`Failed to convert natural language to SQL: ${error.message}`);
    }
  }

  private formatSchemaForPrompt(schema: any[]): string {
    const tables = new Map<string, any[]>();
    const views = new Set<string>();

    schema.forEach((row) => {
      if (row.table_type === 'VIEW') {
        views.add(row.table_name);
      }

      if (!tables.has(row.table_name)) {
        tables.set(row.table_name, []);
      }
      if (row.column_name) {
        tables.get(row.table_name)?.push({
          column: row.column_name,
          type: row.data_type,
        });
      }
    });

    // ULTRA-COMPACT but PRECISE format
    let schemaText = 'AVAILABLE TABLES & COLUMNS (use EXACT names):\n\n';

    // Views first
    if (views.size > 0) {
      schemaText += 'VIEWS:\n';
      views.forEach(viewName => {
        const columns = tables.get(viewName) || [];
        const colNames = columns.slice(0, 12).map(c => c.column).join(', ');
        schemaText += `${viewName}: ${colNames}\n`;
      });
      schemaText += '\n';
    }

    // Regular tables
    tables.forEach((columns, tableName) => {
      if (views.has(tableName)) return;
      const colNames = columns.slice(0, 12).map(c => c.column).join(', ');
      schemaText += `${tableName}: ${colNames}\n`;
    });

    schemaText += '\n⚠️ ONLY use column names listed above. DO NOT guess or assume other columns exist.';

    return schemaText;
  }

  async generateDataSummary(
    naturalLanguageQuery: string,
    data: any[]
  ): Promise<string> {
    try {
      if (!data || data.length === 0) {
        return 'No data was found matching your query.';
      }

      // Prepare data summary
      const rowCount = data.length;
      const sampleRows = data.slice(0, 3);

      const systemPrompt = `You are a data analyst. Explain query results clearly and concisely.

FORMAT RULES:
1. Start with a brief overview sentence
2. Use markdown formatting:
   - **Bold** for emphasis on key metrics
   - Bullet points with "-" (not "*")
   - Line breaks between sections
3. Structure: Overview → Key Findings (3-5 bullets) → Notable Insight
4. Include specific numbers with context
5. Keep it under 150 words
6. No technical jargon

EXAMPLE:
Found 50 products with sales data.

Key findings:
- **Top performer**: Product A generated $45,200 in revenue from 320 sales
- **Highest rated**: Product B has 4.8/5 stars with strong customer satisfaction
- **Low stock alert**: Product C only has 5 units remaining despite high demand

The data shows strong performance across premium products, with customer ratings correlating to higher revenue.`;

      const userPrompt = `User asked: "${naturalLanguageQuery}"

Results: ${rowCount} records
Sample data (first 3):
${JSON.stringify(sampleRows, null, 2)}

Provide a clear, formatted summary.`;

      const response = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.3, max_tokens: 500 }
      );

      const summary = response.choices[0]?.message?.content?.trim();
      return summary || 'Results retrieved successfully.';
    } catch (error) {
      logger.error('Error generating data summary:', error);
      return `Found ${data.length} record(s) matching your query.`;
    }
  }

  private getModelContextLength(): number {
    const provider = this.provider.toLowerCase();
    const model = this.model.toLowerCase();

    // Model-specific context lengths
    if (model.includes('llama-3.1') || model.includes('llama3.1')) {
      return 32768; // Llama 3.1 supports up to 32K context
    }
    if (model.includes('llama-3.3') || model.includes('llama3.3')) {
      return 32768; // Llama 3.3 supports up to 32K context
    }
    if (model.includes('gemma2')) {
      return 8192; // Gemma 2 supports 8K context
    }
    if (model.includes('mistral') || model.includes('mixtral')) {
      return 32768; // Mistral models typically support 32K
    }
    if (model.includes('qwen')) {
      return 32768; // Qwen models support 32K
    }
    if (model.includes('deepseek')) {
      return 32768; // DeepSeek supports 32K
    }
    if (model.includes('gpt-4')) {
      return 128000; // GPT-4 supports 128K context
    }
    if (model.includes('gpt-3.5')) {
      return 16384; // GPT-3.5 supports 16K context
    }

    // Provider defaults
    switch (provider) {
      case 'openai':
        return 16384;
      case 'groq':
        return 32768;
      case 'openrouter':
        return 32768;
      case 'deepseek':
        return 32768;
      case 'onprem':
      case 'custom':
      case 'ollama':
        return 32768; // Assume modern models support larger context
      default:
        return 8192; // Conservative default
    }
  }

  getModelInfo() {
    return {
      provider: this.provider,
      model: this.model,
      contextLength: this.getModelContextLength(),
    };
  }
}

export const unifiedLLMService = new UnifiedLLMService();
