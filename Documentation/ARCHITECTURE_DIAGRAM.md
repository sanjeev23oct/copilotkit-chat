# System Architecture Diagram

```mermaid
flowchart TD
    subgraph Frontend [Frontend (React/TypeScript)]
        UI[PostgresAgent.tsx<br/>MultiAgentInterface.tsx]
        Chart[ChartRenderer.tsx]
    end

    subgraph Backend [Backend (Node.js/TypeScript)]
        API[Express API Routes<br/>postgres-agent.ts<br/>multi-agent.ts]
        Orchestrator[AgentOrchestrator.ts]
        Registry[AgentRegistry.ts]
        Messenger[AgentMessenger.ts]
        SpecializedAgents[AttendanceAgent.ts<br/>DepartmentAgent.ts<br/>SewadarAgent.ts]
        LLMService[LLM Unified Service<br/>llm/unified.ts]
        DBService[Database Service<br/>database.ts<br/>enhanced-database.ts]
        SchemaLoader[Dynamic Schema Loader<br/>dynamic-schema.ts]
        AGUI[AGUI Actions<br/>agui/actions.ts]
        Cache[QueryCache.ts]
        Perf[PerformanceMonitor.ts]
    end

    subgraph Database [PostgreSQL]
        DB[(Complex Schema)]
    end

    subgraph ExternalLLM [LLM Providers]
        Groq[Groq]
        OpenAI[OpenAI]
        DeepSeek[DeepSeek]
        OpenRouter[OpenRouter]
        Ollama[Ollama]
    end

    UI -- "User Query / Actions" --> API
    UI -- "Display Results, Charts, Summaries" --> Chart
    API -- "REST API Calls" --> Orchestrator
    Orchestrator -- "Agent Coordination" --> Registry
    Registry -- "Agent Messaging" --> Messenger
    Messenger -- "Dispatch Tasks" --> SpecializedAgents
    SpecializedAgents -- "Task Results" --> Messenger
    Messenger -- "Aggregate Results" --> Orchestrator
    Orchestrator -- "LLM Query (NL→SQL, Summary)" --> LLMService
    Orchestrator -- "DB Query" --> DBService
    DBService -- "Schema Info" --> SchemaLoader
    DBService -- "SQL Execution" --> DB
    DB -- "Query Results" --> DBService
    DBService -- "Results" --> Orchestrator
    Orchestrator -- "AGUI Actions" --> AGUI
    Orchestrator -- "Cache/Perf Logging" --> Cache
    Orchestrator -- "Perf Metrics" --> Perf
    LLMService -- "Model API Calls" --> Groq
    LLMService -- "Model API Calls" --> OpenAI
    LLMService -- "Model API Calls" --> DeepSeek
    LLMService -- "Model API Calls" --> OpenRouter
    LLMService -- "Model API Calls" --> Ollama
    Orchestrator -- "Response (SQL, Summary, Chart, Table)" --> API
    API -- "JSON Response" --> UI
```

**Legend:**
- **Frontend:** React UI components for query input, result display, and chart rendering.
- **Backend:** Node.js services for agent orchestration, LLM integration, database access, caching, and performance monitoring.
- **Database:** PostgreSQL with complex schema, accessed via service layer.
- **External LLM:** Multiple providers for NL→SQL and summary generation.

**Data Flow:**
1. User interacts with UI, submits query.
2. Frontend sends request to backend API.
3. API routes request to Agent Orchestrator.
4. Orchestrator coordinates agents, queries LLM for SQL/summaries, accesses DB, aggregates results.
5. Results (tables, summaries, charts) returned to frontend for display.

**Technologies:**
- React, TypeScript, Node.js, Express, PostgreSQL, Groq, OpenAI, DeepSeek, OpenRouter, Ollama.