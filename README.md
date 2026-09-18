# Node.js & Express REST API - MongoDB, Nodemailer Email, 5GB Streaming, JWT Auth & RBAC

A production-ready Node.js REST API with ES Modules, **MongoDB Atlas (Mongoose)** database, **Nodemailer Email Service (Registration Welcome Emails & Password Reset)**, **5GB+ Streaming & Resumable Downloads**, JWT Authentication, Role-Based Access Control (RBAC), and Winston structured logging.

---

## 📁 Project Architecture

```
d:\Manish\Node\
├── storage/                      # Storage directory for multi-gigabyte files (git-ignored)
├── logs/                         # Winston log files
│   ├── combined.log              # All application logs (JSON format)
│   └── error.log                 # Error logs with stack traces
├── src/
│   ├── app.js                    # Express app configuration & Morgan->Winston pipe
│   ├── server.js                 # HTTP server entry point & MongoDB initialization
│   ├── config/
│   │   ├── database.js           # Mongoose MongoDB connection & event monitoring
│   │   └── env.js                # Centralized environment variable loader (DB, JWT, Email)
│   ├── models/
│   │   └── user.model.js         # Mongoose User Schema (validation, indexes & transforms)
│   ├── controllers/
│   │   ├── auth.controller.js    # Register, login, forgot/reset password, profile
│   │   ├── file.controller.js    # 5GB Streaming export, Range download & upload
│   │   ├── health.controller.js  # System & Database health check
│   │   └── user.controller.js    # User resource controller
│   ├── middlewares/
│   │   ├── auth.middleware.js    # JWT Bearer token authentication
│   │   ├── role.middleware.js    # RBAC role verification
│   │   ├── rateLimiter.js        # IP Rate limiters (General API & Strict Auth)
│   │   ├── errorHandler.js       # Centralized error handler using Winston
│   │   └── notFound.js           # 404 Route Not Found handler
│   ├── routes/
│   │   ├── index.js              # Master API router (/api)
│   │   ├── auth.routes.js        # /api/auth routes
│   │   ├── file.routes.js        # /api/files streaming & download routes
│   │   ├── health.routes.js      # /api/health routes
│   │   └── user.routes.js        # /api/users routes (Protected by RBAC)
│   ├── services/
│   │   ├── auth.service.js       # Auth logic (hashing, tokens, email triggers)
│   │   ├── email.service.js      # Nodemailer SMTP email service (welcome & reset emails)
│   │   ├── stream.service.js     # Large data stream generator & HTTP Range handler
│   │   └── user.service.js       # Mongoose User database queries & pagination
│   └── utils/
│       ├── emailTemplates.js     # Responsive HTML email templates
│       ├── fileSecurity.js       # Path traversal prevention & byte formatters
│       ├── logger.js             # Winston logger (Console + File transports)
│       └── token.js              # JWT sign/verify, crypto token generator & bcrypt helpers
├── .env                          # Local environment variables
├── .env.example                  # Environment template
├── .gitignore                    # Ignored files
├── package.json                  # Dependencies & scripts
└── README.md                     # Documentation
```

---

## 📧 Email Service Configuration (Nodemailer)

The application includes an automated email dispatch system using `nodemailer`.

