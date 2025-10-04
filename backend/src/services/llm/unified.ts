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

      const systemPrompt = `You are an expert SQL query generator. Convert natural language queries to PostgreSQL SQL queries.

Database Schema:
${schemaInfo}

CRITICAL RULES:
1. Only generate SELECT queries for security
2. Use proper PostgreSQL syntax
3. Include appropriate JOINs when needed
4. Use LIMIT for large result sets
5. Handle case-insensitive searches with ILIKE
6. ALWAYS return ONLY valid JSON - no markdown, no code blocks, no extra text
7. The SQL must be a single line without line breaks

RESPONSE FORMAT (return ONLY this JSON, nothing else):
{
  "sql": "SELECT * FROM users LIMIT 10",
  "explanation": "This query retrieves all users with a limit of 10 rows",
  "confidence": 0.95
}

DO NOT include markdown code blocks like \`\`\`json or \`\`\`. Return ONLY the raw JSON object.`;

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

    schema.forEach((row) => {
      if (!tables.has(row.table_name)) {
        tables.set(row.table_name, []);
      }
      if (row.column_name) {
        tables.get(row.table_name)?.push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
        });
      }
    });

    let schemaText = '';
    tables.forEach((columns, tableName) => {
      schemaText += `Table: ${tableName}\n`;
      columns.forEach((col) => {
        schemaText += `  - ${col.column} (${col.type})${col.nullable ? ' NULL' : ' NOT NULL'}\n`;
      });
      schemaText += '\n';
    });

    return schemaText;
  }

  getModelInfo() {
    return {
      provider: this.provider,
      model: this.model,
    };
  }
}

export const unifiedLLMService = new UnifiedLLMService();
