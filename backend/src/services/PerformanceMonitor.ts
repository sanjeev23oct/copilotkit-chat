interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  agentId?: string;
  success: boolean;
  errorType?: string;
}

interface AggregatedMetrics {
  operation: string;
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
  lastUpdated: Date;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics
  private aggregationCache = new Map<string, AggregatedMetrics>();

  /**
   * Record a performance metric
   */
  record(
    operation: string,
    duration: number,
    success: boolean = true,
    agentId?: string,
    errorType?: string
  ): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      success,
      ...(agentId && { agentId }),
      ...(errorType && { errorType })
    };

    this.metrics.push(metric);

    // Remove old metrics if we exceed the limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Update aggregation cache
    this.updateAggregation(operation);
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string, agentId?: string): () => void {
    const startTime = Date.now();
    
    return (success: boolean = true, errorType?: string) => {
      const duration = Date.now() - startTime;
      this.record(operation, duration, success, agentId, errorType);
    };
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operation: string, timeframeMs?: number): PerformanceMetric[] {
    const cutoff = timeframeMs ? new Date(Date.now() - timeframeMs) : null;
    
    return this.metrics.filter(metric => 
      metric.operation === operation &&
      (!cutoff || metric.timestamp >= cutoff)
    );
  }

  /**
   * Get metrics for a specific agent
   */
  getAgentMetrics(agentId: string, timeframeMs?: number): PerformanceMetric[] {
    const cutoff = timeframeMs ? new Date(Date.now() - timeframeMs) : null;
    
    return this.metrics.filter(metric => 
      metric.agentId === agentId &&
      (!cutoff || metric.timestamp >= cutoff)
    );
  }

  /**
   * Get aggregated metrics for all operations
   */
  getAggregatedMetrics(): AggregatedMetrics[] {
    return Array.from(this.aggregationCache.values());
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(timeframeMs: number = 3600000): { // Default 1 hour
    operations: { [key: string]: AggregatedMetrics };
    agents: { [key: string]: AggregatedMetrics };
    overall: {
      totalOperations: number;
      averageResponseTime: number;
      successRate: number;
      errorBreakdown: { [key: string]: number };
    };
  } {
    const cutoff = new Date(Date.now() - timeframeMs);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    // Aggregate by operation
    const operationStats = new Map<string, {
      count: number;
      totalDuration: number;
      successes: number;
    }>();

    // Aggregate by agent
    const agentStats = new Map<string, {
      count: number;
      totalDuration: number;
      successes: number;
    }>();

    // Error breakdown
    const errorBreakdown = new Map<string, number>();

    for (const metric of recentMetrics) {
      // Operation stats
      if (!operationStats.has(metric.operation)) {
        operationStats.set(metric.operation, { count: 0, totalDuration: 0, successes: 0 });
      }
      const opStats = operationStats.get(metric.operation)!;
      opStats.count++;
      opStats.totalDuration += metric.duration;
      if (metric.success) opStats.successes++;

      // Agent stats
      if (metric.agentId) {
        if (!agentStats.has(metric.agentId)) {
          agentStats.set(metric.agentId, { count: 0, totalDuration: 0, successes: 0 });
        }
        const agentStat = agentStats.get(metric.agentId)!;
        agentStat.count++;
        agentStat.totalDuration += metric.duration;
        if (metric.success) agentStat.successes++;
      }

      // Error breakdown
      if (!metric.success && metric.errorType) {
        errorBreakdown.set(metric.errorType, (errorBreakdown.get(metric.errorType) || 0) + 1);
      }
    }

    // Convert to result format
    const operations: { [key: string]: AggregatedMetrics } = {};
    for (const [operation, stats] of operationStats) {
      operations[operation] = {
        operation,
        totalCalls: stats.count,
        totalDuration: stats.totalDuration,
        averageDuration: stats.totalDuration / stats.count,
        successRate: stats.successes / stats.count,
        lastUpdated: new Date()
      };
    }

    const agents: { [key: string]: AggregatedMetrics } = {};
    for (const [agentId, stats] of agentStats) {
      agents[agentId] = {
        operation: 'all_operations',
        totalCalls: stats.count,
        totalDuration: stats.totalDuration,
        averageDuration: stats.totalDuration / stats.count,
        successRate: stats.successes / stats.count,
        lastUpdated: new Date()
      };
    }

    const totalOperations = recentMetrics.length;
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const successes = recentMetrics.filter(m => m.success).length;

    return {
      operations,
      agents,
      overall: {
        totalOperations,
        averageResponseTime: totalOperations > 0 ? totalDuration / totalOperations : 0,
        successRate: totalOperations > 0 ? successes / totalOperations : 0,
        errorBreakdown: Object.fromEntries(errorBreakdown)
      }
    };
  }

  /**
   * Update aggregation cache for an operation
   */
  private updateAggregation(operation: string): void {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    
    const totalCalls = operationMetrics.length;
    const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    const successes = operationMetrics.filter(m => m.success).length;

    this.aggregationCache.set(operation, {
      operation,
      totalCalls,
      totalDuration,
      averageDuration: totalDuration / totalCalls,
      successRate: successes / totalCalls,
      lastUpdated: new Date()
    });
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(thresholdMs: number = 5000, timeframeMs: number = 3600000): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - timeframeMs);
    
    return this.metrics.filter(metric =>
      metric.timestamp >= cutoff &&
      metric.duration > thresholdMs
    ).sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get error rate for operation
   */
  getErrorRate(operation: string, timeframeMs: number = 3600000): number {
    const metrics = this.getOperationMetrics(operation, timeframeMs);
    if (metrics.length === 0) return 0;
    
    const failures = metrics.filter(m => !m.success).length;
    return failures / metrics.length;
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThanMs: number = 86400000): void { // Default 24 hours
    const cutoff = new Date(Date.now() - olderThanMs);
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get system health indicators
   */
  getHealthIndicators(): {
    status: 'healthy' | 'warning' | 'critical';
    indicators: {
      averageResponseTime: { value: number; status: 'good' | 'warning' | 'critical' };
      errorRate: { value: number; status: 'good' | 'warning' | 'critical' };
      slowOperations: { value: number; status: 'good' | 'warning' | 'critical' };
    };
  } {
    const summary = this.getPerformanceSummary(3600000); // Last hour
    const slowOps = this.getSlowOperations(5000, 3600000);

    // Thresholds
    const responseTimeThresholds = { warning: 3000, critical: 10000 };
    const errorRateThresholds = { warning: 0.05, critical: 0.15 }; // 5% warning, 15% critical
    const slowOpsThresholds = { warning: 5, critical: 20 };

    const avgResponseTime = summary.overall.averageResponseTime;
    const errorRate = 1 - summary.overall.successRate;
    const slowOpsCount = slowOps.length;

    const indicators = {
      averageResponseTime: {
        value: avgResponseTime,
        status: (avgResponseTime > responseTimeThresholds.critical ? 'critical' :
                avgResponseTime > responseTimeThresholds.warning ? 'warning' : 'good') as 'good' | 'warning' | 'critical'
      },
      errorRate: {
        value: errorRate,
        status: (errorRate > errorRateThresholds.critical ? 'critical' :
                errorRate > errorRateThresholds.warning ? 'warning' : 'good') as 'good' | 'warning' | 'critical'
      },
      slowOperations: {
        value: slowOpsCount,
        status: (slowOpsCount > slowOpsThresholds.critical ? 'critical' :
                slowOpsCount > slowOpsThresholds.warning ? 'warning' : 'good') as 'good' | 'warning' | 'critical'
      }
    };

    // Overall status
    const statuses = Object.values(indicators).map(i => i.status);
    const overallStatus = statuses.includes('critical') ? 'critical' :
                         statuses.includes('warning') ? 'warning' : 'healthy';

    return {
      status: overallStatus,
      indicators
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();