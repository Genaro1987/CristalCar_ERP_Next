const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

async function runMigrations() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN nao configurados.");
    process.exit(1);
  }

  const db = createClient({ url, authToken });

  // Tabela de controle das migracoes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS (
      NOME TEXT PRIMARY KEY,
      DATA_APLICACAO TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("Pasta db/migrations nao encontrada. Nada para aplicar.");
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const nome = file;
    const fullPath = path.join(migrationsDir, file);

    // Verifica se ja foi aplicada
    const check = await db.execute(
      "SELECT NOME FROM SCHEMA_MIGRATIONS WHERE NOME = ? LIMIT 1",
      [nome]
    );

    if (check.rows && check.rows.length > 0) {
      console.log(`Migracao ja aplicada, pulando: ${nome}`);
      continue;
    }

    const sql = fs.readFileSync(fullPath, "utf8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`Aplicando migracao: ${nome}`);
    for (const statement of statements) {
      await db.execute(statement);
    }

    await db.execute(
      "INSERT INTO SCHEMA_MIGRATIONS (NOME) VALUES (?)",
      [nome]
    );
  }

  console.log("Todas as migracoes foram aplicadas com sucesso.");
}

runMigrations().catch((err) => {
  console.error("Erro ao rodar migracoes:", err);
  process.exit(1);
});
