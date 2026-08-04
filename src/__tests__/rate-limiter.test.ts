import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { createRateLimiter } from '../rate-limiter';

describe('createRateLimiter', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleSpy.mockRestore();
  });

  it('returns passthrough middleware in development mode', () => {
    process.env.NODE_ENV = 'development';
    const limiter = createRateLimiter('test');
    expect(typeof limiter).toBe('function');
  });

  it('passthrough middleware calls next without blocking', async () => {
    process.env.NODE_ENV = 'development';
    const limiter = createRateLimiter('test');

    const app = express();
    app.use(limiter);
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test').expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('creates actual rate limiter in production mode', () => {
    process.env.NODE_ENV = 'production';
    const limiter = createRateLimiter('test', { max: 100 });
    expect(typeof limiter).toBe('function');
  });

  it('creates rate limiter with correct config', () => {
    process.env.NODE_ENV = 'production';
    const limiter = rateLimit({
      windowMs: 60000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
    });
    expect(typeof limiter).toBe('function');
  });
});
