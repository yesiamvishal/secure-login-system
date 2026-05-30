const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet } = require('./database');
require('dotenv').config();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_DURATION = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against its hash
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user account
 */
async function createUser(username, email, password) {
  const id = uuidv4();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await dbRun(
    `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, username.toLowerCase().trim(), email.toLowerCase().trim(), passwordHash, now, now]
  );

  return id;
}

/**
 * Find user by username or email (parameterized to prevent SQL injection)
 */
async function findUserByUsernameOrEmail(identifier) {
  const clean = identifier.toLowerCase().trim();
  return dbGet(
    `SELECT * FROM users WHERE username = ? OR email = ?`,
    [clean, clean]
  );
}

/**
 * Find user by ID
 */
async function findUserById(id) {
  return dbGet(`SELECT * FROM users WHERE id = ?`, [id]);
}

/**
 * Check if account is locked out
 */
function isAccountLocked(user) {
  if (!user.is_locked) return false;
  if (user.lockout_until && Date.now() > user.lockout_until) {
    // Lockout has expired
    return false;
  }
  return true;
}

/**
 * Record a failed login attempt and lock if threshold exceeded
 */
async function recordFailedAttempt(userId) {
  const user = await findUserById(userId);
  const newAttempts = (user.failed_attempts || 0) + 1;
  const now = Date.now();

  if (newAttempts >= MAX_ATTEMPTS) {
    const lockoutUntil = now + (LOCKOUT_DURATION * 60 * 1000);
    await dbRun(
      `UPDATE users SET failed_attempts = ?, is_locked = 1, lockout_until = ?, updated_at = ? WHERE id = ?`,
      [newAttempts, lockoutUntil, now, userId]
    );
    return { locked: true, lockoutUntil, attemptsLeft: 0 };
  } else {
    await dbRun(
      `UPDATE users SET failed_attempts = ?, updated_at = ? WHERE id = ?`,
      [newAttempts, now, userId]
    );
    return { locked: false, attemptsLeft: MAX_ATTEMPTS - newAttempts };
  }
}

/**
 * Reset failed login attempts on successful login
 */
async function resetFailedAttempts(userId) {
  const now = Date.now();
  await dbRun(
    `UPDATE users SET failed_attempts = 0, is_locked = 0, lockout_until = NULL, last_login = ?, updated_at = ? WHERE id = ?`,
    [now, now, userId]
  );
}

/**
 * Log authentication events for audit trail
 */
async function logAuditEvent(userId, username, action, ip, userAgent, success) {
  await dbRun(
    `INSERT INTO login_audit (user_id, username, action, ip_address, user_agent, success, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, action, ip, userAgent, success ? 1 : 0, Date.now()]
  );
}

/**
 * Sanitize user object for session storage (remove sensitive fields)
 */
function sanitizeUser(user) {
  const { password_hash, two_factor_secret, ...safe } = user;
  return safe;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createUser,
  findUserByUsernameOrEmail,
  findUserById,
  isAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
  logAuditEvent,
  sanitizeUser,
};
