# Peketi Yaswanth | Portfolio & Security Audit System

A modern full-stack developer portfolio featuring account authentication with email verification, Razorpay advance payments, and a unified Docker architecture combining PostgreSQL and the **ELK Stack (Elasticsearch & Kibana)**.

---

## 🚀 Live Deployments

- **Frontend (GitHub Pages):** `https://yaswanth-peketi.github.io/MY__PORTFOLIO/`
- **Backend API & Web Service (Render):** `https://my-portfolio-zani.onrender.com`
- **API Health Check:** `https://my-portfolio-zani.onrender.com/api/health`

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (GitHub Pages / Local Nginx)                      │
│  - Modern Dark-Theme Portfolio                              │
│  - User Sign-In & Email Verification Code                   │
│  - Razorpay Project Advance Checkout                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS REST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (Render Cloud / Docker Node.js)                    │
│  - Express REST API & Static Portfolio Server               │
│  - PostgreSQL Database: Persistent Users & Challenges       │
│  - Resend: Email OTP Code Dispatcher                        │
│  - Razorpay API: Payment Orders & HMAC Verification         │
│  - elkService.js: Structured Security Audit Pipeline        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Internal JSON Document Stream
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  ELK Security & Audit Stack (Docker)                        │
│  - Elasticsearch (Port 9200): Search & Analytics Database   │
│  - Kibana (Port 5601): Live Security Operations Dashboard   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Project Structure

```
MY__PORTFOLIO-master/
├── index.html               # Main portfolio & sign-in interface
├── style.css                # Dark-mode styling, animations, and responsive layout
├── script.js                # Frontend authentication controller
├── payment.js               # Razorpay checkout handler
├── docker-compose.yml       # Combines all 5 services: Postgres, ES, Kibana, Node, Nginx
├── package.json             # Root npm scripts (docker:up, start, dev, test:elk)
├── render.yaml              # Render blueprint infrastructure configuration
├── README.md                # Main project documentation
├── images/
│   └── profile.png          # Portfolio profile picture
├── backend/
│   ├── server.js            # Express API server & static host
│   ├── elkService.js        # Elasticsearch client & audit logger
│   ├── logger.js            # Pino structured JSON logger
│   ├── test-elk.js          # ELK connection verification script
│   ├── Dockerfile           # Backend container image definition
│   ├── package.json         # Backend dependencies
│   ├── .env                 # Local development environment variables
│   └── .env.example         # Template for environment variables
└── nginx/
    └── nginx.conf           # Local Nginx reverse proxy configuration
```

---

## 🐳 Quick Start with Docker (Combines All Services)

To run the complete system locally (Database, Elasticsearch, Kibana, Backend API, and Frontend):

### 1. Start All Services
```powershell
docker-compose up -d
```

Docker will automatically build and start all 5 containers:
- 🌐 **Portfolio Website (Nginx):** [http://localhost](http://localhost)
- 📊 **Kibana Dashboard:** [http://localhost:5601](http://localhost:5601)
- ⚡ **Backend API:** [http://localhost:3000](http://localhost:3000)
- 🔍 **Elasticsearch API:** [http://localhost:9200](http://localhost:9200)
- 🗄️ **PostgreSQL:** `localhost:5432`

### 2. Verify ELK Pipeline
Run the included test script to verify Elasticsearch indexing:
```powershell
npm run test:elk
```

### 3. View Audit Logs in Kibana
1. Open [http://localhost:5601](http://localhost:5601) in your browser.
2. Go to **Management** $\rightarrow$ **Data Views** $\rightarrow$ **Create data view**:
   - **Name:** `Portfolio Logs`
   - **Index pattern:** `portfolio-logs*`
   - **Timestamp field:** `@timestamp`
3. Go to **Analytics** $\rightarrow$ **Discover** to monitor sign-ins, IP addresses, and user activity live!

### 4. Stop All Services
```powershell
docker-compose down
```

---

## 🌐 Deploying on Render

### 1. Web Service Configuration
- **Root Directory:** `backend` (or leave blank; root `package.json` auto-delegates)
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

### 2. Required Environment Variables on Render

| Key | Description | Example / Recommended Value |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | Render PostgreSQL Connection String | `postgresql://...` (Internal URL from Render Postgres) |
| `DATABASE_SSL` | Enable SSL for Render database | `true` |
| `JWT_SECRET` | Secret key for JWT tokens (>= 32 chars) | Random 32+ character string |
| `JWT_EXPIRES_IN` | Token duration | `1h` |
| `FRONTEND_URL` | Production frontend origin | `https://yaswanth-peketi.github.io` |
| `EXTRA_ALLOWED_ORIGINS` | Extra allowed CORS origins | `https://yaswanth-peketi.github.io,http://localhost:5500,http://127.0.0.1:5500` |
| `RESEND_API_KEY` | Resend API key for email verification | `re_xxxxxxxxxxxxxxxxx` |
| `RESEND_FROM` | Sender address verified in Resend | `Portfolio Security <onboarding@resend.dev>` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_xxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | `xxxxxxxxxxxxxxxxxxxx` |
