import pg from 'pg';
const { Pool } = pg;
import { Config } from './config.js';

type PoolType = InstanceType<typeof pg.Pool>;

// Optimized PostgreSQL OIDs for types requiring string conversion
const STRING_TYPES = new Set([20, 1700]); // BIGINT, NUMERIC/DECIMAL
const JSON_TYPES = new Set([114, 3802]); // JSON, JSONB

// Configure type parsers for precision preservation (single registration)
STRING_TYPES.forEach((oid) => pg.types.setTypeParser(oid, (val) => val));

// Optimized JSON parsing with large number handling (single function)
const safeJsonParser = (val: string): unknown => {
  try {
    return JSON.parse(val, (_, v) =>
      typeof v === 'number' && v > Number.MAX_SAFE_INTEGER ? v.toString() : v
    );
  } catch {
    return val;
  }
};

// Register JSON parsers efficiently
JSON_TYPES.forEach((oid) => pg.types.setTypeParser(oid, safeJsonParser));

// Database connection pool with enhanced error handling
let pool: PoolType | null = null;
let poolConfig: Config | null = null;

/**
 * Creates a database connection pool with optimized settings
 * @param config - Database configuration
 * @returns PostgreSQL connection pool
 */
export function getPool(config: Config): PoolType {
  // Validate pool recreation only when config changes
  if (pool && poolConfig && JSON.stringify(config) === JSON.stringify(poolConfig)) {
    return pool;
  }

  // Clean up existing pool if config changed
  if (pool) {
    pool.end().catch((error) => console.error('Error closing old pool:', error));
  }

  try {
    const poolOptions: pg.PoolConfig = {
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true, // Allow Node.js to exit when pool is idle
      ssl: config.ssl,
    };

    if (config.url) {
      // Use connection string URL (preferred method)
      poolOptions.connectionString = config.url;
    } else {
      // Use individual connection parameters
      poolOptions.host = config.host;
      poolOptions.port = config.port;
      poolOptions.database = config.database;
      poolOptions.user = config.user;
      poolOptions.password = config.password;
    }

    pool = new Pool(poolOptions);
    poolConfig = { ...config };

    // Enhanced error handling for pool
    pool.on('error', (error) => {
      console.error('PostgreSQL pool error:', error);
      // Reset pool on critical errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) {
        resetPool();
      }
    });

    return pool;
  } catch (error) {
    console.error('Failed to create database pool:', error);
    throw new Error(
      `Database connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Resets the connection pool (for testing and error recovery)
 */
export function resetPool(): void {
  if (pool) {
    pool.end().catch((error) => console.error('Error closing pool during reset:', error));
    pool = null;
    poolConfig = null;
  }
}
