import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';

export interface TableResource {
  table_name: string;
  table_type: string;
  column_name?: string;
  data_type?: string;
  is_nullable?: string;
  column_default?: string;
  constraint_type?: string;
  description?: string;
  domain: string;
  tags: string[];
}

export interface ProcedureResource {
  routine_name: string;
  routine_type: string;
  data_type?: string;
  parameter_name?: string;
  parameter_mode?: string;
  parameter_data_type?: string;
  routine_definition?: string;
  description?: string;
  domain: string;
  examples: string[];
}

export interface FunctionResource {
  routine_name: string;
  routine_type: string;
  data_type: string;
  parameter_name?: string;
  parameter_mode?: string;
  parameter_data_type?: string;
  routine_definition?: string;
  description?: string;
  domain: string;
  examples: string[];
}

export interface APIResource {
  name: string;
  endpoint: string;
  method: string;
  description: string;
  domain: string;
  authentication?: {
    type: string;
    token_env?: string;
  };
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
}

export interface AgentResourceCatalog {
  agentId: string;
  domain: string;
  tables: TableResource[];
  procedures: ProcedureResource[];
  functions: FunctionResource[];
  apis: APIResource[];
  tablePatterns: string[];
  procedurePatterns: string[];
  functionPatterns: string[];
}

