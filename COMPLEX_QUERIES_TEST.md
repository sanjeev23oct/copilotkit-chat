# Complex Database Queries - Test Suite

## 🎯 Setup Complex Database

Run this command to set up a realistic e-commerce database:

```bash
cd backend
npm run setup-complex-db
```

This creates:
- **10 tables**: suppliers, categories, products, customers, addresses, orders, order_items, reviews, payments, shipping, inventory
- **20+ products** across multiple categories
- **10 customers** with addresses
- **10 orders** with items
- **10 reviews**
- **Multiple relationships** and foreign keys
- **Views** for common queries
- **Indexes** for performance

---

## 🧪 Complex Test Queries

### Level 1: Simple Aggregations

#### Query 1: Total Revenue
```
"What is the total revenue from all orders?"
```

**Expected SQL:**
```sql
SELECT SUM(total_amount) as total_revenue FROM orders;
```

#### Query 2: Customer Count by Tier
```
"How many customers are in each tier?"
```

**Expected SQL:**
```sql
SELECT customer_tier, COUNT(*) as customer_count 
FROM customers 
GROUP BY customer_tier;
```

#### Query 3: Average Order Value
```
"What is the average order value?"
```

**Expected SQL:**
```sql
SELECT AVG(total_amount) as avg_order_value FROM orders;
```

---

### Level 2: Joins

#### Query 4: Orders with Customer Names
```
"Show me all orders with customer names and email addresses"
```

**Expected SQL:**
```sql
SELECT o.order_id, c.first_name, c.last_name, c.email, o.total_amount, o.order_date
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id;
```

#### Query 5: Products with Categories
```
"List all products with their category names"
```

**Expected SQL:**
```sql
SELECT p.product_name, c.category_name, p.unit_price
FROM products p
JOIN categories c ON p.category_id = c.category_id;
```

#### Query 6: Top Customers by Spending
```
"Who are the top 5 customers by total spending?"
```

**Expected SQL:**
```sql
SELECT c.first_name, c.last_name, SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name
ORDER BY total_spent DESC
LIMIT 5;
```

---

### Level 3: Complex Joins

#### Query 7: Order Details with Products
```
"Show me order details including product names and quantities"
```

**Expected SQL:**
```sql
SELECT o.order_id, c.first_name, c.last_name, p.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id;
```

#### Query 8: Products with Reviews
```
"Show me products with their average ratings and review counts"
```

**Expected SQL:**
```sql
SELECT p.product_name, AVG(r.rating) as avg_rating, COUNT(r.review_id) as review_count
FROM products p
LEFT JOIN reviews r ON p.product_id = r.product_id
GROUP BY p.product_id, p.product_name
HAVING COUNT(r.review_id) > 0;
```

#### Query 9: Revenue by Category
```
"What is the total revenue for each product category?"
```

**Expected SQL:**
```sql
SELECT c.category_name, SUM(oi.line_total) as category_revenue
FROM categories c
JOIN products p ON c.category_id = p.category_id
JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY c.category_id, c.category_name
ORDER BY category_revenue DESC;
```

---

### Level 4: Advanced Queries

#### Query 10: Customer Lifetime Value
```
"Show me each customer's total orders, total spent, and average order value"
```

**Expected SQL:**
```sql
SELECT 
    c.first_name, 
    c.last_name, 
    COUNT(o.order_id) as total_orders,
    SUM(o.total_amount) as total_spent,
    AVG(o.total_amount) as avg_order_value
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name
ORDER BY total_spent DESC;
```

#### Query 11: Best Selling Products
```
"What are the top 10 best-selling products by quantity sold?"
```

**Expected SQL:**
```sql
SELECT p.product_name, SUM(oi.quantity) as total_sold, SUM(oi.line_total) as revenue
FROM products p
JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY p.product_id, p.product_name
ORDER BY total_sold DESC
LIMIT 10;
```

#### Query 12: Monthly Revenue Trend
```
"Show me the total revenue for each month in 2024"
```

**Expected SQL:**
```sql
SELECT 
    DATE_TRUNC('month', order_date) as month,
    SUM(total_amount) as monthly_revenue,
    COUNT(order_id) as order_count
FROM orders
WHERE EXTRACT(YEAR FROM order_date) = 2024
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

---

### Level 5: Very Complex Queries

#### Query 13: Customer Segmentation
```
"Show me customers who have spent more than $1000 and have placed more than 2 orders"
```

**Expected SQL:**
```sql
SELECT 
    c.first_name, 
    c.last_name, 
    c.email,
    COUNT(o.order_id) as order_count,
    SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
