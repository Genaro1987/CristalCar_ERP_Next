import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error(
    "Variáveis TURSO_DATABASE_URL e TURSO_AUTH_TOKEN não configuradas."
  );
}

export const db = createClient({
  url,
  authToken,
});
