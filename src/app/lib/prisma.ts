import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { attachDatabasePool } from '@vercel/functions';
import mariadb from 'mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';
import { config } from '../config/index.js';
import { mysqlConfig, POOL_IDLE_SECONDS } from './databaseConfig.js';

// The MariaDB driver speaks to MySQL too
const pool = mariadb.createPool(mysqlConfig(config.DATABASE_URL, config.DATABASE_CA_CERT, config.DATABASE_CONNECTION_LIMIT));

// On Vercel, keeps the function awake after each query until the pool has closed its idle connections. The helper reads
// the idle time in milliseconds, while the MariaDB driver counts seconds, so it is handed the right figure here.
attachDatabasePool({ on: pool.on.bind(pool), config: { idleTimeout: POOL_IDLE_SECONDS * 1000 + 500 } } as unknown as Parameters<typeof attachDatabasePool>[0]);

export const prisma = new PrismaClient({ adapter: new PrismaMariaDb(pool) });
