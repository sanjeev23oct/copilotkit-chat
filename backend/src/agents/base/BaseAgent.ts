import { unifiedLLMService } from '../../services/llm/unified';
import { enhancedDatabaseService, AgentResourceCatalog, APIResource } from '../../services/enhanced-database';
import { createSchemaAwareDatabaseService, SchemaAwareDatabaseService } from '../../services/schema-aware-database';
import { AGUIElement } from '../../types/agui';
import logger from '../../utils/logger';
import { schemaCache, queryResultCache, analysisCache } from '../../services/QueryCache';
import { performanceMonitor } from '../../services/PerformanceMonitor';

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'broadcast' | 'notification';
  action: string;
  payload: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: Date;
  timeout?: number;
  requiresResponse?: boolean;
  correlationId?: string;
  context?: SharedContext;
  metadata?: {
    retryCount?: number;
    originalSender?: string;
    routingPath?: string[];
  };
}

export interface SharedContext {
  originalQuery: string;
  userId?: string | undefined;
  sessionId: string;
  relatedData: Record<string, any>;
  confidence: number;
  executionPath: string[];
}

export interface ResourceStrategy {
  type: 'table' | 'procedure' | 'function' | 'api' | 'hybrid';
  resource: string;
  parameters?: Record<string, any>;
  confidence: number;
  reasoning: string;
  fallback?: ResourceStrategy;
}

export interface QueryAnalysis {
  intent: string;
  domain: string;
  primaryStrategy: ResourceStrategy;
  secondaryStrategies: ResourceStrategy[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  requiresExternalAgents: string[];
}

export interface AgentResult {
  success: boolean;
  data?: any[];
  error?: string;
  sql?: string;
  explanation?: string;
  confidence?: number;
  summary?: string;
  agui?: AGUIElement[];
  model?: {
    provider: string;
    name: string;
  };
  executionStrategy?: ResourceStrategy;
  involvedAgents?: string[];
  executionTime?: number;
}

export abstract class BaseAgent {
  protected agentId: string;
  protected domain: string;
  protected catalog?: AgentResourceCatalog;
  protected messenger?: any; // Will be set by agent registry
  protected useDynamicSchema: boolean = false; // Enable dynamic schema discovery

  protected schemaAwareDatabaseService?: SchemaAwareDatabaseService;

  constructor(agentId: string, domain: string, useDynamicSchema: boolean = false) {
    this.agentId = agentId;
    this.domain = domain;
    this.useDynamicSchema = useDynamicSchema;
    if (useDynamicSchema) {
      this.schemaAwareDatabaseService = createSchemaAwareDatabaseService();
    }
  }

  // Getter methods for agent properties
  getAgentId(): string {
    return this.agentId;
  }

  getAgentName(): string {
    return this.agentId.charAt(0).toUpperCase() + this.agentId.slice(1) + 'Agent';
  }

  getDomain(): string {
    return this.domain;
  }

  // Abstract methods that must be implemented by specialized agents
  abstract getTablePatterns(): string[];
  abstract getProcedurePatterns(): string[];
  abstract getFunctionPatterns(): string[];
  abstract getAPIResources(): APIResource[];
  abstract processQuery(query: string, context?: SharedContext): Promise<AgentResult>;

