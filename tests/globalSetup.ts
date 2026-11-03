import { execSync } from 'node:child_process';
import pg from 'pg';

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  const database = url.pathname.slice(1);

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (!rowCount) await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
}
