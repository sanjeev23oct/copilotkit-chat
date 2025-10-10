# Enhanced Multi-Agent System with Procedures, Functions & Web APIs

## 🎯 Overview

Building upon the multi-agent architecture, this enhanced plan integrates stored procedures, functions, and external web API calls with intelligent LLM-based routing to determine the optimal execution strategy for each query.

## 🧠 Intelligent Resource Detection & Routing

### Resource Types Supported

1. **Database Tables** - Direct SQL queries
2. **Stored Procedures** - Pre-built business logic
3. **Database Functions** - Computed values and transformations
4. **Web APIs** - External service integration
5. **Hybrid Operations** - Combinations of above

### LLM-Based Resource Identification

The system uses LLM to analyze queries and determine the optimal execution path:

```typescript
interface ResourceStrategy {
  type: 'table' | 'procedure' | 'function' | 'api' | 'hybrid';
  resource: string;
  parameters?: Record<string, any>;
  confidence: number;
  reasoning: string;
  fallback?: ResourceStrategy;
}

interface QueryAnalysis {
  intent: string;
  domain: string;
  primaryStrategy: ResourceStrategy;
  secondaryStrategies: ResourceStrategy[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}
```

### Resource Catalog System

```typescript
interface ResourceCatalog {
  tables: TableResource[];
  procedures: ProcedureResource[];
  functions: FunctionResource[];
  apis: APIResource[];
}

interface TableResource {
  name: string;
  description: string;
  columns: ColumnInfo[];
  sampleQueries: string[];
  domain: string;
  tags: string[];
}

interface ProcedureResource {
  name: string;
  description: string;
  parameters: ParameterInfo[];
  returnType: string;
  usage: string[];
  domain: string;
  examples: ProcedureExample[];
}

interface FunctionResource {
  name: string;
  description: string;
  parameters: ParameterInfo[];
  returnType: string;
  usage: string[];
  domain: string;
  examples: FunctionExample[];
}

interface APIResource {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  parameters: ParameterInfo[];
  responseSchema: any;
  domain: string;
  examples: APIExample[];
  authentication?: AuthConfig;
}
```

## 🎯 Enhanced Agent Specializations

### Sewadar Agent Enhancement

**Resources Available:**
- **Tables**: `sewadar_master`, `sewadar_profile`, `sewadar_eligibility`
- **Procedures**: 
  - `sp_GetSewadarDetails(@badge, @includeHistory)`
  - `sp_ValidateSewadarEligibility(@sewadarId, @departmentId)`
  - `sp_UpdateSewadarProfile(@sewadarId, @profileData)`
- **Functions**:
  - `fn_CalculateSewadarAge(@dateOfBirth)`
  - `fn_GetSewadarCurrentStatus(@sewadarId)`
  - `fn_SewadarEligibilityScore(@sewadarId, @criteria)`
- **APIs**:
  - `GET /external/sewadar-verification/{badge}`
  - `POST /external/background-check`

**LLM Routing Examples:**
```typescript
// Query: "Get complete details for sewadar S12345"
// LLM Analysis:
{
  intent: "complete_sewadar_details",
  domain: "sewadar",
  primaryStrategy: {
    type: "procedure",
    resource: "sp_GetSewadarDetails",
    parameters: { badge: "S12345", includeHistory: true },
    confidence: 0.95,
    reasoning: "Procedure provides complete details efficiently"
  }
}

// Query: "Calculate age of sewadar born on 1990-05-15"
// LLM Analysis:
{
  intent: "calculate_age",
  domain: "sewadar",
  primaryStrategy: {
    type: "function",
    resource: "fn_CalculateSewadarAge",
    parameters: { dateOfBirth: "1990-05-15" },
    confidence: 0.98,
    reasoning: "Function designed specifically for age calculation"
  }
}

// Query: "Verify sewadar badge S12345 with external system"
// LLM Analysis:
{
  intent: "external_verification",
  domain: "sewadar",
  primaryStrategy: {
    type: "api",
    resource: "/external/sewadar-verification",
    parameters: { badge: "S12345" },
    confidence: 0.90,
    reasoning: "External verification requires API call"
  }
}
```

