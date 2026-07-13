const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

export function isLocalAdminHost() {
  const host = window.location.hostname;
  return LOCAL_HOSTS.includes(host);
}

export function isReadOnlyByDefault() {
  return !isLocalAdminHost();
}

export function getAccessMode() {
  if (isLocalAdminHost()) return 'admin';
  return 'readonly';
}
