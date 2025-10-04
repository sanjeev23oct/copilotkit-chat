# Large-Scale Performance Testing Guide

## 🎯 Overview

Test the PostgreSQL Agent with a realistic large-scale database containing thousands of records to evaluate:
- Query performance
- Model accuracy with complex schemas
- JOIN performance
- Aggregation speed
- Index effectiveness

---

## 📊 Large Database Specifications

### Dataset Size

- **50 suppliers**
- **100 categories** (hierarchical)
- **5,000 products**
- **10,000 customers**
- **50,000 orders**
- **150,000 order items** (3 items per order average)
- **25,000 reviews**
- **50,000 payments**
- **50,000 shipping records**
- **5,000 inventory records**

**Total: ~345,000 records across 10 tables**

### Relationships

- Complex foreign key relationships
- One-to-many relationships
- Many-to-many through junction tables
- Hierarchical categories
- Multiple indexes for performance

---

## 🚀 Setup

### Prerequisites

- PostgreSQL with sufficient disk space (~500MB)
- At least 4GB RAM
- 5-10 minutes for setup

### Installation

```bash
cd backend
npm run setup-large-db
```

**This will take 5-10 minutes to complete.**

Progress will be shown:
```
Setting up large database for performance testing...
Generating 50 suppliers...
Generating 100 categories...
Generating 5000 products...
  Generated 1000 / 5000 products...
  Generated 2000 / 5000 products...
  ...
```

---

## 🧪 Performance Test Queries

### Level 1: Simple Queries (Should be instant)

#### Test 1: Count Records
```
"How many customers do we have?"
```

**Expected:** < 100ms

#### Test 2: Simple Filter
```
"Show me customers from New York"
```

**Expected:** < 200ms

#### Test 3: Simple Aggregation
```
"What is the total revenue from all orders?"
```

**Expected:** < 500ms

---

### Level 2: JOIN Queries (Should be fast)

#### Test 4: Simple JOIN
```
"Show me orders with customer names"
```

**Expected:** < 1s (with LIMIT)

#### Test 5: Multiple JOINs
```
"Show me order details with customer and product names"
```

**Expected:** < 2s (with LIMIT)

---

### Level 3: Complex Aggregations

#### Test 6: Customer Analytics
```
"Show me the top 100 customers by total spending"
```

**Expected:** < 3s

#### Test 7: Product Performance
```
"What are the top 50 best-selling products?"
```

**Expected:** < 3s

#### Test 8: Revenue by Category
```
"Show me total revenue for each product category"
```

**Expected:** < 5s

---

### Level 4: Very Complex Queries

#### Test 9: Customer Segmentation
```
"Show me customers who have spent more than $5000 and placed more than 10 orders"
```

**Expected:** < 5s

#### Test 10: Product Analytics
```
"Show me products with their total sales, revenue, average rating, and current stock"
```

**Expected:** < 10s

#### Test 11: Time-based Analysis
```
"Show me monthly revenue trends for 2024"
```

**Expected:** < 5s

---

## 📈 Performance Benchmarking

### Test Script

Create `test-performance.sh`:

```bash
#!/bin/bash

echo "🚀 Performance Testing - Large Database"
echo "========================================"
echo ""

QUERIES=(
  "How many customers do we have?"
  "What is the total revenue from all orders?"
  "Show me the top 100 customers by total spending"
  "What are the top 50 best-selling products?"
  "Show me total revenue for each product category"
)

for query in "${QUERIES[@]}"; do
  echo "Query: $query"
  
  start_time=$(date +%s%N)
  
  result=$(curl -s -X POST http://localhost:3010/api/postgres-agent/nl-query \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$query\"}")
  
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))
  
  echo "Time: ${duration}ms"
  echo "Model: $(echo $result | jq -r '.model.name')"
  echo "Rows: $(echo $result | jq -r '.data | length')"
  echo "---"
  echo ""
done
```

### Expected Performance

| Query Type | 8B Model | 70B Model | Expected Time |
|------------|----------|-----------|---------------|
| Simple Count | ✅ | ✅ | < 100ms |
| Simple Filter | ✅ | ✅ | < 200ms |
| Simple Aggregation | ✅ | ✅ | < 500ms |
| Simple JOIN | ✅ | ✅ | < 1s |
| Multiple JOINs | ✅ | ✅ | < 2s |
| Complex Aggregation | ✅ | ✅ | < 5s |
| Very Complex | ⚠️ | ✅ | < 10s |

---

