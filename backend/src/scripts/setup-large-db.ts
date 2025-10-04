import { databaseService } from '../services/database';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Setup Large Database for Performance Testing
 * Creates thousands of records to test query performance
 */

async function setupLargeDatabase() {
  try {
    logger.info('Setting up large database for performance testing...');
    logger.info('This will take a few minutes...');

    // First, setup the complex schema
    const schemaPath = path.join(__dirname, '../database/complex-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    logger.info('Creating tables...');
    await databaseService.query(schema);

    // Generate large datasets
    const SUPPLIERS_COUNT = 50;
    const CATEGORIES_COUNT = 100;
    const PRODUCTS_COUNT = 5000;
    const CUSTOMERS_COUNT = 10000;
    const ORDERS_COUNT = 50000;
    const REVIEWS_COUNT = 25000;

    logger.info(`Generating ${SUPPLIERS_COUNT} suppliers...`);
    await generateSuppliers(SUPPLIERS_COUNT);

    logger.info(`Generating ${CATEGORIES_COUNT} categories...`);
    await generateCategories(CATEGORIES_COUNT);

    logger.info(`Generating ${PRODUCTS_COUNT} products...`);
    await generateProducts(PRODUCTS_COUNT, CATEGORIES_COUNT, SUPPLIERS_COUNT);

    logger.info(`Generating ${CUSTOMERS_COUNT} customers...`);
    await generateCustomers(CUSTOMERS_COUNT);

    logger.info(`Generating addresses...`);
    await generateAddresses(CUSTOMERS_COUNT);

    logger.info(`Generating ${ORDERS_COUNT} orders...`);
    await generateOrders(ORDERS_COUNT, CUSTOMERS_COUNT);

    logger.info(`Generating order items...`);
    await generateOrderItems(ORDERS_COUNT, PRODUCTS_COUNT);

    logger.info(`Generating ${REVIEWS_COUNT} reviews...`);
    await generateReviews(REVIEWS_COUNT, PRODUCTS_COUNT, CUSTOMERS_COUNT);

    logger.info(`Generating payments and shipping...`);
    await generatePaymentsAndShipping(ORDERS_COUNT);

    logger.info(`Generating inventory...`);
    await generateInventory(PRODUCTS_COUNT);

    logger.info('Large database setup completed successfully!');
    
    // Show statistics
    const stats = await databaseService.query(`
      SELECT 
        (SELECT COUNT(*) FROM suppliers) as suppliers,
        (SELECT COUNT(*) FROM categories) as categories,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM customers) as customers,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM order_items) as order_items,
        (SELECT COUNT(*) FROM reviews) as reviews,
        (SELECT COUNT(*) FROM payments) as payments,
        (SELECT COUNT(*) FROM shipping) as shipping,
        (SELECT COUNT(*) FROM inventory) as inventory;
    `);
    
    logger.info('Database statistics:', stats.rows[0]);
    
  } catch (error) {
    logger.error('Error setting up large database:', error);
    throw error;
  }
}

async function generateSuppliers(count: number) {
  const countries = ['USA', 'China', 'Germany', 'Japan', 'UK', 'France', 'Italy', 'Canada', 'Australia', 'India'];
  const cities = ['New York', 'Shanghai', 'Berlin', 'Tokyo', 'London', 'Paris', 'Rome', 'Toronto', 'Sydney', 'Mumbai'];
  
  const values = [];
  for (let i = 1; i <= count; i++) {
    const country = countries[i % countries.length];
    const city = cities[i % cities.length];
    values.push(`('Supplier ${i}', 'Contact ${i}', 'contact${i}@supplier.com', '+1-555-${String(i).padStart(4, '0')}', '${country}', '${city}')`);
  }

  const batchSize = 1000;
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    await databaseService.query(`
      INSERT INTO suppliers (company_name, contact_name, contact_email, phone, country, city)
      VALUES ${batch.join(',')}
      ON CONFLICT DO NOTHING;
    `);
  }
}

async function generateCategories(count: number) {
  const values = [];
  for (let i = 1; i <= count; i++) {
    const parentId = i > 20 ? Math.floor(Math.random() * 20) + 1 : 'NULL';
    values.push(`('Category ${i}', 'Description for category ${i}', ${parentId})`);
  }

  const batchSize = 1000;
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    await databaseService.query(`
      INSERT INTO categories (category_name, description, parent_category_id)
      VALUES ${batch.join(',')}
      ON CONFLICT DO NOTHING;
    `);
  }
}

