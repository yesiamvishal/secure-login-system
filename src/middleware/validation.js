const { body, validationResult } = require('express-validator');

/**
 * Extract validation errors and return formatted messages
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => e.msg);
    return res.status(400).json({ success: false, errors: messages });
  }
  next();
}

/**
 * Registration validation rules
 */
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers, and underscores')
    .escape(),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email is too long'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  handleValidationErrors,
];

/**
 * Login validation rules
 */
const validateLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required')
    .isLength({ max: 255 })
    .withMessage('Input too long')
    .escape(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password too long'),

  handleValidationErrors,
];

/**
 * 2FA token validation
 */
const validate2FAToken = [
  body('token')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('2FA token must be exactly 6 digits'),

  handleValidationErrors,
];

/**
 * Authentication check middleware — redirects to login if not authenticated
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

/**
 * Redirect to dashboard if already logged in
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validate2FAToken,
  requireAuth,
  redirectIfAuthenticated,
};
