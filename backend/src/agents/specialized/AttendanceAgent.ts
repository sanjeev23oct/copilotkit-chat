import { BaseAgent, SharedContext, AgentResult, ResourceStrategy } from '../base/BaseAgent';
import { APIResource } from '../../services/enhanced-database';
import { AGUIElement } from '../../types/agui';
import { unifiedLLMService } from '../../services/llm/unified';
import logger from '../../utils/logger';

export class AttendanceAgent extends BaseAgent {
  constructor() {
    super('attendance', 'attendance');
  }

  // Define table patterns for attendance domain
  getTablePatterns(): string[] {
    return [
      'attendance%',
      'duty%',
      'schedule%',
      'shift%',
      'roster%',
      'checkin%',
      'checkout%'
    ];
  }

  // Define procedure patterns for attendance domain
  getProcedurePatterns(): string[] {
    return [
      'sp_mark_attendance%',
      'sp_attendance%',
      'sp_duty%',
      'sp_schedule%',
      'sp_generate_roster%'
    ];
  }

  // Define function patterns for attendance domain
  getFunctionPatterns(): string[] {
    return [
      'fn_calculate_attendance%',
      'fn_attendance%',
      'fn_duty%',
      'fn_check_attendance%'
    ];
  }

  // Define external APIs for attendance domain
  getAPIResources(): APIResource[] {
    return [
      {
        name: 'time_tracking',
        endpoint: 'https://external-system.com/api/time/track',
        method: 'POST',
        description: 'External time tracking system integration',
        domain: 'attendance',
        authentication: {
          type: 'bearer',
          token_env: 'TIME_TRACKING_API_TOKEN'
        },
        parameters: [
          {
            name: 'sewadarId',
            type: 'string',
            required: true,
            description: 'Sewadar identifier'
          },
          {
            name: 'actionType',
            type: 'string',
            required: true,
            description: 'checkin or checkout'
          },
          {
            name: 'timestamp',
            type: 'string',
            required: false,
            description: 'ISO timestamp, defaults to now'
          },
          {
            name: 'location',
            type: 'string',
            required: false,
            description: 'Check-in location'
          }
        ]
      },
      {
        name: 'shift_scheduler',
        endpoint: 'https://external-system.com/api/shifts/schedule',
        method: 'POST',
        description: 'Automated shift scheduling service',
        domain: 'attendance',
        parameters: [
          {
            name: 'departmentId',
            type: 'string',
            required: true,
            description: 'Department for scheduling'
          },
          {
            name: 'period',
            type: 'string',
            required: true,
            description: 'Scheduling period (weekly, monthly)'
          }
        ]
      }
    ];
  }

