#!/usr/bin/env bash
# Túnel público rápido con Cloudflare (sin cuenta).
# Requiere: npm run dev corriendo en otra terminal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN="$ROOT/.bin/cloudflared"
PORT="${1:-3001}"

if ! curl -sf "http://127.0.0.1:${PORT}/" >/dev/null; then
  echo "❌ Nada escuchando en http://127.0.0.1:${PORT}"
  echo "   Terminal 1: npm run dev --prefix server   (o npm run dev desde la raíz)"
  echo "   Si usás puerto 5173 (Vite dev): npm run tunnel 5173"
  exit 1
fi

if [[ ! -x "$BIN" ]]; then
  mkdir -p "$ROOT/.bin"
  echo "⬇ Descargando cloudflared..."
  curl -fsSL -o "$BIN" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
  chmod +x "$BIN"
fi

echo "🌐 Túnel → http://127.0.0.1:${PORT}"
echo "   (Ctrl+C para cerrar)"
exec "$BIN" tunnel --url "http://127.0.0.1:${PORT}"
