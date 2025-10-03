# Database Configuration Guide

## 🔧 Zero Hardcoding - Pure Configuration

The PostgreSQL Agent is **100% configuration-based**. No database details are hardcoded in the code!

## Quick Setup for Any Database

### Step 1: Update `.env` File

Edit `backend/.env` with your database credentials:

```env
# Database Configuration (PostgreSQL)
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
```

### Step 2: Restart Backend

```bash
cd backend
npm run dev
```

**That's it!** The agent will automatically connect to your database.

## Configuration Examples

### Example 1: Local PostgreSQL

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_app_db
DB_USER=postgres
DB_PASSWORD=mypassword
```

### Example 2: Remote PostgreSQL

```env
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=production_db
DB_USER=app_user
DB_PASSWORD=secure_password_123
```

### Example 3: Docker PostgreSQL

```env
DB_HOST=postgres-container
DB_PORT=5432
DB_NAME=docker_db
DB_USER=postgres
DB_PASSWORD=docker_pass
```

### Example 4: Cloud PostgreSQL (AWS RDS)

```env
DB_HOST=mydb.abc123.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=production
DB_USER=admin
DB_PASSWORD=MySecurePassword123!
```

### Example 5: Cloud PostgreSQL (Azure)

```env
DB_HOST=myserver.postgres.database.azure.com
DB_PORT=5432
DB_NAME=mydb
DB_USER=adminuser@myserver
DB_PASSWORD=AzurePassword123!
```

### Example 6: Cloud PostgreSQL (Google Cloud SQL)

```env
DB_HOST=35.123.456.789
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=GCPPassword123!
```

### Example 7: Heroku PostgreSQL

```env
# Heroku provides a DATABASE_URL, but you can also use individual vars
DB_HOST=ec2-xx-xxx-xxx-xxx.compute-1.amazonaws.com
DB_PORT=5432
DB_NAME=d1234567890abc
DB_USER=username
DB_PASSWORD=long_heroku_password
```

### Example 8: DigitalOcean Managed Database

```env
DB_HOST=db-postgresql-nyc1-12345.ondigitalocean.com
DB_PORT=25060
DB_NAME=defaultdb
DB_USER=doadmin
DB_PASSWORD=do_password_123
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DB_HOST` | Database server hostname/IP | `localhost` | `db.example.com` |
| `DB_PORT` | Database server port | `5432` | `5432` |
| `DB_NAME` | Database name | `ai_chat_db` | `my_database` |
| `DB_USER` | Database username | `postgres` | `app_user` |
| `DB_PASSWORD` | Database password | `password` | `SecurePass123!` |

### Optional Connection Settings

You can also configure these in `backend/src/services/database.ts`:

```typescript
this.pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ai_chat_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  
  // Connection pool settings
  max: 20,                          // Maximum connections
  idleTimeoutMillis: 30000,         // 30 seconds
  connectionTimeoutMillis: 2000,    // 2 seconds
  
  // Optional: SSL configuration
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
});
```

## Advanced Configuration

### SSL Connection

For secure connections (required by many cloud providers):

**Option 1: Add to `.env`**
```env
DB_SSL=true
```

**Option 2: Modify `database.ts`**
```typescript
ssl: {
  rejectUnauthorized: false,  // For self-signed certificates
  ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
}
```

### Connection String (Alternative)

If you prefer using a connection string:

**1. Add to `.env`:**
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

**2. Modify `database.ts`:**
```typescript
constructor() {
  this.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false,
  });
}
```

### Multiple Database Support

To support multiple databases, you can create separate services:

**1. Create `database-secondary.ts`:**
```typescript
export class SecondaryDatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB2_HOST || 'localhost',
      port: parseInt(process.env.DB2_PORT || '5432'),
      database: process.env.DB2_NAME || 'secondary_db',
      user: process.env.DB2_USER || 'postgres',
      password: process.env.DB2_PASSWORD || 'password',
    });
  }
  // ... same methods
}
```

**2. Add to `.env`:**
```env
# Primary Database
DB_HOST=localhost
DB_NAME=primary_db
DB_USER=postgres
DB_PASSWORD=password1

# Secondary Database
DB2_HOST=remote-server.com
DB2_NAME=secondary_db
DB2_USER=app_user
DB2_PASSWORD=password2
```

## Testing Connection

### Method 1: Using psql

```bash
psql -h your-host -p 5432 -U your-user -d your-database
```

### Method 2: Using the API

```bash
# Start backend
cd backend
npm run dev