async function generateProducts(count: number, categoryCount: number, supplierCount: number) {
  const batchSize = 1000;
  
  for (let i = 1; i <= count; i += batchSize) {
    const values = [];
    const end = Math.min(i + batchSize - 1, count);
    
    for (let j = i; j <= end; j++) {
      const categoryId = (j % categoryCount) + 1;
      const supplierId = (j % supplierCount) + 1;
      const price = (Math.random() * 1000 + 10).toFixed(2);
      const stock = Math.floor(Math.random() * 500);
      const weight = (Math.random() * 50 + 0.1).toFixed(2);
      
      values.push(`('Product ${j}', ${categoryId}, ${supplierId}, ${price}, ${stock}, 10, false, 'Description for product ${j}', 'https://example.com/product${j}.jpg', ${weight}, '10x10x10')`);
    }

    await databaseService.query(`
      INSERT INTO products (product_name, category_id, supplier_id, unit_price, units_in_stock, reorder_level, discontinued, description, image_url, weight, dimensions)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 5000 === 1) {
      logger.info(`  Generated ${Math.min(i + batchSize - 1, count)} / ${count} products...`);
    }
  }
}

async function generateCustomers(count: number) {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Maria'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  
  const batchSize = 1000;
  
  for (let i = 1; i <= count; i += batchSize) {
    const values = [];
    const end = Math.min(i + batchSize - 1, count);
    
    for (let j = i; j <= end; j++) {
      const firstName = firstNames[j % firstNames.length];
      const lastName = lastNames[Math.floor(j / firstNames.length) % lastNames.length];
      const email = `customer${j}@email.com`;
      const phone = `+1-555-${String(j).padStart(4, '0')}`;
      const dob = `'${1950 + (j % 50)}-${(j % 12) + 1}-${(j % 28) + 1}'`;
      const points = Math.floor(Math.random() * 5000);
      const tier = tiers[Math.floor(points / 1250)];
      
      values.push(`('${firstName}', '${lastName}', '${email}', '${phone}', ${dob}, ${points}, '${tier}')`);
    }

    await databaseService.query(`
      INSERT INTO customers (first_name, last_name, email, phone, date_of_birth, loyalty_points, customer_tier)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 5000 === 1) {
      logger.info(`  Generated ${Math.min(i + batchSize - 1, count)} / ${count} customers...`);
    }
  }
}

async function generateAddresses(customerCount: number) {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'];
  
  const batchSize = 1000;
  
  for (let i = 1; i <= customerCount; i += batchSize) {
    const values = [];
    const end = Math.min(i + batchSize - 1, customerCount);
    
    for (let j = i; j <= end; j++) {
      const cityIndex = j % cities.length;
      const street = `${j} Main St`;
      const city = cities[cityIndex];
      const state = states[cityIndex];
      const zip = String(10000 + (j % 90000)).padStart(5, '0');
      
      // Shipping address
      values.push(`(${j}, 'shipping', '${street}', '${city}', '${state}', '${zip}', 'USA', true)`);
      // Billing address
      values.push(`(${j}, 'billing', '${street}', '${city}', '${state}', '${zip}', 'USA', true)`);
    }

    await databaseService.query(`
      INSERT INTO addresses (customer_id, address_type, street_address, city, state, postal_code, country, is_default)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 5000 === 1) {
      logger.info(`  Generated ${Math.min((i + batchSize - 1) * 2, customerCount * 2)} / ${customerCount * 2} addresses...`);
    }
  }
}

async function generateOrders(count: number, customerCount: number) {
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  
  const batchSize = 1000;
  
  for (let i = 1; i <= count; i += batchSize) {
    const values = [];
    const end = Math.min(i + batchSize - 1, count);
    
    for (let j = i; j <= end; j++) {
      const customerId = (j % customerCount) + 1;
      const shippingAddressId = customerId * 2 - 1;
      const billingAddressId = customerId * 2;
      const status = statuses[j % statuses.length];
      const subtotal = (Math.random() * 1000 + 50).toFixed(2);
      const tax = (parseFloat(subtotal) * 0.08).toFixed(2);
      const shipping = (Math.random() * 20).toFixed(2);
      const total = (parseFloat(subtotal) + parseFloat(tax) + parseFloat(shipping)).toFixed(2);
      const orderDate = `'2024-${(j % 12) + 1}-${(j % 28) + 1} ${(j % 24)}:${(j % 60)}:00'`;
      
      values.push(`(${customerId}, ${orderDate}, '${status}', ${shippingAddressId}, ${billingAddressId}, ${subtotal}, ${tax}, ${shipping}, ${total}, 0)`);
    }

    await databaseService.query(`
      INSERT INTO orders (customer_id, order_date, order_status, shipping_address_id, billing_address_id, subtotal, tax_amount, shipping_cost, total_amount, discount_amount)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 10000 === 1) {
      logger.info(`  Generated ${Math.min(i + batchSize - 1, count)} / ${count} orders...`);
    }
  }
}

