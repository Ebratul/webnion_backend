import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';
import { config } from '../config/index.js';

// The MariaDB driver speaks to MySQL too. It accepts a mysql:// address as it is.
const adapter = new PrismaMariaDb(config.DATABASE_URL);

export const prisma = new PrismaClient({ adapter });
