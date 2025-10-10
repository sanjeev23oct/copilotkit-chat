# Multi-Agent System Troubleshooting Guide

## Overview
This guide addresses common issues encountered with the multi-agent PostgreSQL system and provides solutions for debugging and fixing problems.

## Common Issues and Solutions

### 1. Database Schema Discovery Errors

**Problem**: 
```
error: column p.routine_name does not exist
hint: Perhaps you meant to reference the column "r.routine_name"
```

**Cause**: PostgreSQL `information_schema.parameters` table uses `specific_name` and `specific_schema` columns instead of `routine_name` and `routine_schema` for JOINs.

**Solution**: ✅ **FIXED**
Updated queries in `backend/src/services/enhanced-database.ts`:
```sql
-- OLD (incorrect)
LEFT JOIN information_schema.parameters p ON r.routine_name = p.routine_name

-- NEW (correct)
LEFT JOIN information_schema.parameters p ON r.routine_name = p.specific_name
```

### 2. LLM Timeout Issues

**Problem**:
```
error: LLM request timeout after 60s
```

**Cause**: On-premise LLM endpoints may be slow or overloaded, causing requests to timeout.

**Solutions**: ✅ **IMPLEMENTED**

#### A. Reduced Timeout for Analysis
- Query analysis timeout reduced from 60s to 30s
- Better fallback mechanisms when analysis fails

#### B. Graceful Degradation
```typescript
// If LLM analysis fails, agent falls back to simple table strategy
return {
  intent: 'data_retrieval',
  domain: this.domain,
  primaryStrategy: {
    type: 'table',
    resource: this.catalog.tables[0]?.table_name || 'unknown',
    confidence: 0.5,
    reasoning: 'Fallback strategy due to analysis error'
  }
};
```

#### C. Improved Error Handling
- Procedure/function discovery now has test queries first
- Returns empty arrays instead of crashing when schema issues occur

### 3. CORS Configuration Issues

**Problem**:
```
Access to fetch at 'http://localhost:3010/api/multi-agent/query' from origin 'http://localhost:5185' has been blocked by CORS policy
```

**Solution**: ✅ **FIXED**
Updated CORS configuration in `backend/src/index.ts`:
```typescript
app.use(cors({
  origin: [
    'http://localhost:5185',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
```

### 4. Agent Heartbeat Monitoring

**Problem**:
```
warn: AgentRegistry: Agent sewadar marked as offline due to stale heartbeat
```

**Cause**: Agents not sending regular heartbeat signals to registry.

**Current Status**: ⚠️ **MONITORING ONLY**
- System continues to work despite heartbeat warnings
- Agents automatically re-register when accessed
- No user-facing impact

**Future Enhancement**: Implement automatic heartbeat in BaseAgent:
```typescript
// In BaseAgent constructor
setInterval(() => {
  if (this.messenger) {
    this.messenger.sendHeartbeat();
  }
}, 30000); // Send heartbeat every 30 seconds
```

## Debugging Steps

### 1. Check Agent Initialization
```bash
# Look for these log messages in terminal:
info: Agent sewadar initialized with X tables, Y procedures, Z functions
info: All multi-agents initialized successfully
```

### 2. Test LLM Connectivity
```bash
curl http://localhost:3010/api/postgres-agent/test-llm
```

Expected response:
```json
{
  "success": true,
  "provider": "onprem",
  "model": "meta-llama-3.1-8b-instruct"
}
```

### 3. Test Multi-Agent API
```bash
curl http://localhost:3010/api/multi-agent/agents
```

Expected response:
```json
[
  {
    "id": "sewadar",
    "name": "SewadarAgent", 
    "domain": "sewadar",
    "status": "online",
    "capabilities": [...],
    "resources": {...}
  }
]
```

### 4. Test Agent Query
```bash
curl -X POST http://localhost:3010/api/multi-agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "agentId": "sewadar"}'
```

## Performance Optimization

### Current Optimizations ✅

