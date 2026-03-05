@echo off
setlocal

:: Если комментарий к коммиту не передан, используем стандартный
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Auto-deploy via AI Agent"

echo 🚀 Starting local Git Push...
git add .
git commit -m "%COMMIT_MSG%"
git push origin main

:: На Windows batch бывает проблема с push в не-main ветку.
:: Сделаем просто push текущей ветки:
git push

echo.
echo 🌐 Connecting to server 69.12.79.201 to execute deploy script...
ssh -o StrictHostKeyChecking=no root@69.12.79.201 "bash /opt/vitograph/deploy.sh"

echo.
echo ✅ Deployment signal sent!
endlocal
