require("dotenv").config();
const { Client } = require("@elastic/elasticsearch");

const esNode = process.env.ELASTICSEARCH_NODE || "http://localhost:9200";
const esCloudId = process.env.ELASTIC_CLOUD_ID;
const esApiKey = process.env.ELASTICSEARCH_API_KEY;
const esUsername = process.env.ELASTICSEARCH_USERNAME;
const esPassword = process.env.ELASTICSEARCH_PASSWORD;
const esIndex = process.env.ELASTICSEARCH_INDEX || "portfolio-logs";

console.log("\n========================================================");
console.log("   PORTFOLIO ELK (Elasticsearch + Kibana) TEST RUNNER   ");
console.log("========================================================\n");

async function run() {
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
    console.log(`Connecting via Elastic Cloud ID...`);
  } else {
    clientOptions.node = esNode;
    console.log(`Connecting to Elasticsearch Node: ${esNode}`);
  }

  if (esApiKey) {
    clientOptions.auth = { apiKey: esApiKey };
  } else if (esUsername && esPassword) {
    clientOptions.auth = { username: esUsername, password: esPassword };
  }

  if (process.env.ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED === "false") {
    clientOptions.tls = { rejectUnauthorized: false };
  }

  const client = new Client(clientOptions);

  try {
    console.log("1. Pinging Elasticsearch...");
    await client.ping();
    console.log("   --> [SUCCESS] Elasticsearch is UP and reachable!\n");

    const sampleDoc = {
      "@timestamp": new Date().toISOString(),
      service: "portfolio-backend",
      environment: process.env.NODE_ENV || "development",
      type: "auth_audit",
      event: "user_login_success",
      status: "success",
      message: "User test.yaswanth@portfolio.dev successfully logged in via MFA",
      user: {
        id: "1",
        name: "Yaswanth",
        email: "test.yaswanth@portfolio.dev",
      },
      client: {
        ip: "127.0.0.1",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      },
      details: {
        authMethod: "email_mfa",
        verificationDurationMs: 420,
        flow: "portfolio_frontend_login",
      },
    };

    console.log(`2. Indexing sample login event into index '${esIndex}'...`);
    const res = await client.index({
      index: esIndex,
      document: sampleDoc,
      refresh: "wait_for",
    });

    console.log(`   --> [SUCCESS] Document indexed! ID: ${res._id}\n`);

    console.log("3. Verifying document retrieval...");
    const searchRes = await client.search({
      index: esIndex,
      query: {
        match: { "event": "user_login_success" },
      },
      sort: [{ "@timestamp": "desc" }],
      size: 1,
    });

    const hit = searchRes.hits.hits[0];
    if (hit) {
      console.log("   --> [SUCCESS] Retrieved document from Elasticsearch:");
      console.log(`       User:    ${hit._source.user.name} <${hit._source.user.email}>`);
      console.log(`       Event:   ${hit._source.event}`);
      console.log(`       Status:  ${hit._source.status}`);
      console.log(`       Time:    ${hit._source["@timestamp"]}\n`);
    }

    console.log("========================================================");
    console.log("   NOW VIEW THIS IN KIBANA:                             ");
    console.log("========================================================");
    console.log("1. Open Kibana in your browser: http://localhost:5601");
    console.log("2. Go to: Stack Management -> Data Views (or Index Patterns)");
    console.log(`3. Click 'Create data view'`);
    console.log(`   - Name: Portfolio Logs`);
    console.log(`   - Index pattern: ${esIndex}*`);
    console.log(`   - Timestamp field: @timestamp`);
    console.log("4. Click 'Save data view to Kibana'");
    console.log("5. Go to 'Discover' in the left menu.");
    console.log("   You will see your login events live!\n");
  } catch (err) {
    console.error("\n[ERROR] Failed to communicate with Elasticsearch:");
    console.error(err.message);
    if (err.meta && err.meta.body) {
      console.error(JSON.stringify(err.meta.body, null, 2));
    }
    console.log("\nTips:");
    console.log("- Did you run 'docker-compose up -d'?");
    console.log("- If using Render, did you forward your local port or set ELASTICSEARCH_NODE?");
    process.exit(1);
  }
}

run();
