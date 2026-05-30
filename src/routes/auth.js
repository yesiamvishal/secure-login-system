const express = require('express');
const router = express.Router();
const {
  createUser,
  findUserByUsernameOrEmail,
  findUserById,
  verifyPassword,
  isAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
  logAuditEvent,
  sanitizeUser,
} = require('../utils/auth');
const { generateSecret, generateQRCode, verifyToken, enable2FA, disable2FA } = require('../utils/twoFactor');
const { validateRegistration, validateLogin, validate2FAToken, requireAuth, redirectIfAuthenticated } = require('../middleware/validation');
const { dbGet } = require('../utils/database');

// ─── Registration ─────────────────────────────────────────────────────────────

router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.sendFile('register.html', { root: './views' });
});

router.post('/api/register', validateRegistration, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if username or email already exists
    const existingByUsername = await dbGet('SELECT id FROM users WHERE username = ?', [username.toLowerCase().trim()]);
    if (existingByUsername) {
      return res.status(409).json({ success: false, errors: ['Username is already taken'] });
    }

    const existingByEmail = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existingByEmail) {
      return res.status(409).json({ success: false, errors: ['Email is already registered'] });
    }

    const userId = await createUser(username, email, password);

    await logAuditEvent(userId, username, 'REGISTER', req.ip, req.get('User-Agent'), true);

    res.json({ success: true, message: 'Account created successfully! Please log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, errors: ['Registration failed. Please try again.'] });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────

router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.sendFile('login.html', { root: './views' });
});

router.post('/api/login', validateLogin, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await findUserByUsernameOrEmail(identifier);

    if (!user) {
      await logAuditEvent(null, identifier, 'LOGIN_FAILED', req.ip, req.get('User-Agent'), false);
      // Constant-time response to prevent user enumeration
      await new Promise(r => setTimeout(r, 500 + Math.random() * 200));
      return res.status(401).json({ success: false, errors: ['Invalid credentials'] });
    }

    // Check lockout
    if (isAccountLocked(user)) {
      const minutesLeft = Math.ceil((user.lockout_until - Date.now()) / 60000);
      await logAuditEvent(user.id, user.username, 'LOGIN_LOCKED', req.ip, req.get('User-Agent'), false);
      return res.status(423).json({
        success: false,
        errors: [`Account is temporarily locked. Try again in ${minutesLeft} minute(s).`]
      });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      const result = await recordFailedAttempt(user.id);
      await logAuditEvent(user.id, user.username, 'LOGIN_FAILED', req.ip, req.get('User-Agent'), false);

      if (result.locked) {
        return res.status(423).json({
          success: false,
          errors: [`Too many failed attempts. Account locked for ${process.env.LOCKOUT_DURATION_MINUTES || 15} minutes.`]
        });
      }

      return res.status(401).json({
        success: false,
        errors: [`Invalid credentials. ${result.attemptsLeft} attempt(s) remaining.`]
      });
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      // Store pending user in session for 2FA verification step
      req.session.pending2FAUserId = user.id;
      req.session.pending2FAUsername = user.username;
      await logAuditEvent(user.id, user.username, 'LOGIN_2FA_REQUIRED', req.ip, req.get('User-Agent'), true);
      return res.json({ success: true, requires2FA: true });
    }

    // Successful login
    await resetFailedAttempts(user.id);
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ success: false, errors: ['Session error'] });
      req.session.userId = user.id;
      req.session.username = user.username;
      logAuditEvent(user.id, user.username, 'LOGIN_SUCCESS', req.ip, req.get('User-Agent'), true);
      res.json({ success: true, redirect: '/dashboard' });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, errors: ['Login failed. Please try again.'] });
  }
});

// ─── 2FA Verification ─────────────────────────────────────────────────────────

router.post('/api/verify-2fa', validate2FAToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.session.pending2FAUserId;

    if (!userId) {
      return res.status(401).json({ success: false, errors: ['No pending 2FA session'] });
    }

    const user = await findUserById(userId);
    if (!user || !user.two_factor_secret) {
      return res.status(401).json({ success: false, errors: ['Invalid session'] });
    }

    const valid = verifyToken(token, user.two_factor_secret);

    if (!valid) {
      await logAuditEvent(user.id, user.username, '2FA_FAILED', req.ip, req.get('User-Agent'), false);
      return res.status(401).json({ success: false, errors: ['Invalid 2FA code. Please try again.'] });
    }

    // Clear pending state and establish session
    delete req.session.pending2FAUserId;
    delete req.session.pending2FAUsername;

    await resetFailedAttempts(user.id);

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ success: false, errors: ['Session error'] });
      req.session.userId = user.id;
      req.session.username = user.username;
      logAuditEvent(user.id, user.username, '2FA_SUCCESS', req.ip, req.get('User-Agent'), true);
      res.json({ success: true, redirect: '/dashboard' });
    });
  } catch (error) {
    console.error('2FA error:', error);
    res.status(500).json({ success: false, errors: ['Verification failed. Please try again.'] });
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get('/dashboard', requireAuth, async (req, res) => {
  res.sendFile('dashboard.html', { root: './views' });
});

router.get('/api/user', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.session.userId);
    if (!user) return res.status(404).json({ success: false });
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ─── 2FA Setup ────────────────────────────────────────────────────────────────

router.post('/api/2fa/setup', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.session.userId);
    const { secret, otpauth } = generateSecret(user.username);
    const qrCode = await generateQRCode(otpauth);

    // Store secret temporarily in session for verification
    req.session.pending2FASecret = secret;

    res.json({ success: true, qrCode, secret });
  } catch (error) {
    res.status(500).json({ success: false, errors: ['Failed to setup 2FA'] });
  }
});

router.post('/api/2fa/enable', requireAuth, validate2FAToken, async (req, res) => {
  try {
    const { token } = req.body;
    const secret = req.session.pending2FASecret;

    if (!secret) {
      return res.status(400).json({ success: false, errors: ['No pending 2FA setup found'] });
    }

    const result = await enable2FA(req.session.userId, secret, token);

    if (!result.success) {
      return res.status(400).json({ success: false, errors: [result.message] });
    }

    delete req.session.pending2FASecret;

    const user = await findUserById(req.session.userId);
    await logAuditEvent(user.id, user.username, '2FA_ENABLED', req.ip, req.get('User-Agent'), true);

    res.json({ success: true, message: '2FA enabled successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, errors: ['Failed to enable 2FA'] });
  }
});

router.post('/api/2fa/disable', requireAuth, async (req, res) => {
  try {
    await disable2FA(req.session.userId);
    const user = await findUserById(req.session.userId);
    await logAuditEvent(user.id, user.username, '2FA_DISABLED', req.ip, req.get('User-Agent'), true);
    res.json({ success: true, message: '2FA disabled.' });
  } catch (error) {
    res.status(500).json({ success: false, errors: ['Failed to disable 2FA'] });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.post('/api/logout', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const username = req.session.username;

  req.session.destroy(async (err) => {
    await logAuditEvent(userId, username, 'LOGOUT', req.ip, req.get('User-Agent'), true);
    res.clearCookie('sessionId');
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, redirect: '/login' });
  });
});

// ─── Root Redirect ────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

module.exports = router;
