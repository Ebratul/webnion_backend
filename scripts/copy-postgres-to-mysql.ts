// Copies every row from the old PostgreSQL database into the MySQL one, then reads both back and compares them.
//   POSTGRES_DATABASE_URL=postgresql://… DATABASE_URL=mysql://… npx tsx scripts/copy-postgres-to-mysql.ts
// Set DATABASE_CA_CERT for a host with its own certificate authority. Run `npm run db:deploy` on the MySQL database first. It refuses to write into a table that already has rows,
// unless --replace is given, which empties those tables first. The PostgreSQL database is only read.
import mariadb from 'mariadb';
import pg from 'pg';
import { mysqlConfig } from '../src/app/lib/databaseConfig.js';

// Prisma stores times in UTC in "timestamp without time zone" columns. Read them as text, so no time zone shifts them.
pg.types.setTypeParser(1114, (value) => value);

const replace = process.argv.includes('--replace');
const source = process.env.POSTGRES_DATABASE_URL;
const target = process.env.DATABASE_URL;
if (!source?.startsWith('postgres') || !target?.startsWith('mysql')) throw new Error('Set POSTGRES_DATABASE_URL to the PostgreSQL address and DATABASE_URL to the MySQL address');

const TABLES = [
  'users', 'services', 'projects', 'products', 'case_studies', 'testimonials', 'delivery_stories', 'outcome_cards', 'technologies',
  'hero_backgrounds', 'pricing_plans', 'faqs', 'team_members', 'client_logos', 'inquiries', 'site_settings', 'activity_logs',
];
const BATCH = 200;

const sameValue = (a: unknown, b: unknown, json: boolean): boolean => {
  if (a === null || b === null) return a === b;
  if (json) return JSON.stringify(a) === JSON.stringify(typeof b === 'string' ? JSON.parse(b) : b);
  if (typeof a === 'boolean') return Number(a) === Number(b);
  // PostgreSQL drops trailing zeros from milliseconds (".87"), MySQL keeps them (".870"): compare the instant itself
  const DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;
  if (typeof a === 'string' && typeof b === 'string' && DATE_TIME.test(a) && DATE_TIME.test(b)) return Date.parse(`${a.replace(' ', 'T')}Z`) === Date.parse(`${b.replace(' ', 'T')}Z`);
  return String(a) === String(b);
};

const main = async () => {
  const pgClient = new pg.Client({ connectionString: source });
  await pgClient.connect();
  // dateStrings keeps DATETIME values as text, the same form PostgreSQL gave above
  const my = await mariadb.createConnection({ ...mysqlConfig(target, process.env.DATABASE_CA_CERT), dateStrings: true });

  let problems = 0;
  for (const table of TABLES) {
    const columns: { name: string; type: string }[] = await my.query('SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [table]);
    if (columns.length === 0) throw new Error(`MySQL has no ${table} table. Run npm run db:deploy first.`);
    const json = new Set(columns.filter((column) => column.type === 'json').map((column) => column.name));
    const names = columns.map((column) => column.name);

    const [{ count }] = await my.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    if (Number(count) > 0) {
      if (!replace) throw new Error(`${table} in MySQL already has ${count} rows. Use --replace to empty it first.`);
      await my.query(`DELETE FROM \`${table}\``);
    }

    const { rows } = await pgClient.query(`SELECT ${names.map((name) => `"${name}"`).join(', ')} FROM "${table}"`);
    await my.beginTransaction();
    for (let start = 0; start < rows.length; start += BATCH) {
      const batch = rows.slice(start, start + BATCH);
      const values = batch.flatMap((row) => names.map((name) => (json.has(name) && row[name] !== null ? JSON.stringify(row[name]) : row[name])));
      const placeholders = batch.map(() => `(${names.map(() => '?').join(', ')})`).join(', ');
      await my.query(`INSERT INTO \`${table}\` (${names.map((name) => `\`${name}\``).join(', ')}) VALUES ${placeholders}`, values);
    }
    await my.commit();

    // Read back and compare every value
    const copied: Record<string, unknown>[] = await my.query(`SELECT * FROM \`${table}\``);
    const key = table === 'site_settings' ? 'key' : 'id';
    const byKey = new Map(copied.map((row) => [String(row[key]), row]));
    let mismatched = 0;
    for (const row of rows) {
      const other = byKey.get(String(row[key]));
      const differing = other ? names.filter((name) => !sameValue(row[name], other[name], json.has(name))) : ['(missing)'];
      if (differing.length > 0) {
        mismatched++;
        if (process.env.DEBUG_COPY && mismatched <= 2) console.log('   ', table, row[key], differing.map((name) => `${name}: ${JSON.stringify(row[name]).slice(0, 80)} | ${JSON.stringify(other?.[name]).slice(0, 80)}`));
      }
    }
    if (mismatched > 0 || copied.length !== rows.length) problems++;
    console.log(`${table.padEnd(17)} ${String(rows.length).padStart(4)} rows copied, ${copied.length === rows.length && mismatched === 0 ? 'all identical' : `${mismatched} differ`}`);
  }

  await pgClient.end();
  await my.end();
  if (problems > 0) {
    console.error(`${problems} table(s) did not match`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
