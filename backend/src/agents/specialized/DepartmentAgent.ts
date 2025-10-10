import { BaseAgent, SharedContext, AgentResult, ResourceStrategy } from '../base/BaseAgent';
import { APIResource } from '../../services/enhanced-database';
import { AGUIElement } from '../../types/agui';
import { unifiedLLMService } from '../../services/llm/unified';
import logger from '../../utils/logger';

export class DepartmentAgent extends BaseAgent {
  constructor() {
    super('department', 'department');
  }

  // Define table patterns for department domain
  getTablePatterns(): string[] {
    return [
      'department%',
      'section%',
      'unit%',
      'division%',
      'hierarchy%',
      'assignment%'
    ];
  }

  // Define procedure patterns for department domain
  getProcedurePatterns(): string[] {
    return [
      'sp_get_department%',
      'sp_department%',
      'sp_assign_department%',
      'sp_transfer_department%'
    ];
  }

  // Define function patterns for department domain
  getFunctionPatterns(): string[] {
    return [
      'fn_calculate_department%',
      'fn_department%',
      'fn_get_department%',
      'fn_check_department%'
    ];
  }

  // Define external APIs for department domain
  getAPIResources(): APIResource[] {
    return [
      {
        name: 'department_sync',
        endpoint: 'https://external-system.com/api/departments/sync',
        method: 'POST',
        description: 'Sync department structure with external systems',
        domain: 'department',
        authentication: {
          type: 'bearer',
          token_env: 'EXTERNAL_API_TOKEN'
        },
        parameters: [
          {
            name: 'departmentId',
            type: 'string',
            required: false,
            description: 'Specific department to sync'
          },
          {
            name: 'includeSubDepartments',
            type: 'boolean',
            required: false,
            description: 'Include sub-departments in sync'
          }
        ]
      },
      {
        name: 'org_chart',
        endpoint: 'https://external-system.com/api/org/chart/{departmentId}',
        method: 'GET',
        description: 'Get organizational chart for department',
        domain: 'department',
        parameters: [
          {
            name: 'departmentId',
            type: 'string',
            required: true,
            description: 'Department ID for org chart'
          }
        ]
      }
    ];
  }

