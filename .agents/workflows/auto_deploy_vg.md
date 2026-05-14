---
description: Автоматический деплой и проверка логов для VITOGRAPH
---
# Auto-deploy Workflow (VITOGRAPH)

Этот воркфлоу автоматически отправляет последний код на GitHub, инициирует скрипт деплоя на сервере проекта VITOGRAPH и читает логи PM2.

// turbo-all
1. Выполняем скрипт отправки кода и рестарта на сервере (можно передать комментарий коммита в кавычках):
```powershell
.\deploy_to_server_vg.bat "%~1"
```

2. Читаем свежие логи PM2 всех трех сервисов (vitograph, vitograph-ai, vitograph-api), чтобы убедиться, что сервер успешно поднялся и нет ошибок синтаксиса или падений:
```powershell
.\fetch_logs_vg.bat
```

## Troubleshooting: SSL/TLS Connection Errors (Git Push)

Если при выполнении шага 1 (Git Push) возникает ошибка SSL/TLS соединения (часто связано с использованием различных VPN), необходимо использовать локальный прокси-сервер `127.0.0.1:10808`.

**Решение:**
1. Включите прокси в Git:
   ```powershell
   git config --global http.proxy http://127.0.0.1:10808
   ```
2. Повторите попытку деплоя.
3. После успешного пуша рекомендуется сбросить настройки прокси:
   ```powershell
   git config --global --unset http.proxy
   ```
