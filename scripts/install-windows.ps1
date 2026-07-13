# Instalación inicial en PC de cobro (Windows)
Write-Host "Despensa Fernando - Setup Windows" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Instalá Node.js 20 LTS desde https://nodejs.org"
    exit 1
}

Set-Location $PSScriptRoot\..

if (-not (Test-Path "server\.env")) {
    Copy-Item "server\.env.example" "server\.env"
    Write-Host "Creado server\.env - configurá DATABASE_URL" -ForegroundColor Yellow
}

npm run install:all
Set-Location server
npm run db:generate
npm run db:push
npm run db:seed
Set-Location ..

npm run build:client

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    npm install -g pm2
}

pm2 start ecosystem.config.cjs
pm2 save

Write-Host "Listo. API en puerto 3001. Serví client/dist en el puerto que uses." -ForegroundColor Green
