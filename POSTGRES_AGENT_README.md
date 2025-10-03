# PostgreSQL Agentic Tool

A comprehensive agentic tool for pulling and visualizing data from PostgreSQL databases with an intuitive API and UI.

## Features

- 🔍 **Query by Table Name**: Simple table-based data retrieval
- 📝 **Custom SQL Queries**: Execute custom SELECT queries
- 📊 **Auto-Visualization**: Automatic chart generation from numeric data
- 🎨 **AGUI Support**: Rich UI elements (tables, cards, charts)
- 🔒 **Security**: SQL injection protection (SELECT queries only)
- 🚀 **Easy Integration**: RESTful API endpoints

## Setup

### Prerequisites

1. PostgreSQL database running locally
2. Node.js and npm installed
3. Backend and frontend dependencies installed

### Database Configuration

The tool uses standard PostgreSQL connection settings from `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chat_db
DB_USER=postgres
DB_PASSWORD=password
```

### Installation

1. Install backend dependencies:
```bash
cd backend
npm install
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Start the backend server:
```bash
cd backend
npm run dev
```

4. Start the frontend:
```bash
cd frontend
npm run dev
```

## API Endpoints

### 1. List Available Tables

**GET** `/api/postgres-agent/tables`

Returns all tables in the database with their schema information.

**Response:**
```json
{
  "success": true,
  "data": ["users", "conversations", "messages"],
  "message": "Found 3 table(s) in PostgreSQL database",
  "agui": [...]
}
```

### 2. Pull Data

**POST** `/api/postgres-agent/pull`

Pull data from PostgreSQL using either a table name or custom query.

**Request Body:**
```json
{
  "tableName": "users",
  "limit": 100,
  "visualize": false
}
```

Or with custom query:
```json
{
  "query": "SELECT * FROM users WHERE created_at > '2024-01-01'",
  "limit": 100,
  "visualize": true
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "message": "Retrieved 50 row(s) from PostgreSQL",
  "agui": [
    {
      "type": "table",
      "id": "postgres_table_123",
      "props": {
        "headers": ["id", "username", "email"],
        "rows": [...]
      }
    }
  ]
}
```

### 3. Execute Action

**POST** `/api/postgres-agent/action`

Execute any registered agentic action.

**Request Body:**
```json
{
  "actionId": "pull_postgres_data",
  "parameters": {
    "tableName": "users",
    "limit": 50
  }
}
```

### 4. Get Available Actions

**GET** `/api/postgres-agent/actions`

Returns all PostgreSQL-related actions with their parameters.

**Response:**
```json
{
  "success": true,
  "actions": [
    {
      "id": "pull_postgres_data",
      "name": "Pull PostgreSQL Data",
      "description": "Pull data from PostgreSQL database using SQL query or table name",
      "parameters": [...]
    }
  ]
}
```

## Available Actions

### 1. pull_postgres_data

Pull data from PostgreSQL with optional visualization.

**Parameters:**
- `query` (string, optional): SQL SELECT query
- `tableName` (string, optional): Table name to query
- `limit` (number, default: 100): Max rows to return
- `visualize` (boolean, default: false): Create chart visualization

### 2. list_postgres_tables

List all available tables in the database.

**Parameters:** None

### 3. query_database

Execute a database query and return results in a table.

**Parameters:**
- `query` (string, required): SQL query to execute

### 4. get_table_schema

Get database table schema information.

**Parameters:** None

### 5. get_sample_data

Get sample data from a specific table.

**Parameters:**
- `tableName` (string, required): Name of the table
- `limit` (number, default: 5): Number of rows to return

## Usage Examples

### Using the Web UI

1. Navigate to the frontend application
2. Click on "PostgreSQL Agent" in the navigation
3. Choose between "Query by Table" or "Custom SQL Query"
4. Enter your query parameters
5. Click "Pull Data" to retrieve results

### Using the Test HTML

1. Open `test-postgres-agent.html` in your browser
2. Try the quick actions:
   - List All Tables
   - Get Available Actions
3. Pull data using table name or custom query
4. Execute custom actions with JSON parameters

### Using cURL

**List tables:**
```bash
curl http://localhost:3010/api/postgres-agent/tables
```

**Pull data from a table:**
```bash
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{
    "tableName": "users",
    "limit": 10,
    "visualize": false
  }'