### Attendance Agent Enhancement

**Resources Available:**
- **Tables**: `attendance_logs`, `swipe_data`, `leave_records`
- **Procedures**:
  - `sp_GenerateAttendanceReport(@startDate, @endDate, @departmentId)`
  - `sp_CalculateMonthlyHours(@sewadarId, @month, @year)`
  - `sp_ProcessBulkAttendance(@attendanceData)`
- **Functions**:
  - `fn_CalculateWorkingHours(@swipeIn, @swipeOut)`
  - `fn_GetAttendancePercentage(@sewadarId, @period)`
  - `fn_IsWorkingDay(@date, @departmentId)`
- **APIs**:
  - `GET /external/biometric-data/{date}`
  - `POST /external/leave-management/apply`
  - `GET /external/holiday-calendar/{year}`

### Department Agent Enhancement

**Resources Available:**
- **Tables**: `departments`, `roles`, `assignments`
- **Procedures**:
  - `sp_GetDepartmentHierarchy(@departmentId)`
  - `sp_AssignSewadarToDepartment(@sewadarId, @departmentId, @roleId)`
  - `sp_GenerateDepartmentReport(@departmentId, @reportType)`
- **Functions**:
  - `fn_GetDepartmentCapacity(@departmentId)`
  - `fn_CalculateDepartmentStrength(@departmentId, @date)`
- **APIs**:
  - `GET /external/org-chart/department/{id}`
  - `POST /external/role-management/create`

## 🔄 Intelligent Query Processing Flow

### 1. Query Analysis Phase
```typescript
class QueryAnalyzer {
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const prompt = this.buildAnalysisPrompt(query);
    const analysis = await this.llmService.analyze(prompt);
    return this.parseAnalysis(analysis);
  }

  private buildAnalysisPrompt(query: string): string {
    return `
Analyze this query and determine the best execution strategy:
"${query}"

Available Resources:
${this.formatResourceCatalog()}

Consider:
1. What is the user's intent?
2. Which domain does this belong to?
3. What's the most efficient way to get this data?
4. Are there procedures/functions that handle this directly?
5. Do we need external API calls?
6. What's the confidence level for each approach?

Return JSON with QueryAnalysis structure.
    `;
  }
}
```

### 2. Resource Strategy Execution
```typescript
class ResourceExecutor {
  async executeStrategy(strategy: ResourceStrategy): Promise<any> {
    switch (strategy.type) {
      case 'table':
        return this.executeTableQuery(strategy);
      case 'procedure':
        return this.executeProcedure(strategy);
      case 'function':
        return this.executeFunction(strategy);
      case 'api':
        return this.executeAPI(strategy);
      case 'hybrid':
        return this.executeHybrid(strategy);
    }
  }

  private async executeProcedure(strategy: ResourceStrategy): Promise<any> {
    const { resource, parameters } = strategy;
    const paramList = Object.entries(parameters || {})
      .map(([key, value]) => `@${key} = '${value}'`)
      .join(', ');
    
    const sql = `EXEC ${resource} ${paramList}`;
    return this.databaseService.executeQuery(sql);
  }

  private async executeFunction(strategy: ResourceStrategy): Promise<any> {
    const { resource, parameters } = strategy;
    const paramList = Object.values(parameters || {})
      .map(value => `'${value}'`)
      .join(', ');
    
    const sql = `SELECT ${resource}(${paramList}) as result`;
    return this.databaseService.executeQuery(sql);
  }

  private async executeAPI(strategy: ResourceStrategy): Promise<any> {
    const apiConfig = this.getAPIConfig(strategy.resource);
    const response = await this.httpClient.request({
      method: apiConfig.method,
      url: this.buildAPIUrl(apiConfig, strategy.parameters),
      data: strategy.parameters,
      headers: this.buildAuthHeaders(apiConfig)
    });
    return response.data;
  }
}
```

