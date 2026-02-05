# MOTLY Configuration Language

MOTLY is a lightweight, human-friendly configuration language designed for readability and ease of use. It originated as the annotation/tag language in Malloy but we are documenting it here as a possible choice for use as a configuration language.

The extension would be either `.motly` or maybe `.mtly`

## Why MOTLY?

- **Concise**: No quotes required for simple strings
- **Readable**: Clean syntax that's easy to scan
- **Typed**: Native support for strings, numbers, booleans, and dates
- **Nested**: Natural object nesting with braces
- **Comments**: Line comments with `#`

### What does MOTLY mean?

MOTLY isn't really an acronym, it was just the end of a search for a name which could also be the file extension, but if it were, it could stand for:

  - Malloy Object Tagging Language, Yahoo!
  - More Objects Than Lines, Yippee!
  - Markup Objects Tersely, Like YAML
  - Makes Other Things Look Yucky
  - Might Overtake TOML Later, Y'know

## Quick Example

```motly
# Application configuration
app: {
  name = "My Application"
  version = 1.2
  debug = @false

  server: {
    host = localhost
    port = 8080
    timeout = 30000
    ssl = @true
  }

  database: {
    host = "db.example.com"
    port = 5432
    name = myapp_production
    pool_size = 20

    credentials: {
      username = admin
      password = "secret with spaces"
    }
  }

  features = [logging, metrics, caching]

  logging: {
    level = info
    format = json
    outputs = [stdout, file]

    file: {
      path = "/var/log/myapp.log"
      max_size = 10485760
      rotate = @true
    }
  }

  scheduled_maintenance = @2024-06-15T02:00:00Z
}
```

## Values

### Strings

Simple strings (alphanumeric and underscore) don't need quotes:

```motly
name = hello
color = blue
status = active
log_level = info
```

Strings with special characters need quotes:

```motly
message = "Hello, World!"
path = "/usr/local/bin"
hostname = "db.example.com"
app_name = "my-app"
pattern = 'foo.*bar'
```

Multi-line strings use triple quotes:

```motly
description = """
This is a long description
that spans multiple lines.
It preserves newlines.
"""
```

### Numbers

Numbers are parsed as native numeric values:

```motly
port = 8080
rate = 0.05
temperature = -40
scientific = 1.5e10
```

To force a number to be a string, use quotes:

```motly
zip_code = "01234"
phone = "555-1234"
```

### Booleans

Booleans use the `@true` and `@false` syntax:

```motly
enabled = @true
debug = @false
verbose = @true
```

### Dates

Dates use ISO 8601 format with `@` prefix:

```motly
# Date only
created = @2024-01-15

# Date with time (UTC)
updated = @2024-01-15T10:30:00Z

# Date with timezone offset
scheduled = @2024-01-15T10:30:00+05:00
```

### Arrays

Arrays are enclosed in square brackets:

```motly
# Simple array
colors = [red, green, blue]

# Array of numbers
ports = [80, 443, 8080]

# Array of strings with spaces
names = ["Alice Smith", "Bob Jones"]

# Array of objects
users = [
  { name = alice  role = admin }
  { name = bob    role = user }
  { name = charlie role = guest }
]

# Mixed array with typed values
config = [@true, 42, hello, @2024-01-15]
```

## Objects

### Basic Nesting

Objects are created with colon and braces:

```motly
server: {
  host = localhost
  port = 8080
}
```

### Deep Nesting

Use dot notation for deep paths:

```motly
database.connection.pool.max = 100
database.connection.pool.min = 10
database.connection.timeout = 5000
```

Or nest explicitly:

```motly
database: {
  connection: {
    pool: {
      max = 100
      min = 10
    }
    timeout = 5000
  }
}
```

### Modifying Objects

There are two ways to add properties to an existing object:

**Colon syntax (`: { }`) replaces all properties:**

```motly
server: {
  host = localhost
  port = 8080
}

# Replace everything in server
server: {
  url = "http://example.com"
}

# Result: server only has url (host and port removed)
```

**Space syntax (`{ }`) merges with existing properties:**

```motly
server: {
  host = localhost
}

# Add more properties (merged)
server {
  port = 8080
}

# Result: server has both host and port
```

Use colon syntax for normal configuration. Space syntax is useful when extending or overriding configuration from multiple sources.

## Comments

Line comments start with `#`:

