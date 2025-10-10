import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';
import { 
  DynamicSchemaDiscoveryService, 
  DatabaseSchema, 
  SchemaFilter, 
  TableInfo,
  ForeignKeyRelation,
  createSchemaDiscoveryService 
} from './dynamic-schema';
import { UnifiedLLMService } from './llm/unified';

/**
 * Schema-Aware Database Service
 * 
 * Integrates dynamic schema discovery with database operations
 * to provide intelligent query generation and execution.
 */

export interface QueryContext {
  schemaName?: string;
  tableHints?: string[];
  maxTables?: number;
  includeFunctions?: boolean;
  useCache?: boolean;
  agentId?: string;
  sessionId?: string;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  sql?: string;
  explanation?: string;
  confidence?: number;
  usedTables?: string[];
  suggestedIndexes?: string[];
  alternativeQueries?: string[];
  executionTime?: number;
  rowCount?: number;
  schemaUsed?: DatabaseSchema;
  error?: string;
}

export interface SchemaInsight {
  totalTables: number;
  totalViews: number;
  totalFunctions: number;
  largestTables: { name: string; size: number; rows: number }[];
  mostConnectedTables: { name: string; connections: number }[];
  suggestedOptimizations: string[];
  dataQualityIssues: string[];
}

export class SchemaAwareDatabaseService {
  private pool: Pool;
  private schemaService: DynamicSchemaDiscoveryService;
  private llmService?: UnifiedLLMService;

