import pg from 'pg';
const { Pool } = pg;
import { Config } from './config.js';

type PoolType = InstanceType<typeof pg.Pool>;

// Database connection pool
let pool: PoolType | null = null;

export function getPool(config: Config): PoolType {
  if (!pool) {
    if (config.url) {
      // Use connection string URL
      pool = new Pool({
        connectionString: config.url,
        ssl: config.ssl,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } else {
      // Use individual connection parameters
      pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }
  }
  return pool;
}

// Reset pool (for testing)
export function resetPool(): void {
  pool = null;
}
