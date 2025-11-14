# @zeko/proxy-handler

Generic web-standard proxy request handler with failover support.

## Features

- Random load balancing across multiple backend hostnames
- Automatic failover with configurable delay
- Path and query string preservation
- Configurable CORS support with subdomain wildcards
- Web standard Request/Response API
- TypeScript support

## Usage

### Basic Setup

```typescript
import { createProxyHandler } from "@zeko/proxy-handler"

const hostnames = [
	"https://api.example.com/graphql",
	"https://backup.example.com/graphql"
]

const handler = createProxyHandler({
	hostnames,
	options: { backupDelay: 2000 }
})

// In a Cloudflare Worker
export default { fetch: handler }

// In any web-standard environment
const response = await handler(request)
```

### CORS Configuration

```typescript
// Allow all origins
const handler = createProxyHandler({
	hostnames,
	options: {
		cors: {
			origins: ["*"]
		}
	}
})

// Allow specific origins only
const handler = createProxyHandler({
	hostnames,
	options: {
		cors: {
			origins: ["https://example.com", "http://localhost:3000"]
		}
	}
})

// Allow origins and all their subdomains
const handler = createProxyHandler({
	hostnames,
	options: {
		cors: {
			origins: ["https://example.com"],
			subdomainWildcard: true // allows example.com, sub.example.com, deep.sub.example.com, etc.
		}
	}
})

// Multiple domains with subdomain support
const handler = createProxyHandler({
	hostnames,
	options: {
		cors: {
			origins: [
				"https://example.com",
				"https://app.io",
				"http://localhost:3000"
			],
			subdomainWildcard: true // enables subdomain matching for all listed origins
		}
	}
})
```

## Options

### `ProxyHandlerOptions`

- `backupDelay` (number, optional): Delay in milliseconds before starting the backup request. Default: `2000`
- `cors` (CorsOptions, optional): CORS configuration. If not provided, CORS is disabled.

### `CorsOptions`

- `origins` (string[]): List of allowed origins. Use `["*"]` to allow all origins (e.g., `["https://example.com", "http://localhost:3000"]`)
- `subdomainWildcard` (boolean, optional): If `true`, allows all subdomains of the specified origins. Default: `false`

## How It Works

1. **Load Balancing**: Randomly selects a primary backend from the hostnames list
2. **Failover**: Starts a backup request to a different backend after the configured delay
3. **Race**: Returns whichever response completes first
4. **CORS**: Automatically handles preflight requests and injects appropriate headers
5. **Path Preservation**: Combines the backend base URL with the original request path and query parameters
