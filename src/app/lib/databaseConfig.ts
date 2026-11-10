import type { PoolConfig } from 'mariadb';

// How long the pool keeps an unused connection. lib/prisma.ts keeps a Vercel function awake this long after a query.
export const POOL_IDLE_SECONDS = 5;

const TLS_MODES = /^(required|verify_ca|verify_identity|true|1)$/i;

// Turns a mysql:// address into driver settings. Hosted MySQL such as Aiven signs its certificate with its own
// authority, so its certificate is passed in DATABASE_CA_CERT and the server is always verified against it.
// Without TLS, as on the local Docker database, the driver may fetch the server's key for MySQL 8 passwords.
export const mysqlConfig = (address: string, caCert?: string, connectionLimit = 1): PoolConfig => {
  const url = new URL(address);
  const ca = caCert?.replace(/\\n/g, '\n');
  const tls = Boolean(ca) || TLS_MODES.test(url.searchParams.get('ssl-mode') ?? url.searchParams.get('ssl') ?? '');

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    // Vercel runs many copies of the API at once and the host allows about 46 connections in all (Aiven's free plan),
    // and a copy that has answered is frozen, so its own timers stop. Three things keep connections from piling up:
    // each copy opens them only when needed and keeps at most a couple; the pool closes idle ones after a few seconds,
    // with lib/prisma.ts keeping the copy awake that long; and MySQL itself drops any connection idle for 30 seconds,
    // which catches a copy frozen before it could tidy up. The pool checks a connection before reusing it.
    connectionLimit,
    minimumIdle: 0,
    idleTimeout: POOL_IDLE_SECONDS,
    initSql: 'SET SESSION wait_timeout = 30, SESSION interactive_timeout = 30',
    prepareCacheLength: 0,
    connectTimeout: 5_000,
    acquireTimeout: 10_000,
    ...(tls ? { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : { allowPublicKeyRetrieval: true }),
  };
};
