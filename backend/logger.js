const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "otp",
      "token",
      "req.body.password",
      "req.body.code",
      "req.body.razorpay_signature",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
