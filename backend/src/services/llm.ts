import OpenAI from 'openai';
import logger from '../utils/logger';
import { databaseService } from './database';

export class LLMService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
    const baseURL = process.env.DEEPSEEK_API_KEY 
      ? 'https://api.deepseek.com'
      : undefined;

    if (!apiKey) {
      throw new Error('OpenAI API key or DeepSeek API key is required');
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  async convertNaturalLanguageToSQL(
    naturalLanguageQuery: string,
    tableHints?: string[]
  ): Promise<{
    sql: string;
    explanation: string;
    confidence: number;
  }> {
    try {
      // Get database schema
      const schema = await databaseService.getTableSchema();
      const schemaInfo = this.formatSchemaForPrompt(schema);

      // Get sample data for context
      const sampleDataPromises = tableHints?.map(async (table) => {
        const samples = await databaseService.getSampleData(table, 3);
        return { table, samples };
      }) || [];
      
      const sampleData = await Promise.all(sampleDataPromises);

      const systemPrompt = `You are an expert SQL query generator. Convert natural language queries to PostgreSQL SQL queries.

Database Schema:
${schemaInfo}

${sampleData.length > 0 ? `Sample Data:
${sampleData.map(({ table, samples }) => 
  `Table: ${table}\n${JSON.stringify(samples, null, 2)}`
).join('\n\n')}` : ''}

Rules:
1. Only generate SELECT queries for security
2. Use proper PostgreSQL syntax
3. Include appropriate JOINs when needed
4. Use LIMIT for large result sets
5. Handle case-insensitive searches with ILIKE
6. Return valid JSON with sql, explanation, and confidence (0-1)

Response format:
{
  "sql": "SELECT ...",
  "explanation": "This query...",
  "confidence": 0.95
}`;

      const userPrompt = `Convert this natural language query to SQL: "${naturalLanguageQuery}"

${tableHints?.length ? `Focus on these tables: ${tableHints.join(', ')}` : ''}`;

      const response = await this.openai.chat.completions.create({
        model: process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(content);
        return {
          sql: parsed.sql,
          explanation: parsed.explanation,
          confidence: parsed.confidence || 0.8
        };
      } catch (parseError) {
        // Fallback: extract SQL from response
        const sqlMatch = content.match(/SELECT[\s\S]*?(?=;|$)/i);
        return {
          sql: sqlMatch ? sqlMatch[0].trim() : '',
          explanation: 'Generated SQL query from natural language',
          confidence: 0.6
        };
      }
    } catch (error) {
      logger.error('Error converting natural language to SQL:', error);
      throw new Error('Failed to convert natural language to SQL');
    }
  }

  private formatSchemaForPrompt(schema: any[]): string {
    const tables = new Map<string, any[]>();
    
    schema.forEach(row => {
      if (!tables.has(row.table_name)) {
        tables.set(row.table_name, []);
      }
      if (row.column_name) {
        tables.get(row.table_name)?.push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default
        });
      }
    });

    let schemaText = '';
    tables.forEach((columns, tableName) => {
      schemaText += `Table: ${tableName}\n`;
      columns.forEach(col => {
        schemaText += `  - ${col.column} (${col.type})${col.nullable ? ' NULL' : ' NOT NULL'}\n`;
      });
      schemaText += '\n';
    });

    return schemaText;
  }
}

export const llmService = new LLMService();