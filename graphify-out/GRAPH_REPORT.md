# Graph Report - VITOGRAPH  (2026-05-17)

## Corpus Check
- 211 files · ~456,977 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 928 nodes · 1545 edges · 56 communities detected
- Extraction: 59% EXTRACTED · 41% INFERRED · 0% AMBIGUOUS · INFERRED: 631 edges (avg confidence: 0.57)
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
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 125|Community 125]]
- [[_COMMUNITY_Community 126|Community 126]]
- [[_COMMUNITY_Community 127|Community 127]]
- [[_COMMUNITY_Community 128|Community 128]]
- [[_COMMUNITY_Community 129|Community 129]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 131|Community 131]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 133|Community 133]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 135|Community 135]]
- [[_COMMUNITY_Community 136|Community 136]]
- [[_COMMUNITY_Community 137|Community 137]]
- [[_COMMUNITY_Community 138|Community 138]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 140|Community 140]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 143|Community 143]]
- [[_COMMUNITY_Community 144|Community 144]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 146|Community 146]]
- [[_COMMUNITY_Community 147|Community 147]]
- [[_COMMUNITY_Community 148|Community 148]]
- [[_COMMUNITY_Community 149|Community 149]]

## God Nodes (most connected - your core abstractions)
1. `DatabaseError` - 63 edges
2. `LabReportExtraction` - 54 edges
3. `ReferenceRange` - 53 edges
4. `BiomarkerResult` - 53 edges
5. `NormResult` - 53 edges
6. `RecordNotFoundError` - 52 edges
7. `UserProfile` - 52 edges
8. `createClient()` - 47 edges
9. `AiApiClient` - 40 edges
10. `ChatPromptBuilder` - 33 edges

## Surprising Connections (you probably didn't know these)
- `DatabaseError` --uses--> `Inserts a feedback row into the db.     Includes a 60-second rate-limit via che`  [INFERRED]
  apps\api\core\exceptions.py → apps\api\api\v1\endpoints\users.py
