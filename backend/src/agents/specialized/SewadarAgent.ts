import { BaseAgent, SharedContext, AgentResult, ResourceStrategy } from '../base/BaseAgent';
import { APIResource } from '../../services/enhanced-database';
import { AGUIElement } from '../../types/agui';
import { unifiedLLMService } from '../../services/llm/unified';
import logger from '../../utils/logger';

export class SewadarAgent extends BaseAgent {
  constructor() {
    super('sewadar', 'sewadar');
  }

  // RSSB Database Architecture:
  // PRIMARY TABLES: Starting points for all queries
  private readonly primaryTables = [
    'sewadar',                    // PRIMARY: All sewadar details start here
  ];
  
  // SUPPORTING TABLES: Link tables providing reference data
  private readonly linkTables = [
    
    'sewadar_attendance_summary',  // Link: All attendance queries start here
    'area',                       // Link: Geographic area information
    'centre',                     // Link: Centre details and mappings
    'centre_department_mapping',  // Link: Centre-department relationships
    'centre_type',                // Link: Centre classification
    'department',                 // Link: Department information
    'sewadar_attendance',         // Link: Detailed attendance records
    'sewadar_family_reference',   // Link: Family relationships
    'sewadar_pics_update'         // Link: Photo/picture updates
  ];

  // Define specific tables for RSSB sewadar domain
  getTablePatterns(): string[] {
    return [
      ...this.primaryTables,
      ...this.linkTables
    ];
  }

  // No stored procedures for RSSB sewadar domain
  getProcedurePatterns(): string[] {
    return [];
  }

  // Define specific functions for RSSB sewadar domain
  getFunctionPatterns(): string[] {
    return [
      'ufunc_get_sewadar_basics',
      'ufunc_get_sewadar_search',
      'ufunc_attendance_summary'
    ];
  }

  // Get RSSB-specific function signatures
  getFunctionSignatures(): Record<string, any> {
    return {
      'ufunc_get_sewadar_basics': {
        parameters: [
          { name: '_loggedin_badge', type: 'varchar', description: 'Logged in user badge number' },
          { name: '_loggedin_role', type: 'varchar', description: 'Logged in user role (e.g., ss-admin)' },
          { name: '_search_badge', type: 'varchar', description: 'Badge number to search for' },
          { name: '_sewadar_id', type: 'integer', description: 'Sewadar ID (use 0 for badge-based search)' }
        ],
        example: "SELECT * FROM public.ufunc_get_sewadar_basics('BH0011GC4321', 'ss-admin', 'BH0011GB8271', 0)",
        description: 'Get basic sewadar information by badge or ID'
      },
      'ufunc_get_sewadar_search': {
        parameters: [
          { name: '_loggedin_badge', type: 'varchar', description: 'Logged in user badge number' },
          { name: '_loggedin_role', type: 'varchar', description: 'Logged in user role' },
          { name: '_sewadar_name', type: 'varchar', description: 'Sewadar name to search for (partial match)' },
          { name: '_father_husband_name', type: 'varchar', description: 'Father/husband name (nullable)' },
          { name: '_badge_number', type: 'varchar', description: 'Badge number (nullable)' },
          { name: '_area_id', type: 'integer', description: 'Area ID filter (nullable)' },
          { name: '_centre_id', type: 'integer', description: 'Centre ID filter (nullable)' },
          { name: '_department_id', type: 'integer', description: 'Department ID filter (nullable)' },
          { name: '_resaddress', type: 'varchar', description: 'Residential address filter (nullable)' },
          { name: 'pagenumber', type: 'integer', description: 'Page number for pagination' },
          { name: 'pagesize', type: 'integer', description: 'Number of records per page' }
        ],
        example: "SELECT * FROM public.ufunc_get_sewadar_search('BH0011GB2002', 'ss-admin', 'Gulshan', null, null, null, null, null, null, 1, 100)",
        description: 'Search sewadars with multiple filter criteria'
      },
      'ufunc_attendance_summary': {
        parameters: [
          { name: '_loggedin_badge', type: 'varchar', description: 'Logged in user badge number' },
          { name: '_loggedin_role', type: 'varchar', description: 'Logged in user role' },
          { name: '_sewadar_badge', type: 'varchar', description: 'Sewadar badge to get attendance summary for' },
          { name: '_from_date', type: 'date', description: 'Start date for attendance summary' },
          { name: '_to_date', type: 'date', description: 'End date for attendance summary' }
        ],
        example: "SELECT * FROM public.ufunc_attendance_summary('BH0011GC4321', 'ss-admin', 'BH0011GB8271', '2024-01-01', '2024-01-31')",
        description: 'Get attendance summary for a sewadar within date range'
      }
    };
  }

