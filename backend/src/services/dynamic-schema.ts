import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';

/**
 * Dynamic Database Schema Discovery Service
 * 
 * This service automatically discovers and maps the complete database schema
 * including tables, columns, constraints, foreign keys, indexes, views, 
 * functions, and procedures without relying on hardcoded configurations.
 */

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  ordinal_position: number;
  is_primary_key: boolean;
  is_unique: boolean;
  is_foreign_key: boolean;
  foreign_key_table?: string;
  foreign_key_column?: string;
  check_constraints: string[];
  column_comment?: string;
}

export interface ForeignKeyRelation {
  constraint_name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  update_rule: string;
  delete_rule: string;
}

export interface IndexInfo {
  index_name: string;
  table_name: string;
  column_names: string[];
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
  definition: string;
}

export interface TableInfo {
  table_name: string;
  table_type: 'TABLE' | 'VIEW' | 'MATERIALIZED VIEW';
  table_schema: string;
  columns: ColumnInfo[];
  primary_keys: string[];
  foreign_keys: ForeignKeyRelation[];
  indexes: IndexInfo[];
  table_comment?: string;
  estimated_row_count: number;
  table_size_bytes: number;
  last_analyzed?: Date;
}

export interface FunctionInfo {
  function_name: string;
  function_schema: string;
  function_type: 'FUNCTION' | 'PROCEDURE' | 'AGGREGATE';
  return_type: string;
  parameters: {
    parameter_name: string;
    parameter_mode: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC';
    data_type: string;
    parameter_default?: string;
  }[];
  function_definition?: string;
  function_comment?: string;
  is_security_definer: boolean;
  volatility: 'IMMUTABLE' | 'STABLE' | 'VOLATILE';
}

export interface DatabaseSchema {
  schema_name: string;
  tables: Map<string, TableInfo>;
  views: Map<string, TableInfo>;
  functions: Map<string, FunctionInfo>;
  procedures: Map<string, FunctionInfo>;
  foreign_key_relationships: ForeignKeyRelation[];
  schema_dependencies: Map<string, string[]>;
  discovery_timestamp: Date;
  database_version: string;
  total_tables: number;
  total_views: number;
  total_functions: number;
  total_procedures: number;
}

export interface SchemaFilter {
  includeSchemas?: string[];
  excludeSchemas?: string[];
  includeTablePatterns?: string[];
  excludeTablePatterns?: string[];
  includeFunctions?: boolean;
  includeProcedures?: boolean;
  includeViews?: boolean;
  includeSystemTables?: boolean;
  maxTables?: number;
}

export class DynamicSchemaDiscoveryService {
  private pool: Pool;
  private schemaCache: Map<string, DatabaseSchema> = new Map();
  private cacheExpiry: Map<string, Date> = new Map();
  private readonly CACHE_DURATION_MS = 300000; // 5 minutes

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Discover complete database schema with optional filtering
   */
  async discoverSchema(
    schemaName: string = 'public',
    filter: SchemaFilter = {}
  ): Promise<DatabaseSchema> {
    const cacheKey = `${schemaName}_${JSON.stringify(filter)}`;
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.schemaCache.get(cacheKey);
      if (cached) {
        logger.info(`Returning cached schema for ${schemaName}`);
        return cached;
      }
    }

    logger.info(`Discovering database schema for: ${schemaName}`);
    const startTime = Date.now();

