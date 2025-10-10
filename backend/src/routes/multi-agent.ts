import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import AgentRegistry from '../agents/communication/AgentRegistry';
import AgentOrchestrator from '../agents/orchestrator/AgentOrchestrator';
import { SewadarAgent } from '../agents/specialized/SewadarAgent';
import { DepartmentAgent } from '../agents/specialized/DepartmentAgent';
import { AttendanceAgent } from '../agents/specialized/AttendanceAgent';
import { agentPreloader } from '../services/AgentResourcePreloader';
import { performanceMonitor } from '../services/PerformanceMonitor';
import { schemaCache, queryResultCache, analysisCache } from '../services/QueryCache';

const router = Router();

// Handle CORS preflight requests
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, User-Agent, Referer');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Initialize agents and registry
const agentRegistry = AgentRegistry.getInstance();
const orchestrator = AgentOrchestrator.getInstance();

// Initialize specialized agents
const sewadarAgent = new SewadarAgent();
const departmentAgent = new DepartmentAgent();
const attendanceAgent = new AttendanceAgent();

// Store agent instances for direct access
const agentInstances = new Map<string, any>([
  ['sewadar', sewadarAgent],
  ['department', departmentAgent],
  ['attendance', attendanceAgent]
]);

// Auto-initialize agents on startup
async function initializeAgents() {
  try {
    await Promise.all([
      sewadarAgent.initialize(),
      departmentAgent.initialize(),
      attendanceAgent.initialize()
    ]);

    // Register agents
    await agentRegistry.registerAgent(sewadarAgent);
    await agentRegistry.registerAgent(departmentAgent);
    await agentRegistry.registerAgent(attendanceAgent);

    logger.info('All multi-agents initialized successfully');
  } catch (error) {
    logger.error('Error initializing multi-agents:', error);
  }
}

// Initialize on module load
initializeAgents();

/**
 * GET /api/multi-agent/agents
 * Get list of available agents with their capabilities
 */
router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const agents = agentRegistry.getRegisteredAgents();
    const agentInfos = agents.map((registration: any) => ({
      agentId: registration.agentId,
      domain: registration.domain,
      status: registration.status,
      resources: registration.capabilities.reduce((total: number, cap: any) => total + (cap.resourceCount || 0), 0),
      capabilities: registration.capabilities.map((cap: any) => cap.name),
      lastHeartbeat: registration.lastHeartbeat,
      responseTime: registration.responseTime
    }));

    res.json({
      success: true,
      agents: agentInfos,
      totalAgents: agentInfos.length
    });
  } catch (error) {
    logger.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agents'
    });
  }
});

/**
 * POST /api/multi-agent/query
 * Auto-route query to best agent
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, visualize = false } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    // Determine best agent using simple routing logic
    const bestAgentId = await determineBestAgent(query);
    const agentRegistration = agentRegistry.getAgent(bestAgentId);
    const agentInstance = agentInstances.get(bestAgentId);

    if (!agentRegistration || !agentInstance) {
      return res.status(404).json({
        success: false,
        error: `Agent ${bestAgentId} not found`
      });
    }

    const result = await agentInstance.processQuery(query, {
      originalQuery: query,
      sessionId: (req as any).sessionID || 'unknown',
      relatedData: {},
      confidence: 0.8,
      executionPath: ['multi-agent-router']
    });

    // Add visualization elements if requested
    if (visualize && result.data && Array.isArray(result.data) && result.data.length > 0) {
      const aguiElements = agentInstance.createAGUIElements ?
        agentInstance.createAGUIElements(result.data, true) :
        [];
      result.agui = aguiElements;
    }

    return res.json({
      ...result,
      involvedAgents: [bestAgentId],
      routingDecision: `Auto-routed to ${bestAgentId} agent`,
      message: result.success ?
        `Query processed successfully by ${bestAgentId} agent` :
        'Query processing failed'
    });

  } catch (error) {
    logger.error('Error in multi-agent query:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/multi-agent/agents/:agentId/query
 * Query specific agent directly
 */
router.post('/agents/:agentId/query', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { query, visualize = false } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const agentRegistration = agentRegistry.getAgent(agentId);
    const agentInstance = agentInstances.get(agentId);
    
    if (!agentRegistration || !agentInstance) {
      return res.status(404).json({
        success: false,
        error: `Agent ${agentId} not found`
      });
    }

    const result = await agentInstance.processQuery(query, {
      originalQuery: query,
      sessionId: (req as any).sessionID || 'unknown',
      relatedData: {},
      confidence: 0.8,
      executionPath: [`${agentId}-direct`]
    });

    // Add visualization elements if requested
    if (visualize && result.data && Array.isArray(result.data) && result.data.length > 0) {
      const aguiElements = agentInstance.createAGUIElements ?
        agentInstance.createAGUIElements(result.data, true) :
        [];
      result.agui = aguiElements;
    }

    return res.json({
      ...result,
      involvedAgents: [agentId],
      message: result.success ?
        `Query processed successfully by ${agentId} agent` :
        'Query processing failed'
    });

  } catch (error) {
    logger.error(`Error in ${req.params.agentId} agent query:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/multi-agent/orchestrate
 * Multi-agent orchestrated query execution
 */
router.post('/orchestrate', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const sessionId = (req as any).sessionID || `session_${Date.now()}`;
    const result = await orchestrator.processQuery(query, undefined, sessionId, 'normal');

    return res.json(result);

  } catch (error) {
    logger.error('Error in orchestrated query:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/multi-agent/agents/:agentId/status
 * Get specific agent status and health
 */
router.get('/agents/:agentId/status', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const registration = agentRegistry.getAgent(agentId);

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: `Agent ${agentId} not found`
      });
    }

    const healthStatus = registration ? {
      agentId: registration.agentId,
      domain: registration.domain,
      status: registration.status,
      resources: 0
    } : null;

    return res.json({
      success: true,
      agent: {
        ...registration,
        healthStatus,
        catalog: null
      }
    });

  } catch (error) {
    logger.error(`Error fetching agent ${req.params.agentId} status:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch agent status'
    });
  }
});

