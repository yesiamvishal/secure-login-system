# 🔐 Secure Login System

A production-ready, security-hardened authentication system built with Node.js, Express, and SQLite. Features a sleek dark glassmorphism UI on a crisp white background.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

### 🛡️ Security
| Feature | Implementation |
|---|---|
| Password Hashing | bcrypt (12 rounds) |
| SQL Injection Protection | Parameterized queries (sqlite3) |
| Session Management | express-session + SQLite store |
| Rate Limiting | express-rate-limit (20 auth attempts / 15 min) |
| Account Lockout | After 5 failed attempts (15 min lockout) |
| Security Headers | Helmet.js (CSP, HSTS, X-Frame-Options, etc.) |
| Cookie Security | HttpOnly, SameSite=Strict, Secure (prod) |
| Session Fixation | Session regenerated on every login |
| Input Validation | express-validator (whitelist, type-check, escape) |
| Audit Logging | Every auth event logged with IP + User-Agent |
| 2FA (Optional) | TOTP via `otplib` — Google Authenticator / Authy |

### 🎨 UI/UX
- White background with a stunning **dark glassmorphism** login card
- Password strength meter on registration
- Real-time form validation feedback
- 2FA QR code setup flow in-dashboard
- Responsive — works on mobile

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/secure-login-system.git
cd secure-login-system

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# ⚠️  Edit .env and set a strong SESSION_SECRET

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000)

For development with auto-reload:
```bash
npm run dev
```

---

## ⚙️ Configuration

Edit `.env` (never commit this file):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `production` enables secure cookies |
| `SESSION_SECRET` | *(required)* | Long random string for session signing |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor (10–14 recommended) |
| `MAX_LOGIN_ATTEMPTS` | `5` | Attempts before account lockout |
| `LOCKOUT_DURATION_MINUTES` | `15` | Minutes to lock account after threshold |
| `DB_PATH` | `./database.sqlite` | Path to SQLite database file |

---

## 📁 Project Structure

```
secure-login-system/
├── server.js              # App entry point, middleware, startup
├── .env.example           # Environment variable template
├── src/
│   ├── routes/
│   │   └── auth.js        # All auth routes (register, login, 2FA, logout)
│   ├── middleware/
│   │   └── validation.js  # Input validation rules, auth guards
│   └── utils/
│       ├── auth.js        # bcrypt, user CRUD, lockout logic
│       ├── database.js    # SQLite init, promisified helpers
│       └── twoFactor.js   # TOTP secret, QR code, verify
├── views/
│   ├── login.html         # Login + 2FA verification page
│   ├── register.html      # Registration with password strength meter
│   ├── dashboard.html     # Post-login dashboard
│   └── 404.html           # Not found page
└── public/
    ├── css/
    │   ├── auth.css        # Glassmorphism card, form, button styles
    │   └── dashboard.css  # Sidebar, stats grid, dashboard layout
    └── js/
        ├── auth.js         # Shared utilities (alerts, loading, toggle)
        └── dashboard.js   # 2FA setup flow, user load, logout
```

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/register` | No | Create a new account |
| `POST` | `/api/login` | No | Authenticate with password |
| `POST` | `/api/verify-2fa` | Pending | Complete 2FA step |
| `GET` | `/api/user` | Yes | Get current user info |
| `POST` | `/api/2fa/setup` | Yes | Generate 2FA secret + QR |
| `POST` | `/api/2fa/enable` | Yes | Confirm & enable 2FA |
| `POST` | `/api/2fa/disable` | Yes | Disable 2FA |
| `POST` | `/api/logout` | Yes | Destroy session |

---

## 🏭 Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a **long random SESSION_SECRET** (e.g., `openssl rand -hex 64`)
3. Put the app behind a reverse proxy (nginx/Caddy) with HTTPS
4. Cookies automatically switch to `Secure: true` in production
5. Consider increasing `BCRYPT_ROUNDS` to 13–14 for slower machines

### Nginx example

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🔒 Security Decisions Explained

**Why bcrypt and not Argon2?** Both are secure. `bcryptjs` is pure JS (zero native deps), making it easier to deploy on any platform. Swap to `argon2` if you prefer.

**Why SQLite?** Perfect for single-server deployments, demos, and portfolios. Swap the `dbRun/dbGet` helpers in `database.js` for `pg` or `mysql2` for Postgres/MySQL.

**Why sessions over JWTs?** Sessions can be invalidated server-side (logout actually works). JWTs require a token blacklist to truly revoke access.

**User enumeration prevention:** Failed logins always return "Invalid credentials" regardless of whether the user exists, and include a random 500–700ms delay.

---

## 📜 License

MIT — use freely, contribute back ❤️