    try {
      const client = await this.pool.connect();
      
      try {
        // Get database version
        const versionResult = await client.query('SELECT version()');
        const dbVersion = versionResult.rows[0]?.version || 'Unknown';

        // Discover all components in parallel
        const [
          tables,
          views, 
          functions,
          procedures,
          foreignKeys
        ] = await Promise.all([
          this.discoverTables(client, schemaName, filter),
          this.discoverViews(client, schemaName, filter),
          filter.includeFunctions !== false ? this.discoverFunctions(client, schemaName) : new Map<string, FunctionInfo>(),
          filter.includeProcedures !== false ? this.discoverProcedures(client, schemaName) : new Map<string, FunctionInfo>(),
          this.discoverForeignKeyRelationships(client, schemaName)
        ]);

        // Build schema dependencies
        const dependencies = this.buildSchemaDependencies(tables, views, foreignKeys);

        const schema: DatabaseSchema = {
          schema_name: schemaName,
          tables,
          views,
          functions,
          procedures,
          foreign_key_relationships: foreignKeys,
          schema_dependencies: dependencies,
          discovery_timestamp: new Date(),
          database_version: dbVersion,
          total_tables: tables.size,
          total_views: views.size,
          total_functions: functions.size,
          total_procedures: procedures.size
        };

        // Cache the result
        this.schemaCache.set(cacheKey, schema);
        this.cacheExpiry.set(cacheKey, new Date(Date.now() + this.CACHE_DURATION_MS));

        const duration = Date.now() - startTime;
        logger.info(`Schema discovery completed in ${duration}ms: ${schema.total_tables} tables, ${schema.total_views} views, ${schema.total_functions} functions, ${schema.total_procedures} procedures`);

        return schema;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error discovering database schema:', error);
      throw new Error(`Schema discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover all tables with comprehensive metadata
   */
  private async discoverTables(
    client: PoolClient, 
    schemaName: string, 
    filter: SchemaFilter
  ): Promise<Map<string, TableInfo>> {
    const tables = new Map<string, TableInfo>();

    // Build WHERE clause for filtering
    let whereClause = `t.table_schema = $1 AND t.table_type = 'BASE TABLE'`;
    const params: any[] = [schemaName];
    let paramIndex = 2;

    if (filter.includeTablePatterns?.length) {
      const patterns = filter.includeTablePatterns.map(() => `t.table_name ILIKE $${paramIndex++}`).join(' OR ');
      whereClause += ` AND (${patterns})`;
      params.push(...filter.includeTablePatterns.map(p => `%${p}%`));
    }

    if (filter.excludeTablePatterns?.length) {
      const patterns = filter.excludeTablePatterns.map(() => `t.table_name NOT ILIKE $${paramIndex++}`).join(' AND ');
      whereClause += ` AND (${patterns})`;
      params.push(...filter.excludeTablePatterns.map(p => `%${p}%`));
    }

    // Get basic table information
    const tableQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        t.table_schema,
        obj_description(c.oid) as table_comment,
        pg_size_pretty(pg_total_relation_size(c.oid)) as table_size,
        pg_total_relation_size(c.oid) as table_size_bytes,
        c.reltuples::bigint as estimated_row_count
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_namespace n ON n.nspname = t.table_schema AND c.relnamespace = n.oid
      WHERE ${whereClause}
      ORDER BY t.table_name
      ${filter.maxTables ? `LIMIT ${filter.maxTables}` : ''}
    `;

    const tableResult = await client.query(tableQuery, params);
    
    for (const row of tableResult.rows) {
      const tableName = row.table_name;
      
      // Get detailed information for each table
      const [columns, indexes, foreignKeys] = await Promise.all([
        this.discoverTableColumns(client, schemaName, tableName),
        this.discoverTableIndexes(client, schemaName, tableName),
        this.discoverTableForeignKeys(client, schemaName, tableName)
      ]);

      // Extract primary keys
      const primaryKeys = columns
        .filter(col => col.is_primary_key)
        .map(col => col.column_name);

      const tableInfo: TableInfo = {
        table_name: tableName,
        table_type: 'TABLE',
        table_schema: schemaName,
        columns,
        primary_keys: primaryKeys,
        foreign_keys: foreignKeys,
        indexes,
        table_comment: row.table_comment,
        estimated_row_count: parseInt(row.estimated_row_count) || 0,
        table_size_bytes: parseInt(row.table_size_bytes) || 0,
        last_analyzed: new Date()
      };

      tables.set(tableName, tableInfo);
    }

    return tables;
  }

  /**
   * Discover columns for a specific table
   */
  private async discoverTableColumns(
    client: PoolClient,
    schemaName: string,
    tableName: string
  ): Promise<ColumnInfo[]> {
    const query = `
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable::boolean,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.ordinal_position,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN uk.column_name IS NOT NULL THEN true ELSE false END as is_unique,
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
        fk.foreign_table_name as foreign_key_table,
        fk.foreign_column_name as foreign_key_column,
        COALESCE(
          array_agg(cc.check_clause) FILTER (WHERE cc.check_clause IS NOT NULL),
          ARRAY[]::text[]
        ) as check_constraints,
        col_description(pgc.oid, c.ordinal_position) as column_comment
      FROM information_schema.columns c
      LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
      LEFT JOIN pg_namespace pgn ON pgn.nspname = c.table_schema AND pgc.relnamespace = pgn.oid
      
      -- Primary key detection
      LEFT JOIN (
        SELECT kcu.column_name, kcu.table_name, kcu.table_schema
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1 AND tc.table_name = $2
      ) pk ON pk.column_name = c.column_name
      
      -- Unique constraint detection
      LEFT JOIN (
        SELECT kcu.column_name, kcu.table_name, kcu.table_schema
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = $1 AND tc.table_name = $2
      ) uk ON uk.column_name = c.column_name
      
      -- Foreign key detection
      LEFT JOIN (
        SELECT 
          kcu.column_name,
          kcu.table_name,
          kcu.table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1 AND tc.table_name = $2
      ) fk ON fk.column_name = c.column_name
      
      -- Check constraints
      LEFT JOIN (
        SELECT 
          kcu.column_name,
          cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.check_constraints cc
          ON cc.constraint_name = tc.constraint_name
          AND cc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'CHECK'
          AND tc.table_schema = $1 AND tc.table_name = $2
      ) cc ON cc.column_name = c.column_name
      
      WHERE c.table_schema = $1 AND c.table_name = $2
      GROUP BY 
        c.column_name, c.data_type, c.is_nullable, c.column_default,
        c.character_maximum_length, c.numeric_precision, c.numeric_scale,
        c.ordinal_position, pk.column_name, uk.column_name, fk.column_name,
        fk.foreign_table_name, fk.foreign_column_name, pgc.oid
      ORDER BY c.ordinal_position
    `;

    const result = await client.query(query, [schemaName, tableName]);
    
    return result.rows.map(row => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
      column_default: row.column_default,
      character_maximum_length: row.character_maximum_length,
      numeric_precision: row.numeric_precision,
      numeric_scale: row.numeric_scale,
      ordinal_position: row.ordinal_position,
      is_primary_key: row.is_primary_key,
      is_unique: row.is_unique,
      is_foreign_key: row.is_foreign_key,
      foreign_key_table: row.foreign_key_table,
      foreign_key_column: row.foreign_key_column,
      check_constraints: row.check_constraints || [],
      column_comment: row.column_comment
    }));
  }

