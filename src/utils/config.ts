// Configuration types
export interface DataMaskingConfig {
  enabled: boolean;
  hiddenTables: Set<string>;
  hiddenColumns: Set<string>;
  defaultSensitiveFields: Set<string>;
  customSensitiveFields: Set<string>;
}

export interface Config {
  url: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | object | undefined;
  queryLevel: string;
  allowedCommands: string[];
  dataMasking: DataMaskingConfig;
}

// Clean SSL configuration function
export function getSslConfig(): boolean | object | undefined {
  const sslEnv = process.env.POSTGRES_SSL;
  const sslCa = process.env.POSTGRES_SSL_CA;
  const sslCert = process.env.POSTGRES_SSL_CERT;
  const sslKey = process.env.POSTGRES_SSL_KEY;

  // Simple boolean values
  if (sslEnv === 'true') return true;
  if (sslEnv === 'false') return false;

  // Certificate-based SSL configuration
  if (sslCa || sslCert || sslKey) {
    return {
      ca: sslCa,
      cert: sslCert,
      key: sslKey,
      rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  // Default - no SSL
  return undefined;
}

// Query levels and their permissions
export const QUERY_LEVELS = {
  readonly: ['SELECT', 'WITH'],
  modify: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'],
  ddl: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'WITH'],
  custom: [] as string[], // Will be populated from config
} as const;

export type QueryLevel = keyof typeof QUERY_LEVELS;

// Create configuration from environment variables
export function createConfig(): Config {
  return {
    // URL has priority over individual parameters
    url: process.env.POSTGRES_URL || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    // SSL settings - clean and readable
    ssl: getSslConfig(),
    queryLevel: process.env.POSTGRES_QUERY_LEVEL || 'readonly', // readonly, modify, ddl, custom
    allowedCommands:
      process.env.POSTGRES_ALLOWED_COMMANDS?.split(',').map((cmd) => cmd.trim().toUpperCase()) ||
      [],
    // Data masking and filtering configuration
    dataMasking: {
      enabled: process.env.POSTGRES_DATA_MASKING !== 'false', // enabled by default
      hiddenTables: new Set(
        process.env.POSTGRES_HIDDEN_TABLES?.split(',').map((t) => t.trim().toLowerCase()) || []
      ),
      hiddenColumns: new Set(
        process.env.POSTGRES_HIDDEN_COLUMNS?.split(',').map((c) => c.trim().toLowerCase()) || []
      ),
      // Default sensitive fields to mask
      defaultSensitiveFields: new Set([
        'password',
        'passwd',
        'pwd',
        'secret',
        'token',
        'api_key',
        'apikey',
        'private_key',
        'privatekey',
        'credit_card',
        'creditcard',
        'card_number',
        'cardnumber',
        'ssn',
        'social_security',
        'tax_id',
      ]),
      // Additional sensitive fields from environment
      customSensitiveFields: new Set(
        process.env.POSTGRES_SENSITIVE_FIELDS?.split(',').map((f) => f.trim().toLowerCase()) || []
      ),
    },
  };
}
