import pg from 'pg';
const { Pool } = pg;
import { Config } from './config.js';

type PoolType = InstanceType<typeof pg.Pool>;

// Configure PostgreSQL type parsers to handle large numbers as strings
// Only convert types that can lose precision in JavaScript to strings
const PRECISION_TYPES = {
  BIGINT: 20, // int8 - can lose precision
  BIGSERIAL: 20, // same as BIGINT
  NUMERIC: 1700, // numeric - arbitrary precision
  DECIMAL: 1700, // same as NUMERIC
};

// Override type parsers for precision-sensitive types to return strings
// This prevents precision loss for large integers and decimals
Object.values(PRECISION_TYPES).forEach((oid) => {
  pg.types.setTypeParser(oid, (val) => {
    return val; // Return as string to preserve precision
  });
});

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