```motly
# This is a comment
server: {
  host = localhost  # inline comment
  port = 8080
}
```

## Real-World Examples

### Web Server Configuration

```motly
# Web server configuration
server: {
  listen: {
    address = "0.0.0.0"
    port = 8080
  }

  tls: {
    enabled = @true
    cert_file = "/etc/ssl/server.crt"
    key_file = "/etc/ssl/server.key"
    min_version = "1.2"
  }

  timeouts: {
    read = 30
    write = 30
    idle = 120
  }

  limits: {
    max_connections = 10000
    max_request_size = 10485760
  }
}

routes = [
  { path = "/api"     handler = api_handler     methods = [GET, POST] }
  { path = "/health"  handler = health_check    methods = [GET] }
  { path = "/static"  handler = static_files    methods = [GET] }
]

middleware = [cors, logging, auth, rate_limit]
```

### Database Configuration

```motly
# Database cluster configuration
database: {
  driver = postgres

  primary: {
    host = "db-primary.internal"
    port = 5432
    database = myapp
    username = app_user
    password = "secure_password_here"

    pool: {
      min = 5
      max = 50
      idle_timeout = 300
    }

    ssl: {
      mode = "verify-full"
      root_cert = "/etc/ssl/db-ca.crt"
    }
  }

  replicas = [
    { host = "db-replica-1.internal"  port = 5432  weight = 1 }
    { host = "db-replica-2.internal"  port = 5432  weight = 1 }
    { host = "db-replica-3.internal"  port = 5432  weight = 2 }
  ]

  migrations: {
    auto_run = @false
    directory = "./migrations"
    table = schema_migrations
  }
}
```

### Kubernetes-style Deployment

```motly
# Deployment configuration
apiVersion = "apps/v1"
kind = Deployment

metadata: {
  name = "my-application"
  namespace = production
  labels: {
    app = "my-app"
    version = "2.1.0"
    team = backend
  }
}

spec: {
  replicas = 3

  selector: {
    matchLabels: {
      app = "my-app"
    }
  }

  template: {
    metadata: {
      labels: {
        app = "my-app"
        version = "2.1.0"
      }
    }

    spec: {
      containers = [
        {
          name = main
          image = "myregistry/my-app:2.1.0"
          ports = [{ containerPort = 8080 }]

          resources: {
            requests: { cpu = "100m"  memory = "128Mi" }
            limits: { cpu = "500m"  memory = "512Mi" }
          }

          env = [
            { name = LOG_LEVEL  value = info }
            { name = DB_HOST    value = "db.internal" }
          ]

          livenessProbe: {
            httpGet: { path = "/health"  port = 8080 }
            initialDelaySeconds = 10
            periodSeconds = 30
          }
        }
      ]
    }
  }
}
```

### Feature Flags

```motly
# Feature flag configuration
features: {
  # Global defaults
  default_enabled = @false

  flags: {
    new_dashboard: {
      enabled = @true
      rollout_percentage = 25
      allowed_users = [admin, beta_testers]
      start_date = @2024-02-01
      end_date = @2024-03-01
    }

    dark_mode: {
      enabled = @true
      rollout_percentage = 100
    }

    experimental_api: {
      enabled = @false
      allowed_environments = [development, staging]
    }
  }
}
```

### Monitoring & Alerts

```motly
# Monitoring configuration
monitoring: {
  metrics: {
    enabled = @true
    endpoint = "/metrics"
    port = 9090

    collectors = [
      { name = http_requests    type = counter   labels = [method, path, status] }
      { name = request_duration type = histogram labels = [method, path] }
      { name = active_users     type = gauge     labels = [region] }
    ]
  }

  alerts = [
    {
      name = high_error_rate
      condition = "error_rate > 0.05"
      duration = 300
      severity = critical

      notifications: {
        channels = [pagerduty, slack]
        message = "Error rate exceeded 5% for 5 minutes"
      }
    }
    {
      name = high_latency
      condition = "p99_latency > 2000"
      duration = 600
      severity = warning

      notifications: {
        channels = [slack]
        message = "P99 latency exceeded 2 seconds"
      }
    }
  ]

  dashboards: {
    refresh_interval = 30
    default_time_range = "1h"
  }
}
```

## Syntax Reference