  // Main query processing method
  async processQuery(query: string, context?: SharedContext): Promise<AgentResult> {
    const startTime = Date.now();
    logger.info(`DepartmentAgent: Processing query: "${query}"`);

    try {
      // Create execution context
      const executionContext = context || {
        originalQuery: query,
        sessionId: `department_${Date.now()}`,
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
      logger.error(`DepartmentAgent: Error processing query:`, error);
      
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
        logger.info(`DepartmentAgent: Trying fallback strategy: ${strategy.type} - ${strategy.resource}`);
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
    logger.info(`DepartmentAgent: Using simple table fallback: ${firstTable.table_name}`);

    const fallbackStrategy: ResourceStrategy = {
      type: 'table',
      resource: firstTable.table_name,
      confidence: 0.3,
      reasoning: 'Simple table fallback when other strategies failed'
    };

    return this.executeTableStrategy(fallbackStrategy, context);
  }

  // Enhanced table strategy with department-specific optimizations
  protected async executeTableStrategy(strategy: ResourceStrategy, context?: SharedContext): Promise<any> {
    if (!this.catalog) {
      throw new Error('Agent catalog not initialized');
    }

    // Build compact schema for department domain
    const schema = this.buildCompactSchema();

    // Use enhanced prompt for department queries
    const enhancedQuery = this.enhanceQueryForDepartmentDomain(context?.originalQuery || 'Get department data');

    // Generate SQL using LLM with department-specific context
    const { sql, explanation, confidence } = await unifiedLLMService.convertNaturalLanguageToSQL(
      enhancedQuery,
      schema,
      [strategy.resource]
    );

    // Execute SQL with agent context
    const result = await this.catalog && this.catalog.tables.length > 0 
      ? await this.executeDepartmentSQL(sql)
      : { rows: [], rowCount: 0 };
    
    return {
      ...result,
      sql,
      explanation,
      confidence,
      executionStrategy: strategy
    };
  }

  // Build compact schema optimized for department queries
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

  // Enhance query with department-specific context
  private enhanceQueryForDepartmentDomain(query: string): string {
    const departmentKeywords = ['department', 'section', 'unit', 'division', 'assignment', 'hierarchy'];
    const hasDepartmentContext = departmentKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );

    if (!hasDepartmentContext) {
      return `For department information: ${query}`;
    }

    return query;
  }

  // Execute department-specific SQL with additional safety checks
  private async executeDepartmentSQL(sql: string): Promise<{ rows: any[], rowCount: number }> {
    try {
      // Additional safety check for department queries
      if (!sql.toLowerCase().includes('department') && !sql.toLowerCase().includes('section')) {
        logger.warn('Query does not seem to be department-related, proceeding with caution');
      }

      // Import and use the enhanced database service
      const { enhancedDatabaseService } = await import('../../services/enhanced-database');
      
      // Execute SQL using the actual database service
      const result = await enhancedDatabaseService.executeQuery(sql, this.agentId);

      logger.info(`DepartmentAgent: SQL executed successfully, returned ${result.rowCount} rows`);
      return result;
    } catch (error) {
      logger.error('DepartmentAgent: Error executing SQL:', error);
      throw error;
    }
  }

  // Department-specific AGUI elements with domain styling
  protected createAGUIElements(data: any[], visualize: boolean = false): AGUIElement[] {
    const elements = super.createAGUIElements(data, visualize);

    // Add department-specific styling and metadata
    elements.forEach(element => {
      if (element.type === 'table') {
        element.props = {
          ...element.props,
          className: 'department-table',
          theme: 'department',
          caption: 'Department Information'
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
                text: 'Department Data Visualization'
              }
            }
          }
        };
      }
    });

    return elements;
  }

  // Generate department-specific summary
  protected async generateSummary(query: string, data: any[]): Promise<string> {
    try {
      if (!data || data.length === 0) {
        return 'No department records found matching your criteria.';
      }

      // Enhanced summary prompt for department domain
      const response = await unifiedLLMService.chat([
        {
          role: 'system',
          content: `You are a department data analyst. Provide clear summaries of departmental information.

FORMATTING RULES:
- Use professional language for organizational data
- Highlight department names, hierarchies, and assignments
- Use **bold** for important details like department names
- Use bullet points for multiple departments or assignments
- Keep summaries under 150 words
- Focus on organizational structure insights`
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
             `Found ${data.length} department record(s) matching your query.`;
    } catch (error) {
      logger.error('DepartmentAgent: Error generating summary:', error);
      return `Found ${data.length} department record(s) for your query.`;
    }
  }

  // Department-specific message handling
  async handleMessage(message: any): Promise<any> {
    logger.info(`DepartmentAgent: Handling message: ${message.action}`);

    switch (message.action) {
      case 'getDepartmentHierarchy':
        return this.handleGetDepartmentHierarchy(message);
      case 'getSewadarsByDepartment':
        return this.handleGetSewadarsByDepartment(message);
      case 'assignToDepartment':
        return this.handleAssignToDepartment(message);
      case 'transferDepartment':
        return this.handleTransferDepartment(message);
      default:
        return super.handleMessage(message);
    }
  }

  // Handle department hierarchy request
  private async handleGetDepartmentHierarchy(message: any): Promise<any> {
    const { departmentId, includeSubDepartments } = message.payload;
    
    try {
      // Mock implementation - would use actual database
      const result = {
        success: true,
        data: [{
          departmentId: departmentId || 'D001',
          name: 'Main Department',
          parentId: null,
          level: 1,
          subDepartments: includeSubDepartments ? [
            { departmentId: 'D001-A', name: 'Sub Department A', parentId: 'D001', level: 2 },
            { departmentId: 'D001-B', name: 'Sub Department B', parentId: 'D001', level: 2 }
          ] : []
        }]
      };

      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: result,
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
          error: error instanceof Error ? error.message : 'Failed to get department hierarchy'
        },
        timestamp: new Date()
      };
    }
  }

  // Handle get sewadars by department
  private async handleGetSewadarsByDepartment(message: any): Promise<any> {
    const { departmentId, includeInactive } = message.payload;
    
    // Mock implementation
    const result = {
      success: true,
      data: [
        {
          sewadarId: 'S001',
          badge: 'S001',
          name: 'Sewadar One',
          departmentId,
          status: 'active',
          assignmentDate: new Date()
        },
        {
          sewadarId: 'S002',
          badge: 'S002',
          name: 'Sewadar Two',
          departmentId,
          status: includeInactive ? 'inactive' : 'active',
          assignmentDate: new Date()
        }
      ].filter(s => includeInactive || s.status === 'active')
    };

    return {
      ...message,
      from: this.agentId,
      to: message.from,
      type: 'response',
      payload: result,
      timestamp: new Date()
    };
  }

  // Handle assignment to department
  private async handleAssignToDepartment(message: any): Promise<any> {
    const { sewadarIds, departmentId, assignmentType } = message.payload;
    
    // Mock implementation
    const result = {
      success: true,
      data: sewadarIds.map((id: string) => ({
        sewadarId: id,
        departmentId,
        assignmentType: assignmentType || 'permanent',
        assignmentDate: new Date(),
        status: 'assigned'
      }))
    };

    return {
      ...message,
      from: this.agentId,
      to: message.from,
      type: 'response',
      payload: result,
      timestamp: new Date()
    };
  }

  // Handle department transfer
  private async handleTransferDepartment(message: any): Promise<any> {
    const { sewadarId, fromDepartmentId, toDepartmentId, effectiveDate } = message.payload;
    
    // Mock implementation
    const result = {
      success: true,
      data: {
        sewadarId,
        fromDepartmentId,
        toDepartmentId,
        effectiveDate: effectiveDate || new Date(),
        transferId: `TR_${Date.now()}`,
        status: 'completed'
      }
    };

    return {
      ...message,
      from: this.agentId,
      to: message.from,
      type: 'response',
      payload: result,
      timestamp: new Date()
    };
  }

  // Get department agent health with domain-specific metrics
  getHealthStatus() {
    const baseHealth = super.getHealthStatus();
    
    return {
      ...baseHealth,
      domainSpecific: {
        totalDepartmentTables: this.catalog?.tables.filter(t => 
          t.table_name.toLowerCase().includes('department')).length || 0,
        departmentProcedures: this.catalog?.procedures.length || 0,
        externalIntegrations: this.getAPIResources().length,
        lastQuery: 'Recently processed department queries'
      }
    };
  }
}