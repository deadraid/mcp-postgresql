#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import pg from 'pg';
const { Pool } = pg;

type PoolType = InstanceType<typeof pg.Pool>;

// Configuration - URL and SSL support
const config = {
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
    process.env.POSTGRES_ALLOWED_COMMANDS?.split(',').map((cmd) => cmd.trim().toUpperCase()) || [],
};

// Clean SSL configuration function
function getSslConfig(): boolean | object | undefined {
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
const QUERY_LEVELS = {
  readonly: ['SELECT'],
  modify: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  ddl: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE'],
  custom: config.allowedCommands,
} as const;

type QueryLevel = keyof typeof QUERY_LEVELS;

// Database connection pool
let pool: PoolType | null = null;

function getPool(): PoolType {
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

// SQL command detection with better parsing
function getSqlCommand(sql: string): string {
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
function isQueryAllowed(sql: string): boolean {
  const command = getSqlCommand(sql);
  const allowedCommands = QUERY_LEVELS[config.queryLevel as QueryLevel] || QUERY_LEVELS.readonly;
  return (allowedCommands as string[]).includes(command);
}

// Tool implementations
async function executeQuery(
  sql: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  if (!isQueryAllowed(sql)) {
    return {
      content: [
        {
          type: 'text',
          text: `Query not allowed. Current level: ${config.queryLevel}. Allowed commands: ${QUERY_LEVELS[config.queryLevel as QueryLevel].join(', ')}`,
        },
      ],
    };
  }

  const client = await getPool().connect();
  try {
    const result = await client.query(sql);
    return {
      content: [
        {
          type: 'text',
          text: `Query executed successfully. Rows: ${result.rowCount}`,
        },
        {
          type: 'text',
          text: JSON.stringify(
            {
              rows: result.rows,
              rowCount: result.rowCount,
              fields: result.fields.map((field) => ({
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
  table?: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const client = await getPool().connect();
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
      query += ` AND table_name = $1`;
      const tableResult = await client.query(query, [table]);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ schema: tableResult.rows }, null, 2),
          },
        ],
      };
    }
    const result = await client.query(query);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ schema: result.rows }, null, 2),
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

async function getTables(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const client = await getPool().connect();
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
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tables: result.rows }, null, 2),
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
    description: 'MCP server for PostgreSQL database operations with query filtering',
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
Execute SQL queries with safety restrictions.

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
**Returns:** Query results with rows, row count, and field information.
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
Get database schema information.

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
**Returns:** Table schema with columns, data types, and constraints.
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
List all tables in the database.

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
**Returns:** List of all tables with their schemas and types.
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
        return await executeQuery(sql);
      }

      case 'schema': {
        const { table } = args as { table?: string };
        return await getSchema(table);
      }

      case 'tables': {
        return await getTables();
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