| Syntax | Description | Example |
|--------|-------------|---------|
| `key = value` | Assign a value | `port = 8080` |
| `key: { ... }` | Nested object | `server: { host = localhost }` |
| `key = [a, b]` | Array | `ports = [80, 443]` |
| `key.sub = val` | Deep path | `db.pool.max = 10` |
| `@true` / `@false` | Boolean | `enabled = @true` |
| `@2024-01-15` | Date | `created = @2024-01-15` |
| `"quoted"` | String with special chars | `host = "my-app.com"` |
| `"""multi"""` | Multi-line string | `desc = """..."""` |
| `# comment` | Line comment | `# This is a comment` |
| `-key` | Delete property | `-deprecated_field` |

## Bare String Rules

Bare (unquoted) strings can only contain:
- Letters: `A-Z`, `a-z`
- Digits: `0-9`
- Underscore: `_`
- Extended Latin: accented characters like `é`, `ñ`, `ü`

Strings with these characters **must** be quoted:
- Hyphens: `"my-app"`
- Dots: `"db.example.com"`
- Slashes: `"/api/v1"`
- Colons: `"host:port"`
- Spaces: `"hello world"`
- Most punctuation

## Comparison with Other Formats

### vs JSON

```json
{
  "server": {
    "host": "localhost",
    "port": 8080,
    "ssl": true
  }
}
```

```motly
server: {
  host = localhost
  port = 8080
  ssl = @true
}
```

MOTLY is more concise: no quotes on simple keys/values, no commas, no colons between keys and values.

### vs YAML

```yaml
server:
  host: localhost
  port: 8080
  ssl: true
```

```motly
server: {
  host = localhost
  port = 8080
  ssl = @true
}
```

MOTLY uses explicit braces instead of indentation, making copy-paste safer.

### vs TOML

```toml
[server]
host = "localhost"
port = 8080
ssl = true
```

```motly
server: {
  host = localhost
  port = 8080
  ssl = @true
}
```

MOTLY allows deeper nesting without section headers.

## Using MOTLY

```typescript
import {Tag} from '@malloydata/malloy-tag';
import * as fs from 'fs';

// Parse a MOTLY configuration file
const configText = fs.readFileSync('app.motly', 'utf-8');
const {tag, log} = Tag.parse(configText);

// Check for parse errors
if (log.length > 0) {
  console.error('Parse errors:', log);
}

// Option 1: Convert to a plain JavaScript object
const config = tag.toObject();
console.log(config.app.name);           // "My Application"
console.log(config.app.server.port);    // 8080
console.log(config.app.features);       // ["logging", "metrics", "caching"]

// Iterate over properties
for (const [key, value] of Object.entries(config.app.server)) {
  console.log(`${key}: ${value}`);
}

// Option 2: Use the Tag API for type-safe access
const app = tag.tag('app');

// String values
const name = app.text('name');          // "My Application"
const host = app.text('server', 'host'); // "localhost"

// Numeric values
const port = app.numeric('server', 'port');     // 8080
const poolSize = app.numeric('database', 'pool_size'); // 20

// Boolean values
const debug = app.boolean('debug');     // false
const ssl = app.isTrue('server', 'ssl'); // true

// Date values
const maintenance = app.date('scheduled_maintenance'); // Date object

// Arrays
const features = app.textArray('features');  // ["logging", "metrics", "caching"]
const outputs = app.textArray('logging', 'outputs'); // ["stdout", "file"]

// Check existence
if (app.has('database', 'credentials')) {
  const username = app.text('database', 'credentials', 'username');
}
```

## Schema Validation

MOTLY supports schema validation to ensure configuration files conform to expected structures. Schemas are themselves written in MOTLY format.

### Defining a Schema

A schema defines `required` and `optional` properties with their expected types:

```motly
required: {
  name = string
  port = number
  enabled = boolean
}
optional: {
  timeout = number
  tags = "string[]"
}
```

### Type Specifiers

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `name = string` |
| `number` | Numeric value | `port = number` |
| `boolean` | True or false | `enabled = boolean` |
| `date` | ISO 8601 date | `created = date` |
| `tag` | Nested object (no scalar value) | `config = tag` |
| `any` | Any type allowed | `value = any` |
| `"string[]"` | Array of strings | `tags = "string[]"` |
| `"number[]"` | Array of numbers | `ports = "number[]"` |
| `"boolean[]"` | Array of booleans | `flags = "boolean[]"` |
| `"date[]"` | Array of dates | `dates = "date[]"` |
| `"tag[]"` | Array of objects | `items = "tag[]"` |
| `"any[]"` | Array of any type | `items = "any[]"` |

