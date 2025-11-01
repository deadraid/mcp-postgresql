import { Config, QUERY_LEVELS, QueryLevel } from './config.js';

// Optimized SQL command detection with enhanced security
const SQL_COMMANDS = new Set([
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'EXPLAIN',
  'ANALYZE',
  'VACUUM',
  'COPY',
  'WITH',
]);

// Pre-compiled regex patterns for better performance
const COMMENT_REGEX = /--.*$/gm;
const MULTILINE_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const WHITESPACE_REGEX = /\s+/;

/**
 * Extracts the primary SQL command from a query with enhanced security
 * @param sql - The SQL query string
 * @returns The detected SQL command or 'UNKNOWN'
 */
export function getSqlCommand(sql: string): string {
  if (!sql || typeof sql !== 'string') return 'UNKNOWN';

  try {
    // Remove comments and normalize in a single pass
    const cleanSql = sql
      .replace(COMMENT_REGEX, '') // Remove single-line comments
      .replace(MULTILINE_COMMENT_REGEX, '') // Remove multi-line comments
      .trim()
      .toUpperCase();

    if (!cleanSql) return 'UNKNOWN';

    // Extract first meaningful word efficiently
    const words = cleanSql.split(WHITESPACE_REGEX);
    const firstWord = words[0];

    // Validate against known commands
    return firstWord && SQL_COMMANDS.has(firstWord) ? firstWord : 'UNKNOWN';
  } catch (error) {
    // Log error for debugging but return UNKNOWN for security
    console.error('Error parsing SQL command:', error);
    return 'UNKNOWN';
  }
}

/**
 * Checks if a SQL query is allowed based on the current configuration
 * @param sql - The SQL query string
 * @param config - The configuration object
 * @returns true if the query is allowed, false otherwise
 */
export function isQueryAllowed(sql: string, config: Config): boolean {
  if (!sql || !config?.queryLevel) return false;

  try {
    const command = getSqlCommand(sql);
    const allowedCommands = QUERY_LEVELS[config.queryLevel as QueryLevel] || QUERY_LEVELS.readonly;
    return Array.isArray(allowedCommands) && allowedCommands.includes(command);
  } catch (error) {
    console.error('Error checking query permission:', error);
    return false;
  }
}

// Data masking and filtering functions - Optimized versions with Set

/**
 * Checks if a table should be hidden based on configuration
 * @param tableName - Name of the table to check
 * @param config - The configuration object
 * @returns true if the table should be hidden, false otherwise
 */
export function isTableHidden(tableName: string, config: Config): boolean {
  if (!tableName || !config?.dataMasking?.enabled || !config.dataMasking.hiddenTables) {
    return false;
  }
  return config.dataMasking.hiddenTables.has(tableName.toLowerCase());
}

/**
 * Checks if a column should be hidden based on configuration
 * @param columnName - Name of the column to check
 * @param config - The configuration object
 * @returns true if the column should be hidden, false otherwise
 */
export function isColumnHidden(columnName: string, config: Config): boolean {
  if (!columnName || !config?.dataMasking?.enabled || !config.dataMasking.hiddenColumns) {
    return false;
  }
  return config.dataMasking.hiddenColumns.has(columnName.toLowerCase());
}

/**
 * Checks if a field contains sensitive data that should be masked
 * @param fieldName - Name of the field to check
 * @param config - The configuration object
 * @returns true if the field is sensitive, false otherwise
 */
export function isSensitiveField(fieldName: string, config: Config): boolean {
  if (!fieldName || !config?.dataMasking?.enabled) return false;

  const lowerField = fieldName.toLowerCase();
  const { defaultSensitiveFields, customSensitiveFields } = config.dataMasking;

  return (
    defaultSensitiveFields?.has(lowerField) ||
    false ||
    customSensitiveFields?.has(lowerField) ||
    false
  );
}

/**
 * Masks sensitive data in query results based on configuration
 * @param rows - Array of row data
 * @param fields - Array of field metadata
 * @param config - The configuration object
 * @returns Object containing processed rows and visible fields
 */
export function maskSensitiveData(
  rows: Record<string, unknown>[],
  fields: { name: string; dataTypeID: number }[],
  config: Config
): { rows: Record<string, unknown>[]; fields: { name: string; dataTypeID: number }[] } {
  if (!config?.dataMasking?.enabled || !rows?.length || !fields?.length) {
    return { rows: rows || [], fields: fields || [] };
  }

  // Early return optimization
  const { hiddenColumns } = config.dataMasking;
  const hasHiddenColumns = hiddenColumns?.size > 0;
  const hasSensitiveFields =
    config.dataMasking.defaultSensitiveFields?.size > 0 ||
    config.dataMasking.customSensitiveFields?.size > 0;

  if (!hasHiddenColumns && !hasSensitiveFields) {
    return { rows, fields };
  }

  // Optimized field preprocessing
  const fieldAnalysis = fields.reduce(
    (acc, field, index) => {
      const fieldName = field.name;
      if (!fieldName) return acc;

      const isVisible = !isColumnHidden(fieldName, config);
      if (isVisible) {
        acc.visibleFields.push(field);
        acc.fieldMap[fieldName] = { index, isSensitive: isSensitiveField(fieldName, config) };
      }
      return acc;
    },
    {
      visibleFields: [] as { name: string; dataTypeID: number }[],
      fieldMap: {} as Record<string, { index: number; isSensitive: boolean }>,
    }
  );

  // Fast path: no processing needed
  if (
    fieldAnalysis.visibleFields.length === fields.length &&
    !Object.values(fieldAnalysis.fieldMap).some((f) => f.isSensitive)
  ) {
    return { rows, fields };
  }

  // Optimized row processing with minimal object creation
  const processedRows = rows.map((row) => {
    const processedRow: Record<string, unknown> = {};

    for (const field of fieldAnalysis.visibleFields) {
      const fieldInfo = fieldAnalysis.fieldMap[field.name];
      if (fieldInfo && Object.prototype.hasOwnProperty.call(row, field.name)) {
        const value = row[field.name];
        processedRow[field.name] = fieldInfo.isSensitive && value != null ? '***' : value;
      }
    }

    return processedRow;
  });

  return { rows: processedRows, fields: fieldAnalysis.visibleFields };
}

/**
 * Filters out hidden tables from the result set
 * @param tables - Array of table metadata
 * @param config - The configuration object
 * @returns Filtered array of visible tables
 */
export function filterTables(
  tables: Record<string, unknown>[],
  config: Config
): Record<string, unknown>[] {
  if (!config?.dataMasking?.enabled || !tables?.length) return tables || [];

  // Optimized filtering with early check
  const hiddenTables = config.dataMasking.hiddenTables;
  if (!hiddenTables || hiddenTables.size === 0) return tables;

  return tables.filter((table) => {
    const tableName = table?.table_name as string;
    return tableName && !hiddenTables.has(tableName.toLowerCase());
  });
}