  // Main query processing method
  async processQuery(query: string, context?: SharedContext): Promise<AgentResult> {
    const startTime = Date.now();
    logger.info(`AttendanceAgent: Processing query: "${query}"`);

    try {
      // Create execution context
      const executionContext = context || {
        originalQuery: query,
        sessionId: `attendance_${Date.now()}`,
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

      // Create AGUI elements with attendance-specific charts
      const agui = this.createAttendanceAGUIElements(result.rows || [], true);

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
      logger.error(`AttendanceAgent: Error processing query:`, error);
      
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
        logger.info(`AttendanceAgent: Trying fallback strategy: ${strategy.type} - ${strategy.resource}`);
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
    logger.info(`AttendanceAgent: Using simple table fallback: ${firstTable.table_name}`);

    const fallbackStrategy: ResourceStrategy = {
      type: 'table',
      resource: firstTable.table_name,
      confidence: 0.3,
      reasoning: 'Simple table fallback when other strategies failed'
    };

    return this.executeTableStrategy(fallbackStrategy, context);
  }

  // Enhanced table strategy with attendance-specific optimizations
  protected async executeTableStrategy(strategy: ResourceStrategy, context?: SharedContext): Promise<any> {
    if (!this.catalog) {
      throw new Error('Agent catalog not initialized');
    }

    // Build compact schema for attendance domain
    const schema = this.buildCompactSchema();

    // Use enhanced prompt for attendance queries
    const enhancedQuery = this.enhanceQueryForAttendanceDomain(context?.originalQuery || 'Get attendance data');

    // Generate SQL using LLM with attendance-specific context
    const { sql, explanation, confidence } = await unifiedLLMService.convertNaturalLanguageToSQL(
      enhancedQuery,
      schema,
      [strategy.resource]
    );

    // Execute SQL with agent context
    const result = await this.catalog && this.catalog.tables.length > 0 
      ? await this.executeAttendanceSQL(sql)
      : { rows: [], rowCount: 0 };
    
    return {
      ...result,
      sql,
      explanation,
      confidence,
      executionStrategy: strategy
    };
  }

  // Build compact schema optimized for attendance queries
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

  // Enhance query with attendance-specific context
  private enhanceQueryForAttendanceDomain(query: string): string {
    const attendanceKeywords = ['attendance', 'present', 'absent', 'duty', 'schedule', 'shift', 'roster'];
    const hasAttendanceContext = attendanceKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );

    if (!hasAttendanceContext) {
      return `For attendance information: ${query}`;
    }

    return query;
  }

  // Execute attendance-specific SQL with additional safety checks
  private async executeAttendanceSQL(sql: string): Promise<{ rows: any[], rowCount: number }> {
    try {
      // Additional safety check for attendance queries
      if (!sql.toLowerCase().includes('attendance') && !sql.toLowerCase().includes('duty')) {
        logger.warn('Query does not seem to be attendance-related, proceeding with caution');
      }

      // Import enhanced database service
      const { enhancedDatabaseService } = await import('../../services/enhanced-database');
      
      // Execute the SQL query
      const result = await enhancedDatabaseService.executeQuery(sql, this.agentId);

      logger.info(`AttendanceAgent: SQL executed successfully, returned ${result.rowCount} rows`);
      return result;
    } catch (error) {
      logger.error('AttendanceAgent: Error executing SQL:', error);
      throw error;
    }
  }

  // Attendance-specific AGUI elements with specialized charts
  private createAttendanceAGUIElements(data: any[], visualize: boolean = false): AGUIElement[] {
    const elements = super.createAGUIElements(data, visualize);

    // Add attendance-specific styling and metadata
    elements.forEach(element => {
      if (element.type === 'table') {
        element.props = {
          ...element.props,
          className: 'attendance-table',
          theme: 'attendance',
          caption: 'Attendance Information'
        };
      }
    });

    // Add attendance-specific charts
    if (visualize && data.length > 0) {
      this.addAttendanceCharts(elements, data);
    }

    return elements;
  }

  // Add specialized attendance charts
  private addAttendanceCharts(elements: AGUIElement[], data: any[]): void {
    const headers = Object.keys(data[0]);
    
    // Add attendance trend chart if date/time columns exist
    const dateColumns = headers.filter(h => 
      h.toLowerCase().includes('date') || h.toLowerCase().includes('time')
    );
    
    if (dateColumns.length > 0) {
      const dateColumn = dateColumns[0];
      const attendanceData = this.processAttendanceTrendData(data, dateColumn);
      
      elements.push({
        type: 'chart',
        id: `attendance_trend_${Date.now()}`,
        props: {
          chartType: 'line',
          data: {
            labels: attendanceData.labels,
            datasets: [{
              label: 'Attendance Count',
              data: attendanceData.values,
              borderColor: '#28a745',
              backgroundColor: 'rgba(40, 167, 69, 0.1)',
              fill: true
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Attendance Trend Over Time'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Number of Attendees'
                }
              }
            }
          }
        }
      });
    }

    // Add present vs absent pie chart if status column exists
    const statusColumns = headers.filter(h => 
      h.toLowerCase().includes('status') || h.toLowerCase().includes('present')
    );
    
    if (statusColumns.length > 0) {
      const statusColumn = statusColumns[0];
      const statusData = this.processStatusData(data, statusColumn);
      
      elements.push({
        type: 'chart',
        id: `attendance_status_${Date.now()}`,
        props: {
          chartType: 'pie',
          data: {
            labels: statusData.labels,
            datasets: [{
              data: statusData.values,
              backgroundColor: [
                '#28a745', // Present - green
                '#dc3545', // Absent - red
                '#ffc107', // Late - yellow
                '#17a2b8'  // Other - blue
              ]
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Attendance Status Distribution'
              }
            }
          }
        }
      });
    }
  }

