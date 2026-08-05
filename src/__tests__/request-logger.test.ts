import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestLogger } from '../request-logger';

describe('requestLogger', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('skips GET requests by default', async () => {
    const app = express();
    app.use(requestLogger());
    app.get('/test', (req, res) => res.json({ ok: true }));

    await request(app).get('/test').expect(200);

    const logCalls = consoleSpy.mock.calls.map((c: any) => String(c[0]));
    const hasRequestLog = logCalls.some((log: string) => log.includes('GET') && log.includes('/test'));
    expect(hasRequestLog).toBe(false);
  });

  it('logs POST requests', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestLogger());
    app.post('/test', (req, res) => res.json({ ok: true }));

    await request(app).post('/test').send({ name: 'test' }).expect(200);

    const logCalls = consoleSpy.mock.calls.map((c: any) => String(c[0]));
    const hasRequestLog = logCalls.some((log: string) => log.includes('POST') && log.includes('/test'));
    expect(hasRequestLog).toBe(true);
  });

  it('redacts sensitive fields from request body', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestLogger());
    app.post('/test', (req, res) => res.json({ ok: true }));

    await request(app)
      .post('/test')
      .send({ email: 'test@example.com', password: 'secret123', token: 'abc' })
      .expect(200);

    const logCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain('test@example.com');
    expect(logCalls).toContain('[REDACTED]');
    expect(logCalls).not.toContain('secret123');
  });

  it('redacts falsy sensitive values from request body', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestLogger());
    app.post('/test', (req, res) => res.json({ ok: true }));

    await request(app)
      .post('/test')
      .send({ password: '', token: 0 })
      .expect(200);

    const logCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain('[REDACTED]');
    expect(logCalls).not.toContain('token":0');
  });

  it('logs PATCH requests', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestLogger());
    app.patch('/test', (req, res) => res.json({ ok: true }));

    await request(app).patch('/test').send({ name: 'patch' }).expect(200);

    const logCalls = consoleSpy.mock.calls.map((c: any) => String(c[0]));
    const hasRequestLog = logCalls.some((log: string) => log.includes('PATCH') && log.includes('/test'));
    expect(hasRequestLog).toBe(true);
  });

  it('logs response status and duration', async () => {
    const app = express();
    app.use(requestLogger());
    app.post('/test', (req, res) => res.json({ ok: true }));

    await request(app).post('/test').expect(200);

    const logCalls = consoleSpy.mock.calls.map((c: any) => String(c[0]));
    const hasResponseLog = logCalls.some((log: string) => log.includes('200') && log.includes('ms'));
    expect(hasResponseLog).toBe(true);
  });

  it('logs error responses when status >= 400', async () => {
    const app = express();
    app.use(requestLogger());
    app.post('/test', (req, res) => res.status(404).json({ error: 'not found' }));

    await request(app).post('/test').expect(404);

    const logCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain('not found');
  });

  it('does not log request body when logBody is false', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestLogger({ logBody: false }));
    app.post('/test', (req, res) => res.json({ ok: true }));

    await request(app).post('/test').send({ password: 'secret' }).expect(200);

    const logCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(logCalls).not.toContain('Request Body');
    expect(logCalls).not.toContain('secret');
  });

  it('can log GET requests when skipGet is false', async () => {
    const app = express();
    app.use(requestLogger({ skipGet: false }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    await request(app).get('/test').expect(200);

    const logCalls = consoleSpy.mock.calls.map((c: any) => String(c[0]));
    const hasRequestLog = logCalls.some((log: string) => log.includes('GET') && log.includes('/test'));
    expect(hasRequestLog).toBe(true);
  });
});
