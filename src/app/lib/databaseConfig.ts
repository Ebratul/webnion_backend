import type { PoolConfig } from 'mariadb';

const TLS_MODES = /^(required|verify_ca|verify_identity|true|1)$/i;

// Turns a mysql:// address into driver settings. Hosted MySQL such as Aiven signs its certificate with its own
// authority, so its certificate is passed in DATABASE_CA_CERT and the server is always verified against it.
// Without TLS, as on the local Docker database, the driver may fetch the server's key for MySQL 8 passwords.
export const mysqlConfig = (address: string, caCert?: string, connectionLimit = 2): PoolConfig => {
  const url = new URL(address);
  const ca = caCert?.replace(/\\n/g, '\n');
  const tls = Boolean(ca) || TLS_MODES.test(url.searchParams.get('ssl-mode') ?? url.searchParams.get('ssl') ?? '');

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    // Vercel runs many copies of the API at once and the host allows about 46 connections in all (Aiven's free plan).
    // So each copy opens connections only when a request needs one, closes them after 30 idle seconds, and keeps at
    // most a couple. Left at the driver's defaults, every copy opened its full pool at start and held it, and the
    // host turned new copies away.
    connectionLimit,
    minimumIdle: 0,
    idleTimeout: 30,
    // The driver gives up after one second by default, shorter than a TLS handshake can take on a slow network.
    // Waiting for a free connection must last longer than opening one, or the real error is lost.
    connectTimeout: 5_000,
    acquireTimeout: 10_000,
    ...(tls ? { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : { allowPublicKeyRetrieval: true }),
  };
};