### 1. SMTP Setup in `.env`
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM="Node API Support <noreply@nodeapi.com>"
```

> **Note on Gmail**: When using Gmail, generate an **App Password** from your Google Account (Security -> 2-Step Verification -> App passwords) and paste it into `EMAIL_PASS`.

> **Development Mode**: If real SMTP credentials are not yet entered, the service runs in **simulation mode**, cleanly logging preview emails to the Winston log without throwing errors or interrupting user registrations.

---

## 🛡️ Rate Limiting Protection (`express-rate-limit`)

The API implements dual-tier rate limiting to prevent abuse, DoS attacks, and brute-force authentication attempts:

| Limiter | Scope | Default Limit | Purpose |
| :--- | :--- | :--- | :--- |
| **`apiLimiter`** | `/api/*` | 100 req / 15 min | General endpoint abuse protection |
| **`authLimiter`** | `/api/auth/*` | 10 req / 15 min | Strict brute-force attack prevention |

### Configuration (`.env`)
```env
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes in milliseconds
RATE_LIMIT_MAX=100           # Max general API requests per window
AUTH_RATE_LIMIT_MAX=10       # Max authentication requests per window
```

When exceeded, the server returns HTTP `429 Too Many Requests`:
```json
{
  "success": false,
  "message": "Too many authentication attempts from this IP. Please try again after 15 minutes.",
  "retryAfterMinutes": 15
}
```

---

## 🔴 Redis High-Performance Caching (`ioredis`)

The API integrates Redis for route response caching, accelerating repeated read requests (`GET /api/users`, `GET /api/users/:id`, `GET /api/auth/profile`) and reducing database queries.

### Key Capabilities:
- **Resilient Connection**: Non-blocking client with automatic reconnect. If Redis is unavailable or offline, the API **gracefully falls back to direct MongoDB queries** without failing.
- **Cache Headers**: Returns `X-Cache: HIT` for cached responses and `X-Cache: MISS` on first fetch.
- **Auto-Invalidation**: Automatically purges stale cache keys on user registration or password update via pattern matching (`cache:*users*`).

### Configuration (`.env`)
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=300       # Cache time-to-live in seconds (5 minutes)
REDIS_ENABLED=true  # Set to false to disable Redis
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Server
- **Development Mode** (with auto-reload):
  ```bash
  npm run dev
  ```
- **Standard Mode**:
  ```bash
  npm start
  ```

---

## 📡 API Endpoints Summary

### 🔐 Authentication & Email Automation
| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Public | Registers user in MongoDB and dispatches a **Welcome Email** (returns `accessToken` + `refreshToken`) |
| `/api/auth/login` | `POST` | Public | Login with credentials, returns `accessToken` & `refreshToken` |
| `/api/auth/refresh-token` | `POST` | Public | Exchange `refreshToken` for a new `accessToken` and rotated `refreshToken` |
| `/api/auth/logout` | `POST` | Public / Authenticated | Invalidate stored `refreshToken` |
| `/api/auth/forgot-password` | `POST` | Public | Generates reset token and dispatches **Password Reset Email** |
| `/api/auth/reset-password` | `POST` | Public | Update password in MongoDB using token |
| `/api/auth/profile` | `GET` | Authenticated | Retrieve authenticated user from MongoDB |
| `/api/users` | `GET` | `Admin`, `Manager`, `Developer` | Paginated MongoDB user query |
| `/api/users/:id` | `GET` | Authenticated | Retrieve user by MongoDB ObjectId |
| `/api/product-users/upload-excel` | `POST` | Public / Admin | Bulk import users & product associations via `.xlsx`, `.xls`, `.csv` |
| `/api/product-users/sample-template` | `GET` | Public | Download pre-formatted sample Excel import template |

### 📊 Excel Bulk Product-User Import
Upload `.xlsx` / `.xls` / `.csv` spreadsheets with the following columns:
- **`Email`** *(Required)*: Unique valid email address.
- **`Role`** *(Optional)*: `User`, `Developer`, `Manager`, or `Admin` (default: `User`).
- **`Name`** *(Optional)*: User full name (fallback to email prefix).
- **`Department`** *(Optional)*: Department name (default: `General`).
- **`Product`** *(Optional)*: Associated product or project name.
- **`Password`** *(Optional)*: Plaintext password to hash (default: `Welcome@123`).

---

### ⚡ 5GB Streaming & File Download
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/files/stream-export` | `GET` | Stream dynamic CSV/JSON export on the fly |
| `/api/files/download/:filename` | `GET` | Resumable download supporting `HTTP 206 Range` |
| `/api/files/generate` | `POST` | Generate test file of arbitrary size in storage |
| `/api/files/upload` | `POST` | Stream upload straight to disk with `pipeline` |
| `/api/files` | `GET` | List files stored on disk |
