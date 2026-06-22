# Graph Report - VITOGRAPH  (2026-06-22)

## Corpus Check
- 267 files · ~476,254 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1034 nodes · 1681 edges · 56 communities detected
- Extraction: 57% EXTRACTED · 43% INFERRED · 0% AMBIGUOUS · INFERRED: 721 edges (avg confidence: 0.57)
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
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 155|Community 155]]
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]
- [[_COMMUNITY_Community 184|Community 184]]
- [[_COMMUNITY_Community 185|Community 185]]
- [[_COMMUNITY_Community 186|Community 186]]
- [[_COMMUNITY_Community 187|Community 187]]
- [[_COMMUNITY_Community 188|Community 188]]
- [[_COMMUNITY_Community 189|Community 189]]
- [[_COMMUNITY_Community 190|Community 190]]
- [[_COMMUNITY_Community 191|Community 191]]
- [[_COMMUNITY_Community 192|Community 192]]
- [[_COMMUNITY_Community 193|Community 193]]
- [[_COMMUNITY_Community 194|Community 194]]
- [[_COMMUNITY_Community 195|Community 195]]
- [[_COMMUNITY_Community 196|Community 196]]
- [[_COMMUNITY_Community 197|Community 197]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 199|Community 199]]
- [[_COMMUNITY_Community 200|Community 200]]
- [[_COMMUNITY_Community 201|Community 201]]
- [[_COMMUNITY_Community 202|Community 202]]
- [[_COMMUNITY_Community 203|Community 203]]
- [[_COMMUNITY_Community 204|Community 204]]
- [[_COMMUNITY_Community 205|Community 205]]

## God Nodes (most connected - your core abstractions)
1. `LabReportExtraction` - 71 edges
2. `ReferenceRange` - 70 edges
3. `BiomarkerResult` - 70 edges
4. `NormResult` - 70 edges
5. `UserProfile` - 69 edges
6. `DatabaseError` - 63 edges
7. `RecordNotFoundError` - 52 edges
8. `createClient()` - 52 edges
9. `AiApiClient` - 41 edges
10. `ChatPromptBuilder` - 34 edges

## Surprising Connections (you probably didn't know these)
- `DatabaseError` --uses--> `Inserts a feedback row into the db.     Includes a 60-second rate-limit via che`  [INFERRED]
  apps\api\core\exceptions.py → apps\api\api\v1\endpoints\users.py
