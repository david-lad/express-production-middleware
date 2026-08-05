# express-production-middleware

[![npm](https://img.shields.io/npm/v/express-production-middleware)](https://www.npmjs.com/package/express-production-middleware)

Production-ready Express middleware stack with security headers, rate limiting, and request logging. Project-agnostic — bring your own limiter names.

## Installation

```bash
npm install express-production-middleware
```

**Peer dependencies:**

```bash
npm install express rate-limit-redis
# Optional: for Redis-backed rate limiting
npm install ioredis
```

## Usage

```typescript
import express from 'express';
import { createRateLimiter, securityMiddleware, requestLogger } from 'express-production-middleware';

const app = express();

// Security headers + CORS
app.use(securityMiddleware({
  allowedOrigins: ['https://yourdomain.com'],
}));

// Request logging (skips GET, redacts sensitive fields)
app.use(requestLogger());

// Create named rate limiters — you decide the names
const apiLimiter = createRateLimiter('api', { max: 100, windowMs: 15 * 60 * 1000 });
const authLimiter = createRateLimiter('auth', { max: 20, windowMs: 15 * 60 * 1000 });

app.use('/api', apiLimiter);
app.post('/login', authLimiter);
```

## Components

### Security Middleware

```typescript
import { securityMiddleware } from 'express-production-middleware';

app.use(securityMiddleware({
  allowedOrigins: ['https://yourdomain.com'],
  enableHttps: true,     // Reject HTTP in production
  enableHeaders: true,   // X-Content-Type-Options, HSTS, CSP, etc.
  enableCors: true,      // CORS with preflight cache
}));
```

**Headers set:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting

```typescript
import { createRateLimiter } from 'express-production-middleware';

const limiter = createRateLimiter('my-app', {
  max: 100,                    // Max requests per window
  windowMs: 15 * 60 * 1000,   // 15 minutes
  redisClient: redisClient,    // Optional: Redis for distributed limiting
  skipPaths: ['/health'],      // Paths to skip
});
```

**Features:**
- Redis-backed for distributed rate limiting (optional)
- In-memory fallback when Redis is unavailable
- Skips health check paths by default
- Standard `RateLimit-*` headers
- Fails open on errors (never blocks requests if limiter breaks)

### Request Logging

```typescript
import { requestLogger } from 'express-production-middleware';

app.use(requestLogger({
  skipGet: true,      // Skip GET requests (default: true)
  logBody: true,      // Log request body (default: true)
  logErrors: true,    // Log error responses (default: true)
}));
```

**Logs include:**
- Method, URL, IP, status code, duration
- Request body with sensitive fields redacted (passwords, tokens, secrets)
- Error responses for 4xx/5xx

## API

### `createRateLimiter(name, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `max` | `number` | `100` | Max requests per window |
| `windowMs` | `number` | `900000` | Window duration (15 min) |
| `redisClient` | `Redis \| null` | `null` | Redis client for distributed limiting |
| `prefix` | `string` | `rl:{name}:` | Redis key prefix |
| `message` | `string` | `"Too many requests"` | Error message |
| `skipPaths` | `string[]` | `['/health', '/healthz']` | Paths to skip |

### `securityMiddleware(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowedOrigins` | `string[]` | `['http://localhost:3000']` | CORS allowed origins |
| `enableHttps` | `boolean` | `true` | Enforce HTTPS in production |
| `enableHeaders` | `boolean` | `true` | Set security headers |
| `enableCors` | `boolean` | `true` | Enable CORS |

### `requestLogger(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skipGet` | `boolean` | `true` | Skip logging GET requests |
| `logBody` | `boolean` | `true` | Log request body |
| `logErrors` | `boolean` | `true` | Log error responses |

## License

[MIT](LICENSE)