## 🔍 Model Comparison with Large Dataset

### Test Scenario

Run the same complex query with different models:

**Query:** "Show me the top 100 customers by total spending with their order counts and average order values"

### Expected Results

#### Llama 3.1 8B (Groq)
- **SQL Quality**: Good
- **Performance**: Fast
- **Accuracy**: 85-90%
- **Complex JOINs**: May simplify

#### Llama 3.3 70B (Groq)
- **SQL Quality**: Excellent
- **Performance**: Fast
- **Accuracy**: 95%+
- **Complex JOINs**: Perfect

#### DeepSeek
- **SQL Quality**: Excellent
- **Performance**: Medium
- **Accuracy**: 95%+
- **Complex JOINs**: Very good

---

## 💡 Optimization Tips

### 1. Use LIMIT

Always use LIMIT for large result sets:
```
"Show me the top 100 customers..."
```

### 2. Use Indexes

The database includes indexes on:
- Foreign keys
- Date columns
- Status columns
- Frequently queried columns

### 3. Use Views

Pre-built views for common queries:
- `customer_order_summary`
- `product_sales_summary`

### 4. Optimize Queries

The LLM should generate optimized queries with:
- Proper JOINs
- WHERE clauses before JOINs
- Appropriate indexes
- LIMIT clauses

---

## 📊 Database Statistics

After setup, check statistics:

```sql
-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Row counts
SELECT 
    (SELECT COUNT(*) FROM suppliers) as suppliers,
    (SELECT COUNT(*) FROM categories) as categories,
    (SELECT COUNT(*) FROM products) as products,
    (SELECT COUNT(*) FROM customers) as customers,
    (SELECT COUNT(*) FROM orders) as orders,
    (SELECT COUNT(*) FROM order_items) as order_items,
    (SELECT COUNT(*) FROM reviews) as reviews;
```

---

## 🎯 Test Checklist

### Setup
- [ ] Run `npm run setup-large-db`
- [ ] Wait for completion (5-10 minutes)
- [ ] Verify record counts
- [ ] Check database size

### Performance Testing
- [ ] Test simple queries
- [ ] Test JOIN queries
- [ ] Test aggregations
- [ ] Test complex queries
- [ ] Measure response times

### Model Comparison
- [ ] Test with 8B model
- [ ] Test with 70B model
- [ ] Test with DeepSeek
- [ ] Compare SQL quality
- [ ] Compare accuracy

### Optimization
- [ ] Check index usage
- [ ] Verify LIMIT clauses
- [ ] Test view performance
- [ ] Optimize slow queries

---

## 🚨 Troubleshooting

### Setup Takes Too Long

**Problem:** Setup taking > 15 minutes

**Solution:**
1. Check PostgreSQL performance
2. Increase shared_buffers in postgresql.conf
3. Disable unnecessary indexes during insert
4. Use SSD for database storage

### Out of Memory

**Problem:** PostgreSQL runs out of memory

**Solution:**
1. Increase PostgreSQL memory settings
2. Reduce batch sizes in script
3. Run setup in smaller chunks

### Slow Queries

**Problem:** Queries taking too long

**Solution:**
1. Check indexes are created
2. Run ANALYZE on tables
3. Use EXPLAIN to check query plans
4. Add LIMIT to queries

---

## 📈 Expected Results

### Database Size
- **Total Size**: ~500MB
- **Largest Table**: order_items (~150,000 rows)
- **Index Size**: ~100MB

### Query Performance
- **Simple queries**: < 500ms
- **JOIN queries**: < 2s
- **Complex aggregations**: < 5s
- **Very complex**: < 10s

### Model Accuracy
- **8B models**: 85-90% on complex queries
- **70B models**: 95%+ on all queries
- **DeepSeek**: 95%+ on SQL queries

---

## 🎉 Summary

### What You Get

✅ **Realistic large-scale database**
- 345,000+ records
- 10 tables with relationships
- Complex schema
- Proper indexes

✅ **Performance testing**
- Query speed benchmarks
- Model comparison
- Optimization testing

✅ **Production-like environment**
- Real-world data volumes
- Complex relationships
- Performance challenges

### Quick Commands

```bash
# Setup large database (5-10 minutes)
npm run setup-large-db

# Test performance
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me the top 100 customers by total spending"}'

# Check database size
psql -d ai_chat_db -c "SELECT pg_size_pretty(pg_database_size('ai_chat_db'));"
```

---

**Ready to test at scale!** 🚀
