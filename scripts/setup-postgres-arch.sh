#!/usr/bin/env bash
# PostgreSQL nativo en Arch / CachyOS (sin Docker)
set -euo pipefail

echo ">> Instalando PostgreSQL..."
sudo pacman -S --needed postgresql

if [[ ! -d /var/lib/postgres/data/base ]]; then
  echo ">> Inicializando cluster..."
  sudo -u postgres initdb -D /var/lib/postgres/data --locale=en_US.UTF-8 --encoding=UTF8
fi

echo ">> Iniciando servicio..."
sudo systemctl enable --now postgresql

sleep 2

echo ">> Contraseña para usuario postgres (para server/.env)..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"

echo ">> Creando base despensa_fernando..."
sudo -u postgres createdb despensa_fernando 2>/dev/null || echo "   (la base ya existía)"

echo ""
echo "PostgreSQL listo en localhost:5432"
echo "Siguiente:"
echo "  ./scripts/dev-linux.sh db"