export class EnhancedDatabaseService {
  private pool: Pool;
  private agentCatalogs: Map<string, AgentResourceCatalog> = new Map();

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_chat_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 60000,        // Increased from 30s to 60s
      connectionTimeoutMillis: 30000,  // Increased from 10s to 30s
      statement_timeout: 120000,       // Increased from 60s to 120s
      query_timeout: 30000,            // Added query timeout
      keepAlive: true,                 // Keep connections alive
      keepAliveInitialDelayMillis: 0,  // Start keep-alive immediately
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      logger.info('Database connected successfully');
    });
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  // Enhanced table schema discovery with agent filtering
  async getAgentTableSchema(agentId: string, tablePatterns: string[] = []): Promise<TableResource[]> {
    let whereClause = "t.table_schema = 'public'";
    
    if (tablePatterns.length > 0) {
      const patternConditions = tablePatterns.map((_pattern, index) =>
        `UPPER(t.table_name) LIKE $${index + 1}`
      ).join(' OR ');
      whereClause += ` AND (${patternConditions})`;
    }

    const query = `
      SELECT 
        t.table_name,
        t.table_type,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        tc.constraint_type,
        obj_description(pgc.oid) as description
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND c.table_schema = 'public'
      LEFT JOIN information_schema.table_constraints tc ON t.table_name = tc.table_name AND tc.table_schema = 'public'
      LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
      WHERE ${whereClause}
      ORDER BY t.table_name, c.ordinal_position;
    `;
    
    try {
      const params = tablePatterns.map(pattern => pattern.toUpperCase());
      const result = await this.query(query, params);
      
      const tables = result.rows.map((row: any): TableResource => ({
        ...row,
        domain: this.inferDomainFromTableName(row.table_name),
        tags: this.generateTableTags(row.table_name, row.column_name)
      }));

      logger.info(`Agent ${agentId}: Found ${new Set(tables.map((t: TableResource) => t.table_name)).size} tables`);
      return tables;
    } catch (error) {
      logger.error(`Error fetching table schema for agent ${agentId}:`, error);
      return [];
    }
  }

  // Discover stored procedures with agent filtering
  async getAgentProcedures(agentId: string, procedurePatterns: string[] = []): Promise<ProcedureResource[]> {
    try {
      // Simple query first to check if procedures exist
      const simpleQuery = `
        SELECT routine_name, routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE'
        LIMIT 10
      `;
      
      const testResult = await this.query(simpleQuery);
      if (testResult.rows.length === 0) {
        logger.info(`Agent ${agentId}: No procedures found in database`);
        return [];
      }

      let whereClause = "r.routine_schema = 'public' AND r.routine_type = 'PROCEDURE'";
      
      if (procedurePatterns.length > 0) {
        const patternConditions = procedurePatterns.map((_pattern, index) =>
          `UPPER(r.routine_name) LIKE $${index + 1}`
        ).join(' OR ');
        whereClause += ` AND (${patternConditions})`;
      }

      const query = `
        SELECT
          r.routine_name,
          r.routine_type,
          r.data_type,
          p.parameter_name,
          p.parameter_mode,
          p.data_type as parameter_data_type,
          r.routine_definition,
          obj_description(pr.oid) as description
        FROM information_schema.routines r
        LEFT JOIN information_schema.parameters p ON r.routine_name = p.specific_name AND r.routine_schema = p.specific_schema
        LEFT JOIN pg_proc pr ON pr.proname = r.routine_name
        WHERE ${whereClause}
        ORDER BY r.routine_name, p.ordinal_position;
      `;
      
      const params = procedurePatterns.map(pattern => pattern.toUpperCase());
      const result = await this.query(query, params);
      
      const procedures = result.rows.map((row: any): ProcedureResource => ({
        ...row,
        domain: this.inferDomainFromProcedureName(row.routine_name),
        examples: this.generateProcedureExamples(row.routine_name, row.parameter_name)
      }));

      logger.info(`Agent ${agentId}: Found ${new Set(procedures.map((p: ProcedureResource) => p.routine_name)).size} procedures`);
      return procedures;
    } catch (error) {
      logger.error(`Error fetching procedures for agent ${agentId}:`, error);
      return [];
    }
  }

  // Discover functions with agent filtering
  async getAgentFunctions(agentId: string, functionPatterns: string[] = []): Promise<FunctionResource[]> {
    try {
      // Simple query first to check if functions exist
      const simpleQuery = `
        SELECT routine_name, routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
        LIMIT 10
      `;
      
      const testResult = await this.query(simpleQuery);
      if (testResult.rows.length === 0) {
        logger.info(`Agent ${agentId}: No functions found in database`);
        return [];
      }

      let whereClause = "r.routine_schema = 'public' AND r.routine_type = 'FUNCTION'";
      
      if (functionPatterns.length > 0) {
        const patternConditions = functionPatterns.map((_pattern, index) =>
          `UPPER(r.routine_name) LIKE $${index + 1}`
        ).join(' OR ');
        whereClause += ` AND (${patternConditions})`;
      }

      const query = `
        SELECT
          r.routine_name,
          r.routine_type,
          r.data_type,
          p.parameter_name,
          p.parameter_mode,
          p.data_type as parameter_data_type,
          r.routine_definition,
          obj_description(pr.oid) as description
        FROM information_schema.routines r
        LEFT JOIN information_schema.parameters p ON r.routine_name = p.specific_name AND r.routine_schema = p.specific_schema
        LEFT JOIN pg_proc pr ON pr.proname = r.routine_name
        WHERE ${whereClause}
        ORDER BY r.routine_name, p.ordinal_position;
      `;
      
      const params = functionPatterns.map(pattern => pattern.toUpperCase());
      const result = await this.query(query, params);
      
      const functions = result.rows.map((row: any): FunctionResource => ({
        ...row,
        domain: this.inferDomainFromFunctionName(row.routine_name),
        examples: this.generateFunctionExamples(row.routine_name, row.parameter_name)
      }));

      logger.info(`Agent ${agentId}: Found ${new Set(functions.map((f: FunctionResource) => f.routine_name)).size} functions`);
      return functions;
    } catch (error) {
      logger.error(`Error fetching functions for agent ${agentId}:`, error);
      return [];
    }
  }

  // Build complete resource catalog for an agent
  async buildAgentResourceCatalog(
    agentId: string,
    domain: string,
    tablePatterns: string[],
    procedurePatterns: string[] = [],
    functionPatterns: string[] = [],
    apis: APIResource[] = []
  ): Promise<AgentResourceCatalog> {
    logger.info(`Building resource catalog for agent: ${agentId}`);

    const [tables, procedures, functions] = await Promise.all([
      this.getAgentTableSchema(agentId, tablePatterns),
      this.getAgentProcedures(agentId, procedurePatterns),
      this.getAgentFunctions(agentId, functionPatterns)
    ]);

    const catalog: AgentResourceCatalog = {
      agentId,
      domain,
      tables,
      procedures,
      functions,
      apis,
      tablePatterns,
      procedurePatterns,
      functionPatterns
    };

    this.agentCatalogs.set(agentId, catalog);
    
    logger.info(`Agent ${agentId} catalog: ${tables.length} tables, ${procedures.length} procedures, ${functions.length} functions, ${apis.length} APIs`);
    return catalog;
  }

  // Get cached catalog for agent
  getAgentCatalog(agentId: string): AgentResourceCatalog | undefined {
    return this.agentCatalogs.get(agentId);
  }

  // Execute procedure with parameters
  async executeProcedure(procedureName: string, parameters: Record<string, any> = {}): Promise<{ rows: any[], rowCount: number }> {
    try {
      const paramList = Object.entries(parameters)
        .map(([key, value]) => {
          if (typeof value === 'string') {
            return `@${key} = '${value}'`;
          }
          return `@${key} = ${value}`;
        })
        .join(', ');
      
      const sql = `CALL ${procedureName}(${paramList})`;
      logger.info(`Executing procedure: ${sql}`);
      
      const result = await this.query(sql);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      logger.error(`Error executing procedure ${procedureName}:`, error);
      throw error;
    }
  }

  // Execute function with parameters (enhanced for RSSB functions)
  async executeFunction(functionName: string, parameters: any[] = []): Promise<{ rows: any[], rowCount: number }> {
    try {
      const paramList = parameters.map(param => {
        if (param === null || param === undefined) {
          return 'null';
        }
        if (typeof param === 'string') {
          return `'${param.replace(/'/g, "''")}'`; // Escape single quotes
        }
        return param;
      }).join(', ');
      
      // For RSSB functions that return table sets, use SELECT * FROM
      const isTableFunction = functionName.includes('ufunc_get_sewadar') || functionName.includes('ufunc_attendance');
      const sql = isTableFunction
        ? `SELECT * FROM ${functionName}(${paramList})`
        : `SELECT ${functionName}(${paramList}) as result`;
        
      logger.info(`Executing function: ${sql}`);
      
      const result = await this.query(sql);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      logger.error(`Error executing function ${functionName}:`, error);
      throw error;
    }
  }

  // Enhanced executeQuery with agent context
  async executeQuery(sqlQuery: string, agentId?: string): Promise<{ rows: any[], rowCount: number }> {
    try {
      // Basic SQL injection protection - only allow SELECT statements and CALL/function calls
      const trimmedQuery = sqlQuery.trim().toLowerCase();
      const allowedStarts = ['select', 'call', 'execute'];
      const isAllowed = allowedStarts.some(start => trimmedQuery.startsWith(start));
      
      if (!isAllowed) {
        throw new Error('Only SELECT queries, CALL procedures, and function executions are allowed');
      }

      logger.info(`Agent ${agentId || 'unknown'}: Executing query: ${sqlQuery.substring(0, 100)}...`);
      
      const result = await this.query(sqlQuery);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      logger.error(`Error executing query for agent ${agentId}:`, error);
      throw error;
    }
  }

  // Get sample data with agent context
  async getSampleData(tableName: string, limit: number = 5, agentId?: string): Promise<any[]> {
    try {
      // Verify agent has access to this table
      if (agentId) {
        const catalog = this.getAgentCatalog(agentId);
        if (catalog) {
          const hasAccess = catalog.tables.some(table => table.table_name === tableName);
          if (!hasAccess) {
            throw new Error(`Agent ${agentId} does not have access to table ${tableName}`);
          }
        }
      }

      const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const query = `SELECT * FROM ${sanitizedTableName} LIMIT $1`;
      const result = await this.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching sample data from ${tableName} for agent ${agentId}:`, error);
      return [];
    }
  }

  // Helper methods for domain inference and tag generation
  private inferDomainFromTableName(tableName: string): string {
    const name = tableName.toLowerCase();
    
    // RSSB-specific domain mapping
    if (name.includes('sewadar') || name.includes('profile') || name.includes('personal')) {
      return 'sewadar';
    }
    if (name === 'area' || name === 'centre' || name === 'centre_type' || name === 'centre_department_mapping') {
      return 'sewadar'; // RSSB structure tables belong to sewadar domain
    }
    if (name.includes('department') || name.includes('dept') || name.includes('role')) {
      return 'department';
    }
    if (name.includes('attendance') || name.includes('swipe') || name.includes('leave')) {
      return 'attendance';
    }
    if (name.includes('report') || name.includes('analytics') || name.includes('metric')) {
      return 'reports';
    }
    if (name.includes('user') || name.includes('admin') || name.includes('audit')) {
      return 'admin';
    }
    return 'general';
  }

  private inferDomainFromProcedureName(procedureName: string): string {
    return this.inferDomainFromTableName(procedureName);
  }

  private inferDomainFromFunctionName(functionName: string): string {
    return this.inferDomainFromTableName(functionName);
  }

  private generateTableTags(tableName: string, columnName?: string): string[] {
    const tags: string[] = [];
    const name = tableName.toLowerCase();
    
    if (name.includes('master')) tags.push('master-data');
    if (name.includes('log')) tags.push('logging');
    if (name.includes('temp')) tags.push('temporary');
    if (name.includes('view')) tags.push('view');
    if (columnName) {
      if (columnName.includes('id')) tags.push('identity');
      if (columnName.includes('date') || columnName.includes('time')) tags.push('temporal');
      if (columnName.includes('status')) tags.push('status');
    }
    
    return tags;
  }

  private generateProcedureExamples(procedureName: string, parameterName?: string): string[] {
    const examples: string[] = [];
    const name = procedureName.toLowerCase();
    
    if (name.includes('get')) {
      examples.push(`CALL ${procedureName}('${parameterName || 'value'}')`);
    }
    if (name.includes('update')) {
      examples.push(`CALL ${procedureName}(${parameterName || 'param'} = 'new_value')`);
    }
    if (name.includes('generate')) {
      examples.push(`CALL ${procedureName}('2024-01-01', '2024-01-31')`);
    }
    
    return examples;
  }

  private generateFunctionExamples(functionName: string, parameterName?: string): string[] {
    const examples: string[] = [];
    const name = functionName.toLowerCase();
    
    // RSSB-specific function examples
    if (name === 'ufunc_get_sewadar_basics') {
      examples.push(`SELECT * FROM public.ufunc_get_sewadar_basics('BH0011GC4321', 'ss-admin', 'BH0011GB8271', 0)`);
    } else if (name === 'ufunc_get_sewadar_search') {
      examples.push(`SELECT * FROM public.ufunc_get_sewadar_search('BH0011GB2002', 'ss-admin', 'Gulshan', null, null, null, null, null, null, 1, 100)`);
    } else if (name === 'ufunc_attendance_summary') {
      examples.push(`SELECT * FROM public.ufunc_attendance_summary('BH0011GC4321', 'ss-admin', 'BH0011GB8271', '2024-01-01', '2024-01-31')`);
    } else if (name.includes('calculate')) {
      examples.push(`SELECT ${functionName}('${parameterName || 'input'}')`);
    } else if (name.includes('get')) {
      examples.push(`SELECT ${functionName}(123) as result`);
    } else if (name.includes('validate')) {
      examples.push(`SELECT ${functionName}('test_value') as is_valid`);
    }
    
    return examples;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const enhancedDatabaseService = new EnhancedDatabaseService();