### 3. Hybrid Execution Engine
```typescript
class HybridExecutor {
  async executeHybridQuery(strategies: ResourceStrategy[]): Promise<any> {
    const results = new Map<string, any>();
    
    // Execute strategies in parallel where possible
    const parallelStrategies = this.identifyParallelStrategies(strategies);
    const sequentialStrategies = this.identifySequentialStrategies(strategies);
    
    // Execute parallel strategies
    const parallelResults = await Promise.all(
      parallelStrategies.map(strategy => this.executeStrategy(strategy))
    );
    
    // Execute sequential strategies
    for (const strategy of sequentialStrategies) {
      const result = await this.executeStrategy(strategy);
      results.set(strategy.resource, result);
      
      // Update context for next strategy
      this.updateExecutionContext(results);
    }
    
    return this.mergeResults(parallelResults, results);
  }
}
```

## 📚 Resource Catalog Configuration

### Database Procedures Catalog
```yaml
# config/procedures.yml
procedures:
  sewadar:
    sp_GetSewadarDetails:
      description: "Get complete sewadar information including history"
      parameters:
        - name: "badge"
          type: "varchar"
          required: true
          description: "Sewadar badge number"
        - name: "includeHistory"
          type: "bit"
          required: false
          default: 0
          description: "Include historical data"
      returns: "Table with sewadar details"
      examples:
        - query: "Get full details for sewadar S12345"
          call: "sp_GetSewadarDetails 'S12345', 1"
        - query: "Show current info for badge S67890"
          call: "sp_GetSewadarDetails 'S67890', 0"
      keywords: ["details", "profile", "complete", "full", "information"]

  attendance:
    sp_GenerateAttendanceReport:
      description: "Generate comprehensive attendance report"
      parameters:
        - name: "startDate"
          type: "date"
          required: true
        - name: "endDate"
          type: "date"
          required: true
        - name: "departmentId"
          type: "int"
          required: false
      keywords: ["report", "attendance", "summary", "monthly", "weekly"]
```

### Database Functions Catalog
```yaml
# config/functions.yml
functions:
  sewadar:
    fn_CalculateSewadarAge:
      description: "Calculate current age from date of birth"
      parameters:
        - name: "dateOfBirth"
          type: "date"
          required: true
      returns: "int (age in years)"
      examples:
        - query: "How old is sewadar born on 1990-05-15?"
          call: "fn_CalculateSewadarAge('1990-05-15')"
      keywords: ["age", "calculate", "born", "years old"]

  attendance:
    fn_CalculateWorkingHours:
      description: "Calculate working hours between swipe in/out"
      parameters:
        - name: "swipeIn"
          type: "datetime"
          required: true
        - name: "swipeOut"
          type: "datetime"
          required: true
      returns: "decimal (hours worked)"
      keywords: ["hours", "worked", "duration", "time"]
```

### External APIs Catalog
```yaml
# config/apis.yml
apis:
  sewadar:
    sewadar_verification:
      endpoint: "https://external-system.com/api/sewadar/verify/{badge}"
      method: "GET"
      description: "Verify sewadar with external identity system"
      parameters:
        - name: "badge"
          type: "path"
          required: true
      authentication:
        type: "bearer"
        token_env: "EXTERNAL_API_TOKEN"
      examples:
        - query: "Verify sewadar S12345 with external system"
          call: "GET /api/sewadar/verify/S12345"
      keywords: ["verify", "external", "validation", "check"]

  attendance:
    biometric_data:
      endpoint: "https://biometric-system.com/api/data/{date}"
      method: "GET"
      description: "Get biometric attendance data"
      parameters:
        - name: "date"
          type: "path"
          required: true
        - name: "department"
          type: "query"
          required: false
      keywords: ["biometric", "swipe", "punch", "entry", "exit"]
```

## 🧠 LLM Prompt Engineering for Resource Selection

### Resource Selection Prompt Template
```typescript
const RESOURCE_SELECTION_PROMPT = `
You are an intelligent database query router. Analyze the user's query and determine the best execution strategy.

USER QUERY: "{query}"

AVAILABLE RESOURCES:

TABLES:
{tables}

STORED PROCEDURES:
{procedures}

FUNCTIONS:
{functions}

