import { unifiedLLMService } from './llm/unified';
import { databaseService } from './database';
import logger from '../utils/logger';

/**
 * LLM Service Wrapper
 * Uses the unified LLM service for all operations
 * Switch models by changing .env configuration!
 */
export class LLMService {
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

      // Use unified LLM service
      return await unifiedLLMService.convertNaturalLanguageToSQL(
        naturalLanguageQuery,
        schema,
        tableHints
      );
    } catch (error: any) {
      logger.error('Error converting natural language to SQL:', {
        message: error.message,
        stack: error.stack,
        status: error.status,
        response: error.response?.data
      });
      throw error; // Re-throw the original error with details
    }
  }

  getModelInfo() {
    return unifiedLLMService.getModelInfo();
  }
}

export const llmService = new LLMService();