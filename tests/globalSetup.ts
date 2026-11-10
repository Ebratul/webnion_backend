import { execSync } from 'node:child_process';
import mariadb from 'mariadb';

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  const database = url.pathname.slice(1);
  if (!/^\w+_test$/.test(database)) throw new Error('TEST_DATABASE_URL must name a database ending in _test');

  // Connect without a database, so the test database can be created when it does not exist yet
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    allowPublicKeyRetrieval: true,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await connection.end();

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
}