HAVING SUM(o.total_amount) > 1000 AND COUNT(o.order_id) > 2;
```

#### Query 14: Product Performance Analysis
```
"Show me products with their sales, revenue, average rating, and stock levels"
```

**Expected SQL:**
```sql
SELECT 
    p.product_name,
    p.unit_price,
    p.units_in_stock,
    COALESCE(SUM(oi.quantity), 0) as units_sold,
    COALESCE(SUM(oi.line_total), 0) as revenue,
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COUNT(DISTINCT r.review_id) as review_count
FROM products p
LEFT JOIN order_items oi ON p.product_id = oi.product_id
LEFT JOIN reviews r ON p.product_id = r.product_id
GROUP BY p.product_id, p.product_name, p.unit_price, p.units_in_stock
ORDER BY revenue DESC;
```

#### Query 15: Shipping Performance
```
"Show me orders with shipping status and delivery times"
```

**Expected SQL:**
```sql
SELECT 
    o.order_id,
    c.first_name || ' ' || c.last_name as customer_name,
    o.order_date,
    s.shipping_status,
    s.carrier,
    s.tracking_number,
    o.total_amount
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN shipping s ON o.order_id = s.order_id
WHERE o.order_status IN ('shipped', 'delivered');
```

---

## 🎯 Testing Workflow

### 1. Setup Database
```bash
cd backend
npm run setup-complex-db
```

### 2. Start Backend
```bash
npm run dev
```

### 3. Test Queries

**Simple Test:**
```bash
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the total revenue from all orders?"}'
```

**Complex Test:**
```bash
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me the top 5 customers by total spending with their order counts"}'
```

### 4. Compare Models

Test the same query with different models:

**8B Model:**
```env
LLM_MODEL=llama-3.1-8b-instant
```

**70B Model:**
```env
LLM_MODEL=llama-3.3-70b-versatile
```

**DeepSeek:**
```env
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
```

---

## 📊 Evaluation Criteria

For each query, evaluate:

1. **SQL Correctness** - Does it generate valid SQL?
2. **Query Accuracy** - Does it answer the question?
3. **Performance** - Are JOINs and indexes used properly?
4. **Completeness** - Are all required fields included?
5. **Optimization** - Is the query efficient?

---

## 💡 Expected Results

### 8B Models (Llama 3.1 8B, Gemma 2 9B)
- ✅ Simple queries (Level 1-2): Excellent
- ✅ Joins (Level 3): Good
- ⚠️ Complex queries (Level 4-5): May struggle

### 70B Models (Llama 3.3 70B)
- ✅ All levels: Excellent
- ✅ Complex joins: Very good
- ✅ Aggregations: Perfect

### DeepSeek
- ✅ All levels: Excellent (specialized for code/SQL)
- ✅ Complex queries: Very good
- ✅ Optimization: Good

---

## 🚀 Quick Test Script

Save this as `test-complex-queries.sh`:

```bash
#!/bin/bash

QUERIES=(
  "What is the total revenue from all orders?"
  "Who are the top 5 customers by total spending?"
  "Show me products with their average ratings"
  "What is the total revenue for each product category?"
  "Show me customers who have spent more than 1000 dollars"
)

for query in "${QUERIES[@]}"; do
  echo "Testing: $query"
  curl -s -X POST http://localhost:3010/api/postgres-agent/nl-query \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$query\"}" | jq '.sql, .confidence, .model'
  echo "---"
done
```

---

## 📈 Database Statistics

After setup, you'll have:
- **5 suppliers**
- **12 categories**
- **20 products**
- **10 customers**
- **10 orders**
- **17 order items**
- **10 reviews**
- **10 payments**
- **10 shipping records**
- **22 inventory records**

**Total: 116 records across 10 tables with complex relationships!**

---

## 🎉 Ready to Test!

1. Run `npm run setup-complex-db`
2. Start backend
3. Test queries from simple to complex
4. Compare different models
5. Evaluate results

**This will give you a real-world test of model capabilities!** 🚀
