import pg from "pg";
import { DATABASE_URL, createCheckpointer } from "./db.ts";

const checkpointer = createCheckpointer();
const pool = new pg.Pool({ connectionString: DATABASE_URL });

try {
  await checkpointer.setup();

  const { rows } = await pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );

  console.log("Connected to Postgres. Tables in schema 'public':");
  for (const row of rows) console.log(`- ${row.table_name}`);
} catch (error) {
  console.error("Could not set up Postgres. Is it running? (docker compose up -d)");
  throw error;
} finally {
  await pool.end();
  await checkpointer.end();
}