  /**
   * Discover indexes for a specific table
   */
  private async discoverTableIndexes(
    client: PoolClient,
    schemaName: string,
    tableName: string
  ): Promise<IndexInfo[]> {
    const query = `
      SELECT 
        i.relname as index_name,
        t.relname as table_name,
        array_agg(a.attname ORDER BY c.ordinality) as column_names,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        am.amname as index_type,
        pg_get_indexdef(i.oid) as definition
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE n.nspname = $1 AND t.relname = $2
      GROUP BY i.relname, t.relname, ix.indisunique, ix.indisprimary, am.amname, i.oid
      ORDER BY i.relname
    `;

    const result = await client.query(query, [schemaName, tableName]);
    
    return result.rows.map(row => ({
      index_name: row.index_name,
      table_name: row.table_name,
      column_names: row.column_names,
      is_unique: row.is_unique,
      is_primary: row.is_primary,
      index_type: row.index_type,
      definition: row.definition
    }));
  }

  /**
   * Discover foreign keys for a specific table
   */
  private async discoverTableForeignKeys(
    client: PoolClient,
    schemaName: string,
    tableName: string
  ): Promise<ForeignKeyRelation[]> {
    const query = `
      SELECT 
        tc.constraint_name,
        tc.table_name as source_table,
        kcu.column_name as source_column,
        ccu.table_name as target_table,
        ccu.column_name as target_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1 
        AND tc.table_name = $2
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `;

    const result = await client.query(query, [schemaName, tableName]);
    
    return result.rows.map(row => ({
      constraint_name: row.constraint_name,
      source_table: row.source_table,
      source_column: row.source_column,
      target_table: row.target_table,
      target_column: row.target_column,
      update_rule: row.update_rule,
      delete_rule: row.delete_rule
    }));
  }

