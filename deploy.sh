#!/bin/bash
cd /opt/vitograph

# Забираем свежий код из гитхаба
git pull origin main

# Сборка фронтенда (Next.js)
echo "Building frontend..."
cd apps/web
npm install
npm run build
cd ../..

# Сборка AI движка (Node.js)
echo "Building AI Engine..."
cd apps/api/src/ai
npm install
npm run build
cd ../../../

# Обновление Python Core
echo "Updating Python Engine..."
cd apps/api
# Используем venv, который прописан в PM2
if [ -d "venv" ]; then
    ./venv/bin/pip install -r requirements.txt
else
    pip install -r requirements.txt
fi
cd ../..

# Перезагружаем все три процесса (NextJS, Node API, Python Core) для синхронизации версий
pm2 restart vitograph vitograph-ai vitograph-api
