import { Request, Response, NextFunction } from 'express';

export interface SecurityOptions {
  allowedOrigins?: string[];
  hstsMaxAge?: number;
}

export function enforceHttps(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production') {
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      res.status(403).json({
        ok: false,
        error: 'HTTPS required. Please use https:// protocol.',
      });
      return;
    }
  }
  next();
}

function applySecurityHeaders(req: Request, res: Response, hstsMaxAge?: number): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader(
      'Strict-Transport-Security',
      `max-age=${hstsMaxAge ?? 31536000}; includeSubDomains`
    );
  }
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  applySecurityHeaders(req, res);

  next();
}

export function corsConfig(options: SecurityOptions = {}) {
  const allowedOrigins = options.allowedOrigins ||
    process.env.ALLOWED_ORIGINS?.split(',') ||
    ['http://localhost:3000'];

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Mobile-App, Accept, Origin, X-Requested-With, Cache-Control'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };
}

export interface SecurityMiddlewareOptions extends SecurityOptions {
  enableHttps?: boolean;
  enableHeaders?: boolean;
  enableCors?: boolean;
}

export function securityMiddleware(options: SecurityMiddlewareOptions = {}) {
  const {
    enableHttps = true,
    enableHeaders = true,
    enableCors = true,
    hstsMaxAge,
    ...corsOptions
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

    if (enableHttps) middlewares.push(enforceHttps);
    if (enableHeaders) {
      middlewares.push((request, response, proceed) => {
        applySecurityHeaders(request, response, hstsMaxAge);
        proceed();
      });
    }
    if (enableCors) middlewares.push(corsConfig(corsOptions));

    let index = 0;
    const run = () => {
      if (index < middlewares.length) {
        middlewares[index++](req, res, run);
      } else {
        next();
      }
    };
    run();
  };
}
