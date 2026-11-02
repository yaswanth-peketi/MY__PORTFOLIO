const { Client } = require("@elastic/elasticsearch");
const logger = require("./logger");

const esNode = process.env.ELASTICSEARCH_NODE;
const esCloudId = process.env.ELASTIC_CLOUD_ID;
const esApiKey = process.env.ELASTICSEARCH_API_KEY;
const esUsername = process.env.ELASTICSEARCH_USERNAME;
const esPassword = process.env.ELASTICSEARCH_PASSWORD;
const esIndex = process.env.ELASTICSEARCH_INDEX || "portfolio-logs";

let esClient = null;

if (esCloudId || esNode) {
  try {
    const clientOptions = {
      maxRetries: 3,
      requestTimeout: 10000,
      headers: {
        accept: "application/vnd.elasticsearch+json; compatible-with=8",
        "content-type": "application/vnd.elasticsearch+json; compatible-with=8",
      },
    };

    if (esCloudId) {
      clientOptions.cloud = { id: esCloudId };
    } else if (esNode) {
      clientOptions.node = esNode;
    }

    if (esApiKey) {
      clientOptions.auth = { apiKey: esApiKey };
    } else if (esUsername && esPassword) {
      clientOptions.auth = {
        username: esUsername,
        password: esPassword,
      };
    }

    if (process.env.ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED === "false") {
      clientOptions.tls = { rejectUnauthorized: false };
    }

    esClient = new Client(clientOptions);

    // Verify cluster connectivity asynchronously
    esClient
      .ping()
      .then(() => {
        logger.info(
          { index: esIndex, target: esCloudId ? "Elastic Cloud" : esNode },
          "Elasticsearch connection verified successfully",
        );
      })
      .catch((err) => {
        logger.warn(
          { error: err.message, target: esCloudId ? "Elastic Cloud" : esNode },
          "Elasticsearch ping failed; will retry when shipping logs.",
        );
      });
  } catch (err) {
    logger.error(
      { error: err.message },
      "Failed to initialize Elasticsearch client",
    );
  }
} else {
  logger.warn(
    "ELASTICSEARCH_NODE or ELASTIC_CLOUD_ID is not configured. Logs will be recorded locally only.",
  );
}

/**
 * Extract client IP and User Agent safely from Express request.
 */
function getClientMeta(req) {
  if (!req) return {};
  const forwarded = req.headers ? req.headers["x-forwarded-for"] : null;
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : req.socket?.remoteAddress || req.ip || "unknown";
  const userAgent = req.headers ? req.headers["user-agent"] : "unknown";
  const referer = req.headers ? req.headers["referer"] : undefined;
  return { ip, userAgent, referer };
}

/**
 * Ship a structured log event to Elasticsearch and Pino logger.
 */
async function logToElk({
  event,
  type = "auth_event",
  status = "info",
  message,
  user = null,
  req = null,
  details = {},
}) {
  const clientMeta = getClientMeta(req);
  const logDoc = {
    "@timestamp": new Date().toISOString(),
    service: "portfolio-backend",
    environment: process.env.NODE_ENV || "development",
    type,
    event,
    status,
    message: message || `Event: ${event}`,
    user: user
      ? {
          id: user.id !== undefined ? String(user.id) : undefined,
          email: user.email || undefined,
          name: user.name || undefined,
        }
      : undefined,
    client: clientMeta,
    details,
  };

  // 1. Log to local logger / Render console
  if (status === "failure" || status === "error") {
    logger.warn(logDoc, `[ELK] ${logDoc.message}`);
  } else {
    logger.info(logDoc, `[ELK] ${logDoc.message}`);
  }

  // 2. Index to Elasticsearch if client is initialized
  if (esClient) {
    try {
      await esClient.index({
        index: esIndex,
        document: logDoc,
      });
    } catch (err) {
      // Graceful fallback: never crash or block authentication if Elasticsearch is down
      logger.warn(
        { error: err.message, event },
        "Failed to ship log document to Elasticsearch",
      );
    }
  }

  return logDoc;
}

module.exports = {
  getEsClient: () => esClient,
  logToElk,
  getClientMeta,
};
