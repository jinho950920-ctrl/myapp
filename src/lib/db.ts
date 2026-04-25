import { Pool } from 'pg';

let pool: Pool;

export function getDb() {
  if (pool) return pool;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set in environment.");

  // Clean URL if it has brackets
  let cleanedUrl = dbUrl;
  const bracketMatch = dbUrl.match(/\[(.*?)\]/);
  if (bracketMatch) {
    const rawPw = bracketMatch[1];
    cleanedUrl = dbUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
  }

  pool = new Pool({
    connectionString: cleanedUrl,
    ssl: { rejectUnauthorized: false }
  });

  return pool;
}

export async function query(text: string, params?: any[]) {
  const db = getDb();
  return db.query(text, params);
}
