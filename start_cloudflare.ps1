# Script to run Cloudflare Tunnel instantly on Windows
Write-Host "Setting up Cloudflare Tunnel..." -ForegroundColor Cyan

$cfPath = "$env:TEMP\cloudflared.exe"

if (-not (Test-Path $cfPath)) {
    Write-Host "Downloading cloudflared.exe..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cfPath
}

Write-Host "Starting tunnel for port 3000..." -ForegroundColor Green
Write-Host "Look for the link ending in '.trycloudflare.com' below!" -ForegroundColor Magenta

# Run it
& $cfPath tunnel --url http://localhost:3000
