const listeners = new Set();

export function subscribeToast(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toast(message, type = 'info', duration = 4200) {
  const item = { id: Date.now() + Math.random(), message, type, duration };
  listeners.forEach((fn) => fn(item));
  return item.id;
}
