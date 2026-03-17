import { pool } from './pool.js';

const migrations = [
  {
    name: '001_create_invoices',
    sql: `
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        vendor_name VARCHAR(500),
        invoice_number VARCHAR(200),
        invoice_date DATE,
        due_date DATE,
        subtotal NUMERIC(12,2),
        tax_amount NUMERIC(12,2),
        total_amount NUMERIC(12,2),
        currency VARCHAR(10) DEFAULT 'USD',
        raw_text TEXT,
        confidence NUMERIC(5,2),
        error_message TEXT,
        quickbooks_id VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description VARCHAR(1000),
        quantity NUMERIC(10,2) DEFAULT 1,
        unit_price NUMERIC(12,2),
        amount NUMERIC(12,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);
    `,
  },
  {
    name: '003_add_xero_invoice_id',
    sql: `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_id VARCHAR(200);
    `,
  },
  {
    name: '004_add_tax_rate',
    sql: `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);
    `,
  },
  {
    name: '002_create_xero_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS xero_tokens (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(200) NOT NULL,
        token_set JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
];

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name VARCHAR(200) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  for (const migration of migrations) {
    const { rows } = await pool.query('SELECT 1 FROM migrations WHERE name = $1', [migration.name]);
    if (rows.length === 0) {
      console.log(`Running migration: ${migration.name}`);
      await pool.query(migration.sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      console.log(`Migration ${migration.name} applied`);
    }
  }
}

// Only run directly when this is the main module
const isDirectRun = process.argv[1]?.includes('migrate');
if (isDirectRun) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
