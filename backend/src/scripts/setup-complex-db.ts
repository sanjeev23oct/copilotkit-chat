import { databaseService } from '../services/database';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function setupComplexDatabase() {
  try {
    logger.info('Setting up complex e-commerce database...');

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../database/complex-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    logger.info('Creating tables...');
    await databaseService.query(schema);

    logger.info('Inserting sample data...');

    // Insert Suppliers
    await databaseService.query(`
      INSERT INTO suppliers (company_name, contact_name, contact_email, phone, country, city) VALUES
      ('Tech Supplies Inc', 'John Smith', 'john@techsupplies.com', '+1-555-0101', 'USA', 'New York'),
      ('Global Electronics', 'Maria Garcia', 'maria@globalelec.com', '+1-555-0102', 'USA', 'Los Angeles'),
      ('Asian Imports Ltd', 'Li Wei', 'li@asianimports.com', '+86-555-0103', 'China', 'Shanghai'),
      ('Euro Products GmbH', 'Hans Mueller', 'hans@europroducts.de', '+49-555-0104', 'Germany', 'Berlin'),
      ('Pacific Trading Co', 'Yuki Tanaka', 'yuki@pacifictrade.jp', '+81-555-0105', 'Japan', 'Tokyo')
      ON CONFLICT DO NOTHING;
    `);

    // Insert Categories
    await databaseService.query(`
      INSERT INTO categories (category_name, description, parent_category_id) VALUES
      ('Electronics', 'Electronic devices and accessories', NULL),
      ('Computers', 'Desktop and laptop computers', 1),
      ('Smartphones', 'Mobile phones and accessories', 1),
      ('Audio', 'Headphones, speakers, and audio equipment', 1),
      ('Home & Garden', 'Home improvement and garden supplies', NULL),
      ('Furniture', 'Indoor and outdoor furniture', 5),
      ('Tools', 'Hand tools and power tools', 5),
      ('Clothing', 'Apparel and accessories', NULL),
      ('Men''s Clothing', 'Men''s apparel', 8),
      ('Women''s Clothing', 'Women''s apparel', 8),
      ('Sports & Outdoors', 'Sports equipment and outdoor gear', NULL),
      ('Books', 'Physical and digital books', NULL)
      ON CONFLICT DO NOTHING;
    `);

    // Insert Products
    await databaseService.query(`
      INSERT INTO products (product_name, category_id, supplier_id, unit_price, units_in_stock, reorder_level, description, weight) VALUES
      ('MacBook Pro 16"', 2, 1, 2499.99, 25, 5, 'High-performance laptop with M3 chip', 2.1),
      ('Dell XPS 15', 2, 1, 1899.99, 30, 5, 'Premium Windows laptop', 1.8),
      ('iPhone 15 Pro', 3, 2, 1199.99, 50, 10, 'Latest iPhone with A17 chip', 0.2),
      ('Samsung Galaxy S24', 3, 2, 999.99, 45, 10, 'Flagship Android phone', 0.19),
      ('Sony WH-1000XM5', 4, 3, 399.99, 60, 15, 'Premium noise-cancelling headphones', 0.25),
      ('Bose QuietComfort', 4, 3, 349.99, 55, 15, 'Comfortable noise-cancelling headphones', 0.24),
      ('Office Desk Chair', 6, 4, 299.99, 40, 8, 'Ergonomic office chair', 15.0),
      ('Standing Desk', 6, 4, 599.99, 20, 5, 'Adjustable height standing desk', 35.0),
      ('Cordless Drill', 7, 5, 129.99, 75, 20, 'Professional cordless drill', 1.5),
      ('Lawn Mower', 7, 5, 399.99, 15, 3, 'Electric lawn mower', 25.0),
      ('Men''s Jacket', 9, 4, 89.99, 100, 25, 'Waterproof winter jacket', 0.8),
      ('Women''s Dress', 10, 4, 79.99, 120, 30, 'Elegant evening dress', 0.3),
      ('Running Shoes', 11, 3, 129.99, 80, 20, 'Professional running shoes', 0.4),
      ('Yoga Mat', 11, 3, 29.99, 150, 40, 'Non-slip yoga mat', 1.2),
      ('The Great Gatsby', 12, 1, 14.99, 200, 50, 'Classic American novel', 0.3),
      ('Wireless Mouse', 2, 2, 29.99, 200, 50, 'Ergonomic wireless mouse', 0.1),
      ('Mechanical Keyboard', 2, 2, 149.99, 75, 20, 'RGB mechanical keyboard', 1.0),
      ('4K Monitor', 2, 1, 499.99, 35, 10, '27-inch 4K display', 5.5),
      ('USB-C Hub', 2, 3, 49.99, 150, 40, '7-in-1 USB-C hub', 0.15),
      ('Portable SSD 1TB', 2, 2, 129.99, 90, 25, 'Fast portable storage', 0.05)
      ON CONFLICT DO NOTHING;
    `);

    // Insert Customers
    await databaseService.query(`
      INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, loyalty_points, customer_tier) VALUES
      ('John', 'Doe', 'john.doe@email.com', '+1-555-1001', '1985-03-15', 1250, 'Gold'),
      ('Jane', 'Smith', 'jane.smith@email.com', '+1-555-1002', '1990-07-22', 850, 'Silver'),
      ('Robert', 'Johnson', 'robert.j@email.com', '+1-555-1003', '1978-11-30', 2100, 'Platinum'),
      ('Maria', 'Garcia', 'maria.garcia@email.com', '+1-555-1004', '1995-05-18', 450, 'Bronze'),
      ('Michael', 'Brown', 'michael.b@email.com', '+1-555-1005', '1982-09-25', 1650, 'Gold'),
      ('Emily', 'Davis', 'emily.davis@email.com', '+1-555-1006', '1993-02-14', 720, 'Silver'),
      ('David', 'Wilson', 'david.w@email.com', '+1-555-1007', '1988-12-08', 980, 'Silver'),
      ('Sarah', 'Martinez', 'sarah.m@email.com', '+1-555-1008', '1991-06-20', 1890, 'Gold'),
      ('James', 'Anderson', 'james.a@email.com', '+1-555-1009', '1975-04-12', 3200, 'Platinum'),
      ('Lisa', 'Taylor', 'lisa.t@email.com', '+1-555-1010', '1987-08-30', 560, 'Bronze')
      ON CONFLICT DO NOTHING;
    `);

    // Insert Addresses
    await databaseService.query(`
      INSERT INTO addresses (customer_id, address_type, street_address, city, state, postal_code, country, is_default) VALUES
      (1, 'shipping', '123 Main St', 'New York', 'NY', '10001', 'USA', true),
      (1, 'billing', '123 Main St', 'New York', 'NY', '10001', 'USA', true),
      (2, 'shipping', '456 Oak Ave', 'Los Angeles', 'CA', '90001', 'USA', true),
      (2, 'billing', '456 Oak Ave', 'Los Angeles', 'CA', '90001', 'USA', true),
      (3, 'shipping', '789 Pine Rd', 'Chicago', 'IL', '60601', 'USA', true),
      (3, 'billing', '789 Pine Rd', 'Chicago', 'IL', '60601', 'USA', true),
      (4, 'shipping', '321 Elm St', 'Houston', 'TX', '77001', 'USA', true),
      (5, 'shipping', '654 Maple Dr', 'Phoenix', 'AZ', '85001', 'USA', true),
      (6, 'shipping', '987 Cedar Ln', 'Philadelphia', 'PA', '19101', 'USA', true),
      (7, 'shipping', '147 Birch Way', 'San Antonio', 'TX', '78201', 'USA', true),
      (8, 'shipping', '258 Spruce Ct', 'San Diego', 'CA', '92101', 'USA', true),
      (9, 'shipping', '369 Willow Pl', 'Dallas', 'TX', '75201', 'USA', true),
      (10, 'shipping', '741 Ash Blvd', 'San Jose', 'CA', '95101', 'USA', true)
      ON CONFLICT DO NOTHING;
    `);

    // Insert Orders
    await databaseService.query(`
      INSERT INTO orders (customer_id, order_date, order_status, shipping_address_id, billing_address_id, subtotal, tax_amount, shipping_cost, total_amount) VALUES
      (1, '2024-01-15 10:30:00', 'delivered', 1, 2, 2499.99, 199.99, 0, 2699.98),
      (2, '2024-01-20 14:45:00', 'delivered', 3, 4, 1199.99, 95.99, 9.99, 1305.97),
      (3, '2024-02-01 09:15:00', 'delivered', 5, 6, 3299.97, 263.99, 0, 3563.96),
      (4, '2024-02-10 16:20:00', 'shipped', 7, 7, 89.99, 7.19, 5.99, 103.17),
      (5, '2024-02-15 11:00:00', 'processing', 8, 8, 599.99, 47.99, 19.99, 667.97),
      (6, '2024-03-01 13:30:00', 'delivered', 9, 9, 429.98, 34.39, 0, 464.37),
      (7, '2024-03-05 10:45:00', 'delivered', 10, 10, 179.98, 14.39, 7.99, 202.36),
      (8, '2024-03-10 15:20:00', 'shipped', 11, 11, 899.97, 71.99, 0, 971.96),
      (9, '2024-03-15 09:00:00', 'processing', 12, 12, 2999.96, 239.99, 0, 3239.95),
      (10, '2024-03-20 14:15:00', 'pending', 13, 13, 159.98, 12.79, 5.99, 178.76)
      ON CONFLICT DO NOTHING;
    `);

    // Insert Order Items
    await databaseService.query(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount) VALUES
      (1, 1, 1, 2499.99, 0),
      (2, 3, 1, 1199.99, 0),
      (3, 1, 1, 2499.99, 0),
      (3, 7, 1, 299.99, 10),
      (3, 5, 1, 399.99, 0),
      (4, 11, 1, 89.99, 0),
      (5, 8, 1, 599.99, 0),
      (6, 5, 1, 399.99, 0),
      (6, 16, 1, 29.99, 0),
      (7, 13, 1, 129.99, 0),
      (7, 14, 1, 29.99, 20),
      (7, 15, 1, 14.99, 0),
      (8, 4, 1, 999.99, 0),
      (9, 1, 1, 2499.99, 0),
      (9, 18, 1, 499.99, 0),
      (10, 13, 1, 129.99, 0),
      (10, 16, 1, 29.99, 0)
      ON CONFLICT DO NOTHING;
    `);

    // Insert Reviews
    await databaseService.query(`
      INSERT INTO reviews (product_id, customer_id, rating, review_title, review_text, verified_purchase) VALUES
      (1, 1, 5, 'Amazing laptop!', 'Best laptop I''ve ever owned. Fast and reliable.', true),
      (3, 2, 5, 'Love this phone', 'Camera quality is outstanding. Battery lasts all day.', true),
      (5, 6, 4, 'Great sound quality', 'Noise cancellation works well. Comfortable for long use.', true),
      (7, 3, 5, 'Perfect office chair', 'Very comfortable. My back pain is gone!', true),
      (11, 4, 4, 'Good quality jacket', 'Keeps me warm and dry. Fits well.', true),
      (13, 7, 5, 'Best running shoes', 'Very comfortable for long runs. Great support.', true),
      (1, 3, 5, 'Worth every penny', 'Performance is incredible. Screen is beautiful.', true),
      (4, 8, 4, 'Solid phone', 'Good value for money. Camera is excellent.', true),
      (8, 5, 5, 'Game changer', 'Standing desk improved my productivity. Easy to adjust.', true),
      (18, 9, 5, 'Crystal clear display', 'Colors are vibrant. Perfect for photo editing.', true)
      ON CONFLICT DO NOTHING;
    `);

    // Insert Payments
    await databaseService.query(`
      INSERT INTO payments (order_id, payment_method, amount, payment_status, transaction_id, card_last_four) VALUES
      (1, 'credit_card', 2699.98, 'completed', 'TXN001', '4532'),
      (2, 'paypal', 1305.97, 'completed', 'TXN002', NULL),
      (3, 'credit_card', 3563.96, 'completed', 'TXN003', '5678'),
      (4, 'debit_card', 103.17, 'completed', 'TXN004', '9012'),
      (5, 'credit_card', 667.97, 'pending', 'TXN005', '3456'),
      (6, 'credit_card', 464.37, 'completed', 'TXN006', '7890'),
      (7, 'paypal', 202.36, 'completed', 'TXN007', NULL),
      (8, 'credit_card', 971.96, 'completed', 'TXN008', '1234'),
      (9, 'credit_card', 3239.95, 'pending', 'TXN009', '5678'),
      (10, 'debit_card', 178.76, 'pending', 'TXN010', '9012')
      ON CONFLICT DO NOTHING;
    `);

    // Insert Shipping
    await databaseService.query(`
      INSERT INTO shipping (order_id, carrier, tracking_number, shipping_method, shipping_status) VALUES
      (1, 'FedEx', 'FDX123456789', 'Express', 'delivered'),
      (2, 'UPS', 'UPS987654321', 'Ground', 'delivered'),
      (3, 'FedEx', 'FDX111222333', 'Express', 'delivered'),
      (4, 'USPS', 'USPS444555666', 'Priority', 'in_transit'),
      (5, 'UPS', 'UPS777888999', 'Ground', 'preparing'),
      (6, 'FedEx', 'FDX222333444', 'Express', 'delivered'),
      (7, 'USPS', 'USPS555666777', 'First Class', 'delivered'),
      (8, 'UPS', 'UPS888999000', 'Ground', 'in_transit'),
      (9, 'FedEx', 'FDX333444555', 'Express', 'preparing'),
      (10, 'USPS', 'USPS666777888', 'Priority', 'preparing')
      ON CONFLICT DO NOTHING;
    `);

    // Insert Inventory
    await databaseService.query(`
      INSERT INTO inventory (product_id, warehouse_location, quantity, minimum_stock_level) VALUES
      (1, 'Warehouse A', 15, 5),
      (1, 'Warehouse B', 10, 5),
      (2, 'Warehouse A', 20, 5),
      (3, 'Warehouse B', 30, 10),
      (3, 'Warehouse C', 20, 10),
      (4, 'Warehouse B', 25, 10),
      (5, 'Warehouse A', 40, 15),
      (6, 'Warehouse A', 35, 15),
      (7, 'Warehouse C', 25, 8),
      (8, 'Warehouse C', 15, 5),
      (9, 'Warehouse A', 50, 20),
      (10, 'Warehouse C', 10, 3),
      (11, 'Warehouse B', 60, 25),
      (12, 'Warehouse B', 80, 30),
      (13, 'Warehouse A', 50, 20),
      (14, 'Warehouse A', 100, 40),
      (15, 'Warehouse B', 150, 50),
      (16, 'Warehouse A', 120, 50),
      (17, 'Warehouse A', 45, 20),
      (18, 'Warehouse C', 20, 10),
      (19, 'Warehouse A', 90, 40),
      (20, 'Warehouse B', 60, 25)
      ON CONFLICT DO NOTHING;
    `);

    logger.info('Complex database setup completed successfully!');
    
    // Show statistics
    const stats = await databaseService.query(`
      SELECT 
        (SELECT COUNT(*) FROM suppliers) as suppliers,
        (SELECT COUNT(*) FROM categories) as categories,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM customers) as customers,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM order_items) as order_items,
        (SELECT COUNT(*) FROM reviews) as reviews;
    `);
    
    logger.info('Database statistics:', stats.rows[0]);
    
  } catch (error) {
    logger.error('Error setting up complex database:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupComplexDatabase()
    .then(() => {
      logger.info('Setup complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Setup failed:', error);
      process.exit(1);
    });
}

export { setupComplexDatabase };
