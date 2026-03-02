@echo off
echo 📡 Fetching recent logs from PM2 on the server...
echo.
echo ===================================================
echo [ MAIN APP LOGS (vitograph) ]
echo ===================================================
ssh -o StrictHostKeyChecking=no root@69.12.79.201 "pm2 logs vitograph --lines 50 --nostream"

echo.
echo ===================================================
echo [ AI SERVICE LOGS (vitograph-ai) ]
echo ===================================================
ssh -o StrictHostKeyChecking=no root@69.12.79.201 "pm2 logs vitograph-ai --lines 50 --nostream"

echo.
echo ✅ Fetch complete.
