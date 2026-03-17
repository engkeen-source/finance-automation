import pg from 'pg';

async function setup() {
  // Connect to default 'postgres' database to create our database
  const client = new pg.Client({
    connectionString: 'postgresql://localhost:5432/postgres',
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'finance_automation'"
    );
    if (rows.length === 0) {
      await client.query('CREATE DATABASE finance_automation');
      console.log('Database finance_automation created');
    } else {
      console.log('Database finance_automation already exists');
    }
  } finally {
    await client.end();
  }

  // Dynamic import so the pool doesn't connect before DB exists
  const { runMigrations } = await import('./migrate.js');
  await runMigrations();
}

setup()
  .then(() => {
    console.log('Setup complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
