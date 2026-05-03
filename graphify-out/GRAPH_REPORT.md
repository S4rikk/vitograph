# Graph Report - VITOGRAPH  (2026-05-02)

## Corpus Check
- 204 files · ~204,215 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 870 nodes · 1431 edges · 34 communities detected
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 529 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 120|Community 120]]
- [[_COMMUNITY_Community 121|Community 121]]

## God Nodes (most connected - your core abstractions)
1. `DatabaseError` - 59 edges
2. `RecordNotFoundError` - 48 edges
3. `createClient()` - 48 edges
4. `LabReportExtraction` - 40 edges
5. `ReferenceRange` - 39 edges
6. `BiomarkerResult` - 39 edges
7. `NormResult` - 39 edges
8. `UserProfile` - 38 edges
9. `AiApiClient` - 38 edges
10. `ChatPromptBuilder` - 33 edges

## Surprising Connections (you probably didn't know these)
- `loadWearables()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `handleDeleteAccount()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `async()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `REST API endpoints for user feedback.  Handles submission of feedback/bug repo` --uses--> `DatabaseError`  [INFERRED]
  apps\api\api\v1\endpoints\users.py → apps\api\core\exceptions.py
- `Inserts a feedback row into the db.     Includes a 60-second rate-limit via che` --uses--> `DatabaseError`  [INFERRED]
  apps\api\api\v1\endpoints\users.py → apps\api\core\exceptions.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (77): DatabaseError, Custom exception hierarchy for database / repository operations.  All exceptio, Base exception for all database-related errors., Raised when a queried record does not exist., Raised when an insert violates a uniqueness constraint., RecordAlreadyExistsError, RecordNotFoundError, analyze_session() (+69 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (80): calculate_norm(), enrich_biomarkers_with_insights(), get_lab_scan_status(), global_exception_handler(), health_check(), http_exception_handler(), lifespan(), parse_lab_report() (+72 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (65): AdminLayout(), run(), HomePage(), handleSubmit(), updateFeedbackStatus(), getAuthToken(), getAuth(), sendFcmNotification() (+57 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (23): ActiveTypewriterNode(), handleImageSelect(), handleUpdate(), NutrPill(), parseNutrientTags(), getMicronutrientColor(), useTypewriter(), compressImage() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (31): analyzeSymptomCorrelation(), buildPsychologicalFallback(), generateDiagnosticHypothesis(), generatePsychologicalResponse(), callLlmStructured(), runFoodVisionAnalyzer(), formatBiomarkersForLLM(), generateBiomarkersHash() (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (14): callModel(), sanitizeMessages(), initCheckpointer(), runNutritionAnalyzer(), getSupabase(), requireAuth(), getLLMConfig(), AppError (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (3): AiApiClient, getApiBaseUrl(), getAuthToken()

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (2): ChatPromptBuilder, getLocalizedPersona()

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (12): createMealLog(), loadUserProfile(), resolveFood(), AppError, ConflictError, getStatusCode(), NotFoundError, toErrorResponse() (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (9): get_supabase_client(), Async Supabase client connection manager.  Provides a lazily-initialised, appl, FastAPI dependency that yields an async client.      If an Authorization heade, Manages the lifecycle of a single ``AsyncClient`` instance.      The client is, Return the cached async Supabase client.          Creates the client on first, Gracefully close the underlying HTTP connections., SupabaseClientManager, DatabaseConnectionError (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.26
Nodes (10): get_lab_schedule(), get_micronutrient_trends(), REST API endpoints for user analytics and insights.  Exposes ``GET`` operation, Fetch and aggregate daily micronutrient intake., Generate predictive lab schedule., LabScheduleItem, MicronutrientTrendDay, Pydantic V2 schemas for analytics endpoints.  Provides response models for mic (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (10): Exception, extract_text_from_pdf(), LLMParsingError, parse_biomarkers_with_llm(), PDFExtractionError, PDFExtractorService, PDF Extractor Service — extracts biomarker data from lab reports.  Provides tw, Raised when PDF text extraction fails. (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (1): PythonCoreClient

### Community 14 - "Community 14"
Cohesion: 0.24
Nodes (9): BiomarkerBase, BiomarkerCreate, BiomarkerRead, BiomarkerUpdate, Pydantic V2 schemas for the ``biomarkers`` table.  Provides request/response m, Shared fields for biomarker create and read operations., Schema for creating a new biomarker (admin/service_role only)., Schema for partial biomarker updates (PATCH semantics).      All fields are op (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.24
Nodes (6): detectAndParseFoodLog(), fetchUserPreferences(), handleUpdateWeight(), loadHistory(), getTzDayBoundaries(), getTzToday()

### Community 17 - "Community 17"
Cohesion: 0.28
Nodes (4): buildChunk(), chunkSectionContent(), generateEmbedding(), getModel()

### Community 18 - "Community 18"
Cohesion: 0.32
Nodes (7): DynamicNormRuleBase, DynamicNormRuleCreate, DynamicNormRuleRead, Pydantic V2 schemas for the ``dynamic_norm_rules`` table.  These schemas repre, Shared fields for dynamic norm rules.      Attributes:         biomarker_id:, Schema for inserting a new dynamic norm rule., Schema returned when reading a dynamic norm rule.

### Community 19 - "Community 19"
Cohesion: 0.32
Nodes (7): Pydantic V2 schemas for the ``user_dynamic_norms`` table.  Represents the cach, Shared fields for user dynamic norms.      Attributes:         user_id: FK to, Schema for inserting or upserting a computed norm., Schema returned when reading a computed norm., UserDynamicNormBase, UserDynamicNormRead, UserDynamicNormUpsert

### Community 20 - "Community 20"
Cohesion: 0.39
Nodes (6): createAdminClient(), banUser(), createUser(), deleteUser(), unbanUser(), updateUserEmail()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (4): getAppConfigKeys(), updateAppConfigItem(), handleUpdate(), AiSettingsPage()

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (4): createKbDocument(), deleteKnowledgeDocument(), handleSubmit(), handleDelete()

### Community 24 - "Community 24"
Cohesion: 0.4
Nodes (4): REST API endpoints for user feedback.  Handles submission of feedback/bug repo, Inserts a feedback row into the db.     Includes a 60-second rate-limit via che, submit_feedback(), FeedbackCreate

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (1): HealthEventBus

### Community 28 - "Community 28"
Cohesion: 0.4
Nodes (4): BaseSettings, Application configuration loaded from environment variables.  Uses ``pydantic-, Central configuration for the VITOGRAPH API.      Attributes:         supabas, Settings

### Community 29 - "Community 29"
Cohesion: 0.5
Nodes (3): negotiateLocale(), proxy(), updateSession()

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (2): generateSecurePassword(), handleLogin()

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (2): handleUpdate(), loadData()

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (2): translateUnit(), translateValueWithUnit()

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (1): run()

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (2): set(), unflatten()

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (1): Extract all text from a PDF file.          Reads every page of the PDF and con

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (1): Parse extracted text into structured biomarker data.          Uses OpenAI ``As

### Community 120 - "Community 120"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send

### Community 121 - "Community 121"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

## Knowledge Gaps
- **53 isolated node(s):** `Application configuration loaded from environment variables.  Uses ``pydantic-`, `Central configuration for the VITOGRAPH API.      Attributes:         supabas`, `Custom exception hierarchy for database / repository operations.  All exceptio`, `Base exception for all database-related errors.`, `Raised when a queried record does not exist.` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (36 nodes): `chat-prompt-builder.ts`, `localized-personas.ts`, `ChatPromptBuilder`, `.build()`, `.constructor()`, `.withActiveSkills()`, `.withAssistantMode()`, `.withChronicConditions()`, `.withCoachingMode()`, `.withDiaryMode()`, `.withDiarySecurityRule()`, `.withDietaryRestrictions()`, `.withEmotionalContext()`, `.withFoodZones()`, `.withGlycemicAwareRule()`, `.withGoalManagement()`, `.withHealthGoals()`, `.withHistorySynopsis()`, `.withKnowledgeBase()`, `.withKnowledgeBases()`, `.withLabReport()`, `.withLanguageDirective()`, `.withMealLogs()`, `.withNutritionTargets()`, `.withPastActions()`, `.withPersona()`, `.withProfile()`, `.withSemanticMemory()`, `.withSkillDocument()`, `.withSupplementProtocol()`, `.withTestResults()`, `.withTodayProgress()`, `.withTodaySupplements()`, `.withWaterContext()`, `.withWeatherAlert()`, `getLocalizedPersona()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (11 nodes): `PythonCoreClient`, `.calculateNorms()`, `.calculateNormsAction()`, `.constructor()`, `.getLabScanStatus()`, `.parseImage()`, `.parseImageBatch()`, `.parseImageBatchAsync()`, `.parsePdf()`, `.refreshBiomarkerNotesAction()`, `.request()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (6 nodes): `health-event-bus.ts`, `HealthEventBus`, `.constructor()`, `.emit()`, `.on()`, `.removeAllListeners()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (4 nodes): `page.tsx`, `checkSession()`, `generateSecurePassword()`, `handleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (4 nodes): `HealthGoalsWidget.tsx`, `handleRemoveGoal()`, `handleUpdate()`, `loadData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (4 nodes): `nutrient-utils.ts`, `normalizeMicronutrientKey()`, `translateUnit()`, `translateValueWithUnit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (3 nodes): `run()`, `flush_queue.js`, `flush_queue.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (3 nodes): `unflatten-json.js`, `set()`, `unflatten()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `Extract all text from a PDF file.          Reads every page of the PDF and con`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `Parse extracted text into structured biomarker data.          Uses OpenAI ``As`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 120`** (1 nodes): `Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 121`** (1 nodes): `Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 2` to `Community 3`, `Community 4`, `Community 5`, `Community 20`, `Community 21`, `Community 22`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `DatabaseError` connect `Community 0` to `Community 24`, `Community 9`, `Community 12`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `String()` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 52 inferred relationships involving `DatabaseError` (e.g. with `REST API endpoint for session analysis.  Compares actual blood test results fr` and `Provide an ``AnalysisService`` instance via DI.`) actually correct?**
  _`DatabaseError` has 52 INFERRED edges - model-reasoned connections that need verification._
- **Are the 44 inferred relationships involving `RecordNotFoundError` (e.g. with `REST API endpoint for session analysis.  Compares actual blood test results fr` and `Provide an ``AnalysisService`` instance via DI.`) actually correct?**
  _`RecordNotFoundError` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 47 inferred relationships involving `createClient()` (e.g. with `run()` and `fetchUserContext()`) actually correct?**
  _`createClient()` has 47 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `LabReportExtraction` (e.g. with `RefreshNotesRequest` and `RefreshedMarker`) actually correct?**
  _`LabReportExtraction` has 36 INFERRED edges - model-reasoned connections that need verification._