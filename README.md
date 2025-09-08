# MCP PostgreSQL Server

A simple MCP server for PostgreSQL with query filtering system.

[![npm version](https://badge.fury.io/js/mcp-postgresql.svg)](https://badge.fury.io/js/mcp-postgresql)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Repository**: [https://github.com/deadraid/mcp-postgresql](https://github.com/deadraid/mcp-postgresql)
> **NPM Package**: [https://www.npmjs.com/package/mcp-postgresql](https://www.npmjs.com/package/mcp-postgresql)
> **Author**: deadraid
> **License**: MIT

## Installation

```bash
# Install globally from npm
npm install -g mcp-postgresql

# Or use directly with npx (no installation needed)
npx mcp-postgresql
```

## Features

- **3 tools**: `query`, `schema`, `tables`
- **Query filtering**: 4 access levels (readonly, modify, ddl, custom)
- **Data masking**: Automatic masking of sensitive fields (passwords, emails, etc.)
- **Security filtering**: Hide tables and columns by configuration
- **Universal tool**: One `query` instead of multiple separate tools
- **Simple configuration**: Only through environment variables
- **SSL support**: Full SSL/TLS configuration for secure connections
- **URL connection**: Support for PostgreSQL connection strings
- **Production ready**: Available on npm, used in production environments

## Quick Start

```bash
# Install from npm (recommended)
npm install -g mcp-postgresql

# Or use directly with npx (no installation needed)
npx mcp-postgresql
```

## Installation

### From npm (recommended)
```bash
# Install globally from npm registry
npm install -g mcp-postgresql

# Or use directly with npx (no installation needed)
npx mcp-postgresql
```

### From source (for development)
```bash
git clone https://github.com/deadraid/mcp-postgresql.git
cd mcp-postgresql
npm install
npm run build
npm link  # For development
```

## Usage

### Basic Configuration

#### Using local build
```json
{
  "mcpServers": {
    "postgresql": {
      "command": "node",
      "args": ["path/to/mcp-postgresql/dist/index.js"],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "mydb",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "password",
        "POSTGRES_QUERY_LEVEL": "readonly"
      }
    }
  }
}
```

#### Using global installation
```json
{
  "mcpServers": {
    "postgresql": {
      "command": "mcp-postgresql",
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "mydb",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "password",
        "POSTGRES_QUERY_LEVEL": "readonly"
      }
    }
  }
}
```

#### Using npx (recommended)
```json
{
  "mcpServers": {
    "postgresql": {
      "command": "npx",
      "args": ["mcp-postgresql-server"],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "mydb",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "password",
        "POSTGRES_QUERY_LEVEL": "readonly"
      }
    }
  }
}
```

### Advanced Configuration with SSL

#### Using connection URL (recommended for cloud databases)
```json
{
  "mcpServers": {
    "postgresql": {
      "command": "npx",
      "args": ["mcp-postgresql-server"],
      "env": {
        "POSTGRES_URL": "postgresql://user:password@host:port/database?sslmode=require",
        "POSTGRES_QUERY_LEVEL": "readonly"
      }
    }
  }
}
```

#### Using SSL certificates
```json
{
  "mcpServers": {
    "postgresql": {
      "command": "npx",
      "args": ["mcp-postgresql-server"],
      "env": {
        "POSTGRES_HOST": "your-db-host.com",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "mydb",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "password",
        "POSTGRES_SSL": "true",
        "POSTGRES_SSL_CA": "/path/to/ca-cert.pem",
        "POSTGRES_SSL_CERT": "/path/to/client-cert.pem",
        "POSTGRES_SSL_KEY": "/path/to/client-key.pem",
        "POSTGRES_QUERY_LEVEL": "readonly"
      }
    }
  }
}
```

### Access Levels

- `readonly` - SELECT queries only
- `modify` - SELECT, INSERT, UPDATE, DELETE
- `ddl` - All operations including CREATE, DROP, ALTER
- `custom` - Custom commands via `POSTGRES_ALLOWED_COMMANDS`

### Data Masking and Security Filtering

The server automatically masks sensitive data and can hide specific tables/columns:

#### Default masked fields (values replaced with `***`):
- `password`, `passwd`, `pwd`
- `secret`, `token`, `api_key`, `apikey`
- `private_key`, `privatekey`
- `credit_card`, `creditcard`, `card_number`, `cardnumber`
- `ssn`, `social_security`, `tax_id`
- `email`, `phone`, `address`

#### Configuration options:
```json
{
  "mcpServers": {
    "postgresql": {
      "command": "npx",
      "args": ["mcp-postgresql-server"],
      "env": {
        "POSTGRES_URL": "postgresql://user:password@host:port/database",
        "POSTGRES_QUERY_LEVEL": "readonly",
        "POSTGRES_DATA_MASKING": "true", // Enable data masking (default: true)
        "POSTGRES_HIDDEN_TABLES": "secret_table,internal_logs", // Hide specific tables
        "POSTGRES_HIDDEN_COLUMNS": "internal_id,debug_info", // Hide specific columns
        "POSTGRES_SENSITIVE_FIELDS": "custom_field,internal_code" // Additional fields to mask
      }
    }
  }
}
```

### Usage Examples

#### Execute Query
```json
{
  "name": "query",
  "arguments": {
    "sql": "SELECT * FROM users LIMIT 10"
  }
}
```
**Note**: Sensitive fields (passwords, emails, etc.) will be automatically masked with `***`

#### View Schema
```json
{
  "name": "schema",
  "arguments": {
    "table": "users"
  }
}
```
**Note**: Hidden tables and columns will be filtered out from results

#### List Tables
```json
{
  "name": "tables",
  "arguments": {}
}
```
**Note**: Hidden tables will be filtered out from results

#### View Schema
```json
{
  "name": "schema",
  "arguments": {
    "table": "users"
  }
}
```

#### List Tables
```json
{
  "name": "tables",
  "arguments": {}
}
```

## Environment Variables

### Connection Options
| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_URL` | **Full connection URL** (has priority over individual params) | `""` |
| `POSTGRES_HOST` | Database host (ignored if URL is set) | `localhost` |
| `POSTGRES_PORT` | Database port (ignored if URL is set) | `5432` |
| `POSTGRES_DB` | Database name (ignored if URL is set) | `postgres` |
| `POSTGRES_USER` | Database user (ignored if URL is set) | `postgres` |
| `POSTGRES_PASSWORD` | Database password (ignored if URL is set) | `""` |

### SSL Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_SSL` | Enable SSL (`true`, `false`, or leave empty for auto) | `""` |
| `POSTGRES_SSL_CA` | SSL CA certificate path | `""` |
| `POSTGRES_SSL_CERT` | SSL client certificate path | `""` |
| `POSTGRES_SSL_KEY` | SSL client key path | `""` |
| `POSTGRES_SSL_REJECT_UNAUTHORIZED` | Reject unauthorized SSL certs (`false` to disable) | `""` |

### Security Options
| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_QUERY_LEVEL` | Access level | `readonly` |
| `POSTGRES_ALLOWED_COMMANDS` | Custom allowed commands | `""` |
| `POSTGRES_DATA_MASKING` | Enable data masking (`true`/`false`) | `true` |
| `POSTGRES_HIDDEN_TABLES` | Comma-separated list of tables to hide | `""` |
| `POSTGRES_HIDDEN_COLUMNS` | Comma-separated list of columns to hide | `""` |
| `POSTGRES_SENSITIVE_FIELDS` | Additional fields to mask (comma-separated) | `""` |

### SSL Examples

#### Cloud Database (Supabase, Neon, etc.)
```bash
POSTGRES_URL="postgresql://user:password@host:port/database?sslmode=require"
```

#### Self-hosted with SSL
```bash
POSTGRES_SSL=true
POSTGRES_SSL_CA=/path/to/ca-cert.pem
POSTGRES_SSL_CERT=/path/to/client-cert.pem
POSTGRES_SSL_KEY=/path/to/client-key.pem
```

#### Disable SSL verification (for development)
```bash
POSTGRES_SSL_REJECT_UNAUTHORIZED=false
```

## Development

```bash
# Build
npm run build

# Development mode
npm run dev

# Lint
npm run lint
```

## Links

- **NPM Package**: [https://www.npmjs.com/package/mcp-postgresql](https://www.npmjs.com/package/mcp-postgresql)
- **GitHub Repository**: [https://github.com/deadraid/mcp-postgresql](https://github.com/deadraid/mcp-postgresql)
- **Issues & Support**: [https://github.com/deadraid/mcp-postgresql/issues](https://github.com/deadraid/mcp-postgresql/issues)

## License

MIT