  /**
   * Discover all views in the schema
   */
  private async discoverViews(
    client: PoolClient,
    schemaName: string,
    filter: SchemaFilter
  ): Promise<Map<string, TableInfo>> {
    if (filter.includeViews === false) {
      return new Map();
    }

    const views = new Map<string, TableInfo>();
    
    const query = `
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = $1 
        AND table_type IN ('VIEW', 'MATERIALIZED VIEW')
      ORDER BY table_name
    `;

    const result = await client.query(query, [schemaName]);
    
    for (const row of result.rows) {
      const viewName = row.table_name;
      const columns = await this.discoverTableColumns(client, schemaName, viewName);
      
      const viewInfo: TableInfo = {
        table_name: viewName,
        table_type: row.table_type as 'VIEW' | 'MATERIALIZED VIEW',
        table_schema: schemaName,
        columns,
        primary_keys: [],
        foreign_keys: [],
        indexes: [],
        estimated_row_count: 0,
        table_size_bytes: 0,
        last_analyzed: new Date()
      };

      views.set(viewName, viewInfo);
    }

    return views;
  }

  /**
   * Discover all functions in the schema
   */
  private async discoverFunctions(
    client: PoolClient,
    schemaName: string
  ): Promise<Map<string, FunctionInfo>> {
    const functions = new Map<string, FunctionInfo>();
    
    const query = `
      SELECT 
        r.routine_name as function_name,
        r.routine_schema as function_schema,
        r.routine_type as function_type,
        r.data_type as return_type,
        r.routine_definition as function_definition,
        r.security_type = 'DEFINER' as is_security_definer,
        COALESCE(r.is_deterministic, 'NO') = 'YES' as is_deterministic,
        obj_description(p.oid) as function_comment
      FROM information_schema.routines r
      LEFT JOIN pg_proc p ON p.proname = r.routine_name
      LEFT JOIN pg_namespace n ON n.nspname = r.routine_schema AND p.pronamespace = n.oid
      WHERE r.routine_schema = $1 
        AND r.routine_type = 'FUNCTION'
      ORDER BY r.routine_name
    `;

    const result = await client.query(query, [schemaName]);
    
    for (const row of result.rows) {
      const functionName = row.function_name;
      const parameters = await this.discoverFunctionParameters(client, schemaName, functionName);
      
      const functionInfo: FunctionInfo = {
        function_name: functionName,
        function_schema: row.function_schema,
        function_type: 'FUNCTION',
        return_type: row.return_type,
        parameters,
        function_definition: row.function_definition,
        function_comment: row.function_comment,
        is_security_definer: row.is_security_definer,
        volatility: row.is_deterministic ? 'IMMUTABLE' : 'VOLATILE'
      };

      functions.set(functionName, functionInfo);
    }

    return functions;
  }

  /**
   * Discover all procedures in the schema
   */
  private async discoverProcedures(
    client: PoolClient,
    schemaName: string
  ): Promise<Map<string, FunctionInfo>> {
    const procedures = new Map<string, FunctionInfo>();
    
    const query = `
      SELECT 
        r.routine_name as function_name,
        r.routine_schema as function_schema,
        r.routine_type as function_type,
        r.routine_definition as function_definition,
        obj_description(p.oid) as function_comment
      FROM information_schema.routines r
      LEFT JOIN pg_proc p ON p.proname = r.routine_name
      LEFT JOIN pg_namespace n ON n.nspname = r.routine_schema AND p.pronamespace = n.oid
      WHERE r.routine_schema = $1 
        AND r.routine_type = 'PROCEDURE'
      ORDER BY r.routine_name
    `;

    const result = await client.query(query, [schemaName]);
    
    for (const row of result.rows) {
      const procedureName = row.function_name;
      const parameters = await this.discoverFunctionParameters(client, schemaName, procedureName);
      
      const procedureInfo: FunctionInfo = {
        function_name: procedureName,
        function_schema: row.function_schema,
        function_type: 'PROCEDURE',
        return_type: 'void',
        parameters,
        function_definition: row.function_definition,
        function_comment: row.function_comment,
        is_security_definer: false,
        volatility: 'VOLATILE'
      };

      procedures.set(procedureName, procedureInfo);
    }

    return procedures;
  }