EXTERNAL APIS:
{apis}

ANALYSIS CRITERIA:
1. EFFICIENCY: Which option provides the fastest result?
2. COMPLETENESS: Which option provides the most complete data?
3. MAINTENANCE: Are there pre-built procedures/functions for this?
4. EXTERNAL DEPENDENCIES: Does this require external data?
5. COMPLEXITY: How complex is the query logic?

DECISION RULES:
- Use PROCEDURES for complex business logic operations
- Use FUNCTIONS for calculations and data transformations
- Use TABLES for simple data retrieval
- Use APIS for external system integration
- Use HYBRID for multi-step operations

Return JSON:
{
  "intent": "what user wants to achieve",
  "domain": "sewadar|attendance|department|reports|admin",
  "primaryStrategy": {
    "type": "table|procedure|function|api|hybrid",
    "resource": "resource name",
    "parameters": {"param": "value"},
    "confidence": 0.0-1.0,
    "reasoning": "why this is the best choice"
  },
  "secondaryStrategies": [...],
  "estimatedComplexity": "low|medium|high"
}
`;
```

### Example LLM Analysis Results

#### Query: "Generate monthly attendance report for IT department"
```json
{
  "intent": "generate_attendance_report",
  "domain": "attendance",
  "primaryStrategy": {
    "type": "procedure",
    "resource": "sp_GenerateAttendanceReport",
    "parameters": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31",
      "departmentId": 2
    },
    "confidence": 0.95,
    "reasoning": "Procedure specifically designed for attendance reporting with built-in business logic"
  },
  "secondaryStrategies": [
    {
      "type": "hybrid",
      "resource": "attendance_logs + department_table",
      "confidence": 0.70,
      "reasoning": "Fallback using raw tables if procedure fails"
    }
  ],
  "estimatedComplexity": "medium"
}
```

#### Query: "Calculate total working hours for sewadar S12345 last week"
```json
{
  "intent": "calculate_working_hours",
  "domain": "attendance",
  "primaryStrategy": {
    "type": "function",
    "resource": "fn_CalculateWorkingHours",
    "parameters": {
      "sewadarId": "S12345",
      "startDate": "2024-01-15",
      "endDate": "2024-01-21"
    },
    "confidence": 0.92,
    "reasoning": "Function designed for precise hour calculations"
  },
  "estimatedComplexity": "low"
}
```

#### Query: "Verify sewadar S12345 with external identity system and get attendance for last month"
```json
{
  "intent": "verify_and_get_attendance",
  "domain": "sewadar",
  "primaryStrategy": {
    "type": "hybrid",
    "resource": "api_verification + procedure_attendance",
    "parameters": {
      "badge": "S12345",
      "month": "2024-01"
    },
    "confidence": 0.88,
    "reasoning": "Requires both external verification and internal attendance data"
  },
  "estimatedComplexity": "high"
}
```

## 🔧 Implementation Components

### Enhanced Base Agent
```typescript
abstract class EnhancedBaseAgent extends BaseAgent {
  protected resourceCatalog: ResourceCatalog;
  protected queryAnalyzer: QueryAnalyzer;
  protected resourceExecutor: ResourceExecutor;
  protected hybridExecutor: HybridExecutor;

  async processQuery(query: string, context?: SharedContext): Promise<AgentResult> {
    // 1. Analyze query to determine resource strategy
    const analysis = await this.queryAnalyzer.analyzeQuery(query);
    
    // 2. Execute primary strategy
    let result;
    try {
      result = await this.resourceExecutor.executeStrategy(analysis.primaryStrategy);
    } catch (error) {
      // 3. Fallback to secondary strategies
      result = await this.executeFallbackStrategies(analysis.secondaryStrategies);
    }
    
    // 4. Format and return result
    return this.formatResult(result, analysis);
  }

  protected async executeFallbackStrategies(strategies: ResourceStrategy[]): Promise<any> {
    for (const strategy of strategies) {
      try {
        return await this.resourceExecutor.executeStrategy(strategy);
      } catch (error) {
        continue; // Try next strategy
      }
    }
    throw new Error('All execution strategies failed');
  }
}
```

