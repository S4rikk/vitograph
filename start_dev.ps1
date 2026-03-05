Write-Host "🚀 Starting VITOGRAPH System..." -ForegroundColor Cyan

$root = "C:\project\VITOGRAPH"

# 1. Python Core (Port 8001)
Write-Host "Launching Python Core..."
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\apps\api'; if (Test-Path .venv) { .\.venv\Scripts\activate }; uvicorn main:app --reload --port 8001"

# 2. Node.js API (Port 3001)
Write-Host "Launching Node.js Gateway..."
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\apps\api\src\ai'; npm run dev"

# 3. Frontend (Port 3000)
Write-Host "Launching Frontend..."
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\apps\web'; npm run dev"

Write-Host "✅ All services started in new windows!" -ForegroundColor Green
Write-Host "Web App: http://localhost:3000"
