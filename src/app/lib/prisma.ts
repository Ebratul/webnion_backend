import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';
import { config } from '../config/index.js';
import { mysqlConfig } from './databaseConfig.js';

// The MariaDB driver speaks to MySQL too. A few connections per serverless instance keeps well under the host's limit.
const adapter = new PrismaMariaDb(mysqlConfig(config.DATABASE_URL, config.DATABASE_CA_CERT, config.DATABASE_CONNECTION_LIMIT));

export const prisma = new PrismaClient({ adapter });
