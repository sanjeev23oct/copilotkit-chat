# PostgreSQL Agent - Quick Reference

## 🚀 Quick Start

```bash
# 1. Setup database
cd backend && npm run setup-db

# 2. Start backend
npm run dev

# 3. Test
curl http://localhost:3010/api/postgres-agent/tables
```

## 📡 API Endpoints

### List Tables
```bash
GET /api/postgres-agent/tables
```

### Pull Data
```bash
POST /api/postgres-agent/pull
{
  "tableName": "users",     # OR "query": "SELECT ..."
  "limit": 100,
  "visualize": false
}
```

### Execute Action
```bash
POST /api/postgres-agent/action
{
  "actionId": "pull_postgres_data",
  "parameters": { ... }
}
```

### Get Actions
```bash
GET /api/postgres-agent/actions
```

## 💡 Common Examples

### List All Tables
```bash
curl http://localhost:3010/api/postgres-agent/tables
```

### Get Users
```bash
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{"tableName": "users", "limit": 10}'
```

### Custom Query
```bash
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM users WHERE age > 25"}'
```

### With Visualization
```bash
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT city, COUNT(*) as count FROM users GROUP BY city",
    "visualize": true
  }'
```

### Get Sample Data
```bash
curl -X POST http://localhost:3010/api/postgres-agent/action \
  -H "Content-Type: application/json" \
  -d '{
    "actionId": "get_sample_data",
    "parameters": {"tableName": "products", "limit": 5}
  }'
```

### Get Schema
```bash
curl -X POST http://localhost:3010/api/postgres-agent/action \
  -H "Content-Type: application/json" \
  -d '{"actionId": "get_table_schema", "parameters": {}}'
```

## 🎯 Available Actions

| Action ID | Description | Parameters |
|-----------|-------------|------------|
| `pull_postgres_data` | Pull data with visualization | query/tableName, limit, visualize |
| `list_postgres_tables` | List all tables | None |
| `query_database` | Execute SQL query | query |
| `get_table_schema` | Get schema info | None |
| `get_sample_data` | Get sample rows | tableName, limit |

## 🔧 Configuration

### .env (Backend)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chat_db
DB_USER=postgres
DB_PASSWORD=password
```

## 🧪 Testing

### HTML Interface
```bash
# Open in browser
test-postgres-agent.html
```

### Frontend UI
```bash
# Start frontend
cd frontend && npm run dev
# Click "PostgreSQL Agent" tab
```

## 📊 Response Format

### Success
```json
{
  "success": true,
  "data": [...],
  "message": "Retrieved 50 row(s)",
  "agui": [...]
}
```

### Error
```json
{
  "success": false,
  "error": "Error message"
}
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check PostgreSQL is running |
| Table not found | Run `npm run setup-db` |
| CORS error | Check FRONTEND_URL in .env |
| SQL error | Only SELECT queries allowed |

## 📚 Documentation

- **Quick Start**: `POSTGRES_AGENT_QUICKSTART.md`
- **Full Docs**: `POSTGRES_AGENT_README.md`
- **Summary**: `POSTGRES_AGENT_SUMMARY.md`

## 🔐 Security

- ✅ Only SELECT queries
- ✅ Table name sanitization
- ✅ SQL injection protection
- ✅ Connection pooling

## 🎨 AGUI Elements

### Table
```json
{
  "type": "table",
  "props": {
    "headers": ["col1", "col2"],
    "rows": [["val1", "val2"]]
  }
}
```

### Card
```json
{
  "type": "card",
  "props": {
    "title": "Title",
    "subtitle": "Subtitle",
    "content": "Content"
  }
}
```

### Chart
```json
{
  "type": "chart",
  "props": {
    "chartType": "bar",
    "data": { ... }
  }
}
```

## 🌐 Integration

### JavaScript
```javascript
const response = await fetch('http://localhost:3010/api/postgres-agent/pull', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tableName: 'users', limit: 100 })
});
const data = await response.json();
```

### Python
```python
import requests
response = requests.post(
  'http://localhost:3010/api/postgres-agent/pull',
  json={'tableName': 'users', 'limit': 100}
)
data = response.json()
```

---

**Need more help?** Check the full documentation files!
