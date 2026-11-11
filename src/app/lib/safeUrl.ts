import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal', 'instance-data']);

const isPrivateV4 = (address: string) => {
  const [a = 0, b = 0] = address.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
};

const isPublicAddress = (address: string): boolean => {
  if (isIP(address) === 4) return !isPrivateV4(address);
  const lower = address.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return !isPrivateV4(mapped[1]!);
  // Only global unicast (2000::/3) is public
  return /^[23][0-9a-f]{3}:/.test(lower) && !lower.startsWith('2001:db8') && !lower.startsWith('2002:');
};

// Base addresses typed in AI Settings must be public https servers, so they cannot be used to reach internal systems.
// The AI service checks again before it connects.
export const checkPublicUrl = async (value: string): Promise<string | null> => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Enter a full address, such as https://api.example.com/v1';
  }
  if (url.protocol !== 'https:') return 'The address must start with https://';
  if (url.username || url.password) return 'The address must not contain a user name or password';
  if (url.search || url.hash) return 'The address must not contain ? or #';
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || /\.(localhost|local|internal)$/.test(host)) return 'The address must be a public server';
  if (isIP(host)) return isPublicAddress(host) ? null : 'The address must be a public server';
  try {
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || !addresses.every(({ address }) => isPublicAddress(address))) return 'The address must be a public server';
  } catch {
    return 'The address could not be found';
  }
  return null;
};
