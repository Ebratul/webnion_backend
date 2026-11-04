import type { Server } from 'node:http';
import { app } from './app.js';
import { config } from './app/config/index.js';
import { prisma } from './app/lib/prisma.js';

let server: Server;

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

const start = async () => {
  await prisma.$connect();
  server = app.listen(config.PORT, () => {
    console.log(`Webnion API listening on port ${config.PORT}`);
    console.log(`Uploads are stored on ${config.cloudinary ? `Cloudinary (${config.cloudinary.cloudName})` : `disk (${config.uploadDir})`}`);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
