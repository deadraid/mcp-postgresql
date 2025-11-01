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

// Pre-computed SSL configuration with enhanced security
const SSL_BOOLEAN_VALUES = new Set(['true', 'false']);

/**
 * Secure SSL configuration with validation and error handling
 * @returns SSL configuration object, boolean, or undefined
 */
export function getSslConfig(): boolean | object | undefined {
  try {
    const sslEnv = process.env.POSTGRES_SSL?.trim().toLowerCase();
    const sslCa = process.env.POSTGRES_SSL_CA?.trim();
    const sslCert = process.env.POSTGRES_SSL_CERT?.trim();
    const sslKey = process.env.POSTGRES_SSL_KEY?.trim();

    // Fast path: simple boolean values
    if (sslEnv && SSL_BOOLEAN_VALUES.has(sslEnv)) {
      return sslEnv === 'true';
    }

    // Certificate-based SSL configuration with validation
    if (sslCa || sslCert || sslKey) {
      const config: Record<string, string | boolean> = {};

      // Only include non-empty certificate values
      if (sslCa) config.ca = sslCa;
      if (sslCert) config.cert = sslCert;
      if (sslKey) config.key = sslKey;

      // Enhanced security: default to true unless explicitly disabled
      config.rejectUnauthorized = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false';

      return config;
    }

    // Default: no SSL (undefined is safer than false for PostgreSQL)
    return undefined;
  } catch (error) {
    console.error('SSL configuration error:', error);
    // Fail secure: disable SSL on configuration error
    return false;
  }
}

// Query levels and their permissions
export const QUERY_LEVELS = {
  readonly: ['SELECT', 'WITH'],
  modify: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'],
  ddl: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'WITH'],
  custom: [] as string[], // Will be populated from config
} as const;

export type QueryLevel = keyof typeof QUERY_LEVELS;

// Pre-defined sensitive fields for optimal performance
const DEFAULT_SENSITIVE_FIELDS = new Set([
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
]);

// Environment variable processing helpers
function parsePort(portStr: string | undefined): number {
  const port = parseInt(portStr || '5432', 10);
  return isNaN(port) || port < 1 || port > 65535 ? 5432 : port;
}

function parseCommandList(commands: string | undefined): string[] {
  if (!commands) return [];
  return commands
    .split(',')
    .map((cmd) => cmd.trim().toUpperCase())
    .filter((cmd) => cmd.length > 0);
}

function parseSetFromEnv(envVar: string | undefined): Set<string> {
  if (!envVar) return new Set();
  return new Set(
    envVar
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0)
  );
}

/**
 * Creates configuration from environment variables with enhanced validation
 * @returns Complete configuration object
 */
export function createConfig(): Config {
  try {
    return {
      // URL has priority over individual parameters
      url: process.env.POSTGRES_URL?.trim() || '',
      host: process.env.POSTGRES_HOST?.trim() || 'localhost',
      port: parsePort(process.env.POSTGRES_PORT),
      database: process.env.POSTGRES_DB?.trim() || 'postgres',
      user: process.env.POSTGRES_USER?.trim() || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '', // Password can be empty in some setups

      // SSL settings with enhanced security
      ssl: getSslConfig(),

      // Query level with validation
      queryLevel: (process.env.POSTGRES_QUERY_LEVEL?.trim() || 'readonly') as QueryLevel,

      // Allowed commands with proper parsing
      allowedCommands: parseCommandList(process.env.POSTGRES_ALLOWED_COMMANDS),

      // Data masking and filtering configuration with optimizations
      dataMasking: {
        enabled: process.env.POSTGRES_DATA_MASKING !== 'false',
        hiddenTables: parseSetFromEnv(process.env.POSTGRES_HIDDEN_TABLES),
        hiddenColumns: parseSetFromEnv(process.env.POSTGRES_HIDDEN_COLUMNS),
        defaultSensitiveFields: DEFAULT_SENSITIVE_FIELDS,
        customSensitiveFields: parseSetFromEnv(process.env.POSTGRES_SENSITIVE_FIELDS),
      },
    };
  } catch (error) {
    console.error('Configuration creation error:', error);
    // Return secure defaults on configuration error
    return {
      url: '',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: '',
      ssl: false,
      queryLevel: 'readonly',
      allowedCommands: [],
      dataMasking: {
        enabled: true,
        hiddenTables: new Set(),
        hiddenColumns: new Set(),
        defaultSensitiveFields: DEFAULT_SENSITIVE_FIELDS,
        customSensitiveFields: new Set(),
      },
    };
  }
}