  /**
   * Discover parameters for a function or procedure
   */
  private async discoverFunctionParameters(
    client: PoolClient,
    schemaName: string,
    routineName: string
  ): Promise<FunctionInfo['parameters']> {
    const query = `
      SELECT 
        parameter_name,
        parameter_mode,
        data_type,
        parameter_default
      FROM information_schema.parameters
      WHERE specific_schema = $1 
        AND specific_name = $2
      ORDER BY ordinal_position
    `;

    const result = await client.query(query, [schemaName, routineName]);
    
    return result.rows.map(row => ({
      parameter_name: row.parameter_name || `param_${row.ordinal_position}`,
      parameter_mode: row.parameter_mode as 'IN' | 'OUT' | 'INOUT' | 'VARIADIC',
      data_type: row.data_type,
      parameter_default: row.parameter_default
    }));
  }

  /**
   * Discover all foreign key relationships in the schema
   */
  private async discoverForeignKeyRelationships(
    client: PoolClient,
    schemaName: string
  ): Promise<ForeignKeyRelation[]> {
    const query = `
      SELECT 
        tc.constraint_name,
        tc.table_name as source_table,
        kcu.column_name as source_column,
        ccu.table_name as target_table,
        ccu.column_name as target_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
      ORDER BY tc.table_name, tc.constraint_name
    `;

    const result = await client.query(query, [schemaName]);
    
    return result.rows.map(row => ({
      constraint_name: row.constraint_name,
      source_table: row.source_table,
      source_column: row.source_column,
      target_table: row.target_table,
      target_column: row.target_column,
      update_rule: row.update_rule,
      delete_rule: row.delete_rule
    }));
  }

  /**
   * Build schema dependencies map
   */
  private buildSchemaDependencies(
    tables: Map<string, TableInfo>,
    views: Map<string, TableInfo>,
    foreignKeys: ForeignKeyRelation[]
  ): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    
    // Initialize all tables and views
    [...tables.keys(), ...views.keys()].forEach(name => {
      dependencies.set(name, []);
    });
    
    // Add foreign key dependencies
    foreignKeys.forEach(fk => {
      const deps = dependencies.get(fk.source_table) || [];
      if (!deps.includes(fk.target_table)) {
        deps.push(fk.target_table);
        dependencies.set(fk.source_table, deps);
      }
    });
    
