import { databaseService } from '../services/database';
import logger from '../utils/logger';

async function setupSampleDatabase() {
  try {
    logger.info('Setting up sample database...');

    // Create sample tables
    await databaseService.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        age INTEGER,
        city VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await databaseService.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50),
        price DECIMAL(10,2),
        stock_quantity INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await databaseService.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        total_amount DECIMAL(10,2),
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert sample data
    await databaseService.query(`
      INSERT INTO users (name, email, age, city) VALUES
      ('John Doe', 'john@example.com', 30, 'New York'),
      ('Jane Smith', 'jane@example.com', 25, 'Los Angeles'),
      ('Bob Johnson', 'bob@example.com', 35, 'Chicago'),
      ('Alice Brown', 'alice@example.com', 28, 'Houston'),
      ('Charlie Wilson', 'charlie@example.com', 32, 'Phoenix')
      ON CONFLICT (email) DO NOTHING;
    `);

    await databaseService.query(`
      INSERT INTO products (name, category, price, stock_quantity) VALUES
      ('Laptop', 'Electronics', 999.99, 50),
      ('Smartphone', 'Electronics', 699.99, 100),
      ('Coffee Mug', 'Home', 12.99, 200),
      ('Desk Chair', 'Furniture', 199.99, 25),
      ('Notebook', 'Office', 5.99, 500)
      ON CONFLICT DO NOTHING;
    `);

    await databaseService.query(`
      INSERT INTO orders (user_id, product_id, quantity, total_amount) VALUES
      (1, 1, 1, 999.99),
      (2, 2, 1, 699.99),
      (3, 3, 2, 25.98),
      (4, 4, 1, 199.99),
      (5, 5, 3, 17.97),
      (1, 3, 1, 12.99),
      (2, 4, 1, 199.99)
      ON CONFLICT DO NOTHING;
    `);

    logger.info('Sample database setup completed successfully!');
    
    // Show what was created
    const tables = await databaseService.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    logger.info('Created tables:', tables.rows.map((r: any) => r.table_name));
    
  } catch (error) {
    logger.error('Error setting up sample database:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupSampleDatabase()
    .then(() => {
      logger.info('Database setup complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database setup failed:', error);
      process.exit(1);
    });
}

export { setupSampleDatabase };