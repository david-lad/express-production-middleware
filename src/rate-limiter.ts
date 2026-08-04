import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

export interface RateLimiterOptions {
  redisClient?: Redis | null;
  windowMs?: number;
  max?: number;
  prefix?: string;
  message?: string;
  skipPaths?: string[];
}

export interface LimiterConfig {
  windowMs: number;
  max: number;
  message?: string;
  prefix: string;
}

export function createRateLimiter(name: string, options: RateLimiterOptions = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  const skipPaths = options.skipPaths || ['/health', '/healthz'];

  if (!isProduction) {
    return passthrough;
  }

  const rateLimitConfig: any = {
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: { ok: false, error: options.message || 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      const path = req.originalUrl || req.path;
      return skipPaths.some(p => path === p || path.startsWith(p));
    },
  };

  if (options.redisClient) {
    try {
      const client = options.redisClient;
      rateLimitConfig.store = new RedisStore({
        sendCommand: ((command: string, ...args: string[]) => client.call(command, ...args)) as any,
        prefix: options.prefix || `rl:${name}:`,
      });
    } catch (err: any) {
      console.warn(`[RateLimiter] Redis store unavailable for ${name}, using memory store:`, err.message);
    }
  }

  const limiter = rateLimit(rateLimitConfig);
  return safeMiddleware(name, () => limiter);
}

function passthrough(req: Request, res: Response, next: NextFunction): void {
  next();
}

function safeMiddleware(name: string, getLimiter: () => any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const limiter = getLimiter();

    if (typeof limiter !== 'function') {
      return next();
    }

    try {
      return limiter(req, res, (err?: Error) => {
        if (err) {
          console.warn(`[RateLimiter] ${name} failed open:`, err.message);
        }
        return next();
      });
    } catch (err: any) {
      console.warn(`[RateLimiter] ${name} failed open:`, err.message);
      return next();
    }
  };
}
