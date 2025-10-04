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

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.max_tokens ?? 2000,
        stream: false,
      });

      logger.info(`LLM response received successfully`);
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
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.max_tokens ?? 2000,
        stream: true,
      });

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

RULES:
1. Only SELECT queries
2. Use EXACT table/column names from schema
3. For aggregates, ALL non-aggregated columns must be in GROUP BY with primary key
4. Use LEFT JOIN for optional data
5. Add LIMIT 100 for large results

EXAMPLE with VIEW:
Q: "products with sales and ratings"
A: {"sql":"SELECT product_name, total_quantity_sold as total_sales, total_revenue as revenue, avg_rating FROM product_sales_summary ORDER BY total_revenue DESC LIMIT 100","explanation":"Using pre-aggregated view for product sales data","confidence":0.98}

EXAMPLE with JOIN:
Q: "products with stock"
A: {"sql":"SELECT p.product_name, p.units_in_stock, COALESCE(SUM(oi.quantity),0) as sales FROM products p LEFT JOIN order_items oi ON p.product_id=oi.product_id GROUP BY p.product_id, p.product_name, p.units_in_stock LIMIT 100","explanation":"Products with stock and sales","confidence":0.95}

Return ONLY JSON (no markdown):`;

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

    // ULTRA-COMPACT FORMAT to fit in token limits
    let schemaText = 'TABLES (use exact names):\n';

    // Views first (compact)
    if (views.size > 0) {
      schemaText += '\nVIEWS:\n';
      views.forEach(viewName => {
        const columns = tables.get(viewName) || [];
        const colNames = columns.map(c => c.column).join(', ');
        schemaText += `${viewName}: ${colNames}\n`;
      });
    }

    // Tables (compact)
    tables.forEach((columns, tableName) => {
      if (views.has(tableName)) return;
      const colNames = columns.map(c => c.column).join(', ');
      schemaText += `${tableName}: ${colNames}\n`;
    });

    // Key relationships (compact)
    schemaText += '\nRELATIONS: products→categories,suppliers | orders→customers | order_items→orders,products | reviews→products,customers\n';

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
      const columns = Object.keys(data[0]);
      const sampleRows = data.slice(0, 3);

      const systemPrompt = `You are a data analyst assistant. Explain query results in clear, natural language.

RULES:
1. Write in a conversational, easy-to-understand style
2. Highlight key insights and patterns
3. Use bullet points for multiple items
4. Include specific numbers and statistics
5. Keep it concise but informative (2-4 paragraphs max)
6. Don't mention SQL or technical details unless relevant
7. Focus on what the data means, not how it was retrieved`;

      const userPrompt = `The user asked: "${naturalLanguageQuery}"

The query returned ${rowCount} record(s) with these columns: ${columns.join(', ')}

Here are the first few results:
${JSON.stringify(sampleRows, null, 2)}

Please provide a natural language summary of these results that answers the user's question.`;

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

  getModelInfo() {
    return {
      provider: this.provider,
      model: this.model,
    };
  }
}

export const unifiedLLMService = new UnifiedLLMService();
