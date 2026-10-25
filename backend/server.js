require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

const requiredEnv = [
  "DATABASE_URL",
  "JWT_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "FRONTEND_URL",
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(
    `Missing required environment variables: ${missingEnv.join(", ")}`,
  );
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters.");
  process.exit(1);
}

const allowedOrigins = new Set([
  process.env.FRONTEND_URL.replace(/\/$/, ""),
  ...(process.env.EXTRA_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
]);

app.use(
  cors({
    origin(origin, callback) {
      // Permit command-line health checks and server-to-server requests without Origin.
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, "")))
        return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
const resend = new Resend(process.env.RESEND_API_KEY);
const otpTtlMinutes = Math.min(
  15,
  Math.max(3, Number(process.env.OTP_TTL_MINUTES || 10)),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Try again in 15 minutes.",
  },
});
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many verification attempts. Please wait before trying again.",
  },
});

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
function createOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}
function hashOtp(otp, salt) {
  return crypto.createHash("sha256").update(`${salt}:${otp}`).digest("hex");
}
function safeEqualHex(a, b) {
  const aa = Buffer.from(a || "", "hex");
  const bb = Buffer.from(b || "", "hex");
  return (
    aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb)
  );
}
function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      issuer: "portfolio-auth-api",
      audience: "portfolio-client",
    },
  );
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match)
    return res.status(401).json({ error: "Authentication required." });
  try {
    req.auth = jwt.verify(match[1], process.env.JWT_SECRET, {
      issuer: "portfolio-auth-api",
      audience: "portfolio-client",
    });
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Session expired or invalid. Please sign in again." });
  }
}
async function sendOtpEmail(email, otp) {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: [email],
    subject: "Your sign-in verification code",
    text: `Your verification code is ${otp}. It expires in ${otpTtlMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2>Verify your sign-in</h2><p>Enter this code to complete signing in:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</p><p>This code expires in ${otpTtlMinutes} minutes. Do not share it with anyone.</p><p>If you did not request this, ignore this email.</p></div>`,
  });
  if (error) {
    console.error("Resend email error:", error.message || error);
    throw new Error(
      "Could not send verification email. Check your Resend sender/domain configuration.",
    );
  }
}
async function issueOtp(user) {
  const otp = createOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(otp, salt);
  const expiresAt = new Date(Date.now() + otpTtlMinutes * 60 * 1000);
  await pool.query(
    `INSERT INTO auth_challenges (user_id, otp_hash, otp_salt, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, $4, 0, NOW())
     ON CONFLICT (user_id) DO UPDATE SET otp_hash = EXCLUDED.otp_hash,
       otp_salt = EXCLUDED.otp_salt, expires_at = EXCLUDED.expires_at,
       attempts = 0, created_at = NOW()`,
    [user.id, otpHash, salt, expiresAt],
  );
  try {
    await sendOtpEmail(user.email, otp);
  } catch (err) {
    await pool.query("DELETE FROM auth_challenges WHERE user_id = $1", [
      user.id,
    ]);
    throw err;
  }
}
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS auth_challenges (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      otp_hash CHAR(64) NOT NULL,
      otp_salt CHAR(32) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

// Create account. Registration does not sign the user in; they must use login + email MFA.
app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = normalizeEmail(req.body.email);
    const password =
      typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 2 || name.length > 80)
      return res.status(400).json({ error: "Name must be 2–80 characters." });
    if (!validEmail(email))
      return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 10 || password.length > 72) {
      return res
        .status(400)
        .json({ error: "Password must be 10–72 characters long." });
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return res
        .status(400)
        .json({
          error: "Password must include at least one letter and one number.",
        });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
        [name, email, passwordHash],
      );
      return res
        .status(201)
        .json({
          message:
            "Account created. Sign in to receive your email verification code.",
          user: result.rows[0],
        });
    } catch (err) {
      if (err.code === "23505")
        return res
          .status(409)
          .json({ error: "An account with this email already exists." });
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// First login step: validate password and send a short-lived email MFA code.
app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password =
      typeof req.body.password === "string" ? req.body.password : "";
    if (!validEmail(email) || !password)
      return res.status(400).json({ error: "Enter your email and password." });
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    // Same response for unknown email and incorrect password.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    await issueOtp(user);
    res.json({
      mfaRequired: true,
      message: "Verification code sent to your email.",
      email: user.email,
      expiresInSeconds: otpTtlMinutes * 60,
    });
  } catch (err) {
    next(err);
  }
});

