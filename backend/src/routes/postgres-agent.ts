import { Router, Request, Response } from 'express';
import { aguiActionRegistry } from '../services/agui/actions';
import { llmService } from '../services/llm';
import { databaseService } from '../services/database';
import logger from '../utils/logger';

const router = Router();

// Execute PostgreSQL agentic action
router.post('/action', async (req: Request, res: Response) => {
  try {
    const { actionId, parameters } = req.body;

    if (!actionId) {
      return res.status(400).json({
        success: false,
        error: 'actionId is required'
      });
    }

    logger.info(`Executing PostgreSQL agent action: ${actionId}`, parameters);

    const result = await aguiActionRegistry.executeAction(actionId, parameters || {});

    return res.json(result);
  } catch (error) {
    logger.error('PostgreSQL agent action error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Pull data from PostgreSQL
router.post('/pull', async (req: Request, res: Response) => {
  try {
    const { query, tableName, limit, visualize } = req.body;

    logger.info('Pulling data from PostgreSQL:', { query, tableName, limit, visualize });

    const result = await aguiActionRegistry.executeAction('pull_postgres_data', {
      query,
      tableName,
      limit: limit || 100,
      visualize: visualize || false
    });

    return res.json(result);
  } catch (error) {
    logger.error('PostgreSQL pull error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// List all tables
router.get('/tables', async (_req: Request, res: Response) => {
  try {
    logger.info('Listing PostgreSQL tables');

    const result = await aguiActionRegistry.executeAction('list_postgres_tables', {});

    return res.json(result);
  } catch (error) {
    logger.error('PostgreSQL list tables error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get available actions
router.get('/actions', async (_req: Request, res: Response) => {
  try {
    const actions = aguiActionRegistry.getActions();
    
    // Filter to PostgreSQL-related actions
    const postgresActions = actions.filter(action => 
      action.id.includes('postgres') || 
      action.id.includes('database') ||
      action.id === 'query_database' ||
      action.id === 'get_table_schema' ||
      action.id === 'get_sample_data'
    );

    return res.json({
      success: true,
      actions: postgresActions.map(action => ({
        id: action.id,
        name: action.name,
        description: action.description,
        parameters: action.parameters
      }))
    });
  } catch (error) {
    logger.error('Error fetching PostgreSQL actions:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get current model info
router.get('/model-info', async (_req: Request, res: Response) => {
  try {
    const modelInfo = llmService.getModelInfo();
    return res.json({
      success: true,
      ...modelInfo,
      message: `Currently using ${modelInfo.provider} with model ${modelInfo.model}`
    });
  } catch (error) {
    logger.error('Error getting model info:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Test LLM connection
router.get('/test-llm', async (_req: Request, res: Response) => {
  try {
    logger.info('Testing LLM connection...');
    
    const { unifiedLLMService } = await import('../services/llm/unified');
    
    const testResponse = await unifiedLLMService.chat(
      [
        { role: 'user', content: 'Say "Hello, I am working!" in exactly those words.' }
      ],
      { temperature: 0, max_tokens: 50 }
    );

    const content = testResponse.choices[0]?.message?.content;
    
    return res.json({
      success: true,
      message: 'LLM connection successful',
      provider: unifiedLLMService.getModelInfo().provider,
      model: unifiedLLMService.getModelInfo().model,
      testResponse: content,
    });
  } catch (error: any) {
    logger.error('LLM test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: {
        status: error.status,
        code: error.code,
        type: error.type,
      }
    });
  }
});

// Natural language query endpoint
router.post('/nl-query', async (req: Request, res: Response) => {
  try {
    const { query, tableHints, visualize } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query (natural language) is required'
      });
    }

    logger.info('Processing natural language query:', { query, tableHints });

    // Convert natural language to SQL
    const { sql, explanation, confidence } = await llmService.convertNaturalLanguageToSQL(
      query,
      tableHints
    );

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'Could not generate SQL query from natural language'
      });
    }

    logger.info('Generated SQL:', { sql, confidence });

    // Execute the SQL query
    const result = await databaseService.executeQuery(sql);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        sql,
        explanation,
        confidence,
        message: 'Query executed successfully but returned no results',
        naturalLanguageQuery: query
      });
    }

    // Create AGUI table
    const headers = Object.keys(result.rows[0]);
    const rows = result.rows.map(row => headers.map(header => {
      const value = row[header];
      if (value instanceof Date) {
        return value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value;
    }));

    const aguiElements: any[] = [
      {
        type: 'table',
        id: `nl_query_table_${Date.now()}`,
        props: {
          headers,
          rows,
          sortable: true,
          filterable: true,
          pagination: result.rows.length > 10 ? {
            page: 1,
            pageSize: 10,
            total: result.rows.length
          } : undefined
        }
      }
    ];

    // Add visualization if requested and data is suitable
    if (visualize && result.rows.length > 0) {
      const numericColumns = headers.filter(header => {
        const firstValue = result.rows[0][header];
        return typeof firstValue === 'number' || !isNaN(Number(firstValue));
      });

      if (numericColumns.length > 0 && headers.length > 1) {
        const labelColumn = headers[0];
        const valueColumn = numericColumns[0];
        
        const labels = result.rows.slice(0, 10).map(row => String(row[labelColumn]));
        const values = result.rows.slice(0, 10).map(row => Number(row[valueColumn]));

        aguiElements.push({
          type: 'chart',
          id: `nl_query_chart_${Date.now()}`,
          props: {
            chartType: 'bar',
            data: {
              labels,
              datasets: [{
                label: valueColumn,
                data: values,
                backgroundColor: '#36A2EB'
              }]
            }
          }
        });
      }
    }

    return res.json({
      success: true,
      data: result.rows,
      sql,
      explanation,
      confidence,
      message: `Retrieved ${result.rowCount} row(s) from PostgreSQL`,
      naturalLanguageQuery: query,
      agui: aguiElements
    });
  } catch (error) {
    logger.error('Natural language query error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;