- `loadWearables()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `handleDeleteAccount()` --calls--> `createClient()`  [INFERRED]
  apps\web\src\components\profile\UserProfileSheet.tsx → apps\web\src\lib\supabase\server.ts
- `parse_lab_report()` --calls--> `extract_biomarkers()`  [INFERRED]
  apps\api\main.py → apps\api\services\pdf_parser.py
- `REST API endpoints for user feedback.  Handles submission of feedback/bug repo` --uses--> `DatabaseError`  [INFERRED]
  apps\api\api\v1\endpoints\users.py → apps\api\core\exceptions.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (81): DatabaseError, Custom exception hierarchy for database / repository operations.  All exceptio, Base exception for all database-related errors., Raised when a queried record does not exist., Raised when an insert violates a uniqueness constraint., RecordAlreadyExistsError, RecordNotFoundError, analyze_session() (+73 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (72): AdminLayout(), run(), getAppConfigKeys(), updateAppConfigItem(), handleUpdate(), AiSettingsPage(), HomePage(), handleSubmit() (+64 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (81): calculate_norm(), enrich_biomarkers_with_insights(), get_lab_scan_status(), global_exception_handler(), health_check(), http_exception_handler(), lifespan(), parse_lab_report() (+73 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (15): callModel(), sanitizeMessages(), initCheckpointer(), runNutritionAnalyzer(), PythonCoreClient, getSupabase(), requireAuth(), getLLMConfig() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (22): ActiveTypewriterNode(), handleImageSelect(), handleUpdate(), NutrPill(), parseNutrientTags(), getMicronutrientColor(), useTypewriter(), compressImage() (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (32): analyzeSymptomCorrelation(), buildPsychologicalFallback(), generateDiagnosticHypothesis(), generatePsychologicalResponse(), callLlmStructured(), runFoodVisionAnalyzer(), formatBiomarkersForLLM(), generateBiomarkersHash() (+24 more)

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
Cohesion: 0.23
Nodes (12): get_lab_schedule(), get_micronutrient_trends(), REST API endpoints for user analytics and insights.  Exposes ``GET`` operation, Fetch and aggregate daily micronutrient intake., Fetch and aggregate daily micronutrient intake., Generate predictive lab schedule., Generate predictive lab schedule., LabScheduleItem (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.24
Nodes (9): get_supabase_client(), Async Supabase client connection manager.  Provides a lazily-initialised, appl, FastAPI dependency that yields an async client.      If an Authorization heade, Manages the lifecycle of a single ``AsyncClient`` instance.      The client is, Return the cached async Supabase client.          Creates the client on first, Gracefully close the underlying HTTP connections., SupabaseClientManager, DatabaseConnectionError (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (10): Exception, extract_text_from_pdf(), LLMParsingError, parse_biomarkers_with_llm(), PDFExtractionError, PDFExtractorService, PDF Extractor Service — extracts biomarker data from lab reports.  Provides tw, Raised when PDF text extraction fails. (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.24
Nodes (9): BiomarkerBase, BiomarkerCreate, BiomarkerRead, BiomarkerUpdate, Pydantic V2 schemas for the ``biomarkers`` table.  Provides request/response m, Shared fields for biomarker create and read operations., Schema for creating a new biomarker (admin/service_role only)., Schema for partial biomarker updates (PATCH semantics).      All fields are op (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.27
Nodes (9): extract_biomarkers(), _extract_text_from_docx(), _extract_text_from_pdf(), _extract_text_from_txt(), File Parser Service — Multi-format biomarker extraction using AI.  Supports PD, Decode plain-text bytes (UTF-8 with fallback to cp1251)., Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:, Extract text from PDF bytes using pypdf. (+1 more)

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
Cohesion: 0.4
Nodes (4): BaseSettings, Application configuration loaded from environment variables.  Uses ``pydantic-, Central configuration for the VITOGRAPH API.      Attributes:         supabas, Settings

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (4): BiomarkerResult, extract_biomarkers(), PDF Parser Service — Regex-based extraction of biomarker values.  This service, Extract standard biomarkers from PDF bytes using Regex.

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (3): negotiateLocale(), proxy(), updateSession()

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (2): generateSecurePassword(), handleLogin()

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (2): handleUpdate(), loadData()

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (2): translateUnit(), translateValueWithUnit()

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (1): run()

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (2): set(), unflatten()

### Community 98 - "Community 98"
Cohesion: 1.0
Nodes (1): Extract all text from a PDF file.          Reads every page of the PDF and con

### Community 99 - "Community 99"
Cohesion: 1.0
Nodes (1): Parse extracted text into structured biomarker data.          Uses OpenAI ``As

### Community 125 - "Community 125"
Cohesion: 1.0
Nodes (1): The root structure expected from the LLM.

### Community 126 - "Community 126"
Cohesion: 1.0
Nodes (1): Extract text from PDF bytes using pypdf.

### Community 127 - "Community 127"
Cohesion: 1.0
Nodes (1): Extract text from DOCX bytes using python-docx.

### Community 128 - "Community 128"
Cohesion: 1.0
Nodes (1): Decode plain-text bytes (UTF-8 with fallback to cp1251).

### Community 129 - "Community 129"
Cohesion: 1.0
Nodes (1): Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:

### Community 130 - "Community 130"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send

### Community 131 - "Community 131"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

### Community 132 - "Community 132"
Cohesion: 1.0
Nodes (1): Schema for creating a new user profile.      The ``id`` is provided by Supabas

### Community 133 - "Community 133"
Cohesion: 1.0
Nodes (1): Schema for partial profile updates (PATCH semantics).      All fields are opti

### Community 134 - "Community 134"
Cohesion: 1.0
Nodes (1): Schema returned by the API when reading a profile.

### Community 135 - "Community 135"
Cohesion: 1.0
Nodes (1): Represents aggregated micronutrients for a single day.          Since the keys

### Community 136 - "Community 136"
Cohesion: 1.0
Nodes (1): Represents a recommendation for a single biomarker test.

### Community 137 - "Community 137"
Cohesion: 1.0
Nodes (1): Encapsulates the reference range explicitly stated in the document.

### Community 138 - "Community 138"
Cohesion: 1.0
Nodes (1): A single biomarker extracted dynamically from the lab report.

### Community 139 - "Community 139"
Cohesion: 1.0
Nodes (1): The root structure expected from the LLM.

### Community 140 - "Community 140"
Cohesion: 1.0
Nodes (1): Extract text from PDF bytes using pypdf.

### Community 141 - "Community 141"
Cohesion: 1.0
Nodes (1): Extract text from DOCX bytes using python-docx.

### Community 142 - "Community 142"
Cohesion: 1.0
Nodes (1): Decode plain-text bytes (UTF-8 with fallback to cp1251).

### Community 143 - "Community 143"
Cohesion: 1.0
Nodes (1): Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:

### Community 144 - "Community 144"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send

### Community 145 - "Community 145"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

### Community 146 - "Community 146"
Cohesion: 1.0
Nodes (1): Calculate personalized norms based on profile factors (Mock Logic).

### Community 147 - "Community 147"
Cohesion: 1.0
Nodes (1): Extract standard biomarkers from PDF bytes using Regex.

### Community 148 - "Community 148"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send

### Community 149 - "Community 149"
Cohesion: 1.0
Nodes (1): Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

## Knowledge Gaps
- **76 isolated node(s):** `Application configuration loaded from environment variables.  Uses ``pydantic-`, `Central configuration for the VITOGRAPH API.      Attributes:         supabas`, `Custom exception hierarchy for database / repository operations.  All exceptio`, `Base exception for all database-related errors.`, `Raised when a queried record does not exist.` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (36 nodes): `chat-prompt-builder.ts`, `localized-personas.ts`, `ChatPromptBuilder`, `.build()`, `.constructor()`, `.withActiveSkills()`, `.withAssistantMode()`, `.withChronicConditions()`, `.withCoachingMode()`, `.withDiaryMode()`, `.withDiarySecurityRule()`, `.withDietaryRestrictions()`, `.withEmotionalContext()`, `.withFoodZones()`, `.withGlycemicAwareRule()`, `.withGoalManagement()`, `.withHealthGoals()`, `.withHistorySynopsis()`, `.withKnowledgeBase()`, `.withKnowledgeBases()`, `.withLabReport()`, `.withLanguageDirective()`, `.withMealLogs()`, `.withNutritionTargets()`, `.withPastActions()`, `.withPersona()`, `.withProfile()`, `.withSemanticMemory()`, `.withSkillDocument()`, `.withSupplementProtocol()`, `.withTestResults()`, `.withTodayProgress()`, `.withTodaySupplements()`, `.withWaterContext()`, `.withWeatherAlert()`, `getLocalizedPersona()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (6 nodes): `health-event-bus.ts`, `HealthEventBus`, `.constructor()`, `.emit()`, `.on()`, `.removeAllListeners()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (4 nodes): `page.tsx`, `checkSession()`, `generateSecurePassword()`, `handleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (4 nodes): `HealthGoalsWidget.tsx`, `handleRemoveGoal()`, `handleUpdate()`, `loadData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (4 nodes): `nutrient-utils.ts`, `normalizeMicronutrientKey()`, `translateUnit()`, `translateValueWithUnit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (3 nodes): `run()`, `flush_queue.js`, `flush_queue.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (3 nodes): `unflatten-json.js`, `set()`, `unflatten()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `Extract all text from a PDF file.          Reads every page of the PDF and con`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `Parse extracted text into structured biomarker data.          Uses OpenAI ``As`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 125`** (1 nodes): `The root structure expected from the LLM.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 126`** (1 nodes): `Extract text from PDF bytes using pypdf.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 127`** (1 nodes): `Extract text from DOCX bytes using python-docx.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 128`** (1 nodes): `Decode plain-text bytes (UTF-8 with fallback to cp1251).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 129`** (1 nodes): `Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 130`** (1 nodes): `Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (1 nodes): `Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 132`** (1 nodes): `Schema for creating a new user profile.      The ``id`` is provided by Supabas`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 133`** (1 nodes): `Schema for partial profile updates (PATCH semantics).      All fields are opti`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 134`** (1 nodes): `Schema returned by the API when reading a profile.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 135`** (1 nodes): `Represents aggregated micronutrients for a single day.          Since the keys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 136`** (1 nodes): `Represents a recommendation for a single biomarker test.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 137`** (1 nodes): `Encapsulates the reference range explicitly stated in the document.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 138`** (1 nodes): `A single biomarker extracted dynamically from the lab report.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 139`** (1 nodes): `The root structure expected from the LLM.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 140`** (1 nodes): `Extract text from PDF bytes using pypdf.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 141`** (1 nodes): `Extract text from DOCX bytes using python-docx.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 142`** (1 nodes): `Decode plain-text bytes (UTF-8 with fallback to cp1251).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 143`** (1 nodes): `Extract standard biomarkers from PDF, DOCX, or TXT file using AI.      Args:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 144`** (1 nodes): `Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 146`** (1 nodes): `Calculate personalized norms based on profile factors (Mock Logic).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 147`** (1 nodes): `Extract standard biomarkers from PDF bytes using Regex.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 148`** (1 nodes): `Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.      Send`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 149`** (1 nodes): `Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 1` to `Community 20`, `Community 3`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `DatabaseError` connect `Community 0` to `Community 10`, `Community 12`, `Community 21`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `ProfileUpdate` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 56 inferred relationships involving `DatabaseError` (e.g. with `REST API endpoint for session analysis.  Compares actual blood test results fr` and `Provide an ``AnalysisService`` instance via DI.`) actually correct?**
  _`DatabaseError` has 56 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `LabReportExtraction` (e.g. with `RefreshNotesRequest` and `RefreshedMarker`) actually correct?**
  _`LabReportExtraction` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `ReferenceRange` (e.g. with `RefreshNotesRequest` and `RefreshedMarker`) actually correct?**
  _`ReferenceRange` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `BiomarkerResult` (e.g. with `RefreshNotesRequest` and `RefreshedMarker`) actually correct?**
  _`BiomarkerResult` has 50 INFERRED edges - model-reasoned connections that need verification._