  constructor(pool?: Pool) {
    this.pool = pool || new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_chat_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 30000,
      statement_timeout: 120000,
      query_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
    });

    this.schemaService = createSchemaDiscoveryService(this.pool);

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      logger.info('Schema-aware database connected successfully');
    });
  }

  /**
   * Initialize with LLM service for intelligent query generation
   */
  initializeWithLLM(llmService: UnifiedLLMService): void {
    this.llmService = llmService;
    this.llmService.setSchemaService(this.schemaService);
    logger.info('Schema-aware database service initialized with LLM support');
  }

  /**
   * Execute natural language query with full schema awareness
   */
  async executeNaturalLanguageQuery(
    query: string,
    context: QueryContext = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing natural language query: "${query}"`);

      if (!this.llmService) {
        throw new Error('LLM service not initialized. Call initializeWithLLM() first.');
      }

      // Discover schema if needed
      const schema = await this.discoverRelevantSchema(query, context);

      // Generate enhanced SQL
      const options: any = {};
      if (context.schemaName) options.schemaName = context.schemaName;
      if (context.tableHints) options.tableHints = context.tableHints;
      if (context.maxTables) options.maxTables = context.maxTables;
      if (context.includeFunctions !== undefined) options.includeFunctions = context.includeFunctions;
      if (context.useCache !== undefined) options.useCache = context.useCache;
      
      const sqlResult = await this.llmService.generateEnhancedSQL(query, options);

      // Execute the SQL
      const executionResult = await this.executeQuery(sqlResult.sql, context);

      const executionTime = Date.now() - startTime;

      const result: QueryResult = {
        success: true,
        data: executionResult.rows,
        sql: sqlResult.sql,
        explanation: sqlResult.explanation,
        confidence: sqlResult.confidence,
        usedTables: sqlResult.usedTables,
        executionTime,
        rowCount: executionResult.rowCount,
        schemaUsed: schema
      };
      
      if (sqlResult.suggestedIndexes) result.suggestedIndexes = sqlResult.suggestedIndexes;
      if (sqlResult.alternativeQueries) result.alternativeQueries = sqlResult.alternativeQueries;
      
      return result;
    } catch (error) {
      logger.error('Error executing natural language query:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Discover relevant schema based on query context
   */
  async discoverRelevantSchema(
    query: string,
    context: QueryContext
  ): Promise<DatabaseSchema> {
    const filter: SchemaFilter = {
      includeSchemas: [context.schemaName || 'public'],
      maxTables: context.maxTables || 50,
      includeFunctions: context.includeFunctions !== false,
      includeProcedures: true,
      includeViews: true,
      includeSystemTables: false
    };

    // Intelligent table pattern detection from query
    const detectedPatterns = this.extractTablePatternsFromQuery(query);
    const allPatterns = [...(context.tableHints || []), ...detectedPatterns];
    
    if (allPatterns.length > 0) {
      filter.includeTablePatterns = allPatterns;
    }

    return await this.schemaService.discoverSchema(
      context.schemaName || 'public',
      filter
    );
  }

  /**
   * Extract potential table patterns from natural language query
   */
  private extractTablePatternsFromQuery(query: string): string[] {
    const patterns: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Common domain-specific patterns
    const domainPatterns = {
      sewadar: ['sewadar', 'applicant', 'volunteer', 'member'],
      department: ['department', 'dept', 'division', 'unit'],
      attendance: ['attendance', 'swipe', 'check', 'present', 'absent'],
      area: ['area', 'region', 'zone', 'territory'],
      centre: ['centre', 'center', 'location', 'branch'],
      user: ['user', 'account', 'login', 'auth'],
      order: ['order', 'purchase', 'transaction', 'sale'],
      product: ['product', 'item', 'goods', 'inventory'],
      customer: ['customer', 'client', 'buyer', 'consumer'],
      payment: ['payment', 'billing', 'invoice', 'charge']
    };

    Object.entries(domainPatterns).forEach(([domain, keywords]) => {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        patterns.push(`%${domain}%`);
      }
    });

    return patterns;
  }

  /**
   * Execute SQL query with enhanced error handling
   */
  async executeQuery(
    sqlQuery: string, 
    context: QueryContext = {}
  ): Promise<{ rows: any[], rowCount: number }> {
    try {
      // Basic SQL injection protection
      const trimmedQuery = sqlQuery.trim().toLowerCase();
      const allowedStarts = ['select', 'call', 'execute', 'with'];
      const isAllowed = allowedStarts.some(start => trimmedQuery.startsWith(start));
      
      if (!isAllowed) {
        throw new Error('Only SELECT queries, function calls, and CTEs are allowed');
      }

      logger.info(`Agent ${context.agentId || 'unknown'}: Executing query: ${sqlQuery.substring(0, 100)}...`);
      
      const client = await this.pool.connect();
      try {
        const result = await client.query(sqlQuery);
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Error executing query for agent ${context.agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get schema insights and analytics
   */
  async getSchemaInsights(schemaName: string = 'public'): Promise<SchemaInsight> {
    try {
      const schema = await this.schemaService.discoverSchema(schemaName);
      
      // Analyze largest tables
      const largestTables = Array.from(schema.tables.values())
        .map(table => ({
          name: table.table_name,
          size: table.table_size_bytes,
          rows: table.estimated_row_count
        }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      // Analyze most connected tables
      const connectionCounts = new Map<string, number>();
      schema.foreign_key_relationships.forEach(fk => {
        connectionCounts.set(fk.source_table, (connectionCounts.get(fk.source_table) || 0) + 1);
        connectionCounts.set(fk.target_table, (connectionCounts.get(fk.target_table) || 0) + 1);
      });

      const mostConnectedTables = Array.from(connectionCounts.entries())
        .map(([name, connections]) => ({ name, connections }))
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 10);

      // Generate optimization suggestions
      const suggestedOptimizations = this.generateOptimizationSuggestions(schema);
      
      // Detect data quality issues
      const dataQualityIssues = await this.detectDataQualityIssues(schema);

      return {
        totalTables: schema.total_tables,
        totalViews: schema.total_views,
        totalFunctions: schema.total_functions,
        largestTables,
        mostConnectedTables,
        suggestedOptimizations,
        dataQualityIssues
      };
    } catch (error) {
      logger.error('Error generating schema insights:', error);
      throw error;
    }
  }

  /**
   * Generate optimization suggestions based on schema analysis
   */
  private generateOptimizationSuggestions(schema: DatabaseSchema): string[] {
    const suggestions: string[] = [];

    // Check for missing indexes on foreign keys
    schema.foreign_key_relationships.forEach(fk => {
      const sourceTable = schema.tables.get(fk.source_table);
      if (sourceTable) {
        const hasIndex = sourceTable.indexes.some(idx => 
          idx.column_names.includes(fk.source_column)
        );
        if (!hasIndex) {
          suggestions.push(`Consider adding index on ${fk.source_table}.${fk.source_column} (foreign key)`);
        }
      }
    });

    // Check for large tables without primary keys
    Array.from(schema.tables.values()).forEach(table => {
      if (table.primary_keys.length === 0 && table.estimated_row_count > 1000) {
        suggestions.push(`Table ${table.table_name} has no primary key but ${table.estimated_row_count} rows`);
      }
    });

    // Check for tables with many columns but no indexes
    Array.from(schema.tables.values()).forEach(table => {
      if (table.columns.length > 10 && table.indexes.length === 0) {
        suggestions.push(`Table ${table.table_name} has ${table.columns.length} columns but no indexes`);
      }
    });

    return suggestions;
  }

  /**
   * Detect potential data quality issues
   */
  private async detectDataQualityIssues(schema: DatabaseSchema): Promise<string[]> {
    const issues: string[] = [];

    try {
      const client = await this.pool.connect();
      
      try {
        // Check for tables with potential orphaned records
        for (const fk of schema.foreign_key_relationships) {
          const orphanQuery = `
            SELECT COUNT(*) as orphan_count
            FROM ${fk.source_table} s
            LEFT JOIN ${fk.target_table} t ON s.${fk.source_column} = t.${fk.target_column}
            WHERE t.${fk.target_column} IS NULL AND s.${fk.source_column} IS NOT NULL
          `;
          
          try {
            const result = await client.query(orphanQuery);
            const orphanCount = parseInt(result.rows[0]?.orphan_count || '0');
            if (orphanCount > 0) {
              issues.push(`${orphanCount} orphaned records in ${fk.source_table}.${fk.source_column}`);
            }
          } catch (error) {
            // Skip if query fails (e.g., table doesn't exist)
            logger.debug(`Skipping orphan check for ${fk.source_table}: ${error}`);
          }
        }

        // Check for tables with high percentage of NULL values
        for (const table of schema.tables.values()) {
          if (table.estimated_row_count > 100) {
            for (const column of table.columns) {
              if (column.is_nullable && !column.is_foreign_key) {
                try {
                  const nullQuery = `
                    SELECT 
                      COUNT(*) as total_count,
                      COUNT(${column.column_name}) as non_null_count
                    FROM ${table.table_name}
                    LIMIT 1000
                  `;
                  
                  const result = await client.query(nullQuery);
                  const totalCount = parseInt(result.rows[0]?.total_count || '0');
                  const nonNullCount = parseInt(result.rows[0]?.non_null_count || '0');
                  
                  if (totalCount > 0) {
                    const nullPercentage = ((totalCount - nonNullCount) / totalCount) * 100;
                    if (nullPercentage > 80) {
                      issues.push(`${table.table_name}.${column.column_name} is ${nullPercentage.toFixed(1)}% NULL`);
                    }
                  }
                } catch (error) {
                  // Skip if query fails
                  logger.debug(`Skipping NULL check for ${table.table_name}.${column.column_name}: ${error}`);
                }
              }
            }
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error detecting data quality issues:', error);
      issues.push('Unable to perform complete data quality analysis');
    }

    return issues;
  }

  /**
   * Get table relationships and suggest join strategies
   */
  async getTableRelationships(tableName: string, schemaName: string = 'public'): Promise<{
    directRelationships: ForeignKeyRelation[];
    indirectRelationships: string[];
    suggestedJoins: string[];
  }> {
    const schema = await this.schemaService.discoverSchema(schemaName);
    
    // Direct relationships (foreign keys)
    const directRelationships = schema.foreign_key_relationships.filter(
      fk => fk.source_table === tableName || fk.target_table === tableName
    );

    // Indirect relationships (through intermediate tables)
    const indirectRelationships: string[] = [];
    const visited = new Set<string>();
    
    const findIndirectRelations = (currentTable: string, depth: number = 0) => {
      if (depth > 2 || visited.has(currentTable)) return;
      visited.add(currentTable);
      
      schema.foreign_key_relationships.forEach(fk => {
        if (fk.source_table === currentTable && !indirectRelationships.includes(fk.target_table)) {
          indirectRelationships.push(fk.target_table);
          findIndirectRelations(fk.target_table, depth + 1);
        }
        if (fk.target_table === currentTable && !indirectRelationships.includes(fk.source_table)) {
          indirectRelationships.push(fk.source_table);
          findIndirectRelations(fk.source_table, depth + 1);
        }
      });
    };

    findIndirectRelations(tableName);

    // Generate suggested join patterns
    const suggestedJoins = directRelationships.map(fk => {
      if (fk.source_table === tableName) {
        return `JOIN ${fk.target_table} ON ${tableName}.${fk.source_column} = ${fk.target_table}.${fk.target_column}`;
      } else {
        return `JOIN ${fk.source_table} ON ${tableName}.${fk.target_column} = ${fk.source_table}.${fk.source_column}`;
      }
    });

    return {
      directRelationships,
      indirectRelationships: indirectRelationships.filter(table => table !== tableName),
      suggestedJoins
    };
  }

  /**
   * Get the dynamic schema service
   */
  getSchemaService(): DynamicSchemaDiscoveryService {
    return this.schemaService;
  }

  /**
   * Get the LLM service
   */
  getLLMService(): UnifiedLLMService | undefined {
    return this.llmService;
  }

  /**
   * Force refresh of schema cache
   */
  refreshSchemaCache(): void {
    this.schemaService.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.schemaService.getCacheStats();
  }

  /**
   * Detect schema changes
   */
  async detectSchemaChanges(schemaName: string = 'public') {
    return await this.schemaService.detectSchemaChanges(schemaName);
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Factory function to create schema-aware database service
 */
export function createSchemaAwareDatabaseService(pool?: Pool): SchemaAwareDatabaseService {
  return new SchemaAwareDatabaseService(pool);
}