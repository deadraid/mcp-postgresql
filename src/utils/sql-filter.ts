import { Config, QUERY_LEVELS, QueryLevel } from './config.js';

// SQL command detection with better parsing
export function getSqlCommand(sql: string): string {
  // Remove comments and normalize
  let cleanSql = sql
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .trim()
    .toUpperCase();

  // Extract first meaningful word
  const words = cleanSql.split(/\s+/);
  const firstWord = words[0];

  const commands = [
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
  ];

  return firstWord && commands.includes(firstWord) ? firstWord : 'UNKNOWN';
}

// Check if query is allowed
export function isQueryAllowed(sql: string, config: Config): boolean {
  const command = getSqlCommand(sql);
  const allowedCommands = QUERY_LEVELS[config.queryLevel as QueryLevel] || QUERY_LEVELS.readonly;
  return (allowedCommands as string[]).includes(command);
}

// Data masking and filtering functions - Optimized versions with Set
export function isTableHidden(tableName: string, config: Config): boolean {
  if (!config.dataMasking.enabled) return false;
  return config.dataMasking.hiddenTables.has(tableName.toLowerCase());
}

export function isColumnHidden(columnName: string, config: Config): boolean {
  if (!config.dataMasking.enabled) return false;
  return config.dataMasking.hiddenColumns.has(columnName.toLowerCase());
}

export function isSensitiveField(fieldName: string, config: Config): boolean {
  if (!config.dataMasking.enabled) return false;
  const lowerField = fieldName.toLowerCase();
  return (
    config.dataMasking.defaultSensitiveFields.has(lowerField) ||
    config.dataMasking.customSensitiveFields.has(lowerField)
  );
}

export function maskSensitiveData(
  rows: Record<string, unknown>[],
  fields: { name: string; dataTypeID: number }[],
  config: Config
): { rows: Record<string, unknown>[]; fields: { name: string; dataTypeID: number }[] } {
  if (!config.dataMasking.enabled || rows.length === 0) {
    return { rows, fields };
  }

  // Optimized single-pass filtering
  const fieldNames = fields.map((field) => field.name);
  const visibleFields: { name: string; dataTypeID: number }[] = [];
  const sensitiveFieldNames = new Set<string>();
  const fieldVisibility: boolean[] = [];

  // Single-pass preprocessing of fields
  for (let i = 0; i < fields.length; i++) {
    const fieldName = fieldNames[i];
    const field = fields[i];

    if (fieldName && field) {
      // Check column visibility
      const isVisible = !isColumnHidden(fieldName, config);
      fieldVisibility[i] = isVisible;

      if (isVisible) {
        visibleFields.push(field);
        // Check sensitivity only for visible fields
        if (isSensitiveField(fieldName, config)) {
          sensitiveFieldNames.add(fieldName);
        }
      }
    }
  }

  // If no sensitive fields and all fields are visible - return original data
  if (sensitiveFieldNames.size === 0 && visibleFields.length === fields.length) {
    return { rows, fields };
  }

  // Optimized masking and row filtering
  const processedRows = rows.map((row) => {
    const processedRow: Record<string, unknown> = {};

    for (let i = 0; i < fields.length; i++) {
      if (fieldVisibility[i]) {
        const fieldName = fieldNames[i];
        if (fieldName) {
          const value = row[fieldName];

          // Mask sensitive data
          if (sensitiveFieldNames.has(fieldName) && value !== null && value !== undefined) {
            processedRow[fieldName] = '***';
          } else {
            processedRow[fieldName] = value;
          }
        }
      }
    }

    return processedRow;
  });

  return { rows: processedRows, fields: visibleFields };
}

export function filterTables(
  tables: Record<string, unknown>[],
  config: Config
): Record<string, unknown>[] {
  if (!config.dataMasking.enabled || tables.length === 0) return tables;

  // Optimized filtering with early check
  const hiddenTables = config.dataMasking.hiddenTables;
  if (hiddenTables.size === 0) return tables;

  return tables.filter((table) => {
    const tableName = table.table_name as string;
    return !hiddenTables.has(tableName.toLowerCase());
  });
}