  // Initialize agent with resource discovery
  async initialize(): Promise<void> {
    const timer = performanceMonitor.startTimer('agent_initialization', this.agentId);

    try {
      logger.info(`Initializing agent: ${this.agentId}`);

      // Check cache first
      const cacheKey = `agent_catalog:${this.agentId}`;
      const cachedCatalog = schemaCache.get<AgentResourceCatalog>(cacheKey);

      if (cachedCatalog) {
        this.catalog = cachedCatalog;
        logger.info(`Agent ${this.agentId} loaded from cache with ${this.catalog.tables.length} tables, ${this.catalog.procedures.length} procedures, ${this.catalog.functions.length} functions`);
        timer();
        return;
      }

      // Use dynamic schema discovery if enabled
      if (this.useDynamicSchema) {
        // Dynamic schema discovery and mapping to AgentResourceCatalog
        const schema = await this.schemaAwareDatabaseService!.discoverRelevantSchema(
          this.domain,
          {
            agentId: this.agentId,
            tableHints: this.getTablePatterns(),
            useCache: true
          }
        );
        this.catalog = {
          agentId: this.agentId,
          domain: this.domain,
          tables: (schema.tables ? Array.from(schema.tables.values()) : []).map(table => ({
            table_name: table.table_name || '',
            table_type: (table.table_type as string) || '',
            column_name: '',
            data_type: '',
            is_nullable: '',
            column_default: '',
            constraint_type: '',
            description: '',
            domain: this.domain,
            tags: []
          })),
          procedures: [],
          functions: [],
          apis: this.getAPIResources(),
          tablePatterns: this.getTablePatterns(),
          procedurePatterns: this.getProcedurePatterns(),
          functionPatterns: this.getFunctionPatterns()
        };
      } else {
        // Legacy static schema
        this.catalog = await enhancedDatabaseService.buildAgentResourceCatalog(
          this.agentId,
          this.domain,
          this.getTablePatterns(),
          this.getProcedurePatterns(),
          this.getFunctionPatterns(),
          this.getAPIResources()
        );
      }

      // Cache the catalog
      schemaCache.set(cacheKey, this.catalog, undefined, 1800000); // 30 minutes TTL

      logger.info(`Agent ${this.agentId} initialized with ${
        this.catalog?.tables?.length ?? 0
      } tables, ${
        this.catalog?.procedures?.length ?? 0
      } procedures, ${
        this.catalog?.functions?.length ?? 0
      } functions`);
      timer();
    } catch (error) {
      logger.error(`Failed to initialize agent ${this.agentId}:`, error);
      timer();
      throw error;
    }
  }

  // Get agent's resource catalog
  getCatalog(): AgentResourceCatalog | undefined {
    return this.catalog;
  }

  // Analyze query to determine best execution strategy
  protected async analyzeQuery(query: string, _context?: SharedContext): Promise<QueryAnalysis> {
    if (!this.catalog) {
      throw new Error(`Agent ${this.agentId} not initialized`);
    }

    // Check cache first
    const cacheKey = `analysis:${this.agentId}:${query}`;
    const cachedAnalysis = analysisCache.get<QueryAnalysis>(cacheKey);
    if (cachedAnalysis) {
      logger.debug(`Using cached analysis for query: "${query}"`);
      return cachedAnalysis;
    }

    const timer = performanceMonitor.startTimer('query_analysis', this.agentId);
    const prompt = this.buildAnalysisPrompt(query, this.catalog);
    
    try {
      // Set a shorter timeout for analysis (30s instead of 60s)
      const analysisTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout after 30s')), 30000);
      });

