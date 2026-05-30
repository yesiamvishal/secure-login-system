require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
// Session store: uses memory store for dev; swap for connect-pg-simple or connect-redis in production


const { initializeDatabase } = require('./src/utils/database');
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, errors: ['Too many requests. Please try again later.'] },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, errors: ['Too many authentication attempts. Please try again in 15 minutes.'] },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/verify-2fa', authLimiter);

// ─── Request Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ─── Session Management ───────────────────────────────────────────────────────
app.use(session({
  name: 'sessionId',
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  // In production, replace with connect-pg-simple, connect-redis, or connect-sqlite3
  cookie: {
    httpOnly: true,               // Prevents JS access to cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',           // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', authRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).sendFile('404.html', { root: './views' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, errors: ['An unexpected error occurred'] });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`\n🔐 Secure Login System running at http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Press Ctrl+C to stop\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
