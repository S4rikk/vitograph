# VITOGRAPH — Prompt Architecture v1.0

> **Дата:** 3 апреля 2026
> **Автор:** Maya (Lead Technical Architect)  
> **Задача:** Рефакторинг слоя промптов для улучшения модульности, версионирования и качества ответов LLM.

---

## 1. Текущее состояние (AS-IS)

```mermaid
graph TB
    subgraph "ai.controller.ts (2824 lines — GOD FILE)"
        FC[fetchUserContext]
        FMT["10+ format*() helpers"]
        INLINE_PROMPT["Inline System Prompt<br/>(L1150-1300, ~150 lines)"]
        HANDLERS["handleChat, handleAnalyze,<br/>handleDiagnose, etc."]
    end
    
    subgraph "Scattered Prompts"
        LAB["lab-report-analyzer.ts<br/>LAB_DIAGNOSTIC_SYSTEM_PROMPT"]
        FOOD["food-vision-analyzer.ts<br/>FOOD_VISION_SYSTEM_PROMPT"]
        SOMATIC["vision-analyzer.ts<br/>SYSTEM_PROMPTS{}"]
        TRIGGERS["ai-triggers.ts<br/>3x SYSTEM_PROMPT"]
    end
    
    FC --> FMT
    FMT --> INLINE_PROMPT
    INLINE_PROMPT --> HANDLERS
```

**Проблемы:**
- Chat system prompt собирается inline из 15+ `format*()` вызовов
- Промпты вшиты в бизнес-логику (невозможно A/B тестировать)
- 0 версионирования промптов
- Мешанка русского и английского в инструкциях
- Нет few-shot примеров в самых частотных промптах (Chat, Food Vision)

---

## 2. Целевое состояние (TO-BE)

```mermaid
graph TB
    subgraph "prompts/ (NEW — Centralized Registry)"
        REG["index.ts<br/>Prompt Registry"]
        CB["chat-prompt-builder.ts<br/>ChatPromptBuilder class"]
        LP["lab-diagnostic.prompt.ts"]
        FP["food-vision.prompt.ts"]
        PP["psychological.prompt.ts"]
    end
    
    subgraph "ai.controller.ts (SIMPLIFIED)"
        FC2[fetchUserContext]
        FMT2["formatters/ (extracted)"]
        HANDLERS2["Handlers call builder.build()"]
    end
    
    subgraph "validators/ (NEW)"
        VAL["response-validator.ts<br/>Post-LLM checks"]
    end
    
    REG --> CB
    REG --> LP
    REG --> FP
    REG --> PP
    FC2 --> FMT2
    FMT2 --> CB
    CB --> HANDLERS2
    HANDLERS2 --> VAL
```

---

## 3. ChatPromptBuilder — Ключевой новый модуль

### 3.1 Интерфейс

```typescript
interface PromptBuildResult {
  systemPrompt: string;
  estimatedTokens: number;
  includedSections: string[];
  version: string;
}

class ChatPromptBuilder {
  private sections: Map<string, { content: string; priority: number; tokens: number }>;
  
  constructor(private mode: "assistant" | "diary") {}
  
  // Core persona — всегда включается
  withPersona(profile: LeanProfile): this;
  
  // Rules — всегда включается  
  withRules(): this;
  
  // Context sections — адаптивно
  withProfile(profile: LeanProfile): this;
  withDietaryRestrictions(profile: any): this;
  withHealthGoals(profile: any): this;
  withNutritionTargets(profile: any, kbs: any[]): this;
  withTodayProgress(meals: any[], tz: string): this;
  withMealLogs(meals: any[], tz: string): this;
  withLabReport(profile: any, isDeepDive: boolean): this;
  withKnowledgeBases(kbs: any[]): this;
  withSupplementProtocol(profile: any): this;
  withTodaySupplements(logs: any[], tz: string): this;
  withWeatherAlert(alert: string): this;
  withFoodZones(profile: any): this;
  
  // Build final prompt
  build(): PromptBuildResult;
}
```

### 3.2 Приоритеты секций

| Приоритет | Секция | Режим | Бюджет (символов) |
|-----------|--------|-------|-------------------|
| P0 | Persona + Rules | Оба | ~3000 |
| P0 | Profile + Restrictions | Оба | ~500 |
| P0 | Health Goals | Оба | ~300 |
| P1 | Nutrition Targets | Diary | ~800 |
| P1 | Today Progress | Оба | ~600 |
| P1 | Lab Report (Tier 1 / Deep) | Assistant | ~2000 |
| P2 | Meal Logs (detailed) | Diary + Diet intent | ~1500 |
| P2 | Knowledge Bases | Оба | ~800 |
| P2 | Supplement Protocol | Оба | ~600 |
| P2 | Today Supplements | Оба | ~300 |
| P3 | Weather Alert | Оба | ~200 |
| P3 | Food Zones | Diary + Diet intent | ~800 |

---

## 4. Few-Shot Examples — Что добавить

### 4.1 Food Vision (в `food-vision.prompt.ts`)

Добавить 2 примера: один для обычной еды, один для БАДов.

### 4.2 Chat TECHNICAL BLOCK (в persona builder)

Добавить 1 пример идеального ответа с правильными `<nutr>` тегами, `<meal_score>` и TECHNICAL BLOCK.

---

## 5. Response Validators

### 5.1 Chat Validator

```typescript
function validateChatResponse(text: string): ValidationResult {
  // 1. No markdown headers (###, ##)
  // 2. No bullet points (-, *)
  // 3. All <nutr> tags properly closed
  // 4. No <nutr type="micro"> in narrative (only in tech block)
  // 5. No "[Image of...]" placeholders
  // 6. Language is Russian
}
```

### 5.2 Lab Report Validator

```typescript  
function validateLabReport(report: LabDiagnosticReport, inputCount: number): ValidationResult {
  // 1. biomarker_assessments.length >= inputCount
  // 2. food_zones.red.length > 0 (never empty)
  // 3. food_zones.green.length > 0 (never empty)
  // 4. All required fields non-empty
}
```

### 5.3 Food Vision Validator

```typescript
function validateFoodVision(result: FoodRecognitionOutput): ValidationResult {
  // 1. items.length > 0 OR supplements.length > 0
  // 2. All calories >= 0
  // 3. All weight_g > 0
  // 4. health_reaction is non-empty Russian text
}
```
