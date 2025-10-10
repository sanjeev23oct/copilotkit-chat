import OpenAI from 'openai';
import logger from '../../utils/logger';
import { DynamicSchemaDiscoveryService, DatabaseSchema, SchemaFilter } from '../dynamic-schema';

/**
 * Unified LLM Service
 * Supports: OpenRouter, DeepSeek, OpenAI, Ollama, Groq, and any OpenAI-compatible API
 * Switch models by changing .env configuration only!
 */
export class UnifiedLLMService {
  private client: OpenAI;
  private model: string;
  private provider: string;
  private schemaService?: DynamicSchemaDiscoveryService;

  constructor(schemaService?: DynamicSchemaDiscoveryService) {
    if (schemaService) {
      this.schemaService = schemaService;
    }
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
      logger.info(`LLM Base URL: ${this.client.baseURL}`);
      logger.info(`Request parameters: ${JSON.stringify({
        model: this.model,
        messageCount: messages.length,
        temperature: options?.temperature ?? 0.1
      })}`);
      
      const startTime = Date.now();

      // Set timeout based on provider (increased for Groq due to rate limits)
      const timeout = this.provider === 'groq' ? 60000 : (this.provider === 'onprem' || this.provider === 'custom' ? 120000 : 30000);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          logger.error(`LLM request timeout after ${timeout/1000}s for ${this.provider} at ${this.client.baseURL}`);
          reject(new Error(`LLM request timeout after ${timeout/1000}s`));
        }, timeout);
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
    schema?: any[] | DatabaseSchema,
    tableHints?: string[],
    options?: {
      schemaName?: string;
      useCache?: boolean;
      maxTables?: number;
      includeFunctions?: boolean;
    }
  ): Promise<{
    sql: string;
    explanation: string;
    confidence: number;
  }> {
    try {
      logger.info(`Converting natural language to SQL: "${naturalLanguageQuery}"`);

      let schemaInfo: string;
      
      // Use dynamic schema if available and no legacy schema provided
      if (this.schemaService && (!schema || Array.isArray(schema) && schema.length === 0)) {
        const dynamicSchema = await this.getDynamicSchema(options?.schemaName, tableHints, options);
        schemaInfo = this.formatDynamicSchemaForPrompt(dynamicSchema, tableHints);
      } else if (schema && !Array.isArray(schema)) {
        // Handle DatabaseSchema object
        schemaInfo = this.formatDynamicSchemaForPrompt(schema as DatabaseSchema, tableHints);
      } else {
        // Fallback to legacy schema format
        schemaInfo = this.formatSchemaForPrompt(schema as any[] || []);
      }

      const systemPrompt = `Convert natural language to PostgreSQL for RSSB system.

${schemaInfo}

CRITICAL RSSB SCHEMA RULES:
• sewadar table has: id, badge_number, applicant_name, centre_id, department_id, deployed_department_id
• area table has: id, area_name (NO department_id column)
• centre table has: id, centre_name (NO department_id column)
• department table has: id, department_name, department_code
• Use "applicant_name" NOT "name" or "sewadar_name"
• Add LIMIT 100 to all queries

CORRECT SEWADAR QUERY PATTERN (from actual RSSB system):
SELECT s.id, s.badge_number, s.applicant_name, s.father_husband_name,
       a.area_name, c.centre_name, d.department_name, st.status_name
FROM sewadar s
JOIN area a ON a.id = s.area_id
JOIN centre c ON c.id = s.centre_id
JOIN department d ON d.id = s.department_id
JOIN status st ON st.id = s.status_id
WHERE s.is_valid = true AND s.is_active = true
LIMIT 100;

FORBIDDEN PATTERNS:
❌ a.department_id (area table has NO department_id)
❌ c.department_id (centre table has NO department_id)
❌ centre_department_mapping JOIN (not needed for basic sewadar queries)

Return JSON: {"sql":"...","explanation":"...","confidence":0.0-1.0}`;

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
    // ULTRA-COMPACT schema format to stay within Groq's 6000 token limit
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
        tables.get(row.table_name)?.push(row.column_name);
      }
    });

    // ULTRA-COMPACT RSSB SCHEMA (Token-optimized)
    let schemaText = 'RSSB TABLES:\n\n';

    // Primary table - only key columns
    schemaText += 'sewadar: id, badge_number, applicant_name, status_id, area_id, centre_id, department_id, deployed_department_id, is_active, is_valid\n';
    
    // Key supporting tables - minimal columns
    schemaText += 'department: id, department_name, department_code, is_active\n';
    schemaText += 'centre: id, centre_name, is_active\n';
    schemaText += 'area: id, area_name, is_active\n';
    schemaText += 'status: id, status_name, is_active\n';

    // Views (if any)
    if (views.size > 0) {
      schemaText += '\nVIEWS:\n';
      views.forEach(viewName => {
        const columns = tables.get(viewName) || [];
        const keyColumns = columns.slice(0, 5).join(', ');
        schemaText += `${viewName}: ${keyColumns}\n`;
      });
    }

    // Other tables (very limited)
    const otherTables = Array.from(tables.keys())
      .filter(name => !views.has(name) && !['sewadar', 'department', 'centre', 'area'].includes(name))
      .slice(0, 10); // Limit to 10 tables max

    if (otherTables.length > 0) {
      schemaText += '\nOTHER:\n';
      otherTables.forEach(tableName => {
        const columns = tables.get(tableName) || [];
        const keyColumns = columns.slice(0, 3).join(', ');
        schemaText += `${tableName}: ${keyColumns}\n`;
      });
    }

    // Critical rules (ultra-compact)
    schemaText += '\nCRITICAL RULES:\n';
    schemaText += '• Use "applicant_name" NOT "name"\n';
    schemaText += '• area table has NO department_id column\n';
    schemaText += '• centre table has NO department_id column\n';
    schemaText += '• sewadar has centre_id/department_id directly\n';
    schemaText += '• Always use WHERE s.is_valid = true AND s.is_active = true\n';
    schemaText += '• Add LIMIT 100\n';

    return schemaText;
  }

  /**
   * Format dynamic schema for LLM prompt with intelligent optimization
   */
  private formatDynamicSchemaForPrompt(schema: DatabaseSchema, tableHints?: string[]): string {
    return this.schemaService?.generateSchemaContext(schema, {
      includeComments: true,
      includeConstraints: true,
      includeIndexes: false,
      maxTablesInContext: 50,
      prioritizeTables: tableHints || []
    }) || 'No schema available';
  }

  /**
   * Get dynamic schema with intelligent filtering
   */
  private async getDynamicSchema(
    schemaName: string = 'public',
    tableHints?: string[],
    options?: {
      maxTables?: number;
      includeFunctions?: boolean;
      useCache?: boolean;
    }
  ): Promise<DatabaseSchema> {
    if (!this.schemaService) {
      throw new Error('Schema service not available');
    }

    const filter: SchemaFilter = {
      includeSchemas: [schemaName],
      maxTables: options?.maxTables || 50,
      includeFunctions: options?.includeFunctions !== false,
      includeProcedures: true,
      includeViews: true,
      includeSystemTables: false
    };

    // Add table hints as patterns
    if (tableHints?.length) {
      filter.includeTablePatterns = tableHints;
    }

    return await this.schemaService.discoverSchema(schemaName, filter);
  }

  /**
   * Set schema service for dynamic discovery
   */
  setSchemaService(schemaService: DynamicSchemaDiscoveryService): void {
    this.schemaService = schemaService;
  }

  /**
   * Get schema service
   */
  getSchemaService(): DynamicSchemaDiscoveryService | undefined {
    return this.schemaService;
  }

  /**
   * Generate enhanced SQL with schema awareness
   */
  async generateEnhancedSQL(
    naturalLanguageQuery: string,
    options?: {
      schemaName?: string;
      tableHints?: string[];
      maxTables?: number;
      includeFunctions?: boolean;
      useCache?: boolean;
      requireExactMatch?: boolean;
    }
  ): Promise<{
    sql: string;
    explanation: string;
    confidence: number;
    usedTables: string[];
    suggestedIndexes?: string[];
    alternativeQueries?: string[];
  }> {
    const result = await this.convertNaturalLanguageToSQL(
      naturalLanguageQuery,
      undefined,
      options?.tableHints,
      options
    );

    // Extract used tables from SQL
    const usedTables = this.extractTablesFromSQL(result.sql);

    return {
      ...result,
      usedTables,
      suggestedIndexes: this.suggestIndexes(result.sql, usedTables),
      alternativeQueries: await this.generateAlternativeQueries(naturalLanguageQuery, usedTables)
    };
  }

  /**
   * Extract table names from SQL query
   */
  private extractTablesFromSQL(sql: string): string[] {
    const tablePattern = /(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const matches = sql.match(tablePattern) || [];
    return [...new Set(matches.map(match =>
      match.replace(/(?:FROM|JOIN)\s+/i, '').trim()
    ))];
  }

  /**
   * Suggest indexes based on SQL query
   */
  private suggestIndexes(sql: string, usedTables: string[]): string[] {
    const suggestions: string[] = [];
    
    // Look for WHERE clauses and suggest indexes
    const wherePattern = /WHERE\s+([^;]+)/i;
    const whereMatch = sql.match(wherePattern);
    
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnPattern = /([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*|\b[a-zA-Z_][a-zA-Z0-9_]*\b)\s*[=<>]/g;
      const columns = whereClause.match(columnPattern) || [];
      
      columns.forEach(col => {
        const cleanCol = col.replace(/\s*[=<>].*/, '').trim();
        if (cleanCol && !cleanCol.includes('(')) {
          suggestions.push(`CREATE INDEX IF NOT EXISTS idx_${cleanCol.replace('.', '_')} ON ${cleanCol.includes('.') ? cleanCol.split('.')[0] : usedTables[0] || 'table'} (${cleanCol.includes('.') ? cleanCol.split('.')[1] : cleanCol});`);
        }
      });
    }
    
    return [...new Set(suggestions)];
  }

  /**
   * Generate alternative query suggestions
   */
  private async generateAlternativeQueries(naturalLanguageQuery: string, usedTables: string[]): Promise<string[]> {
    try {
      const alternativePrompt = `Given this query intent: "${naturalLanguageQuery}"
And these tables: ${usedTables.join(', ')}

Suggest 2-3 alternative ways to phrase this query that might yield different insights:`;

      const response = await this.chat([
        { role: 'user', content: alternativePrompt }
      ], { temperature: 0.7, max_tokens: 300 });

      const suggestions = response.choices[0]?.message?.content?.split('\n').filter((line: string) =>
        line.trim() && !line.startsWith('#') && !line.startsWith('*')
      ) || [];

      return suggestions.slice(0, 3);
    } catch (error) {
      logger.warn('Failed to generate alternative queries:', error);
      return [];
    }
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
      baseURL: this.client.baseURL,
    };
  }

  // Test LLM connectivity
  async testConnection(): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
      logger.info(`Testing LLM connectivity: ${this.provider} at ${this.client.baseURL}`);
      const startTime = Date.now();

      // Simple test message
      const testResponse = await this.chat([
        {
          role: 'user',
          content: 'Hello! Please respond with just "OK" to test connectivity.'
        }
      ], { max_tokens: 10, temperature: 0 });

      const latency = Date.now() - startTime;
      logger.info(`LLM connectivity test successful in ${latency}ms`);

      return {
        success: true,
        message: `Connection successful to ${this.provider} (${latency}ms)`,
        latency
      };
    } catch (error: any) {
      logger.error(`LLM connectivity test failed:`, {
        provider: this.provider,
        baseURL: this.client.baseURL,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
}

export const unifiedLLMService = new UnifiedLLMService();
