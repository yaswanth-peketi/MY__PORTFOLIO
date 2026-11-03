# 🚀 ELK (Elasticsearch & Kibana) Integration Guide for Portfolio

This guide explains how your portfolio backend (running on **Render**) sends login and authentication events to **Elasticsearch**, and how to view them live in **Kibana**.

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────┐
│  Frontend (GitHub Pages)        │
│  User logs in with Email + MFA  │
└────────────────┬────────────────┘
                 │ HTTPS (POST /api/auth/verify-mfa)
                 ▼
┌─────────────────────────────────┐
│  Backend (Render Web Service)   │
│  - Verifies credentials & MFA   │
│  - Signs JWT token              │
│  - elkService.js logs event     │
└────────────────┬────────────────┘
                 │ Elasticsearch API (JSON Document)
                 ▼
┌─────────────────────────────────┐
│  Elasticsearch                  │
│  - Index: portfolio-logs        │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Kibana Dashboard               │
│  - View live user logins        │
│  - Filter by email / IP / time  │
└─────────────────────────────────┘
```

---

## 📦 What Was Added to Your Project

1. **`backend/elkService.js`**:
   - Official Elasticsearch client (`@elastic/elasticsearch`).
   - Automatically buffers and indexes structured login audit logs (`user_login_success`, `user_login_failed`, `user_login_otp_sent`, `user_logout`).
   - Graceful fallback: If Elasticsearch is down or unreachable, the login flow never breaks for the user.

2. **`backend/server.js` Updates**:
   - Added ELK event logging to `/api/auth/login`, `/api/auth/verify-mfa`, `/api/auth/register`, and `/api/auth/logout`.
   - Updated `/api/health` to report Elasticsearch connectivity status.
   - Added diagnostic endpoint `POST /api/elk/test-log` to test ELK shipping immediately.

3. **`docker-compose.yml`**:
   - Pre-configured single-node **Elasticsearch 8.17.0** and **Kibana 8.17.0** (with memory limits suitable for laptops).
   - Optional **Logstash** pipeline in `elk/logstash/pipeline/logstash.conf`.

4. **`backend/test-elk.js`**:
   - Run `npm run test:elk` to ping Elasticsearch, send a test login event, and verify retrieval.

---

## 🛠 Profile 1: Local ELK Stack (Docker Compose)

### 1. Start the ELK Containers
Open PowerShell in `MY__PORTFOLIO-master`:
```powershell
docker-compose up -d
```
Verify the containers are running:
```powershell
docker ps
```
- Elasticsearch: `http://localhost:9200`
- Kibana: `http://localhost:5601`

### 2. Verify Elasticsearch Connection
In PowerShell, navigate to `backend` and run:
```powershell
npm run test:elk
```
You should see:
```text
[SUCCESS] Elasticsearch is UP and reachable!
[SUCCESS] Document indexed!
```

---

## 🌐 Connecting Render (Cloud) to your ELK Stack

Because your backend is hosted in **Render** and the frontend is on **GitHub**, Render needs a public URL to reach your Elasticsearch cluster. Choose one of the two options below:

### Option A: Using Elastic Cloud (Recommended for Production)
1. Sign up for [Elastic Cloud (14-day free trial)](https://cloud.elastic.co/) or create a free managed Elasticsearch instance (e.g. Bonsai).
2. Create a deployment and copy:
   - **Elasticsearch Endpoint URL** (or Cloud ID)
   - **API Key** or **Username (`elastic`) & Password**
3. In your **Render Dashboard**:
   - Navigate to your Web Service -> **Environment**.
   - Add the following environment variables:
     ```env
     ELASTICSEARCH_NODE=https://your-deployment-name.es.us-east-1.aws.elastic.cloud:9243
     ELASTICSEARCH_API_KEY=your_api_key_here
     ELASTICSEARCH_INDEX=portfolio-logs
     ```
   - Render will automatically redeploy with the new settings.

### Option B: Expose Local ELK to Render using Cloudflare Tunnel (100% Free)
If you want to use the local Docker ELK stack on your computer with your live Render backend:
1. Double-click `start-tunnel.bat` or run:
   ```powershell
   npm run tunnel
   ```
   *(or if running the full Docker stack: `docker logs portfolio-cloudflared`)*
2. Cloudflare will give you a free, public HTTPS URL like:
   `https://random-words.trycloudflare.com`
3. In your **Render Dashboard** -> **Environment**, set:
   ```env
   ELASTICSEARCH_NODE=https://random-words.trycloudflare.com
   ELASTICSEARCH_INDEX=portfolio-logs
   ```
4. Now, any sign-in from your GitHub frontend will hit Render, and Render will send the audit log through Cloudflare's secure edge directly into your local Kibana!

---

## 📊 How to View Logins in Kibana

### 1. Create a Data View (Index Pattern)
1. Open your browser and go to Kibana:
   - Local: `http://localhost:5601`
   - Or your Elastic Cloud Kibana URL.
2. In the left navigation menu, go to **Management** -> **Stack Management**.
3. Under **Kibana**, click **Data Views** (in older versions: *Index Patterns*).
4. Click **Create data view**.
5. Configure:
   - **Name**: `Portfolio Logs`
   - **Index pattern**: `portfolio-logs*`
   - **Timestamp field**: `@timestamp`
6. Click **Save data view to Kibana**.

### 2. View Live Logins in Discover
1. Click the menu icon (top left) -> **Analytics** -> **Discover**.
2. Select the `Portfolio Logs` data view from the dropdown.
3. Every time someone logs in on your portfolio, a new document appears!
4. Expand the document to see:
   ```json
   {
     "@timestamp": "2026-11-02T16:45:00.000Z",
     "service": "portfolio-backend",
     "type": "auth_audit",
     "event": "user_login_success",
     "status": "success",
     "message": "User yaswanth@example.com successfully logged in",
     "user": {
       "id": "1",
       "name": "Yaswanth",
       "email": "yaswanth@example.com"
     },
     "client": {
       "ip": "203.0.113.195",
       "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
     },
     "details": {
       "authMethod": "email_mfa"
     }
   }
   ```

### 3. Filter by Login Events
In the Kibana search bar:
- Show all successful logins:
  `event.keyword : "user_login_success"`
- Show failed login attempts:
  `event.keyword : "user_login_failed"`
- Show logins for a specific user:
  `user.email.keyword : "yaswanth@example.com"`

---

## 🧪 Quick Test Without Waiting for MFA Email

If you want to immediately see a login log appear in Kibana:
Send a request to your backend's diagnostic endpoint using curl or Postman:

```bash
curl -X POST https://YOUR-RENDER-SERVICE.onrender.com/api/elk/test-log \
  -H "Content-Type: application/json" \
  -d '{"email": "mytest@example.com", "name": "Test User"}'
```
Or for local backend:
```bash
curl -X POST http://localhost:3000/api/elk/test-log \
  -H "Content-Type: application/json" \
  -d '{"email": "mytest@example.com", "name": "Test User"}'
```
The document will instantly show up in Kibana!