Note: Array types must be quoted to prevent the `[]` from being parsed as an array literal.

### Nested Schemas

Define nested object structures by nesting `required` and `optional` blocks:

```motly
required: {
  database: {
    required: {
      host = string
      port = number
    }
    optional: {
      ssl = boolean
      pool: {
        required: {
          min = number
          max = number
        }
      }
    }
  }
}
```

### Combining Type and Nested Validation

Properties can have both a type constraint and nested property validation. Use the shorthand form:

```motly
required: {
  server = tag {
    required: {
      host = string
      port = number
    }
  }
}
```

Or the full form with `type`:

```motly
required: {
  server: {
    type = tag
    required: {
      host = string
      port = number
    }
  }
}
```

This works for any type. For example, validating a property that must be a string but can also have metadata:

```motly
required: {
  name = string {
    optional: { locale = string }
  }
}
```

### Array Element Validation

For arrays of objects (`tag[]`), the nested schema validates each element:

```motly
required: {
  items = "tag[]" {
    required: {
      size = number
      color = string
    }
  }
}
```

This validates that `items` is an array where every element has `size` (number) and `color` (string). Errors include the array index in the path (e.g., `items.1.size`).

### Custom Types

Define reusable types in the `types` section and reference them by name:

```motly
types: {
  personType: {
    required: {
      name = string
      age = number
    }
  }
}
required: {
  user = personType
  manager = personType
}
```

Custom type names cannot conflict with built-in types (string, number, etc.).

#### Custom Type Arrays

Use quoted `"typeName[]"` for arrays of custom types:

```motly
types: {
  personType: {
    required: { name = string age = number }
  }
}
required: {
  people = "personType[]"
}
```

#### Recursive Types

Custom types can reference themselves for recursive structures:

```motly
types: {
  treeNode: {
    required: { value = number }
    optional: { children = "treeNode[]" }
  }
}
required: {
  root = treeNode
}
```

This validates trees of arbitrary depth where each node has a `value` and optional `children`.

### Unknown Properties

By default, properties not listed in `required` or `optional` cause validation errors. To allow extra properties, add `allowUnknown = @true`:

```motly
allowUnknown = @true
required: {
  name = string
}
```

### Validation API

```typescript
import {parseTag, validateTag} from '@malloydata/malloy-tag';

// Parse the configuration
const {tag: config} = parseTag(`
  name = "my-app"
  port = 8080
  enabled = @true
  tags = [web, api, production]
`);

// Parse the schema
const {tag: schema} = parseTag(`
  required: {
    name = string
    port = number
    enabled = boolean
  }
  optional: {
    timeout = number
    tags = "string[]"
  }
`);

// Validate
const errors = validateTag(config, schema);

if (errors.length === 0) {
  console.log('Configuration is valid!');
} else {
  for (const error of errors) {
    console.log(`${error.code}: ${error.message} at ${error.path.join('.')}`);
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `missing-required` | A required property is not present |
| `wrong-type` | Property value has incorrect type |
| `unknown-property` | Property not defined in schema |
| `invalid-schema` | Schema contains invalid type (e.g., typo like `stirng`) |

### Complete Example

**Schema (app-schema.motly):**

```motly
required: {
  app: {
    required: {
      name = string
      version = number
    }
    optional: {
      debug = boolean
    }
  }
  server: {
    required: {
      host = string
      port = number
    }
    optional: {
      ssl = boolean
      timeout = number
    }
  }
}
optional: {
  features = "string[]"
  metadata = tag
}
```

**Configuration (app.motly):**

```motly
app: {
  name = "My Application"
  version = 1.2
  debug = @false
}

server: {
  host = localhost
  port = 8080
  ssl = @true
}

features = [logging, metrics]
```

**Validation:**

```typescript
import {parseTag, validateTag} from '@malloydata/malloy-tag';
import * as fs from 'fs';

const {tag: config} = parseTag(fs.readFileSync('app.motly', 'utf-8'));
const {tag: schema} = parseTag(fs.readFileSync('app-schema.motly', 'utf-8'));

const errors = validateTag(config, schema);
// errors = [] (valid configuration)
```