1. **Schema Queries**: Added test queries before complex JOINs
2. **LLM Timeouts**: Reduced timeout for faster fallback
3. **Error Handling**: Graceful degradation instead of crashes
4. **Connection Pooling**: PostgreSQL connection pool (max 20 connections)

### Recommended Optimizations 📋

1. **Query Caching**:
```typescript
// Cache frequently used schemas and analysis results
const queryCache = new Map<string, any>();
const CACHE_TTL = 300000; // 5 minutes
```

2. **Agent Resource Preloading**:
```typescript
// Preload agent catalogs on startup instead of lazy loading
await Promise.all(agents.map(agent => agent.initialize()));
```

3. **Connection Optimization**:
```typescript
// Use read replicas for query execution
const readOnlyPool = new Pool({
  host: process.env.DB_READ_HOST,
  // ... readonly configuration
});
```

## Environment Configuration

### Recommended LLM Settings

For **stable operation**:
```env
LLM_PROVIDER=groq
LLM_API_KEY=gsk_your_key
LLM_MODEL=llama-3.1-8b-instant
```

For **local development**:
```env
LLM_PROVIDER=onprem
LLM_API_KEY=local
LLM_MODEL=meta-llama-3.1-8b-instruct
LLM_BASE_URL=http://localhost:8000/v1
```

### Database Settings
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chat_db
DB_USER=postgres
DB_PASSWORD=your_password

# Connection pool settings
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
```

## Monitoring and Logging

### Key Log Messages to Monitor

**Successful Operations**:
```
info: Agent [agent] initialized with X tables
info: AgentRegistry: Registered agent [agent] for domain [domain]
info: All multi-agents initialized successfully
```

**Warning Signs**:
```
error: Error fetching procedures for agent [agent]
error: LLM request timeout after [X]s
warn: AgentRegistry: Agent [agent] marked as offline
```

**Critical Errors**:
```
error: Failed to initialize agent [agent]
error: Agent [agent]: Strategy execution failed
error: Database connection failed
```

### Performance Metrics

Monitor these metrics:
- **Query Response Time**: Should be < 10 seconds
- **Agent Initialization Time**: Should be < 30 seconds
- **LLM Response Time**: Should be < 5 seconds
- **Database Query Time**: Should be < 2 seconds

## System Status Check

Use this checklist to verify system health:

- [ ] ✅ Backend server running on port 3010
- [ ] ✅ Frontend server running on port 5185
- [ ] ✅ PostgreSQL database accessible
- [ ] ✅ LLM service responding
- [ ] ✅ All agents initialized successfully
- [ ] ✅ CORS configured correctly
- [ ] ✅ Multi-agent API endpoints responding
- [ ] ✅ Frontend can fetch agent list
- [ ] ✅ Queries execute without timeout

## Recovery Procedures

### If Agents Fail to Initialize
1. Check database connectivity
2. Verify schema exists
3. Restart backend service
4. Check logs for specific errors

### If LLM Timeouts Persist
1. Switch to faster LLM provider (Groq recommended)
2. Reduce query complexity
3. Use fallback strategies
4. Check LLM service health

### If CORS Errors Occur
1. Verify frontend URL in CORS config
2. Check browser network tab for exact error
3. Restart backend after config changes
4. Clear browser cache

## Known Limitations

1. **Procedure Discovery**: Some PostgreSQL installations may not have procedures/functions, causing harmless errors
2. **LLM Dependencies**: System requires external LLM service for optimal operation
3. **Heartbeat Monitoring**: Currently warning-only, doesn't affect functionality
4. **Agent Communication**: Basic implementation, can be enhanced for complex workflows

## Success Criteria

The system is working correctly when:
- ✅ All agents initialize without critical errors
- ✅ Queries return results within 10 seconds
- ✅ Frontend displays agent cards and accepts queries
- ✅ Database queries execute successfully
- ✅ LLM generates appropriate SQL and summaries
- ✅ No CORS errors in browser console

---

**Last Updated**: 2025-10-08  
**Status**: System operational with known issues resolved  
**Next Steps**: Implement caching and heartbeat enhancements