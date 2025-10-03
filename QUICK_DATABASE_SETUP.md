# Quick Database Setup - 30 Seconds! ⚡

## 🎯 Connect to ANY PostgreSQL Database

### Step 1: Edit `.env` (15 seconds)

```bash
cd backend
vim .env
```

Update these 5 lines:
```env
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
```

### Step 2: Restart Backend (15 seconds)

```bash
npm run dev
```

### Step 3: Test (Optional)

```bash
curl http://localhost:3010/api/postgres-agent/tables
```

## ✅ That's It!

**No code changes needed. No hardcoding. Just configuration!**

---

## 📋 Quick Examples

### Local Database
```env
DB_HOST=localhost
DB_NAME=myapp_db
DB_USER=postgres
DB_PASSWORD=mypassword
```

### AWS RDS
```env
DB_HOST=mydb.abc123.us-east-1.rds.amazonaws.com
DB_NAME=production
DB_USER=admin
DB_PASSWORD=SecurePass123!
```

### Azure Database
```env
DB_HOST=myserver.postgres.database.azure.com
DB_NAME=mydb
DB_USER=adminuser@myserver
DB_PASSWORD=AzurePass123!
```

### Docker
```env
DB_HOST=postgres-container
DB_NAME=docker_db
DB_USER=postgres
DB_PASSWORD=docker_pass
```

---

## 🔒 Security Tip

For production, use a read-only user:

```sql
CREATE USER readonly_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE mydb TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
```

Then in `.env`:
```env
DB_USER=readonly_user
DB_PASSWORD=secure_password
```

---

## 🚀 Works With

- ✅ Local PostgreSQL
- ✅ Remote PostgreSQL
- ✅ AWS RDS
- ✅ Azure Database for PostgreSQL
- ✅ Google Cloud SQL
- ✅ Heroku Postgres
- ✅ DigitalOcean Managed Database
- ✅ Docker containers
- ✅ Any PostgreSQL 9.6+

---

## 💡 Pro Tips

**Multiple Databases?**
Create multiple `.env` files:
```bash
.env.dev
.env.staging
.env.production
```

Switch between them:
```bash
cp .env.production .env && npm run dev
```

**Test Connection First:**
```bash
psql -h your-host -U your-user -d your-database
```

**Enable SSL (Cloud Providers):**
```env
DB_SSL=true
```

---

## 🆘 Troubleshooting

**Can't connect?**
1. Check PostgreSQL is running
2. Verify host/port/credentials
3. Check firewall rules
4. Test with `psql` first

**Authentication failed?**
1. Double-check username/password
2. Ensure user has database access
3. Check `pg_hba.conf` settings

**Database doesn't exist?**
```sql
CREATE DATABASE your_database_name;
```

---

## 📚 Full Documentation

See `DATABASE_CONFIGURATION_GUIDE.md` for:
- Advanced SSL configuration
- Multiple database support
- Cloud provider examples
- Security best practices
- Migration guides

---

**Remember: It's just 5 environment variables. No code changes ever needed!** 🎉
