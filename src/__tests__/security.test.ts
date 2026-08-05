import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  enforceHttps,
  securityHeaders,
  corsConfig,
  securityMiddleware,
} from '../security';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/',
    originalUrl: '/',
    headers: {},
    secure: false,
    socket: { remoteAddress: '127.0.0.1' },
    body: null,
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const mock: any = {
    headers: {},
    statusCode: 200,
    _jsonData: null,
    setHeader(name: string, value: string) {
      mock.headers[name] = value;
      return mock;
    },
    removeHeader(name: string) {
      delete mock.headers[name];
      return mock;
    },
    getHeader(name: string) {
      return mock.headers[name];
    },
    status(code: number) {
      mock.statusCode = code;
      return mock;
    },
    json(data: any) {
      mock._jsonData = data;
      return mock;
    },
    end() {
      return mock;
    },
  };
  return mock;
}

describe('enforceHttps', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('passes through in development mode', () => {
    process.env.NODE_ENV = 'development';
    const req = mockReq({ secure: false });
    const res = mockRes();
    const next = vi.fn();

    enforceHttps(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 in production if not secure', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq({ secure: false, headers: {} });
    const res = mockRes();
    const next = vi.fn();

    enforceHttps(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through in production if secure', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq({ secure: true });
    const res = mockRes();
    const next = vi.fn();

    enforceHttps(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through in production if x-forwarded-proto is https', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq({ secure: false, headers: { 'x-forwarded-proto': 'https' } });
    const res = mockRes();
    const next = vi.fn();

    enforceHttps(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('securityHeaders', () => {
  it('sets all security headers', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff');
    expect(res.getHeader('X-Frame-Options')).toBe('DENY');
    expect(res.getHeader('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.getHeader('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.getHeader('Content-Security-Policy')).toBe("default-src 'self'");
    expect(next).toHaveBeenCalled();
  });

  it('removes X-Powered-By', () => {
    const res = mockRes();
    res.setHeader('X-Powered-By', 'Express');
    const req = mockReq();

    securityHeaders(req, res, () => {});
    expect(res.getHeader('X-Powered-By')).toBeUndefined();
  });

  it('sets HSTS when request is secure', () => {
    const req = mockReq({ secure: true });
    const res = mockRes();

    securityHeaders(req, res, () => {});
    expect(res.getHeader('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('sets HSTS when x-forwarded-proto is https', () => {
    const req = mockReq({ headers: { 'x-forwarded-proto': 'https' } });
    const res = mockRes();

    securityHeaders(req, res, () => {});
    expect(res.getHeader('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('uses custom HSTS max age when provided through securityMiddleware', () => {
    const app = express();
    app.use(securityMiddleware({ enableHttps: false, hstsMaxAge: 600 }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    return request(app)
      .get('/test')
      .set('x-forwarded-proto', 'https')
      .expect(200)
      .expect('Strict-Transport-Security', 'max-age=600; includeSubDomains');
  });

  it('does not set HSTS for insecure requests', () => {
    const req = mockReq({ secure: false });
    const res = mockRes();

    securityHeaders(req, res, () => {});
    expect(res.getHeader('Strict-Transport-Security')).toBeUndefined();
  });
});

describe('corsConfig', () => {
  it('sets CORS headers for allowed origin', () => {
    const middleware = corsConfig({ allowedOrigins: ['https://example.com'] });
    const req = mockReq({ headers: { origin: 'https://example.com' } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.getHeader('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(res.getHeader('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.getHeader('Access-Control-Allow-Methods')).toContain('GET');
    expect(next).toHaveBeenCalled();
  });

  it('does not set Allow-Origin for disallowed origin', () => {
    const middleware = corsConfig({ allowedOrigins: ['https://example.com'] });
    const req = mockReq({ headers: { origin: 'https://evil.com' } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('handles OPTIONS preflight with 200', () => {
    const middleware = corsConfig({ allowedOrigins: ['https://example.com'] });
    const req = mockReq({ method: 'OPTIONS', headers: { origin: 'https://example.com' } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('securityMiddleware', () => {
  it('runs all middlewares in sequence', () => {
    const app = express();
    app.use(securityMiddleware({ enableHttps: false }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    return request(app)
      .get('/test')
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('X-Frame-Options', 'DENY');
  });

  it('can disable individual middlewares', () => {
    const app = express();
    app.use(securityMiddleware({ enableHeaders: false, enableHttps: false, enableCors: false }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    return request(app)
      .get('/test')
      .expect(200)
      .then((res) => {
        expect(res.headers['x-content-type-options']).toBeUndefined();
      });
  });
});
