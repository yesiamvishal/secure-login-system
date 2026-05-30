const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { dbRun } = require('./database');
require('dotenv').config();

const APP_NAME = process.env.APP_NAME || 'SecureLoginSystem';

/**
 * Generate a new 2FA secret for a user
 */
function generateSecret(username) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(username, APP_NAME, secret);
  return { secret, otpauth };
}

/**
 * Generate a QR code data URL from an OTP auth URI
 */
async function generateQRCode(otpauth) {
  return QRCode.toDataURL(otpauth);
}

/**
 * Verify a TOTP token against a secret
 */
function verifyToken(token, secret) {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}

/**
 * Enable 2FA for a user after verifying the setup token
 */
async function enable2FA(userId, secret, token) {
  if (!verifyToken(token, secret)) {
    return { success: false, message: 'Invalid verification code' };
  }

  const now = Date.now();
  await dbRun(
    `UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1, updated_at = ? WHERE id = ?`,
    [secret, now, userId]
  );

  return { success: true };
}

/**
 * Disable 2FA for a user
 */
async function disable2FA(userId) {
  const now = Date.now();
  await dbRun(
    `UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0, updated_at = ? WHERE id = ?`,
    [now, userId]
  );
}

module.exports = { generateSecret, generateQRCode, verifyToken, enable2FA, disable2FA };