- `loadWearables()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `handleDeleteAccount()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `handleDeleteMetric()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `handleDeleteAllMetrics()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (81): DatabaseError, Custom exception hierarchy for database / repository operations.  All exceptio, Base exception for all database-related errors., Raised when a queried record does not exist., Raised when an insert violates a uniqueness constraint., RecordAlreadyExistsError, RecordNotFoundError, analyze_session() (+73 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (77): AdminLayout(), run(), getAppConfigKeys(), updateAppConfigItem(), handleUpdate(), AiSettingsPage(), HomePage(), handleSubmit() (+69 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (94): calculate_norm(), enrich_biomarkers_with_insights(), get_lab_scan_status(), global_exception_handler(), health_check(), http_exception_handler(), lifespan(), LifespanTextEmbedding (+86 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (15): callModel(), sanitizeMessages(), initCheckpointer(), runNutritionAnalyzer(), PythonCoreClient, getSupabase(), requireAuth(), getLLMConfig() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (25): ActiveTypewriterNode(), handleImageSelect(), handleUpdate(), NutrPill(), parseNutrientTags(), getMicronutrientColor(), useTypewriter(), compressImage() (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (30): analyzeSymptomCorrelation(), buildPsychologicalFallback(), generateDiagnosticHypothesis(), generatePsychologicalResponse(), callLlmStructured(), runFoodVisionAnalyzer(), formatBiomarkersForLLM(), generateBiomarkersHash() (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (3): AiApiClient, getApiBaseUrl(), getAuthToken()

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (2): ChatPromptBuilder, getLocalizedPersona()

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (12): createMealLog(), loadUserProfile(), resolveFood(), AppError, ConflictError, getStatusCode(), NotFoundError, toErrorResponse() (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.23
Nodes (12): get_lab_schedule(), get_micronutrient_trends(), REST API endpoints for user analytics and insights.  Exposes ``GET`` operation, Fetch and aggregate daily micronutrient intake., Fetch and aggregate daily micronutrient intake., Generate predictive lab schedule., Generate predictive lab schedule., LabScheduleItem (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (13): extract_biomarkers(), extract_biomarkers_from_image(), extract_biomarkers_from_image_batch(), _extract_text_from_docx(), _extract_text_from_pdf(), _extract_text_from_txt(), File Parser Service — Multi-format biomarker extraction using AI.  Supports PD, Decode plain-text bytes (UTF-8 with fallback to cp1251). (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (9): get_supabase_client(), Async Supabase client connection manager.  Provides a lazily-initialised, appl, FastAPI dependency that yields an async client.      If an Authorization heade, Manages the lifecycle of a single ``AsyncClient`` instance.      The client is, Return the cached async Supabase client.          Creates the client on first, Gracefully close the underlying HTTP connections., SupabaseClientManager, DatabaseConnectionError (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.24
Nodes (10): Exception, extract_text_from_pdf(), LLMParsingError, parse_biomarkers_with_llm(), PDFExtractionError, PDFExtractorService, PDF Extractor Service — extracts biomarker data from lab reports.  Provides tw, Raised when PDF text extraction fails. (+2 more)

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
Cohesion: 0.33
Nodes (5): REST API endpoints for user feedback.  Handles submission of feedback/bug repo, Inserts a feedback row into the db.     Includes a 60-second rate-limit via che, Inserts a feedback row into the db.     Includes a 60-second rate-limit via che, submit_feedback(), FeedbackCreate

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (1): HealthEventBus

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (4): BiomarkerResult, extract_biomarkers(), PDF Parser Service — Regex-based extraction of biomarker values.  This service, Extract standard biomarkers from PDF bytes using Regex.

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (4): BaseSettings, Application configuration loaded from environment variables.  Uses ``pydantic-, Central configuration for the VITOGRAPH API.      Attributes:         supabas, Settings

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (3): negotiateLocale(), proxy(), updateSession()

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (2): generateSecurePassword(), handleLogin()

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (2): handleUpdate(), loadData()

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (2): translateUnit(), translateValueWithUnit()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (1): run()

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (2): set(), unflatten()

### Community 155 - "Community 155"
Cohesion: 1.0
Nodes (1): Extract all text from a PDF file.          Reads every page of the PDF and con

### Community 156 - "Community 156"
Cohesion: 1.0
Nodes (1): Parse extracted text into structured biomarker data.          Uses OpenAI ``As

### Community 181 - "Community 181"
Cohesion: 1.0
Nodes (1): The root structure expected from the LLM.

### Community 182 - "Community 182"
Cohesion: 1.0
Nodes (1): Extract text from PDF bytes using pypdf.

### Community 183 - "Community 183"
Cohesion: 1.0
Nodes (1): Extract text from DOCX bytes using python-docx.

### Community 184 - "Community 184"
Cohesion: 1.0
Nodes (1): Decode plain-text bytes (UTF-8 with fallback to cp1251).

### Community 185 - "Community 185"
Cohesion: 1.0
Nodes (1): Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:

### Community 186 - "Community 186"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send

### Community 187 - "Community 187"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

### Community 188 - "Community 188"
Cohesion: 1.0
Nodes (1): Schema for creating a new user profile.      The ``id`` is provided by Supabas

### Community 189 - "Community 189"
Cohesion: 1.0
Nodes (1): Schema for partial profile updates (PATCH semantics).      All fields are opti

### Community 190 - "Community 190"
Cohesion: 1.0
Nodes (1): Schema returned by the API when reading a profile.

### Community 191 - "Community 191"
Cohesion: 1.0
Nodes (1): Represents aggregated micronutrients for a single day.          Since the keys

### Community 192 - "Community 192"
Cohesion: 1.0
Nodes (1): Represents a recommendation for a single biomarker test.

### Community 193 - "Community 193"
Cohesion: 1.0
Nodes (1): Encapsulates the reference range explicitly stated in the document.

### Community 194 - "Community 194"
Cohesion: 1.0
Nodes (1): A single biomarker extracted dynamically from the lab report.

### Community 195 - "Community 195"
Cohesion: 1.0
Nodes (1): The root structure expected from the LLM.

### Community 196 - "Community 196"
Cohesion: 1.0
Nodes (1): Extract text from PDF bytes using pypdf.

### Community 197 - "Community 197"
Cohesion: 1.0
Nodes (1): Extract text from DOCX bytes using python-docx.

### Community 198 - "Community 198"
Cohesion: 1.0
Nodes (1): Decode plain-text bytes (UTF-8 with fallback to cp1251).

### Community 199 - "Community 199"
Cohesion: 1.0
Nodes (1): Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:

### Community 200 - "Community 200"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send

### Community 201 - "Community 201"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

### Community 202 - "Community 202"
Cohesion: 1.0
Nodes (1): Calculate personalized norms based on profile factors (Mock Logic).

### Community 203 - "Community 203"
Cohesion: 1.0
Nodes (1): Extract standard biomarkers from PDF bytes using Regex.

### Community 204 - "Community 204"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send

### Community 205 - "Community 205"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

## Knowledge Gaps
- **76 isolated node(s):** `Application configuration loaded from environment variables.  Uses ``pydantic-`, `Central configuration for the VITOGRAPH API.      Attributes:         supabas`, `Custom exception hierarchy for database / repository operations.  All exceptio`, `Base exception for all database-related errors.`, `Raised when a queried record does not exist.` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (37 nodes): `chat-prompt-builder.ts`, `localized-personas.ts`, `ChatPromptBuilder`, `.build()`, `.constructor()`, `.withActiveSkills()`, `.withAssistantMode()`, `.withChronicConditions()`, `.withCoachingMode()`, `.withDiaryMode()`, `.withDiarySecurityRule()`, `.withDietaryRestrictions()`, `.withEmotionalContext()`, `.withFoodZones()`, `.withGlycemicAwareRule()`, `.withGoalManagement()`, `.withHealthGoals()`, `.withHistorySynopsis()`, `.withKnowledgeBase()`, `.withKnowledgeBases()`, `.withLabReport()`, `.withLanguageDirective()`, `.withMealLogs()`, `.withNutritionTargets()`, `.withPastActions()`, `.withPersona()`, `.withPreviousInsight()`, `.withProfile()`, `.withSemanticMemory()`, `.withSkillDocument()`, `.withSupplementProtocol()`, `.withTestResults()`, `.withTodayProgress()`, `.withTodaySupplements()`, `.withWaterContext()`, `.withWeatherAlert()`, `getLocalizedPersona()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (6 nodes): `health-event-bus.ts`, `HealthEventBus`, `.constructor()`, `.emit()`, `.on()`, `.removeAllListeners()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (4 nodes): `page.tsx`, `checkSession()`, `generateSecurePassword()`, `handleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (4 nodes): `HealthGoalsWidget.tsx`, `handleRemoveGoal()`, `handleUpdate()`, `loadData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (4 nodes): `nutrient-utils.ts`, `normalizeMicronutrientKey()`, `translateUnit()`, `translateValueWithUnit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (3 nodes): `run()`, `flush_queue.js`, `flush_queue.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (3 nodes): `unflatten-json.js`, `set()`, `unflatten()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 155`** (1 nodes): `Extract all text from a PDF file.          Reads every page of the PDF and con`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 156`** (1 nodes): `Parse extracted text into structured biomarker data.          Uses OpenAI ``As`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 181`** (1 nodes): `The root structure expected from the LLM.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (1 nodes): `Extract text from PDF bytes using pypdf.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 183`** (1 nodes): `Extract text from DOCX bytes using python-docx.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 184`** (1 nodes): `Decode plain-text bytes (UTF-8 with fallback to cp1251).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 185`** (1 nodes): `Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 186`** (1 nodes): `Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 187`** (1 nodes): `Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 188`** (1 nodes): `Schema for creating a new user profile.      The ``id`` is provided by Supabas`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 189`** (1 nodes): `Schema for partial profile updates (PATCH semantics).      All fields are opti`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 190`** (1 nodes): `Schema returned by the API when reading a profile.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 191`** (1 nodes): `Represents aggregated micronutrients for a single day.          Since the keys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 192`** (1 nodes): `Represents a recommendation for a single biomarker test.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 193`** (1 nodes): `Encapsulates the reference range explicitly stated in the document.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 194`** (1 nodes): `A single biomarker extracted dynamically from the lab report.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 195`** (1 nodes): `The root structure expected from the LLM.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 196`** (1 nodes): `Extract text from PDF bytes using pypdf.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 197`** (1 nodes): `Extract text from DOCX bytes using python-docx.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 198`** (1 nodes): `Decode plain-text bytes (UTF-8 with fallback to cp1251).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 199`** (1 nodes): `Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 200`** (1 nodes): `Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 201`** (1 nodes): `Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 202`** (1 nodes): `Calculate personalized norms based on profile factors (Mock Logic).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 203`** (1 nodes): `Extract standard biomarkers from PDF bytes using Regex.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 204`** (1 nodes): `Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 205`** (1 nodes): `Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 1` to `Community 20`, `Community 3`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `DatabaseError` connect `Community 0` to `Community 21`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `ProfileUpdate` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 67 inferred relationships involving `LabReportExtraction` (e.g. with `LifespanTextEmbedding` and `RefreshNotesRequest`) actually correct?**
  _`LabReportExtraction` has 67 INFERRED edges - model-reasoned connections that need verification._
- **Are the 67 inferred relationships involving `ReferenceRange` (e.g. with `LifespanTextEmbedding` and `RefreshNotesRequest`) actually correct?**
  _`ReferenceRange` has 67 INFERRED edges - model-reasoned connections that need verification._
- **Are the 67 inferred relationships involving `BiomarkerResult` (e.g. with `LifespanTextEmbedding` and `RefreshNotesRequest`) actually correct?**
  _`BiomarkerResult` has 67 INFERRED edges - model-reasoned connections that need verification._
- **Are the 67 inferred relationships involving `NormResult` (e.g. with `LifespanTextEmbedding` and `RefreshNotesRequest`) actually correct?**
  _`NormResult` has 67 INFERRED edges - model-reasoned connections that need verification._