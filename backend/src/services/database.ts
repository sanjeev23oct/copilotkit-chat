import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_chat_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased from 2s to 10s for on-prem LLM
      statement_timeout: 60000, // 60 second query timeout
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
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

  async getTableSchema(): Promise<any[]> {
    const query = `
      SELECT 
        t.table_name,
        t.table_type,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        tc.constraint_type
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN information_schema.table_constraints tc ON t.table_name = tc.table_name
      WHERE t.table_schema = 'public'
        AND (
          LOWER(t.table_name) LIKE 'sewadar%' OR 
          LOWER(t.table_name) LIKE 'department%'
         
        )
      ORDER BY t.table_name, c.ordinal_position;
    `;
    
    try {
      const result = await this.query(query);
      logger.info(`Filtered schema: Found ${new Set(result.rows.map((r: any) => r.table_name)).size} tables matching 'sewadar' or 'department'`);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching table schema:', error);
      return [];
    }
  }

  async getSampleData(tableName: string, limit: number = 5): Promise<any[]> {
    try {
      // Sanitize table name to prevent SQL injection
      const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const query = `SELECT * FROM ${sanitizedTableName} LIMIT $1`;
      const result = await this.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching sample data from ${tableName}:`, error);
      return [];
    }
  }

  async executeQuery(sqlQuery: string): Promise<{ rows: any[], rowCount: number }> {
    try {
      // Basic SQL injection protection - only allow SELECT statements
      const trimmedQuery = sqlQuery.trim().toLowerCase();
      if (!trimmedQuery.startsWith('select')) {
        throw new Error('Only SELECT queries are allowed for security reasons');
      }

      const result = await this.query(sqlQuery);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      logger.error('Error executing query:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const databaseService = new DatabaseService();