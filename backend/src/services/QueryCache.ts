interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface QueryCacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0
  };

  constructor(
    private defaultTTL: number = 300000, // 5 minutes
    private maxSize: number = 1000
  ) {}

  /**
   * Generate cache key from query and parameters
   */
  private generateKey(query: string, params?: any): string {
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${normalizedQuery}:${paramsStr}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries if cache is full
   */
  private evictIfNeeded(): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest 20% of entries
      const entriesToRemove = Math.floor(this.maxSize * 0.2);
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.delete(sortedEntries[i][0]);
      }
    }
  }

  /**
   * Get cached result
   */
  get<T>(query: string, params?: any): T | null {
    const key = this.generateKey(query, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Store result in cache
   */
  set<T>(query: string, data: T, params?: any, ttl?: number): void {
    const key = this.generateKey(query, params);
    
    this.evictIfNeeded();
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  /**
   * Check if result is cached
   */
  has(query: string, params?: any): boolean {
    const key = this.generateKey(query, params);
    const entry = this.cache.get(key);
    return entry ? this.isValid(entry) : false;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Clear specific pattern of entries
   */
  clearPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern.toLowerCase())) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): QueryCacheStats {
    this.cleanup(); // Clean up before reporting stats
    
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Get memory usage estimate (approximate)
   */
  getMemoryUsage(): { entries: number; estimatedSizeKB: number } {
    let estimatedSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      estimatedSize += key.length * 2; // String in UTF-16
      estimatedSize += JSON.stringify(entry.data).length * 2;
      estimatedSize += 24; // Timestamp + TTL + overhead
    }
    
    return {
      entries: this.cache.size,
      estimatedSizeKB: Math.round(estimatedSize / 1024)
    };
  }
}

// Global cache instances
export const schemaCache = new QueryCache(
  600000, // 10 minutes TTL for schema
  100     // Max 100 schema entries
);

export const queryResultCache = new QueryCache(
  300000, // 5 minutes TTL for query results
  500     // Max 500 query results
);

export const analysisCache = new QueryCache(
  1800000, // 30 minutes TTL for LLM analysis
  200      // Max 200 analysis results
);