# Portfolio Authentication + Email MFA Backend

This folder adds a Node.js/Express backend to the existing static portfolio. It uses Render PostgreSQL for users, Resend for email one-time codes, bcrypt for password hashing, and JWT bearer tokens after MFA.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API and database health |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Validate password and send MFA code |
| POST | `/api/auth/verify-mfa` | Verify the six-digit code and return a JWT |
| GET | `/api/auth/me` | Return the signed-in user's profile |
| POST | `/api/auth/logout` | Logout acknowledgement; client must discard its token |

### Request examples

Register:
```json
{ "name": "Ravi", "email": "ravi@example.com", "password": "StrongPass123" }
```

Login:
```json
{ "email": "ravi@example.com", "password": "StrongPass123" }
```

Verify MFA:
```json
{ "email": "ravi@example.com", "code": "123456" }
```

Use the actual code delivered by Resend, not the example code.

## Deploy on Render

1. Push this whole portfolio repository to GitHub, including the `backend` folder.
2. In Render, create a **PostgreSQL** database. Wait until it is available.
3. Create a **Web Service** from the same GitHub repository.
4. Set **Root Directory** to `backend`.
5. Set **Runtime** to Node.
6. Set **Build Command** to `npm install`.
7. Set **Start Command** to `npm start`.
8. In the web service's Environment settings, add:
   - `DATABASE_URL`: Render PostgreSQL **Internal Database URL** (best when the web service and database are both on Render).
   - `DATABASE_SSL`: `true`
   - `JWT_SECRET`: a long random secret, at least 32 characters.
   - `RESEND_API_KEY`: your Resend API key.
   - `RESEND_FROM`: a sender address/domain verified in Resend, e.g. `Portfolio Security <security@yourdomain.com>`.
   - `FRONTEND_URL`: your exact GitHub Pages origin, e.g. `https://YOUR_USERNAME.github.io` or `https://YOUR_USERNAME.github.io/MY__PORTFOLIO/` is **not** the origin; the origin is only scheme + host, so use `https://YOUR_USERNAME.github.io`.
   - `NODE_ENV`: `production`
   - Optional: `JWT_EXPIRES_IN` (`1h` default), `OTP_TTL_MINUTES` (`10` default), `EXTRA_ALLOWED_ORIGINS` (comma-separated origins).
9. Deploy. Visit `https://YOUR-RENDER-SERVICE.onrender.com/api/health`. Expected result: `{"status":"ok","database":"connected"}`.
10. Do not commit `.env` or actual secrets to GitHub. `.env.example` contains placeholders only.

## Resend notes

- Verify a domain/sender in Resend and use it in `RESEND_FROM`.
- Resend's testing/sandbox restrictions may limit recipients. For production use, verify a domain and confirm the account's sending limits.
- Email MFA codes expire after 10 minutes by default and are stored as salted hashes, not plaintext.
- If email sending fails, check the Render logs and Resend sender/domain configuration.

## Connect your existing frontend

The portfolio currently contains only `index.html`, `style.css`, and an empty `script.js`; it does not currently have login/register/MFA forms. This backend is API-ready, but it will not add a visible login UI by itself.

From frontend JavaScript, call the deployed API like this:
```js
const API_BASE = "https://YOUR-RENDER-SERVICE.onrender.com";

const response = await fetch(`${API_BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});
const data = await response.json();
if (!response.ok) throw new Error(data.error || "Login failed");
// data.mfaRequired === true: show a six-digit code form.
```

Then submit the code:
```js
const response = await fetch(`${API_BASE}/api/auth/verify-mfa`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, code })
});
const data = await response.json();
if (!response.ok) throw new Error(data.error || "MFA verification failed");
// Keep data.token in memory where practical; send it as Authorization: Bearer <token>.
```

Register:
```js
await fetch(`${API_BASE}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, password })
});
```

## Security notes

- Never place `RESEND_API_KEY`, `DATABASE_URL`, or `JWT_SECRET` in browser JavaScript.
- Prefer keeping JWTs in memory. `localStorage` is convenient but exposed if the site has an XSS vulnerability.
- This implementation uses short-lived stateless JWTs; logout requires the frontend to discard the token, and already-issued tokens remain valid until expiry. Use short token lifetimes.
- For a public production application, add account recovery, email verification at registration, monitoring, and a stronger abuse-prevention strategy before relying on it for sensitive accounts.
