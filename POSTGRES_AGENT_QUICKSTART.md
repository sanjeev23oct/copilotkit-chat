# PostgreSQL Agent - Quick Start Guide

Get up and running with the PostgreSQL Agentic Tool in 5 minutes!

## Prerequisites

- PostgreSQL installed and running locally
- Node.js (v16 or higher)
- npm or yarn

## Step 1: Database Setup

### Option A: Use Existing Database

If you already have a PostgreSQL database, update the `.env` file in the `backend` folder:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chat_db
DB_USER=postgres
DB_PASSWORD=password
```

### Option B: Create New Database with Sample Data

1. Create a new database:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ai_chat_db;

# Exit psql
\q
```

2. Run the setup script to create sample tables:
```bash
cd backend
npm run setup-db
```

This creates three sample tables:
- `users` - Sample user data
- `products` - Product catalog
- `orders` - Order transactions

## Step 2: Start the Backend

```bash
cd backend
npm install
npm run dev
```

You should see:
```
🚀 Server running on port 3010
🗄️  Database API: http://localhost:3010/api/database
🐘 PostgreSQL Agent: http://localhost:3010/api/postgres-agent
```

## Step 3: Test the API

### Quick Test with cURL

```bash
# List all tables
curl http://localhost:3010/api/postgres-agent/tables

# Pull data from users table
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{"tableName": "users", "limit": 10}'
```

### Test with HTML Interface

1. Open `test-postgres-agent.html` in your browser
2. Click "List All Tables" to see available tables
3. Enter a table name (e.g., "users") and click "Pull Data"

## Step 4: Start the Frontend (Optional)

```bash
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:5173` (or the port shown) and click on "PostgreSQL Agent" in the navigation.

## Example Queries

### 1. Get All Users
```json
POST /api/postgres-agent/pull
{
  "tableName": "users",
  "limit": 100
}
```

### 2. Custom Query with Aggregation
```json
POST /api/postgres-agent/pull
{
  "query": "SELECT city, COUNT(*) as user_count FROM users GROUP BY city",
  "visualize": true
}
```

### 3. Join Query
```json
POST /api/postgres-agent/pull
{
  "query": "SELECT u.name, p.name as product, o.quantity FROM orders o JOIN users u ON o.user_id = u.id JOIN products p ON o.product_id = p.id",
  "limit": 50
}
```

### 4. Get Sample Data
```json
POST /api/postgres-agent/action
{
  "actionId": "get_sample_data",
  "parameters": {
    "tableName": "products",
    "limit": 5
  }
}
```

### 5. Get Table Schema
```json
POST /api/postgres-agent/action
{
  "actionId": "get_table_schema",
  "parameters": {}
}
```

## Common Use Cases

### 1. Explore Database Structure
```bash
# List all tables
curl http://localhost:3010/api/postgres-agent/tables

# Get schema for all tables
curl -X POST http://localhost:3010/api/postgres-agent/action \
  -H "Content-Type: application/json" \
  -d '{"actionId": "get_table_schema", "parameters": {}}'
```

### 2. Quick Data Preview
```bash
# Get 5 sample rows from any table
curl -X POST http://localhost:3010/api/postgres-agent/action \
  -H "Content-Type: application/json" \
  -d '{"actionId": "get_sample_data", "parameters": {"tableName": "users", "limit": 5}}'
```

### 3. Data Analysis with Visualization
```bash
# Get product sales by category with chart
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT category, SUM(stock_quantity) as total_stock FROM products GROUP BY category",
    "visualize": true
  }'
```

### 4. Filter and Sort Data
```bash
# Get users from specific city
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM users WHERE city = '\''New York'\'' ORDER BY age DESC",
    "limit": 10
  }'
```

## Integration Examples

### JavaScript/TypeScript

```typescript
const API_URL = 'http://localhost:3010';

// Pull data from a table
async function pullData(tableName: string, limit: number = 100) {
  const response = await fetch(`${API_URL}/api/postgres-agent/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableName, limit })
  });
  return await response.json();
}

// Execute custom query
async function executeQuery(query: string, visualize: boolean = false) {
  const response = await fetch(`${API_URL}/api/postgres-agent/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, visualize })
  });
  return await response.json();
}

// Usage
const users = await pullData('users', 50);
const stats = await executeQuery(
  'SELECT city, COUNT(*) as count FROM users GROUP BY city',
  true
);
```

### Python

```python
import requests
import json

API_URL = 'http://localhost:3010'

def pull_data(table_name, limit=100):
    response = requests.post(
        f'{API_URL}/api/postgres-agent/pull',
        json={'tableName': table_name, 'limit': limit}
    )
    return response.json()

def execute_query(query, visualize=False):
    response = requests.post(
        f'{API_URL}/api/postgres-agent/pull',
        json={'query': query, 'visualize': visualize}
    )
    return response.json()

# Usage
users = pull_data('users', 50)
print(json.dumps(users, indent=2))
```

## Troubleshooting

### "Connection refused" Error

**Problem**: Can't connect to PostgreSQL

**Solution**:
1. Check if PostgreSQL is running:
   ```bash
   # Windows
   pg_ctl status
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. Verify connection settings in `backend/.env`

3. Test connection manually:
   ```bash
   psql -h localhost -U postgres -d ai_chat_db
   ```

### "Table does not exist" Error

**Problem**: Table not found in database

**Solution**:
1. List available tables:
   ```bash
   curl http://localhost:3010/api/postgres-agent/tables
   ```

2. Create sample tables:
   ```bash
   cd backend
   npm run setup-db
   ```

### "Only SELECT queries are allowed" Error

**Problem**: Trying to execute INSERT, UPDATE, or DELETE

**Solution**: The tool only allows SELECT queries for security. Use PostgreSQL client for data modifications.

### CORS Error in Browser

**Problem**: CORS policy blocking requests

**Solution**:
1. Check `FRONTEND_URL` in `backend/.env` matches your frontend URL
2. Restart backend server after changing `.env`

## Next Steps

1. **Explore the API**: Try different queries and actions
2. **Integrate with Your App**: Use the API in your application
3. **Add Custom Actions**: Extend the tool with custom actions
4. **Build Dashboards**: Create data visualization dashboards

## API Reference

Full API documentation: See `POSTGRES_AGENT_README.md`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the full documentation in `POSTGRES_AGENT_README.md`
3. Check backend logs for detailed error messages

## Security Notes

- Only SELECT queries are allowed
- Table names are sanitized to prevent SQL injection
- Connection pooling is used for efficiency
- Always use parameterized queries when possible

Happy querying! 🐘✨
