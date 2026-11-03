# Peketi Yaswanth | Portfolio & Authentication API

A modern developer portfolio featuring account authentication with Email Multi-Factor Authentication (MFA), Razorpay advance payments, and Elasticsearch & Kibana (ELK) security audit logging.

---

## 🚀 Live Deployments

- **Frontend (GitHub Pages):** `https://yaswanth-peketi.github.io/MY__PORTFOLIO/`
- **Backend API & Web Service (Render):** `https://my-portfolio-zani.onrender.com`
- **API Health Check:** `https://my-portfolio-zani.onrender.com/api/health`

---

## 🏗 Architecture Overview

```
┌──────────────────────────────────────────────┐
│  Frontend (GitHub Pages / Render)            │
│  - Account Authentication (Register / Login) │
│  - Email MFA Verification                    │
│  - Portfolio Showcase (Skills, Projects)     │
│  - Razorpay "Give Advance" Integration       │
└──────────────────────┬───────────────────────┘
                       │ HTTPS REST API
                       ▼
┌──────────────────────────────────────────────┐
│  Backend (Render Web Service / Node.js)      │
│  - Serves static portfolio files & API       │
│  - PostgreSQL: User accounts & challenges    │
│  - Resend: One-time verification email OTP   │
│  - Razorpay: Order creation & verification   │
│  - ELK Stack: Auth & audit logging           │
└──────────────────────────────────────────────┘
```

---

## 🛠 Project Structure

```
MY__PORTFOLIO-master/
├── index.html               # Main portfolio & authentication interface
├── style.css                # Dark-mode portfolio styling
├── script.js                # Frontend authentication & session controller
├── payment.js               # Razorpay payment handler
├── package.json             # Root scripts (start, dev, install)
├── render.yaml              # Render blueprint infrastructure configuration
├── ELK_SETUP_GUIDE.md       # Complete guide for Elasticsearch & Kibana
├── images/
│   └── profile.png          # Portfolio profile picture
├── backend/
│   ├── server.js            # Express API server & static file host
│   ├── package.json         # Backend dependencies & scripts
│   ├── .env                 # Local development environment variables
│   ├── .env.example         # Example environment template
│   ├── elkService.js        # Elasticsearch client & audit logger
│   ├── logger.js            # Pino structured logger
│   ├── test-elk.js          # ELK connection verification script
│   └── Dockerfile           # Backend container definition
└── nginx/
    └── nginx.conf           # Local Docker reverse proxy configuration
```

---

## ⚡ Quick Start (Local Development)

### Option 1: Direct Node.js (Quickest)
1. Install dependencies:
   ```powershell
   npm run install:backend
   ```
2. Start the server:
   ```powershell
   npm start
   ```
3. Open your browser at `http://localhost:3000`. The portfolio and API will be immediately available.

### Option 2: Full Docker Stack (With Postgres & ELK)
1. Start all containers (Postgres, Elasticsearch, Kibana, Backend, Nginx):
   ```powershell
   docker-compose up -d
   ```
2. Open `http://localhost` for the portfolio.
3. Open `http://localhost:5601` for the Kibana dashboard.

---

## 🌐 Deploying to Render

### 1. Web Service Settings
- **Repository:** Connect your GitHub repository (`MY__PORTFOLIO`).
- **Root Directory:** `backend` (or leave blank if building from root).
- **Environment:** `Node`.
- **Build Command:** `npm install`.
- **Start Command:** `npm start`.

### 2. Environment Variables on Render
Configure these in your Render Web Service **Environment** tab:

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | Render PostgreSQL Connection String | `postgresql://...` (Internal URL from Render Postgres) |
| `DATABASE_SSL` | Enable SSL for Render database | `true` |
| `JWT_SECRET` | Secret key for JWT tokens (>= 32 chars) | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Token duration | `1h` |
| `FRONTEND_URL` | GitHub Pages origin | `https://yaswanth-peketi.github.io` |
| `EXTRA_ALLOWED_ORIGINS` | Additional allowed origins for CORS | `https://yaswanth-peketi.github.io,http://localhost:5500,http://127.0.0.1:5500` |
| `RESEND_API_KEY` | Resend API key for email OTP | `re_xxxxxxxxxxxxxxxxx` |
| `RESEND_FROM` | Sender address verified in Resend | `Portfolio Security <onboarding@resend.dev>` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_xxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | `xxxxxxxxxxxxxxxxxxxx` |
| `ELASTICSEARCH_NODE` | (Optional) Managed Elastic / Ngrok URL | `https://your-elastic-deployment.es.us-east-1.aws.elastic.cloud:9243` |
| `ELASTICSEARCH_INDEX` | Index name for audit logs | `portfolio-logs` |

---

## 🔑 Key Features Fixed

1. **Seamless Render Integration:**
   `script.js` and `payment.js` automatically connect to `https://my-portfolio-zani.onrender.com` when running on GitHub Pages or local preview, and switch to relative URLs when running directly under the server.
2. **Unified Static & API Server:**
   Visiting the root URL (`https://my-portfolio-zani.onrender.com/` or `http://localhost:3000/`) now serves the full portfolio instead of returning `Cannot GET /`.
3. **Smart CORS & Safe CSP:**
   Allows requests from GitHub Pages, localhost live-preview tools (e.g. port 5500, 3000, 8080), and `file://` environments without CORS 403 blocks.
4. **Resilient Razorpay & DB Handling:**
   Server starts cleanly and provides helpful status messages even if Razorpay keys or local databases are not yet set up.
