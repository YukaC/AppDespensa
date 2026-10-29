/**
 * Static demo configuration.
 *
 * The demo only turns on for an explicit build-time flag:
 *   VITE_DEMO=1 vite build
 * Without that variable the client keeps using the real API exactly as before.
 */

function readDemoFlag() {
  try {
    return import.meta.env.VITE_DEMO === '1';
  } catch {
    // Node (tests) has no import.meta.env.
    return false;
  }
}

export const DEMO_MODE = readDemoFlag();
export const DEMO_PIN = '1234';
export const DEMO_STORAGE_KEY = 'despensa-demo:state:v1';
