import { Router } from 'express';
import { databaseService } from '../services/database';
import { llmService } from '../services/llm';
import logger from '../utils/logger';

const router = Router();

// Natural language database query endpoint
router.post('/query', async (req, res) => {
  try {
    const { query_description, table_hints } = req.body;

    if (!query_description) {
      return res.status(400).json({
        success: false,
        error: 'query_description is required',
      });
    }

    logger.info('Processing natural language query:', { query_description, table_hints });

    // Convert natural language to SQL
    const { sql, explanation, confidence } = await llmService.convertNaturalLanguageToSQL(
      query_description,
      table_hints
    );

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'Could not generate SQL query from natural language',
      });
    }

    // Execute the SQL query
    const { rows, rowCount } = await databaseService.executeQuery(sql);

    return res.json({
      success: true,
      data: rows,
      query: sql,
      explanation,
      confidence,
      rowCount,
      originalQuery: query_description,
    });
  } catch (error) {
    logger.error('Database query error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get database schema
router.get('/schema', async (_req, res) => {
  try {
    const schema = await databaseService.getTableSchema();
    
    // Group by table name
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

    const tableInfo = Array.from(tables.entries()).map(([tableName, columns]) => ({
      tableName,
      columns
    }));

    res.json({
      success: true,
      tables: tableInfo,
    });
  } catch (error) {
    logger.error('Error fetching schema:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch schema',
    });
  }
});

// Get sample data from a table
router.get('/sample/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    const sampleData = await databaseService.getSampleData(tableName, limit);
    
    res.json({
      success: true,
      data: sampleData,
      tableName,
      count: sampleData.length,
    });
  } catch (error) {
    logger.error('Error fetching sample data:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sample data',
    });
  }
});

export default router;