// Moves files the site already uses from the uploads folder to Cloudinary and updates the database.
//   npm run media:migrate             do it
//   npm run media:migrate -- --dry-run   only list what would move
// Local files are kept as a backup. A file that fails stays local and is reported, and running again retries it.
import { existsSync } from 'node:fs';
import path from 'node:path';
import mariadb from 'mariadb';
import { config } from '../src/app/config/index.js';
import { uploadToCloudinary } from '../src/app/lib/cloudinary.js';

const COLUMNS: [table: string, column: string, type: string][] = [
  ['testimonials', 'videoUrl', 'text'],
  ['testimonials', 'image', 'text'],
  ['testimonials', 'avatar', 'text'],
  ['services', 'image', 'text'],
  ['projects', 'image', 'text'],
  ['projects', 'content', 'json'],
  ['case_studies', 'image', 'text'],
  ['case_studies', 'content', 'json'],
  ['delivery_stories', 'image', 'text'],
  ['team_members', 'photo', 'text'],
  ['client_logos', 'logo', 'text'],
];

const dryRun = process.argv.includes('--dry-run');
// Only paths on this site: the lookbehind skips full URLs that merely contain /uploads/
const UPLOAD_PATH = /(?<![\w/.:-])\/uploads\/[\w./-]+/g;
const VIDEO_FILE = /\.(mp4|webm)$/i;

const main = async () => {
  if (!config.cloudinary && !dryRun) throw new Error('Set the CLOUDINARY_ keys in .env first');

  const db = await mariadb.createConnection(config.DATABASE_URL.replace(/^mysql:/, 'mariadb:'));

  const found = new Set<string>();
  for (const [table, column] of COLUMNS) {
    const rows: { value: string }[] = await db.query(`SELECT CAST(\`${column}\` AS CHAR) AS value FROM \`${table}\` WHERE CAST(\`${column}\` AS CHAR) LIKE '%/uploads/%'`);
    for (const { value } of rows) for (const match of value.matchAll(UPLOAD_PATH)) found.add(match[0]);
  }

  console.log(`${found.size} file(s) in use from the uploads folder`);
  const failed: string[] = [];

  for (const webPath of found) {
    const filePath = path.join(config.uploadDir, webPath.slice('/uploads/'.length));
    if (!filePath.startsWith(config.uploadDir + path.sep) || !existsSync(filePath)) {
      console.log(`  missing on disk, skipped: ${webPath}`);
      failed.push(webPath);
      continue;
    }
    if (dryRun) {
      console.log(`  would move: ${webPath}`);
      continue;
    }

    try {
      const url = await uploadToCloudinary(filePath, VIDEO_FILE.test(filePath) ? 'video' : 'image');
      await db.beginTransaction();
      for (const [table, column, type] of COLUMNS) {
        // A JSON column is updated as text and read back as JSON, so a path inside an article is replaced too
        const value = type === 'json' ? `CAST(REPLACE(CAST(\`${column}\` AS CHAR), ?, ?) AS JSON)` : `REPLACE(\`${column}\`, ?, ?)`;
        await db.query(`UPDATE \`${table}\` SET \`${column}\` = ${value} WHERE CAST(\`${column}\` AS CHAR) LIKE CONCAT('%', ?, '%')`, [webPath, url, webPath]);
      }
      await db.commit();
      console.log(`  moved: ${webPath} -> ${url}`);
    } catch (error) {
      await db.rollback().catch(() => undefined);
      console.error(`  failed: ${webPath}: ${(error as Error).message}`);
      failed.push(webPath);
    }
  }

  await db.end();
  if (failed.length > 0) {
    console.log(`${failed.length} file(s) not moved. The database still points to them locally; run again after fixing the cause.`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
