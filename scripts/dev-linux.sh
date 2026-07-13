#!/usr/bin/env bash
# Desarrollo y pruebas en Linux
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Falta Node.js/npm. En Arch/CachyOS:"
  echo "  sudo pacman -S nodejs npm"
  exit 1
fi

compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return 0
  fi
  if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    echo "podman compose"
    return 0
  fi
  return 1
}

postgres_ready() {
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h localhost -p 5432 -q 2>/dev/null
    return $?
  fi
  (echo >/dev/tcp/localhost/5432) >/dev/null 2>&1
}

wait_postgres() {
  local i
  for i in $(seq 1 30); do
    if postgres_ready; then
      return 0
    fi
    sleep 1
  done
  return 1
}

install_deps() {
  echo ">> Instalando dependencias (server)..."
  npm install --prefix server
  echo ">> Generando cliente Prisma..."
  npm run db:generate --prefix server

  echo ">> Instalando dependencias (client)..."
  npm install --prefix client
}

setup_db_container() {
  local cc
  if ! cc=$(compose_cmd); then
    return 1
  fi
  echo ">> Levantando PostgreSQL ($cc)..."
  $cc -f "$ROOT/docker-compose.yml" up -d postgres
  echo ">> Esperando Postgres en :5432..."
  wait_postgres
}

init_db_schema() {
  if ! postgres_ready; then
    echo ""
    echo "ERROR: PostgreSQL no responde en localhost:5432"
    echo ""
    echo "Opción A — Docker/Podman:"
    echo "  sudo pacman -S docker docker-compose   # o podman podman-compose"
    echo "  sudo systemctl enable --now docker"
    echo "  sudo usermod -aG docker \$USER   # cerrar sesión y volver a entrar"
    echo "  ./scripts/dev-linux.sh db"
    echo ""
    echo "Opción B — PostgreSQL nativo (Arch):"
    echo "  ./scripts/setup-postgres-arch.sh"
    echo "  ./scripts/dev-linux.sh db"
    echo ""
    return 1
  fi
  echo ">> Prisma db push + seed..."
  npm run db:push --prefix server
  npm run db:seed --prefix server
}

ensure_prisma() {
  if [[ ! -f server/node_modules/.prisma/client/index.js ]] && \
     [[ ! -f server/node_modules/@prisma/client/index.js ]]; then
    echo ">> Falta Prisma Client, generando..."
    npm run db:generate --prefix server
  fi
}

check_api() {
  if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

case "${1:-}" in
  install)
    install_deps
    if setup_db_container 2>/dev/null; then
      init_db_schema || true
    else
      echo ">> Sin Docker/Podman. Configurá Postgres y ejecutá: ./scripts/dev-linux.sh db"
      if postgres_ready; then
        init_db_schema || true
      fi
    fi
    echo ""
    echo "Listo. Siguiente paso (dos terminales):"
    echo "  ./scripts/dev-linux.sh server"
    echo "  ./scripts/dev-linux.sh client"
    ;;
  db)
    ensure_prisma
    setup_db_container 2>/dev/null || true
    init_db_schema
    ;;
  server)
    ensure_prisma
    if ! postgres_ready; then
      echo "AVISO: Postgres no está en :5432. El servidor arrancará pero fallará en cada request."
      echo "Ejecutá en otra terminal: ./scripts/dev-linux.sh db"
    fi
    npm run dev --prefix server
    ;;
  client)
    if ! check_api; then
      echo "AVISO: La API no responde en http://localhost:3001"
      echo "Primero ejecutá en otra terminal: ./scripts/dev-linux.sh server"
      echo ""
    fi
    npm run dev --prefix client
    ;;
  check)
    echo -n "Node: "; node -v
    echo -n "npm: "; npm -v
    echo -n "Postgres :5432: "; postgres_ready && echo "OK" || echo "NO"
    echo -n "Prisma client: "; [[ -d server/node_modules/@prisma/client ]] && echo "OK" || echo "NO (npm run db:generate --prefix server)"
    echo -n "API :3001: "; check_api && echo "OK" || echo "NO (./scripts/dev-linux.sh server)"
    ;;
  ip)
    echo "URLs para probar:"
    hostname -I 2>/dev/null | awk '{print "  http://" $1 ":5173  (solo lectura / móvil)"}'
    echo "  http://localhost:5173  (modo caja / admin)"
    echo "  http://localhost:3001/api/health"
    ;;
  *)
    echo "Uso: $0 {install|db|server|client|check|ip}"
    exit 1
    ;;
esac
