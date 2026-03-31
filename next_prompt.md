# ЗАДАЧА: ДОБАВИТЬ СКАНИРОВАНИЕ ЭТИКЕТОК В ЧАТ-АССИСТЕНТ

---
description: Внедрить возможность отправки фото продукта или этикетки прямо в строку чата с ИИ, чтобы получать советы по питанию без сохранения в дневник.
---

## Обязательные скиллы:
При выполнении задачи обязательно строго следуй паттернам из следующих документов (используй view_file для их прочтения перед началом редактирования):
1. `C:\store\ag_skills\skills\frontend-developer\SKILL.md`
2. `C:\store\ag_skills\skills\nodejs-backend-patterns\SKILL.md`

## 1. Контекст
Пользователю необходимо сфотографировать этикетку продукта в магазине и задать чат-помощнику вопрос: "Могу ли я это съесть?". 
Особенности:
1. Интегрировано в обычное окно чата `AiAssistantView`.
2. Анализ проходит напрямую через `handleChat` с использованием `gpt-5.4-mini` (передача мультимодального массива в `HumanMessage`).
3. Запись в дневник или логирование в БД (кроме истории чата) строго запрещено.

## 2. Что нужно сделать

### Шаг 1: Backend (`apps/api/src/ai/src/request-schemas.ts`)
- Обнови `ChatRequestSchema`. Добавь опциональное поле `imageBase64?: z.string()`.

### Шаг 2: Backend (`apps/api/src/ai/src/ai.controller.ts`)
Внутри обработчика `handleChat`:
- Импортируй `uploadAndRotateFoodPhoto` из `./lib/storage.js` (если еще нет).
- Если в теле запроса есть `body.imageBase64`, вызови загрузку:
  ```typescript
  let finalImageUrl = body.imageUrl;
  if (body.imageBase64) {
    finalImageUrl = await uploadAndRotateFoodPhoto(req.user.id, body.imageBase64, token);
  }
  ```
- В объекте `userMsgPayload`, если определен `finalImageUrl`, сохраняй его `image_url: finalImageUrl`.
- При пробросе пользовательского сообщения в массив для LangGraph (`messagesToInvoke.push`) сделай следующее:
  ```typescript
  if (finalImageUrl) {
      messagesToInvoke.push(
        new HumanMessage({
          content: [
            { type: "text", text: body.message || "Пожалуйста, проанализируй это фото этикетки." },
            { type: "image_url", image_url: { url: finalImageUrl } }
          ]
        })
      );
  } else {
      messagesToInvoke.push(new HumanMessage(body.message));
  }
  ```
- В **System Prompt** (который создается внутри `handleChat` для `assistant` mode) добавь короткую инструкцию (где-то рядом с условием про 'HOWEVER, you CANNOT log, save...'):
  `Если пользователь приложил фото продукта или этикетки, проанализируй состав (учитывай E-добавки, вредные жиры, сахар), соотнеси с его зонами противопоказаний и аллергиями, и ответь: можно ли ему это съесть и почему. Будь строг и краток.`

### Шаг 3: Frontend (`apps/web/src/lib/api-client.ts`)
- В методе `chat` добавь поддержку аргумента `imageBase64?: string` и передавай его в `body` POST-запроса. 

### Шаг 4: Frontend (`apps/web/src/components/assistant/AiAssistantView.tsx`)
- Импортируй утилиту `compressImage` из `@/lib/image-utils`.
- Добавь стейт для хранения картинки `const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);`.
- Добавь иконку скрепки/камеры возле `<textarea>`, клик по которой триггерит реф скрытого `<input type="file" accept="image/*" />`.
- В `onChange` инпута сжимай файл через `compressImage(file, 1024)` и клади в стейт `selectedImageBase64`.
- Над `textarea` отображай миниатюру выбранного фото (с маленьким крестиком по центру или в углу для снятия/очистки стейта).
- В `handleSendMessage` передай `selectedImageBase64` в вызов `apiClient.chat`. Сразу после отправки очищай стейт фото.

## 3. Критерии приемки
- Загруженное фото попадает в историю чата, а LLM (gpt-5.4-mini) успешно видит фото и оценивает пищевой продукт согласно контексту здоровья пользователя.
- Не использован сторонний `runLabelScanner`.
- Код компилируется без TS ошибок.
