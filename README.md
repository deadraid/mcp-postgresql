# MCP PostgreSQL Server

A simple MCP server for PostgreSQL with query filtering system.

## Features

- **3 tools**: `query`, `schema`, `tables`
- **Query filtering**: 4 access levels (readonly, modify, ddl, custom)
- **Universal tool**: One `query` instead of multiple separate tools
- **Simple configuration**: Only through environment variables
- **SSL support**: Full SSL/TLS configuration for secure connections
- **URL connection**: Support for PostgreSQL connection strings

## Installation

### Local development
```bash
npm install
npm run build
```

### Global installation
```bash
# Build the project first
npm run build

# Install globally
npm install -g .

# Or link for development
npm link

# Now you can use it from anywhere
mcp-postgresql-server
```

### Using npx (recommended)
```bash
# No installation needed, runs directly
npx mcp-postgresql-server
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
      "command": "mcp-postgresql-server",
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

## License

MIT