      const analysisPromise = unifiedLLMService.chat(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: `Analyze this query: "${query}"` }
        ],
        { temperature: 0.1, max_tokens: 1000 }
      );

      const response = await Promise.race([analysisPromise, analysisTimeout]) as any;

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM for query analysis');
      }

      // Parse JSON response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const analysis: QueryAnalysis = JSON.parse(cleanContent);
      
      // Cache the analysis
      analysisCache.set(cacheKey, analysis, undefined, 1800000); // 30 minutes TTL
      
      logger.info(`Query analysis for "${query}": ${analysis.primaryStrategy.type} - ${analysis.primaryStrategy.resource}`);
      timer();
      
      return analysis;
    } catch (error) {
      logger.error(`Error analyzing query for agent ${this.agentId}:`, error);
      timer();
      
      // Fallback to table-based strategy
      const fallbackAnalysis: QueryAnalysis = {
        intent: 'data_retrieval',
        domain: this.domain,
        primaryStrategy: {
          type: 'table',
          resource: this.catalog.tables[0]?.table_name || 'unknown',
          confidence: 0.5,
          reasoning: 'Fallback strategy due to analysis error'
        },
        secondaryStrategies: [],
        estimatedComplexity: 'medium',
        requiresExternalAgents: []
      };
      
      // Cache fallback analysis with shorter TTL
      analysisCache.set(cacheKey, fallbackAnalysis, undefined, 300000); // 5 minutes TTL
      
      return fallbackAnalysis;
    }
  }

  // Execute a specific resource strategy
  protected async executeStrategy(strategy: ResourceStrategy, context?: SharedContext): Promise<any> {
    const startTime = Date.now();
    logger.info(`Agent ${this.agentId}: Executing ${strategy.type} strategy: ${strategy.resource}`);

    try {
      let result;
      
      switch (strategy.type) {
        case 'table':
          result = await this.executeTableStrategy(strategy, context);
          break;
        case 'procedure':
          result = await this.executeProcedureStrategy(strategy, context);
          break;
        case 'function':
          result = await this.executeFunctionStrategy(strategy, context);
          break;
        case 'api':
          result = await this.executeAPIStrategy(strategy, context);
          break;
        case 'hybrid':
          result = await this.executeHybridStrategy(strategy, context);
          break;
        default:
          throw new Error(`Unknown strategy type: ${strategy.type}`);
      }

      const executionTime = Date.now() - startTime;
      logger.info(`Agent ${this.agentId}: Strategy executed in ${executionTime}ms`);
      
      return result;
    } catch (error) {
      logger.error(`Agent ${this.agentId}: Strategy execution failed:`, error);
      throw error;
    }
  }

  // Execute table-based strategy (SQL generation)
  protected async executeTableStrategy(strategy: ResourceStrategy, context?: SharedContext): Promise<any> {
    if (!this.catalog) {
      throw new Error('Agent catalog not initialized');
    }

    logger.info(`[Agent:${this.agentId}] Starting executeTableStrategy for resource: ${strategy.resource}`);
    const timer = performanceMonitor.startTimer('table_strategy_execution', this.agentId);

    try {
      // Check cache for query results
      const query = context?.originalQuery || 'Get data';
      logger.info(`[Agent:${this.agentId}] Query: ${query}`);
      const cacheKey = `query:${this.agentId}:${query}:${strategy.resource}`;
      const cachedResult = queryResultCache.get(cacheKey);

      if (cachedResult) {
        logger.info(`[Agent:${this.agentId}] Cache hit for key: ${cacheKey}`);
        timer();
        return cachedResult;
      }

      // Get filtered schema for this agent
      logger.info(`[Agent:${this.agentId}] Building filtered schema for LLM`);
      const schema = this.catalog.tables.map(table => ({
        table_name: table.table_name,
        table_type: table.table_type,
        column_name: table.column_name,
        data_type: table.data_type
      }));

      let sqlResult;
      if (this.useDynamicSchema && this.schemaAwareDatabaseService) {
        logger.info(`[Agent:${this.agentId}] Using dynamic schema-aware service for SQL generation`);
        sqlResult = await this.schemaAwareDatabaseService.executeNaturalLanguageQuery(
          query,
          {
            agentId: this.agentId,
            tableHints: [strategy.resource]
          }
        );
        logger.info(`[Agent:${this.agentId}] Dynamic SQL result: ${JSON.stringify(sqlResult)}`);
        // Attach executionStrategy for consistency
        if (sqlResult) {
          (sqlResult as any).executionStrategy = strategy;
        }
      } else {
        logger.info(`[Agent:${this.agentId}] Using legacy static schema for SQL generation`);
        const { sql, explanation, confidence } = await unifiedLLMService.convertNaturalLanguageToSQL(
          query,
          schema,
          [strategy.resource]
        );
        logger.info(`[Agent:${this.agentId}] Generated SQL: ${sql}`);
        const result = await enhancedDatabaseService.executeQuery(sql, this.agentId);
        logger.info(`[Agent:${this.agentId}] Query executed, rows: ${result.rows?.length ?? 0}`);
        sqlResult = {
          ...result,
          sql,
          explanation,
          confidence,
          executionStrategy: strategy
        };
      }

      // Cache the result
      logger.info(`[Agent:${this.agentId}] Caching result for key: ${cacheKey}`);
      queryResultCache.set(cacheKey, sqlResult, undefined, 300000); // 5 minutes TTL

      timer();
      logger.info(`[Agent:${this.agentId}] Finished executeTableStrategy`);
      return sqlResult;
    } catch (error) {
      logger.error(`[Agent:${this.agentId}] Error in executeTableStrategy:`, error);
      timer();
      throw error;
    }
  }

  // Execute stored procedure strategy
  protected async executeProcedureStrategy(strategy: ResourceStrategy, _context?: SharedContext): Promise<any> {
    const result = await enhancedDatabaseService.executeProcedure(
      strategy.resource,
      strategy.parameters || {}
    );
    
    return {
      ...result,
      executionStrategy: strategy,
      explanation: `Executed stored procedure: ${strategy.resource}`
    };
  }

  // Execute function strategy
  protected async executeFunctionStrategy(strategy: ResourceStrategy, _context?: SharedContext): Promise<any> {
    const parameters = strategy.parameters ? Object.values(strategy.parameters) : [];
    const result = await enhancedDatabaseService.executeFunction(
      strategy.resource,
      parameters
    );
    
    return {
      ...result,
      executionStrategy: strategy,
      explanation: `Executed function: ${strategy.resource}`
    };
  }

  // Execute API strategy
  protected async executeAPIStrategy(strategy: ResourceStrategy, _context?: SharedContext): Promise<any> {
    // Find API configuration
    const apiConfig = this.getAPIResources().find(api => api.name === strategy.resource);
    if (!apiConfig) {
      throw new Error(`API configuration not found: ${strategy.resource}`);
    }

    // This would be implemented with actual HTTP client
    logger.info(`Would call API: ${apiConfig.method} ${apiConfig.endpoint}`);
    
    // For now, return mock data
    return {
      rows: [{ message: `API call to ${apiConfig.endpoint} would be made here` }],
      rowCount: 1,
      executionStrategy: strategy,
      explanation: `API call: ${apiConfig.method} ${apiConfig.endpoint}`
    };
  }

  // Execute hybrid strategy (combination of resources)
  protected async executeHybridStrategy(strategy: ResourceStrategy, context?: SharedContext): Promise<any> {
    // For now, fallback to table strategy
    const tableStrategy: ResourceStrategy = {
      ...strategy,
      type: 'table',
      resource: this.catalog?.tables[0]?.table_name || 'unknown'
    };
    
    return this.executeTableStrategy(tableStrategy, context);
  }

  // Create AGUI elements from result data
  protected createAGUIElements(data: any[], visualize: boolean = false): AGUIElement[] {
    if (!data || data.length === 0) {
      return [];
    }

    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(header => {
      const value = row[header];
      if (value instanceof Date) {
        return value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value;
    }));

    const elements: AGUIElement[] = [
      {
        type: 'table',
        id: `${this.agentId}_table_${Date.now()}`,
        props: {
          headers,
          rows,
          sortable: true,
          filterable: true,
          pagination: data.length > 10 ? {
            page: 1,
            pageSize: 10,
            total: data.length
          } : undefined
        }
      }
    ];

    // Add visualization if requested
    if (visualize && data.length > 0) {
      const numericColumns = headers.filter(header => {
        const firstValue = data[0][header];
        return typeof firstValue === 'number' || !isNaN(Number(firstValue));
      });

      if (numericColumns.length > 0 && headers.length > 1) {
        const labelColumn = headers[0];
        const valueColumn = numericColumns[0];
        
        const labels = data.slice(0, 10).map(row => String(row[labelColumn]));
        const values = data.slice(0, 10).map(row => Number(row[valueColumn]));

        elements.push({
          type: 'chart',
          id: `${this.agentId}_chart_${Date.now()}`,
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

    return elements;
  }

  // Generate natural language summary
  protected async generateSummary(query: string, data: any[]): Promise<string> {
    try {
      return await unifiedLLMService.generateDataSummary(query, data);
    } catch (error) {
      logger.error(`Error generating summary for agent ${this.agentId}:`, error);
      return `Found ${data.length} record(s) for your query.`;
    }
  }

  // Build analysis prompt for LLM
  private buildAnalysisPrompt(_query: string, catalog: AgentResourceCatalog): string {
    const tablesInfo = catalog.tables.map(t => `${t.table_name}: ${t.column_name || 'no columns'}`).join('\n');
    const proceduresInfo = catalog.procedures.map(p => `${p.routine_name}: ${p.description || 'no description'}`).join('\n');
    const functionsInfo = catalog.functions.map(f => `${f.routine_name}: ${f.description || 'no description'}`).join('\n');
    const apisInfo = catalog.apis.map(a => `${a.name}: ${a.description}`).join('\n');

    return `You are an intelligent query analyzer for the ${this.domain} domain. Analyze queries and determine the best execution strategy.

AVAILABLE RESOURCES:

TABLES:
${tablesInfo}

STORED PROCEDURES:
${proceduresInfo}

FUNCTIONS:
${functionsInfo}

EXTERNAL APIS:
${apisInfo}

ANALYSIS RULES:
1. Use PROCEDURES for complex business operations
2. Use FUNCTIONS for calculations and transformations
3. Use TABLES for simple data retrieval
4. Use APIS for external system integration
5. Consider efficiency and data completeness

Return JSON format:
{
  "intent": "what user wants to achieve",
  "domain": "${this.domain}",
  "primaryStrategy": {
    "type": "table|procedure|function|api|hybrid",
    "resource": "resource name",
    "parameters": {"param": "value"},
    "confidence": 0.0-1.0,
    "reasoning": "why this is the best choice"
  },
  "secondaryStrategies": [],
  "estimatedComplexity": "low|medium|high",
  "requiresExternalAgents": []
}`;
  }

  // Handle inter-agent messages
  async handleMessage(message: AgentMessage): Promise<AgentMessage | void> {
    logger.info(`Agent ${this.agentId}: Received message from ${message.from}: ${message.action}`);
    
    try {
      switch (message.action) {
        case 'getResourceInfo':
          return this.handleGetResourceInfo(message);
        case 'queryData':
          return this.handleQueryData(message);
        case 'shareContext':
          return this.handleShareContext(message);
        default:
          logger.warn(`Agent ${this.agentId}: Unknown message action: ${message.action}`);
          return undefined;
      }
    } catch (error) {
      logger.error(`Agent ${this.agentId}: Error handling message:`, error);
      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      };
    }
  }

  // Handle resource info requests
  private async handleGetResourceInfo(message: AgentMessage): Promise<AgentMessage> {
    return {
      ...message,
      from: this.agentId,
      to: message.from,
      type: 'response',
      payload: {
        catalog: this.catalog,
        agentInfo: {
          id: this.agentId,
          domain: this.domain,
          status: 'active'
        }
      },
      timestamp: new Date()
    };
  }

  // Handle data query requests from other agents
  private async handleQueryData(message: AgentMessage): Promise<AgentMessage> {
    const { query } = message.payload;
    
    try {
      const result = await this.processQuery(query, message.context);
      
      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: {
          success: result.success,
          data: result.data,
          summary: result.summary
        },
        context: message.context || {
          originalQuery: query,
          sessionId: 'unknown',
          relatedData: {},
          confidence: 0.8,
          executionPath: [this.agentId]
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: {
          success: false,
          error: error instanceof Error ? error.message : 'Query execution failed'
        },
        timestamp: new Date()
      };
    }
  }

  // Handle context sharing from other agents
  private async handleShareContext(message: AgentMessage): Promise<void> {
    logger.info(`Agent ${this.agentId}: Received context from ${message.from}`);
    
    // Store context for potential use in future queries
    if (message.context) {
      message.context.relatedData[message.from] = message.payload;
    }
    
    // No response needed for context sharing
  }

  // Get agent health status
  getHealthStatus(): { agentId: string; domain: string; status: string; resources: number } {
    return {
      agentId: this.agentId,
      domain: this.domain,
      status: this.catalog ? 'active' : 'initializing',
      resources: (this.catalog?.tables.length || 0) + 
                (this.catalog?.procedures.length || 0) + 
                (this.catalog?.functions.length || 0) + 
                (this.catalog?.apis.length || 0)
    };
  }
}