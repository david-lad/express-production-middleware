import { Request, Response, NextFunction } from 'express';

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'refreshToken', 'otp', 'authorization'];

export interface RequestLoggerOptions {
  skipGet?: boolean;
  logBody?: boolean;
  logErrors?: boolean;
  sensitiveFields?: string[];
}

export function requestLogger(options: RequestLoggerOptions = {}) {
  const {
    skipGet = true,
    logBody = true,
    logErrors = true,
    sensitiveFields = SENSITIVE_FIELDS,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (skipGet && req.method === 'GET') {
      return next();
    }

    const start = Date.now();
    const timestamp = new Date().toISOString();

    console.log(
      `[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip || req.socket.remoteAddress}`
    );

    if (logBody && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.body) {
      const logBody = { ...req.body };
      for (const field of sensitiveFields) {
        if (logBody[field]) {
          logBody[field] = '[REDACTED]';
        }
      }
      console.log(`[${timestamp}] Request Body:`, JSON.stringify(logBody));
    }

    const originalSend = res.send.bind(res);
    res.send = function (data: any) {
      const duration = Date.now() - start;
      console.log(
        `[${timestamp}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`
      );

      if (logErrors && res.statusCode >= 400) {
        console.log(`[${timestamp}] Error Response:`, data);
      }

      return originalSend(data);
    } as any;

    next();
  };
}