  // Define external APIs for sewadar domain (empty for RSSB system)
  getAPIResources(): APIResource[] {
    return [];
  }

  // Main query processing method
  async processQuery(query: string, context?: SharedContext): Promise<AgentResult> {
    const startTime = Date.now();
    logger.info(`SewadarAgent: Processing query: "${query}"`);

    try {
      // Create execution context
      const executionContext = context || {
        originalQuery: query,
        sessionId: `sewadar_${Date.now()}`,
        relatedData: {},
        confidence: 0.8,
        executionPath: [this.agentId]
      };

      // Analyze query to determine strategy
      const analysis = await this.analyzeQuery(query, executionContext);
      
      // Execute primary strategy
      let result;
      try {
        result = await this.executeStrategy(analysis.primaryStrategy, executionContext);
      } catch (error) {
        logger.warn(`Primary strategy failed, trying fallback strategies`);
        result = await this.executeFallbackStrategies(analysis.secondaryStrategies, executionContext);
      }

      // Generate natural language summary
      const summary = await this.generateSummary(query, result.rows || []);

      // Create AGUI elements
      const agui = this.createAGUIElements(result.rows || [], true);

      // Get model info
      const modelInfo = unifiedLLMService.getModelInfo();

      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result.rows || [],
        sql: result.sql,
        explanation: result.explanation || analysis.primaryStrategy.reasoning,
        confidence: result.confidence || analysis.primaryStrategy.confidence,
        summary,
        agui,
        model: {
          provider: modelInfo.provider,
          name: modelInfo.model
        },
        executionStrategy: result.executionStrategy || analysis.primaryStrategy,
        involvedAgents: [this.agentId],
        executionTime
      };
    } catch (error) {
      logger.error(`SewadarAgent: Error processing query:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        involvedAgents: [this.agentId],
        executionTime: Date.now() - startTime
      };
    }
  }

  // Execute fallback strategies when primary fails
  private async executeFallbackStrategies(strategies: ResourceStrategy[], context: SharedContext): Promise<any> {
    for (const strategy of strategies) {
      try {
        logger.info(`SewadarAgent: Trying fallback strategy: ${strategy.type} - ${strategy.resource}`);
        return await this.executeStrategy(strategy, context);
      } catch (error) {
        logger.warn(`Fallback strategy failed: ${strategy.resource}`);
        continue;
      }
    }
    
    // Ultimate fallback - simple table query
    return this.executeSimpleTableFallback(context);
  }

  // Simple table fallback when all strategies fail
  private async executeSimpleTableFallback(context: SharedContext): Promise<any> {
    if (!this.catalog || this.catalog.tables.length === 0) {
      throw new Error('No tables available for fallback');
    }

    const firstTable = this.catalog.tables[0];
    logger.info(`SewadarAgent: Using simple table fallback: ${firstTable.table_name}`);

    const fallbackStrategy: ResourceStrategy = {
      type: 'table',
      resource: firstTable.table_name,
      confidence: 0.3,
      reasoning: 'Simple table fallback when other strategies failed'
    };

    return this.executeTableStrategy(fallbackStrategy, context);
  }

  // Enhanced table strategy with sewadar-specific optimizations
  protected async executeTableStrategy(strategy: ResourceStrategy, context?: SharedContext): Promise<any> {
    if (!this.catalog) {
      throw new Error('Agent catalog not initialized');
    }

    // Build compact schema for sewadar domain
    const schema = this.buildCompactSchema();

    // Use enhanced prompt for sewadar queries
    const enhancedQuery = this.enhanceQueryForSewadarDomain(context?.originalQuery || 'Get sewadar data');

    // Generate SQL using LLM with sewadar-specific context
    const { sql, explanation, confidence } = await unifiedLLMService.convertNaturalLanguageToSQL(
      enhancedQuery,
      schema,
      [strategy.resource]
    );

    // Execute SQL with agent context
    const result = await this.catalog && this.catalog.tables.length > 0 
      ? await this.executeSewadarSQL(sql)
      : { rows: [], rowCount: 0 };
    
    return {
      ...result,
      sql,
      explanation,
      confidence,
      executionStrategy: strategy
    };
  }

  // Build compact schema optimized for sewadar queries
  private buildCompactSchema(): any[] {
    if (!this.catalog) return [];

    return this.catalog.tables.map(table => ({
      table_name: table.table_name,
      table_type: table.table_type,
      column_name: table.column_name,
      data_type: table.data_type,
      domain: table.domain
    }));
  }

  // Enhance query with sewadar-specific context
  private enhanceQueryForSewadarDomain(query: string): string {
    const sewadarKeywords = ['sewadar', 'badge', 'profile', 'eligibility', 'personal'];
    const hasSewadarContext = sewadarKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );

    if (!hasSewadarContext) {
      return `For sewadar information: ${query}`;
    }

    return query;
  }

  // Execute sewadar-specific SQL with RSSB database functions
  private async executeSewadarSQL(sql: string): Promise<{ rows: any[], rowCount: number }> {
    try {
      // Check if this is a function call to our specific RSSB functions
      const isRSSBFunction = sql.toLowerCase().includes('ufunc_get_sewadar');
      
      if (!isRSSBFunction && !sql.toLowerCase().includes('sewadar') && !sql.toLowerCase().includes('area') && !sql.toLowerCase().includes('centre') && !sql.toLowerCase().includes('department')) {
        logger.warn('Query does not seem to be RSSB sewadar-related, proceeding with caution');
      }

      // Import enhanced database service
      const { enhancedDatabaseService } = await import('../../services/enhanced-database');
      
      // Execute the SQL query
      const result = await enhancedDatabaseService.executeQuery(sql, this.agentId);

      logger.info(`SewadarAgent: SQL executed successfully, returned ${result.rowCount} rows`);
      return result;
    } catch (error) {
      logger.error('SewadarAgent: Error executing SQL:', error);
      throw error;
    }
  }

  // Execute RSSB sewadar functions with proper parameter handling
  async executeSewadarFunction(functionName: string, parameters: any[]): Promise<{ rows: any[], rowCount: number }> {
    try {
      const signatures = this.getFunctionSignatures();
      const signature = signatures[functionName];
      
      if (!signature) {
        throw new Error(`Unknown function: ${functionName}`);
      }

      // Import enhanced database service
      const { enhancedDatabaseService } = await import('../../services/enhanced-database');
      
      // Execute function
      const result = await enhancedDatabaseService.executeFunction(`public.${functionName}`, parameters);
      
      logger.info(`SewadarAgent: Function ${functionName} executed successfully, returned ${result.rowCount} rows`);
      return result;
    } catch (error) {
      logger.error(`SewadarAgent: Error executing function ${functionName}:`, error);
      throw error;
    }
  }

  // Helper method to get sewadar basics
  // ARCHITECTURE: Starts from PRIMARY TABLE 'sewadar' and links to supporting tables
  async getSewadarBasics(loggedInBadge: string, loggedInRole: string, searchBadge: string, sewadarId: number = 0): Promise<{ rows: any[], rowCount: number }> {
    return this.executeSewadarFunction('ufunc_get_sewadar_basics', [loggedInBadge, loggedInRole, searchBadge, sewadarId]);
  }

  // Helper method to search sewadars
  // ARCHITECTURE: Starts from PRIMARY TABLE 'sewadar' and joins with link tables
  async searchSewadars(
    loggedInBadge: string,
    loggedInRole: string,
    sewadarName?: string,
    fatherHusbandName?: string,
    badgeNumber?: string,
    areaId?: number,
    centreId?: number,
    departmentId?: number,
    resAddress?: string,
    pageNumber: number = 1,
    pageSize: number = 100
  ): Promise<{ rows: any[], rowCount: number }> {
    return this.executeSewadarFunction('ufunc_get_sewadar_search', [
      loggedInBadge,
      loggedInRole,
      sewadarName || null,
      fatherHusbandName || null,
      badgeNumber || null,
      areaId || null,
      centreId || null,
      departmentId || null,
      resAddress || null,
      pageNumber,
      pageSize
    ]);
  }

  // Helper method to get attendance summary
  // ARCHITECTURE: Starts from PRIMARY TABLE 'sewadar_attendance_summary'
  async getAttendanceSummary(
    loggedInBadge: string,
    loggedInRole: string,
    sewadarBadge: string,
    fromDate: string,
    toDate: string
  ): Promise<{ rows: any[], rowCount: number }> {
    return this.executeSewadarFunction('ufunc_attendance_summary', [
      loggedInBadge,
      loggedInRole,
      sewadarBadge,
      fromDate,
      toDate
    ]);
  }

  // Sewadar-specific AGUI elements with domain styling
  protected createAGUIElements(data: any[], visualize: boolean = false): AGUIElement[] {
    const elements = super.createAGUIElements(data, visualize);

    // Add sewadar-specific styling and metadata
    elements.forEach(element => {
      if (element.type === 'table') {
        element.props = {
          ...element.props,
          className: 'sewadar-table',
          theme: 'sewadar',
          caption: 'Sewadar Information'
        };
      }
      
      if (element.type === 'chart') {
        element.props = {
          ...element.props,
          options: {
            ...element.props.options,
            plugins: {
              ...element.props.options?.plugins,
              title: {
                display: true,
                text: 'Sewadar Data Visualization'
              }
            }
          }
        };
      }
    });

    return elements;
  }

  // Generate sewadar-specific summary
  protected async generateSummary(query: string, data: any[]): Promise<string> {
    try {
      if (!data || data.length === 0) {
        return 'No sewadar records found matching your criteria.';
      }

      // Enhanced summary prompt for sewadar domain
      const response = await unifiedLLMService.chat([
        {
          role: 'system',
          content: `You are a sewadar data analyst. Provide clear, respectful summaries of sewadar information.

FORMATTING RULES:
- Use respectful language when referring to sewadars
- Highlight key information like badge numbers, eligibility status, departments
- Use **bold** for important details
- Use bullet points for multiple items
- Keep summaries under 150 words
- Focus on actionable insights`
        },
        {
          role: 'user',
          content: `Query: "${query}"
          
Data: ${JSON.stringify(data.slice(0, 3), null, 2)}
Total records: ${data.length}

Provide a clear summary.`
        }
      ], { temperature: 0.3, max_tokens: 500 });

      return response.choices[0]?.message?.content?.trim() || 
             `Found ${data.length} sewadar record(s) matching your query.`;
    } catch (error) {
      logger.error('SewadarAgent: Error generating summary:', error);
      return `Found ${data.length} sewadar record(s) for your query.`;
    }
  }

  // RSSB Sewadar-specific message handling
  async handleMessage(message: any): Promise<any> {
    logger.info(`SewadarAgent: Handling message: ${message.action}`);

    switch (message.action) {
      case 'getSewadarBasics':
        return this.handleGetSewadarBasics(message);
      case 'searchSewadars':
        return this.handleSearchSewadars(message);
      case 'getSewadarsByBadge':
        return this.handleGetSewadarsByBadge(message);
      case 'getAttendanceSummary':
        return this.handleGetAttendanceSummary(message);
      default:
        return super.handleMessage(message);
    }
  }

  // Handle sewadar basics request using RSSB function
  private async handleGetSewadarBasics(message: any): Promise<any> {
    const { loggedInBadge, loggedInRole, searchBadge, sewadarId } = message.payload;
    
    try {
      const result = await this.getSewadarBasics(
        loggedInBadge || 'BH0011GC4321',
        loggedInRole || 'ss-admin',
        searchBadge,
        sewadarId || 0
      );

      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: {
          success: true,
          data: result.rows,
          rowCount: result.rowCount
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
          error: error instanceof Error ? error.message : 'Failed to get sewadar basics'
        },
        timestamp: new Date()
      };
    }
  }

  // Handle sewadar search using RSSB function
  private async handleSearchSewadars(message: any): Promise<any> {
    const {
      loggedInBadge,
      loggedInRole,
      sewadarName,
      fatherHusbandName,
      badgeNumber,
      areaId,
      centreId,
      departmentId,
      resAddress,
      pageNumber,
      pageSize
    } = message.payload;
    
    try {
      const result = await this.searchSewadars(
        loggedInBadge || 'BH0011GB2002',
        loggedInRole || 'ss-admin',
        sewadarName,
        fatherHusbandName,
        badgeNumber,
        areaId,
        centreId,
        departmentId,
        resAddress,
        pageNumber || 1,
        pageSize || 100
      );

      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: {
          success: true,
          data: result.rows,
          rowCount: result.rowCount,
          pageNumber: pageNumber || 1,
          pageSize: pageSize || 100
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
          error: error instanceof Error ? error.message : 'Failed to search sewadars'
        },
        timestamp: new Date()
      };
    }
  }

  // Handle get sewadars by badge
  private async handleGetSewadarsByBadge(message: any): Promise<any> {
    const { badges, loggedInBadge, loggedInRole } = message.payload;
    
    try {
      const results = await Promise.all(
        badges.map((badge: string) =>
          this.getSewadarBasics(
            loggedInBadge || 'BH0011GC4321',
            loggedInRole || 'ss-admin',
            badge,
            0
          )
        )
      );

      const allData = results.flatMap(result => result.rows);

      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: {
          success: true,
          data: allData,
          rowCount: allData.length
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
          error: error instanceof Error ? error.message : 'Failed to get sewadars by badge'
        },
        timestamp: new Date()
      };
    }
  }

  // Handle attendance summary request
  private async handleGetAttendanceSummary(message: any): Promise<any> {
    const {
      loggedInBadge,
      loggedInRole,
      sewadarBadge,
      fromDate,
      toDate
    } = message.payload;
    
    try {
      const result = await this.getAttendanceSummary(
        loggedInBadge || 'BH0011GC4321',
        loggedInRole || 'ss-admin',
        sewadarBadge,
        fromDate,
        toDate
      );

      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: {
          success: true,
          data: result.rows,
          rowCount: result.rowCount,
          dateRange: { fromDate, toDate },
          sewadarBadge
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
          error: error instanceof Error ? error.message : 'Failed to get attendance summary'
        },
        timestamp: new Date()
      };
    }
  }

  // Get sewadar agent health with domain-specific metrics
  getHealthStatus() {
    const baseHealth = super.getHealthStatus();
    
    return {
      ...baseHealth,
      domainSpecific: {
        totalSewadarTables: this.catalog?.tables.filter(t => 
          t.table_name.toLowerCase().includes('sewadar')).length || 0,
        sewadarProcedures: this.catalog?.procedures.length || 0,
        externalIntegrations: this.getAPIResources().length,
        lastQuery: 'Recently processed sewadar queries'
      }
    };
  }
}