### Resource Registry Service
```typescript
class ResourceRegistryService {
  private resourceCatalog: ResourceCatalog;

  async loadResourceCatalog(): Promise<void> {
    this.resourceCatalog = {
      tables: await this.loadTableResources(),
      procedures: await this.loadProcedureResources(),
      functions: await this.loadFunctionResources(),
      apis: await this.loadAPIResources()
    };
  }

  async discoverDatabaseResources(): Promise<void> {
    // Auto-discover procedures and functions from database
    const procedures = await this.databaseService.query(`
      SELECT ROUTINE_NAME, ROUTINE_DEFINITION, PARAMETER_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.ROUTINES r
      LEFT JOIN INFORMATION_SCHEMA.PARAMETERS p ON r.ROUTINE_NAME = p.ROUTINE_NAME
      WHERE ROUTINE_TYPE = 'PROCEDURE'
    `);

    const functions = await this.databaseService.query(`
      SELECT ROUTINE_NAME, ROUTINE_DEFINITION, PARAMETER_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.ROUTINES r
      LEFT JOIN INFORMATION_SCHEMA.PARAMETERS p ON r.ROUTINE_NAME = p.ROUTINE_NAME
      WHERE ROUTINE_TYPE = 'FUNCTION'
    `);

    // Update catalog with discovered resources
    this.updateCatalogFromDiscovery(procedures.rows, functions.rows);
  }

  getResourcesForDomain(domain: string): Partial<ResourceCatalog> {
    return {
      tables: this.resourceCatalog.tables.filter(t => t.domain === domain),
      procedures: this.resourceCatalog.procedures.filter(p => p.domain === domain),
      functions: this.resourceCatalog.functions.filter(f => f.domain === domain),
      apis: this.resourceCatalog.apis.filter(a => a.domain === domain)
    };
  }
}
```

## 🚀 Enhanced Implementation Phases

### Phase 1: Resource Discovery & Cataloging (Week 1)
- [ ] Build resource catalog system
- [ ] Auto-discover database procedures and functions
- [ ] Create resource configuration files
- [ ] Implement LLM-based resource analysis

### Phase 2: Enhanced Query Processing (Week 2)
- [ ] Implement QueryAnalyzer with LLM integration
- [ ] Build ResourceExecutor for all resource types
- [ ] Create procedure and function execution handlers
- [ ] Implement API calling mechanisms

### Phase 3: Hybrid Execution Engine (Week 3)
- [ ] Build HybridExecutor for complex operations
- [ ] Implement parallel and sequential execution
- [ ] Create result merging logic
- [ ] Add fallback strategy handling

### Phase 4: Agent Enhancement (Week 4)
- [ ] Enhance all agents with new capabilities
- [ ] Implement resource-aware query processing
- [ ] Add intelligent routing based on resource analysis
- [ ] Create domain-specific resource catalogs

### Phase 5: Integration & Optimization (Week 5)
- [ ] Frontend integration for all resource types
- [ ] Performance optimization and caching
- [ ] Comprehensive testing
- [ ] Documentation and examples

## 📊 Expected Benefits

### Performance Improvements
- **Procedure Calls**: 5-10x faster than equivalent table queries
- **Function Usage**: Precise calculations without data transfer
- **API Integration**: Real-time external data access
- **Hybrid Operations**: Optimal execution paths

### Intelligence Enhancements
- **Automatic Resource Selection**: LLM chooses best execution method
- **Fallback Strategies**: Graceful degradation when primary methods fail
- **Context-Aware Routing**: Considers data volume and complexity
- **Learning Capability**: Improves resource selection over time

### Developer Experience
- **Simplified Integration**: Automatic discovery of database resources
- **Flexible Execution**: Support for any combination of resources
- **Rich Diagnostics**: Clear visibility into execution strategies
- **Easy Extension**: Simple addition of new procedures, functions, and APIs

---

This enhanced architecture provides a truly intelligent multi-agent system that can seamlessly work with tables, stored procedures, functions, and external APIs while making intelligent decisions about the optimal execution strategy for each query.