  // Process data for attendance trend chart
  private processAttendanceTrendData(data: any[], dateColumn: string): { labels: string[], values: number[] } {
    const trendMap = new Map<string, number>();
    
    data.forEach(record => {
      const date = record[dateColumn];
      if (date) {
        const dateStr = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
        trendMap.set(dateStr, (trendMap.get(dateStr) || 0) + 1);
      }
    });

    const sortedEntries = Array.from(trendMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    return {
      labels: sortedEntries.map(([date]) => date),
      values: sortedEntries.map(([, count]) => count)
    };
  }

  // Process data for status distribution chart
  private processStatusData(data: any[], statusColumn: string): { labels: string[], values: number[] } {
    const statusMap = new Map<string, number>();
    
    data.forEach(record => {
      const status = record[statusColumn];
      if (status) {
        const normalizedStatus = String(status).toLowerCase();
        let category = 'Other';
        
        if (normalizedStatus.includes('present') || normalizedStatus === 'true' || normalizedStatus === '1') {
          category = 'Present';
        } else if (normalizedStatus.includes('absent') || normalizedStatus === 'false' || normalizedStatus === '0') {
          category = 'Absent';
        } else if (normalizedStatus.includes('late')) {
          category = 'Late';
        }
        
        statusMap.set(category, (statusMap.get(category) || 0) + 1);
      }
    });

    return {
      labels: Array.from(statusMap.keys()),
      values: Array.from(statusMap.values())
    };
  }

  // Generate attendance-specific summary
  protected async generateSummary(query: string, data: any[]): Promise<string> {
    try {
      if (!data || data.length === 0) {
        return 'No attendance records found matching your criteria.';
      }

      // Enhanced summary prompt for attendance domain
      const response = await unifiedLLMService.chat([
        {
          role: 'system',
          content: `You are an attendance data analyst. Provide clear summaries of attendance information.

FORMATTING RULES:
- Use professional language for attendance data
- Highlight attendance rates, patterns, and trends
- Use **bold** for important statistics like attendance percentages
- Use bullet points for multiple time periods or departments
- Keep summaries under 150 words
- Focus on actionable attendance insights`
        },
        {
          role: 'user',
          content: `Query: "${query}"
          
Data: ${JSON.stringify(data.slice(0, 3), null, 2)}
Total records: ${data.length}

Provide a clear summary with attendance insights.`
        }
      ], { temperature: 0.3, max_tokens: 500 });

      return response.choices[0]?.message?.content?.trim() || 
             `Found ${data.length} attendance record(s) matching your query.`;
    } catch (error) {
      logger.error('AttendanceAgent: Error generating summary:', error);
      return `Found ${data.length} attendance record(s) for your query.`;
    }
  }

  // Attendance-specific message handling
  async handleMessage(message: any): Promise<any> {
    logger.info(`AttendanceAgent: Handling message: ${message.action}`);

    switch (message.action) {
      case 'markAttendance':
        return this.handleMarkAttendance(message);
      case 'getAttendanceReport':
        return this.handleGetAttendanceReport(message);
      case 'generateRoster':
        return this.handleGenerateRoster(message);
      case 'checkAttendanceStatus':
        return this.handleCheckAttendanceStatus(message);
      default:
        return super.handleMessage(message);
    }
  }

  // Handle mark attendance request
  private async handleMarkAttendance(message: any): Promise<any> {
    const { sewadarId, actionType, timestamp, location } = message.payload;
    
    try {
      // Mock implementation - would integrate with actual time tracking
      const result = {
        success: true,
        data: {
          sewadarId,
          actionType, // 'checkin' or 'checkout'
          timestamp: timestamp || new Date().toISOString(),
          location: location || 'Unknown',
          recordId: `ATT_${Date.now()}`,
          status: 'recorded'
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
    } catch (error) {
      return {
        ...message,
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to mark attendance'
        },
        timestamp: new Date()
      };
    }
  }

  // Handle attendance report request
  private async handleGetAttendanceReport(message: any): Promise<any> {
    const { sewadarIds, dateFrom, dateTo, departmentId } = message.payload;
    
    // Mock implementation
    const result = {
      success: true,
      data: {
        reportId: `RPT_${Date.now()}`,
        dateFrom,
        dateTo,
        departmentId,
        summary: {
          totalSewadars: sewadarIds?.length || 0,
          presentDays: 20,
          absentDays: 2,
          attendanceRate: '90.9%'
        },
        details: sewadarIds?.map((id: string) => ({
          sewadarId: id,
          presentDays: Math.floor(Math.random() * 22) + 18,
          absentDays: Math.floor(Math.random() * 4),
          attendanceRate: (Math.random() * 20 + 80).toFixed(1) + '%'
        })) || []
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

  // Handle roster generation
  private async handleGenerateRoster(message: any): Promise<any> {
    const { departmentId, period, startDate } = message.payload;
    
    // Mock implementation
    const result = {
      success: true,
      data: {
        rosterId: `ROSTER_${Date.now()}`,
        departmentId,
        period,
        startDate,
        shifts: [
          { shiftId: 'SHIFT_001', name: 'Morning Shift', startTime: '06:00', endTime: '14:00' },
          { shiftId: 'SHIFT_002', name: 'Evening Shift', startTime: '14:00', endTime: '22:00' },
          { shiftId: 'SHIFT_003', name: 'Night Shift', startTime: '22:00', endTime: '06:00' }
        ],
        schedule: [
          { date: startDate, shiftId: 'SHIFT_001', assignedSewadars: ['S001', 'S002'] },
          { date: startDate, shiftId: 'SHIFT_002', assignedSewadars: ['S003', 'S004'] }
        ]
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

  // Handle attendance status check
  private async handleCheckAttendanceStatus(message: any): Promise<any> {
    const { sewadarId, date } = message.payload;
    
    // Mock implementation
    const result = {
      success: true,
      data: {
        sewadarId,
        date: date || new Date().toISOString().split('T')[0],
        status: 'present',
        checkinTime: '08:30:00',
        checkoutTime: null,
        totalHours: null,
        location: 'Main Hall'
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

  // Get attendance agent health with domain-specific metrics
  getHealthStatus() {
    const baseHealth = super.getHealthStatus();
    
    return {
      ...baseHealth,
      domainSpecific: {
        totalAttendanceTables: this.catalog?.tables.filter(t => 
          t.table_name.toLowerCase().includes('attendance')).length || 0,
        attendanceProcedures: this.catalog?.procedures.length || 0,
        externalIntegrations: this.getAPIResources().length,
        lastQuery: 'Recently processed attendance queries'
      }
    };
  }
}