import express from 'express';
import { createRateLimiter, securityMiddleware, requestLogger } from '../index';

const app = express();

// Security headers + CORS
app.use(securityMiddleware({
  allowedOrigins: ['https://yourdomain.com'],
  enableHttps: false, // Disable for local dev
}));

// Request logging (skips GET, redacts sensitive fields)
app.use(requestLogger());

// Parse JSON bodies
app.use(express.json());

// Create named rate limiters
const apiLimiter = createRateLimiter('api', { max: 100, windowMs: 15 * 60 * 1000 });
const authLimiter = createRateLimiter('auth', { max: 20, windowMs: 15 * 60 * 1000 });

// Apply to routes
app.use('/api', apiLimiter);
app.post('/login', authLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