/**
 * GET /api/multi-agent/orchestrator/status
 * Get orchestrator status and active queries
 */
router.get('/orchestrator/status', async (_req: Request, res: Response) => {
  try {
    const status = orchestrator.getHealthStatus();
    res.json({
      success: true,
      orchestrator: status
    });
  } catch (error) {
    logger.error('Error fetching orchestrator status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orchestrator status'
    });
  }
});

/**
 * Helper function to determine best agent for a query
 */
async function determineBestAgent(query: string): Promise<string> {
  const lowerQuery = query.toLowerCase();
  
  // Simple keyword-based routing
  if (lowerQuery.includes('sewadar') || 
      lowerQuery.includes('profile') || 
      lowerQuery.includes('badge') ||
      lowerQuery.includes('eligibility') ||
      lowerQuery.includes('personal')) {
    return 'sewadar';
  }
  
  if (lowerQuery.includes('department') || 
      lowerQuery.includes('dept') || 
      lowerQuery.includes('role') ||
      lowerQuery.includes('assignment') ||
      lowerQuery.includes('transfer') ||
      lowerQuery.includes('organizational')) {
    return 'department';
  }
  
  if (lowerQuery.includes('attendance') || 
      lowerQuery.includes('swipe') || 
      lowerQuery.includes('leave') ||
      lowerQuery.includes('time') ||
      lowerQuery.includes('present') ||
      lowerQuery.includes('absent')) {
    return 'attendance';
  }
  
  // Default to sewadar agent for general queries
  return 'sewadar';
}

// Get cache statistics
router.get('/cache/stats', async (_req, res) => {
  try {
    const stats = {
      schema: schemaCache.getStats(),
      queryResults: queryResultCache.getStats(),
      analysis: analysisCache.getStats(),
      memory: {
        schema: schemaCache.getMemoryUsage(),
        queryResults: queryResultCache.getMemoryUsage(),
        analysis: analysisCache.getMemoryUsage()
      }
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear cache
router.post('/cache/clear', async (req, res) => {
  try {
    const { type } = req.body;

    switch (type) {
      case 'schema':
        schemaCache.clear();
        break;
      case 'queryResults':
        queryResultCache.clear();
        break;
      case 'analysis':
        analysisCache.clear();
        break;
      case 'all':
        schemaCache.clear();
        queryResultCache.clear();
        analysisCache.clear();
        break;
      default:
        return res.status(400).json({ error: 'Invalid cache type' });
    }

    return res.json({
      success: true,
      message: `${type} cache cleared successfully`
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get performance metrics
router.get('/performance/metrics', async (req, res) => {
  try {
    const timeframe = parseInt(req.query.timeframe as string) || 3600000; // Default 1 hour
    const summary = performanceMonitor.getPerformanceSummary(timeframe);
    
    res.json(summary);
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get system health
router.get('/health', async (_req, res) => {
  try {
    const health = performanceMonitor.getHealthIndicators();
    const agentHealth = Array.from(agentInstances.values()).map(agent => agent.getHealthStatus());
    
    res.json({
      ...health,
      agents: agentHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting system health:', error);
    res.status(500).json({
      error: 'Failed to get system health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Preload agent resources
router.post('/preload', async (req, res) => {
  try {
    const { agentIds, maxConcurrency } = req.body;
    const allAgents = Array.from(agentInstances.values());
    
    let targetAgents = allAgents;
    if (agentIds && Array.isArray(agentIds)) {
      targetAgents = allAgents.filter(agent => agentIds.includes(agent.getAgentId()));
    }

    const results = await agentPreloader.preloadAgents(
      targetAgents,
      maxConcurrency || 3
    );

    const stats = agentPreloader.getPreloadStats();

    res.json({
      success: true,
      results,
      stats,
      message: `Preloaded ${results.length} agents`
    });
  } catch (error) {
    logger.error('Error preloading agents:', error);
    res.status(500).json({
      error: 'Failed to preload agents',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get preload status
router.get('/preload/status', async (_req, res) => {
  try {
    const stats = agentPreloader.getPreloadStats();
    const results = agentPreloader.getAllPreloadResults();

    res.json({
      stats,
      results
    });
  } catch (error) {
    logger.error('Error getting preload status:', error);
    res.status(500).json({
      error: 'Failed to get preload status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;