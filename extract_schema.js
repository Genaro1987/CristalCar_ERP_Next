const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
}

async function run() {
  loadEnv();

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("Missing TURSO env vars");
    process.exit(1);
  }

  const client = createClient({
    url,
    authToken,
  });

  try {
    const result = await client.execute(
      "SELECT sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    );

    for (const row of result.rows) {
      console.log(row.sql);
      console.log(";");
    }
    console.log("--- SUCCESS ---");
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    client.close();
  }
}

run();
