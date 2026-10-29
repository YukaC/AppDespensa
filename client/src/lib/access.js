import { DEMO_MODE } from './demo/config.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * The static demo runs on Vercel, not on the shop's admin PC, but it is meant
 * to show the full admin flow. Treat the demo build as the local admin host.
 */
export function isLocalAdminHost() {
  if (DEMO_MODE) return true;
  const host = window.location.hostname;
  return LOCAL_HOSTS.includes(host);
}

export function isReadOnlyByDefault() {
  if (DEMO_MODE) return false;
  return !isLocalAdminHost();
}

export function getAccessMode() {
  if (DEMO_MODE) return 'admin';
  if (isLocalAdminHost()) return 'admin';
  return 'readonly';
}