# Test connection
curl http://localhost:3010/api/postgres-agent/tables
```

### Method 3: Test Script

Create `test-connection.js`:

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT NOW()');
    console.log('Server time:', result.rows[0].now);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
```

Run it:
```bash
node test-connection.js
```

## Switching Databases

### Scenario 1: Development to Production

**Development (`.env.development`):**
```env
DB_HOST=localhost
DB_NAME=dev_db
DB_USER=dev_user
DB_PASSWORD=dev_pass
```

**Production (`.env.production`):**
```env
DB_HOST=prod-server.com
DB_NAME=prod_db
DB_USER=prod_user
DB_PASSWORD=secure_prod_pass
```

**Switch:**
```bash
# Development
cp .env.development .env
npm run dev

# Production
cp .env.production .env
npm start
```

### Scenario 2: Multiple Clients

**Client A (`.env.clientA`):**
```env
DB_HOST=clienta-db.com
DB_NAME=clienta_db
DB_USER=clienta_user
DB_PASSWORD=clienta_pass
```

**Client B (`.env.clientB`):**
```env
DB_HOST=clientb-db.com
DB_NAME=clientb_db
DB_USER=clientb_user
DB_PASSWORD=clientb_pass
```

**Switch:**
```bash
cp .env.clientA .env && npm run dev
# or
cp .env.clientB .env && npm run dev
```

## Security Best Practices

### 1. Never Commit `.env` Files

Ensure `.gitignore` includes:
```
.env
.env.local
.env.*.local
```

### 2. Use Strong Passwords

```env
# Bad
DB_PASSWORD=password

# Good
DB_PASSWORD=Xy9$mK2#pL8@qR5!nW3
```

### 3. Restrict Database User Permissions

```sql
-- Create read-only user for the agent
CREATE USER agent_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE mydb TO agent_user;
GRANT USAGE ON SCHEMA public TO agent_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_user;
```

### 4. Use Environment-Specific Configs

```bash
# Development
DB_USER=dev_user

# Production
DB_USER=readonly_user  # Limited permissions
```

### 5. Enable SSL for Production

```env
DB_SSL=true
```

## Troubleshooting

### Connection Refused

**Problem:** `ECONNREFUSED`

**Solutions:**
1. Check if PostgreSQL is running
2. Verify `DB_HOST` and `DB_PORT`
3. Check firewall rules
4. Ensure PostgreSQL accepts remote connections

### Authentication Failed

**Problem:** `password authentication failed`

**Solutions:**
1. Verify `DB_USER` and `DB_PASSWORD`
2. Check `pg_hba.conf` for authentication method
3. Ensure user has database access

### Database Does Not Exist

**Problem:** `database "xyz" does not exist`

**Solutions:**
1. Create the database:
   ```sql
   CREATE DATABASE your_database_name;
   ```
2. Verify `DB_NAME` in `.env`

### SSL Required

**Problem:** `SSL connection required`

**Solutions:**
1. Add to `.env`:
   ```env
   DB_SSL=true
   ```
2. Or modify `database.ts` to enable SSL

### Too Many Connections

**Problem:** `too many connections`

**Solutions:**
1. Reduce `max` in pool configuration
2. Increase PostgreSQL `max_connections`
3. Check for connection leaks

## Migration Guide

### From Existing Database

**Step 1:** Get your database credentials
```bash
# From your current app
echo $DATABASE_URL
# or check your config files
```

**Step 2:** Update `.env`
```env
DB_HOST=your-host
DB_PORT=5432
DB_NAME=your-db
DB_USER=your-user
DB_PASSWORD=your-password
```

**Step 3:** Test connection
```bash
cd backend
npm run dev
curl http://localhost:3010/api/postgres-agent/tables
```

**Step 4:** Start using!
```bash
# Natural language query
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all tables"}'
```

## Docker Compose Example

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: mydb
      DB_USER: myuser
      DB_PASSWORD: mypassword
    ports:
      - "3010:3010"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

## Summary

✅ **Zero Hardcoding**
- All database settings in `.env`
- No code changes needed
- Switch databases instantly

✅ **Works with Any PostgreSQL**
- Local databases
- Remote databases
- Cloud databases (AWS, Azure, GCP)
- Docker containers
- Managed services

✅ **Easy Configuration**
- 5 environment variables
- Optional SSL support
- Connection pooling built-in
- Security best practices

✅ **Quick Switch**
```bash
# Just update .env and restart
vim backend/.env
npm run dev
```

**Your PostgreSQL Agent works with ANY PostgreSQL database - just configure and go!** 🚀
