import { BaseAgent } from '../agents/base/BaseAgent';
import { schemaCache } from './QueryCache';
import logger from '../utils/logger';

interface PreloadResult {
  agentId: string;
  success: boolean;
  duration: number;
  error?: string;
  resourceCounts: {
    tables: number;
    procedures: number;
    functions: number;
  };
}

export class AgentResourcePreloader {
  private preloadResults = new Map<string, PreloadResult>();

  /**
   * Preload resources for a single agent
   */
  async preloadAgent(agent: BaseAgent): Promise<PreloadResult> {
    const startTime = Date.now();
    const agentId = agent.getAgentId();

    try {
      logger.info(`AgentResourcePreloader: Starting preload for agent ${agentId}`);

      // Force initialization of agent catalog
      await agent.initialize();

      // Cache the catalog for future use
      const catalog = agent.getCatalog();
      if (catalog) {
        schemaCache.set(
          `agent_catalog:${agentId}`,
          catalog,
          undefined,
          1800000 // 30 minutes TTL
        );
      }

      const duration = Date.now() - startTime;
      const result: PreloadResult = {
        agentId,
        success: true,
        duration,
        resourceCounts: {
          tables: catalog?.tables?.length || 0,
          procedures: catalog?.procedures?.length || 0,
          functions: catalog?.functions?.length || 0
        }
      };

      this.preloadResults.set(agentId, result);
      logger.info(`AgentResourcePreloader: Agent ${agentId} preloaded in ${duration}ms`);
      
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const result: PreloadResult = {
        agentId,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        resourceCounts: { tables: 0, procedures: 0, functions: 0 }
      };

      this.preloadResults.set(agentId, result);
      logger.error(`AgentResourcePreloader: Failed to preload agent ${agentId}:`, error);
      
      return result;
    }
  }

  /**
   * Preload resources for multiple agents in parallel
   */
  async preloadAgents(agents: BaseAgent[], maxConcurrency: number = 3): Promise<PreloadResult[]> {
    logger.info(`AgentResourcePreloader: Starting parallel preload for ${agents.length} agents`);
    
    const results: PreloadResult[] = [];
    const batches = this.chunkArray(agents, maxConcurrency);

    for (const batch of batches) {
      const batchPromises = batch.map(agent => this.preloadAgent(agent));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Log summary
    const successful = results.filter(r => r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = Math.round(totalDuration / results.length);

    logger.info(`AgentResourcePreloader: Completed preload - ${successful}/${results.length} successful, avg ${avgDuration}ms per agent`);

    return results;
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get preload results for specific agent
   */
  getPreloadResult(agentId: string): PreloadResult | undefined {
    return this.preloadResults.get(agentId);
  }

  /**
   * Get all preload results
   */
  getAllPreloadResults(): PreloadResult[] {
    return Array.from(this.preloadResults.values());
  }

  /**
   * Check if agent has been successfully preloaded
   */
  isPreloaded(agentId: string): boolean {
    const result = this.preloadResults.get(agentId);
    return result ? result.success : false;
  }

  /**
   * Get preload statistics
   */
  getPreloadStats(): {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    totalResourceCount: { tables: number; procedures: number; functions: number };
  } {
    const results = Array.from(this.preloadResults.values());
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = results.length > 0 ? Math.round(totalDuration / results.length) : 0;
    
    const totalResourceCount = successful.reduce(
      (totals, result) => ({
        tables: totals.tables + result.resourceCounts.tables,
        procedures: totals.procedures + result.resourceCounts.procedures,
        functions: totals.functions + result.resourceCounts.functions
      }),
      { tables: 0, procedures: 0, functions: 0 }
    );

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      averageDuration,
      totalResourceCount
    };
  }

  /**
   * Clear preload results
   */
  clearResults(): void {
    this.preloadResults.clear();
  }

  /**
   * Warm up cache for agent
   */
  async warmupAgentCache(agent: BaseAgent): Promise<void> {
    const agentId = agent.getAgentId();
    
    try {
      // Check if already cached
      const cachedCatalog = schemaCache.get(`agent_catalog:${agentId}`);
      if (cachedCatalog) {
        logger.debug(`AgentResourcePreloader: Agent ${agentId} catalog already cached`);
        return;
      }

      // Preload if not cached
      await this.preloadAgent(agent);
      
    } catch (error) {
      logger.warn(`AgentResourcePreloader: Warmup failed for agent ${agentId}:`, error);
    }
  }
}

// Global preloader instance
export const agentPreloader = new AgentResourcePreloader();