```

**Execute custom query:**
```bash
curl -X POST http://localhost:3010/api/postgres-agent/pull \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT role, COUNT(*) as count FROM messages GROUP BY role",
    "visualize": true
  }'
```

**Execute action:**
```bash
curl -X POST http://localhost:3010/api/postgres-agent/action \
  -H "Content-Type: application/json" \
  -d '{
    "actionId": "get_sample_data",
    "parameters": {
      "tableName": "conversations",
      "limit": 5
    }
  }'
```

### Using JavaScript/Fetch

```javascript
// Pull data from a table
async function pullData() {
  const response = await fetch('http://localhost:3010/api/postgres-agent/pull', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tableName: 'users',
      limit: 100,
      visualize: true
    })
  });
  
  const data = await response.json();
  console.log(data);
}

// List all tables
async function listTables() {
  const response = await fetch('http://localhost:3010/api/postgres-agent/tables');
  const data = await response.json();
  console.log(data.data); // Array of table names
}
```

## AGUI Elements

The tool returns rich UI elements that can be rendered in the frontend:

### Table Element
```json
{
  "type": "table",
  "id": "unique_id",
  "props": {
    "headers": ["Column1", "Column2"],
    "rows": [["value1", "value2"]],
    "sortable": true,
    "filterable": true,
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100
    }
  }
}
```

### Card Element
```json
{
  "type": "card",
  "id": "unique_id",
  "props": {
    "title": "Table Name",
    "subtitle": "5 columns",
    "content": "Table details..."
  }
}
```

### Chart Element
```json
{
  "type": "chart",
  "id": "unique_id",
  "props": {
    "chartType": "bar",
    "data": {
      "labels": ["Label1", "Label2"],
      "datasets": [{
        "label": "Dataset",
        "data": [10, 20],
        "backgroundColor": "#36A2EB"
      }]
    }
  }
}
```

## Security

- **SQL Injection Protection**: Only SELECT queries are allowed
- **Table Name Sanitization**: Special characters are removed from table names
- **Query Validation**: All queries are validated before execution
- **Connection Pooling**: Efficient database connection management

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common errors:
- Invalid SQL query syntax
- Table not found
- Connection timeout
- Permission denied

## Extending the Tool

### Adding New Actions

Add new actions in `backend/src/services/agui/actions.ts`:

```typescript
this.registerAction({
  id: 'my_custom_action',
  name: 'My Custom Action',
  description: 'Description of what this action does',
  parameters: [
    {
      name: 'param1',
      type: 'string',
      description: 'Parameter description',
      required: true
    }
  ],
  handler: async (params) => {
    // Your custom logic here
    return {
      success: true,
      data: result,
      message: 'Action completed',
      agui: [...]
    };
  }
});
```

## Troubleshooting

### Connection Issues

If you can't connect to PostgreSQL:

1. Check that PostgreSQL is running:
   ```bash
   # Windows
   pg_ctl status
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. Verify connection settings in `.env`
3. Test connection manually:
   ```bash
   psql -h localhost -U postgres -d ai_chat_db
   ```

### No Tables Found

If no tables are returned:

1. Ensure your database has tables created
2. Run the schema setup script:
   ```bash
   cd backend
   npm run setup-db
   ```

### CORS Issues

If you get CORS errors:

1. Check that `FRONTEND_URL` in `.env` matches your frontend URL
2. Restart the backend server after changing `.env`

## Performance Tips

1. **Use Limits**: Always specify a reasonable limit for large tables
2. **Index Your Queries**: Ensure frequently queried columns are indexed
3. **Connection Pooling**: The tool uses connection pooling by default
4. **Pagination**: Use pagination for large result sets

## License

MIT
