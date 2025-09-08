#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createConfig } from '../utils/config.js';
import { getPool } from '../utils/database.js';
import {
  isQueryAllowed,
  isTableHidden,
  isColumnHidden,
  maskSensitiveData,
  filterTables,
} from '../utils/sql-filter.js';

import type { Config } from '../utils/config.js';

// Configuration
const config: Config = createConfig();

// Tool implementations
async function executeQuery(
  sql: string,
  config: Config
): Promise<{ content: Array<{ type: string; text: string }> }> {
  if (!isQueryAllowed(sql, config)) {
    return {
      content: [
        {
          type: 'text',
          text: `Query not allowed. Current level: ${config.queryLevel}. Allowed commands: ${config.allowedCommands.join(', ')}`,
        },
      ],
    };
  }

  const pool = getPool(config);
  const client = await pool.connect();
  try {
    const result = await client.query(sql);

    // Apply data masking and filtering
    const { rows: maskedRows, fields: visibleFields } = maskSensitiveData(
      result.rows as Record<string, unknown>[],
      result.fields,
      config
    );

    return {
      content: [
        {
          type: 'text',
          text: `Query executed successfully. Rows: ${maskedRows.length}`,
        },
        {
          type: 'text',
          text: JSON.stringify(
            {
              rows: maskedRows,
              rowCount: maskedRows.length,
              fields: visibleFields.map((field) => ({
                name: field.name,
                type: field.dataTypeID,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `PostgreSQL error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  } finally {
    client.release();
  }
}

async function getSchema(
  table: string | undefined,
  config: Config
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const pool = getPool(config);
  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        table_schema,
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    `;

    if (table) {
      // Check if table is hidden
      if (isTableHidden(table, config)) {
        return {
          content: [
            {
              type: 'text',
              text: `Table "${table}" is hidden due to security settings.`,
            },
          ],
        };
      }

      query += ` AND table_name = $1`;
      const tableResult = await client.query(query, [table]);

      // Filter out hidden columns
      const visibleColumns = tableResult.rows.filter(
        (row: Record<string, unknown>) => !isColumnHidden(row.column_name as string, config)
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ schema: visibleColumns }, null, 2),
          },
        ],
      };
    }

    const result = await client.query(query);

    // Filter out hidden tables and columns
    const visibleSchema = result.rows.filter((row: Record<string, unknown>) => {
      const tableName = row.table_name as string;
      const columnName = row.column_name as string;
      return !isTableHidden(tableName, config) && !isColumnHidden(columnName, config);
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ schema: visibleSchema }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `PostgreSQL error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  } finally {
    client.release();
  }
}

async function getTables(
  config: Config
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const pool = getPool(config);
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `);

    // Filter out hidden tables
    const visibleTables = filterTables(result.rows as Record<string, unknown>[], config);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tables: visibleTables }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `PostgreSQL error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  } finally {
    client.release();
  }
}

// Create server
const server = new Server(
  {
    name: 'mcp-postgresql',
    version: '1.0.0',
    description:
      'MCP server for PostgreSQL database operations with query filtering and data masking',
    categories: ['database', 'sql', 'postgresql'],
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools with LLM-friendly descriptions
 */
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: 'query',
        description: `
Execute SQL queries with safety restrictions and data masking.

**Best for:** Running SELECT queries to explore data, getting database information.
**Not recommended for:** When you need to modify data (use 'modify' query level).
**Common mistakes:** Trying to run INSERT/UPDATE/DELETE with readonly level.
**Prompt Example:** "Show me all users from the users table"
**Usage Example:**
\`\`\`json
{
  "name": "query",
  "arguments": {
    "sql": "SELECT * FROM users LIMIT 10"
  }
}
\`\`\`
**Returns:** Query results with rows, row count, and field information. Sensitive data is masked.
`,
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'SQL query to execute',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'schema',
        description: `
Get database schema information with security filtering.

**Best for:** Exploring table structures, understanding database design.
**Not recommended for:** When you need actual data (use query tool instead).
**Common mistakes:** Not specifying a table when you want specific table info.
**Prompt Example:** "Show me the schema of the users table"
**Usage Example:**
\`\`\`json
{
  "name": "schema",
  "arguments": {
    "table": "users"
  }
}
\`\`\`
**Returns:** Table schema with columns, data types, and constraints. Hidden tables/columns are filtered out.
`,
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Specific table name to get schema for (optional)',
            },
          },
        },
      },
      {
        name: 'tables',
        description: `
List all tables in the database with security filtering.

**Best for:** Getting an overview of available tables, exploring database structure.
**Not recommended for:** When you need detailed table information (use schema tool).
**Common mistakes:** None - this is a safe read-only operation.
**Prompt Example:** "Show me all tables in the database"
**Usage Example:**
\`\`\`json
{
  "name": "tables",
  "arguments": {}
}
\`\`\`
**Returns:** List of all tables with their schemas and types. Hidden tables are filtered out.
`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'query': {
        const { sql } = args as { sql: string };
        if (!sql || typeof sql !== 'string') {
          return {
            content: [
              {
                type: 'text',
                text: 'Invalid input: sql must be a non-empty string',
              },
            ],
            isError: true,
          };
        }
        return await executeQuery(sql, config);
      }

      case 'schema': {
        const { table } = args as { table?: string };
        return await getSchema(table, config);
      }

      case 'tables': {
        return await getTables(config);
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: 'Unknown error occurred',
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PostgreSQL MCP server started');
}

// Always run the server when executed directly
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

export { server };