// Second login step: verify email code, then return a signed bearer token.
app.post("/api/auth/verify-mfa", otpLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = typeof req.body.code === "string" ? req.body.code.trim() : "";
    if (!validEmail(email) || !/^\d{6}$/.test(otp))
      return res
        .status(400)
        .json({ error: "Enter the six-digit code sent to your email." });

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, c.otp_hash, c.otp_salt, c.expires_at, c.attempts
       FROM users u JOIN auth_challenges c ON c.user_id = u.id WHERE u.email = $1`,
      [email],
    );
    const row = result.rows[0];
    if (!row)
      return res
        .status(401)
        .json({
          error:
            "Code is invalid or expired. Sign in again to request a new code.",
        });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await pool.query("DELETE FROM auth_challenges WHERE user_id = $1", [
        row.id,
      ]);
      return res
        .status(401)
        .json({ error: "Code expired. Sign in again to request a new code." });
    }
    if (row.attempts >= 5) {
      await pool.query("DELETE FROM auth_challenges WHERE user_id = $1", [
        row.id,
      ]);
      return res
        .status(429)
        .json({
          error:
            "Too many incorrect codes. Sign in again to request a new code.",
        });
    }
    const matches = safeEqualHex(hashOtp(otp, row.otp_salt), row.otp_hash);
    if (!matches) {
      await pool.query(
        "UPDATE auth_challenges SET attempts = attempts + 1 WHERE user_id = $1",
        [row.id],
      );
      return res.status(401).json({ error: "Incorrect verification code." });
    }
    await pool.query("DELETE FROM auth_challenges WHERE user_id = $1", [
      row.id,
    ]);
    const token = signToken(row);
    res.json({
      message: "Sign-in successful.",
      token,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      user: { id: row.id, name: row.name, email: row.email },
    });
  } catch (err) {
    next(err);
  }
});

const Razorpay = require("razorpay");

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error("Razorpay environment variables are required.");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Example: ₹500. Change this amount on the server.
// Amount is specified in paise: ₹500 = 50000 paise.
const PAYMENT_AMOUNT_PAISE = 50000;

// Create an order.
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: PAYMENT_AMOUNT_PAISE,
      currency: "INR",
      receipt: `mp_${crypto.randomBytes(8).toString("hex")}`,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error.message);

    res.status(502).json({
      error: "Could not create a payment order.",
    });
  }
});

// Verify the payment signature on the server.
app.post("/api/payment/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body || {};

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      return res.status(400).json({
        verified: false,
        error: "Missing payment verification details.",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(razorpay_signature, "hex");

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      return res.status(400).json({
        verified: false,
        error: "Invalid payment signature.",
      });
    }

    // Confirm the payment belongs to the specified order.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== "captured" ||
      payment.amount !== PAYMENT_AMOUNT_PAISE ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment is not captured or does not match the order.",
      });
    }

    return res.json({
      verified: true,
      paymentId: payment.id,
      orderId: razorpay_order_id,
      status: payment.status,
    });
  } catch (error) {
    console.error("Payment verification failed:", error.message);

    return res.status(502).json({
      verified: false,
      error: "Unable to verify payment right now.",
    });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [req.auth.sub],
    );
    if (!result.rows[0])
      return res.status(404).json({ error: "User not found." });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Stateless JWT logout: client must discard its token. A token remains valid until expiry.
app.post("/api/auth/logout", requireAuth, (_req, res) => {
  res.json({ message: "Logged out. Remove the token from client storage." });
});

app.use((err, _req, res, _next) => {
  console.error(err.stack || err);
  if (err.message === "Origin is not allowed by CORS.")
    return res.status(403).json({ error: err.message });
  res.status(500).json({ error: err.message || "Internal server error." });
});

const port = Number(process.env.PORT || 3000);
initDb()
  .then(() => {
    app.listen(port, "0.0.0.0", () =>
      console.log(`Auth API listening on port ${port}`),
    );
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