async function generateOrderItems(orderCount: number, productCount: number) {
  const batchSize = 1000;
  const itemsPerOrder = 3; // Average items per order
  const totalItems = orderCount * itemsPerOrder;
  
  for (let i = 1; i <= totalItems; i += batchSize) {
    const values = [];
    const end = Math.min(i + batchSize - 1, totalItems);
    
    for (let j = i; j <= end; j++) {
      const orderId = Math.floor((j - 1) / itemsPerOrder) + 1;
      const productId = (j % productCount) + 1;
      const quantity = Math.floor(Math.random() * 5) + 1;
      const price = (Math.random() * 500 + 10).toFixed(2);
      const discount = Math.floor(Math.random() * 20);
      
      values.push(`(${orderId}, ${productId}, ${quantity}, ${price}, ${discount})`);
    }

    await databaseService.query(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 10000 === 1) {
      logger.info(`  Generated ${Math.min(i + batchSize - 1, totalItems)} / ${totalItems} order items...`);
    }
  }
}

async function generateReviews(count: number, productCount: number, customerCount: number) {
  const batchSize = 1000;
  
  for (let i = 1; i <= count; i += batchSize) {
    const values = [];
    const end = Math.min(i + batchSize - 1, count);
    
    for (let j = i; j <= end; j++) {
      const productId = (j % productCount) + 1;
      const customerId = (j % customerCount) + 1;
      const rating = Math.floor(Math.random() * 3) + 3; // 3-5 stars
      const verified = j % 2 === 0;
      
      values.push(`(${productId}, ${customerId}, ${rating}, 'Review ${j}', 'This is review text for product ${productId}', 0, ${verified})`);
    }

    await databaseService.query(`
      INSERT INTO reviews (product_id, customer_id, rating, review_title, review_text, helpful_count, verified_purchase)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 10000 === 1) {
      logger.info(`  Generated ${Math.min(i + batchSize - 1, count)} / ${count} reviews...`);
    }
  }
}

async function generatePaymentsAndShipping(orderCount: number) {
  const paymentMethods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer'];
  const carriers = ['FedEx', 'UPS', 'USPS', 'DHL'];
  const shippingStatuses = ['preparing', 'in_transit', 'out_for_delivery', 'delivered'];
  
  const batchSize = 1000;
  
  for (let i = 1; i <= orderCount; i += batchSize) {
    const paymentValues = [];
    const shippingValues = [];
    const end = Math.min(i + batchSize - 1, orderCount);
    
    for (let j = i; j <= end; j++) {
      const method = paymentMethods[j % paymentMethods.length];
      const amount = (Math.random() * 1000 + 50).toFixed(2);
      const lastFour = String(j % 10000).padStart(4, '0');
      
      paymentValues.push(`(${j}, '${method}', ${amount}, 'completed', 'TXN${j}', '${lastFour}')`);
      
      const carrier = carriers[j % carriers.length];
      const status = shippingStatuses[j % shippingStatuses.length];
      
      shippingValues.push(`(${j}, '${carrier}', 'TRK${j}', 'Standard', '${status}')`);
    }

    await databaseService.query(`
      INSERT INTO payments (order_id, payment_method, amount, payment_status, transaction_id, card_last_four)
      VALUES ${paymentValues.join(',')}
      ON CONFLICT DO NOTHING;
    `);

    await databaseService.query(`
      INSERT INTO shipping (order_id, carrier, tracking_number, shipping_method, shipping_status)
      VALUES ${shippingValues.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 10000 === 1) {
      logger.info(`  Generated ${Math.min(i + batchSize - 1, orderCount)} / ${orderCount} payments and shipping records...`);
    }
  }
}

async function generateInventory(productCount: number) {
  const warehouses = ['Warehouse A', 'Warehouse B', 'Warehouse C', 'Warehouse D'];
  
  const batchSize = 1000;
  
  for (let i = 1; i <= productCount; i += batchSize) {
    const values = [];
    const end = Math.min(i + batchSize - 1, productCount);
    
    for (let j = i; j <= end; j++) {
      const warehouse = warehouses[j % warehouses.length];
      const quantity = Math.floor(Math.random() * 1000);
      const minLevel = Math.floor(Math.random() * 50) + 10;
      
      values.push(`(${j}, '${warehouse}', ${quantity}, ${minLevel})`);
    }

    await databaseService.query(`
      INSERT INTO inventory (product_id, warehouse_location, quantity, minimum_stock_level)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `);
    
    if (i % 5000 === 1) {
      logger.info(`  Generated ${Math.min(i + batchSize - 1, productCount)} / ${productCount} inventory records...`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  setupLargeDatabase()
    .then(() => {
      logger.info('Large database setup complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Large database setup failed:', error);
      process.exit(1);
    });
}

export { setupLargeDatabase };
