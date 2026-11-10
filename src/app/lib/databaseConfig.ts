import type { PoolConfig } from 'mariadb';

const TLS_MODES = /^(required|verify_ca|verify_identity|true|1)$/i;

// Turns a mysql:// address into driver settings. Hosted MySQL such as Aiven signs its certificate with its own
// authority, so its certificate is passed in DATABASE_CA_CERT and the server is always verified against it.
// Without TLS, as on the local Docker database, the driver may fetch the server's key for MySQL 8 passwords.
export const mysqlConfig = (address: string, caCert?: string, connectionLimit = 5): PoolConfig => {
  const url = new URL(address);
  const ca = caCert?.replace(/\\n/g, '\n');
  const tls = Boolean(ca) || TLS_MODES.test(url.searchParams.get('ssl-mode') ?? url.searchParams.get('ssl') ?? '');

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit,
    ...(tls ? { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : { allowPublicKeyRetrieval: true }),
  };
};
