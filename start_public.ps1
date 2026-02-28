# VITOGRAPH Public Local Tunnel Script
# Starts the Next.js Frontend on port 3000 and exposes it via localtunnel

Write-Host "Starting Next.js Dev Server and Localtunnel..." -ForegroundColor Cyan

# Install localtunnel globally if it is not found
if (!(Get-Command lt -ErrorAction SilentlyContinue)) {
    Write-Host "Installing localtunnel globally..." -ForegroundColor Yellow
    npm install -g localtunnel
}

# Run the frontend dev server in the background
$nextJob = Start-Job {
    cd "apps/web"
    npm run dev
}

# Give Next.js a few seconds to boot
Start-Sleep -Seconds 5

# Start localtunnel
Write-Host "Opening tunnel on port 3000. Give this URL to your phone..." -ForegroundColor Green
lt --port 3000

# Cleanup job if user stops tunnel
Stop-Job $nextJob
