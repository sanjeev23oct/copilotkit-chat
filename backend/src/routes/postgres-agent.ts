import { Router, Request, Response } from 'express';
import { aguiActionRegistry } from '../services/agui/actions';
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

export default router;