    return dependencies;
  }

  /**
   * Generate optimized schema context for LLM
   */
  generateSchemaContext(schema: DatabaseSchema, options: {
    includeComments?: boolean;
    includeConstraints?: boolean;
    includeIndexes?: boolean;
    maxTablesInContext?: number;
    prioritizeTables?: string[];
  } = {}): string {
    const {
      includeComments = true,
      includeConstraints = true,
      includeIndexes = false,
      maxTablesInContext = 50,
      prioritizeTables = []
    } = options;

    let context = `DATABASE SCHEMA: ${schema.schema_name}\n`;
    context += `Discovery: ${schema.discovery_timestamp.toISOString()}\n`;
    context += `Tables: ${schema.total_tables}, Views: ${schema.total_views}, Functions: ${schema.total_functions}\n\n`;

    // Prioritize and limit tables
    const allTables = Array.from(schema.tables.values());
    const prioritized = allTables.filter(t => prioritizeTables.includes(t.table_name));
    const remaining = allTables.filter(t => !prioritizeTables.includes(t.table_name));
    const selectedTables = [...prioritized, ...remaining].slice(0, maxTablesInContext);

    // Add table information
    context += "TABLES:\n";
    selectedTables.forEach(table => {
      context += `\n${table.table_name}:\n`;
      
      // Add columns with types and constraints
      table.columns.forEach(col => {
        let colInfo = `  ${col.column_name}: ${col.data_type}`;
        
        if (col.is_primary_key) colInfo += ' [PK]';
        if (col.is_foreign_key) colInfo += ` [FK→${col.foreign_key_table}.${col.foreign_key_column}]`;
        if (!col.is_nullable) colInfo += ' [NOT NULL]';
        if (col.column_default) colInfo += ` [DEFAULT: ${col.column_default}]`;
        
        context += colInfo + '\n';
      });

      if (includeComments && table.table_comment) {
        context += `  -- ${table.table_comment}\n`;
      }
    });

    // Add foreign key relationships
    if (includeConstraints && schema.foreign_key_relationships.length > 0) {
      context += "\nFOREIGN KEY RELATIONSHIPS:\n";
      schema.foreign_key_relationships.forEach(fk => {
        context += `${fk.source_table}.${fk.source_column} → ${fk.target_table}.${fk.target_column}\n`;
      });
    }

    // Add views
    if (schema.views.size > 0) {
      context += "\nVIEWS:\n";
      Array.from(schema.views.values()).slice(0, 10).forEach(view => {
        context += `${view.table_name}: `;
        const keyColumns = view.columns.slice(0, 5).map(c => c.column_name).join(', ');
        context += keyColumns + '\n';
      });
    }

    // Add functions
    if (schema.functions.size > 0) {
      context += "\nFUNCTIONS:\n";
      Array.from(schema.functions.values()).slice(0, 10).forEach(func => {
        const params = func.parameters.map(p => `${p.parameter_name}: ${p.data_type}`).join(', ');
        context += `${func.function_name}(${params}) → ${func.return_type}\n`;
      });
    }

    return context;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    return expiry ? expiry > new Date() : false;
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.cacheExpiry.clear();
    logger.info('Schema cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cached_schemas: number;
    cache_hit_rate: number;
    oldest_cache_entry?: Date;
    newest_cache_entry?: Date;
  } {
    const cacheEntries = Array.from(this.cacheExpiry.values());
    const oldest = cacheEntries.length > 0 ? new Date(Math.min(...cacheEntries.map(d => d.getTime()))) : undefined;
    const newest = cacheEntries.length > 0 ? new Date(Math.max(...cacheEntries.map(d => d.getTime()))) : undefined;
    
    const stats: any = {
      cached_schemas: this.schemaCache.size,
      cache_hit_rate: 0, // Would need to track hits/misses
    };
    
    if (oldest) stats.oldest_cache_entry = oldest;
    if (newest) stats.newest_cache_entry = newest;
    
    return stats;
  }

  /**
   * Detect schema changes since last discovery
   */
  async detectSchemaChanges(schemaName: string = 'public'): Promise<{
    has_changes: boolean;
    table_changes: string[];
    column_changes: string[];
    constraint_changes: string[];
  }> {
    const cacheKey = `${schemaName}_{}`;
    const cached = this.schemaCache.get(cacheKey);
    
    if (!cached) {
      return {
        has_changes: true,
        table_changes: ['Schema not cached - full discovery needed'],
        column_changes: [],
        constraint_changes: []
      };
    }

    try {
      const client = await this.pool.connect();
      
      try {
        // Quick check for table changes
        const tableCountQuery = `
          SELECT COUNT(*) as table_count
          FROM information_schema.tables
          WHERE table_schema = $1 AND table_type = 'BASE TABLE'
        `;
        
        const result = await client.query(tableCountQuery, [schemaName]);
        const currentTableCount = parseInt(result.rows[0].table_count);
        
        if (currentTableCount !== cached.total_tables) {
          return {
            has_changes: true,
            table_changes: [`Table count changed: ${cached.total_tables} → ${currentTableCount}`],
            column_changes: [],
            constraint_changes: []
          };
        }

        // Check for column changes in key tables
        // This could be expanded for more detailed change detection
        
        return {
          has_changes: false,
          table_changes: [],
          column_changes: [],
          constraint_changes: []
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error detecting schema changes:', error);
      return {
        has_changes: true,
        table_changes: ['Error checking for changes - assuming changes present'],
        column_changes: [],
        constraint_changes: []
      };
    }
  }
}

/**
 * Factory function to create schema discovery service
 */
export function createSchemaDiscoveryService(pool: Pool): DynamicSchemaDiscoveryService {
  return new DynamicSchemaDiscoveryService(pool);
}