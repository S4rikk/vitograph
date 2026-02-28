# VITOGRAPH MVP Testing Guide 🧪

Congratulations! The system is fully integrated.
Follow these steps to verify the end-to-end flow.

## 1. Start the Servers (3 Terminals Needed)

### Terminal A: Python Core (The Brain) 🧠
Handles PDF parsing and norm calculations.
```bash
cd apps/api
# Make sure venv is active if you used one
uvicorn main:app --reload --port 8000
```
*Verify:* Open `http://localhost:8000/docs` to see Swagger UI.

### Terminal B: Node.js Gateway (The Body) 🛡️
Handles Auth, Chat, and Frontend requests.
```bash
cd apps/api/src/ai
npm run dev
```
*Verify:* Server should log "VITOGRAPH AI Engine v0.1.0 Port: 3001".

### Terminal C: Frontend (The Face) 🎨
The user interface.
```bash
cd apps/web
npm run dev
```
*Verify:* Open `http://localhost:3000`.

---

## 2. Test the Flow

1.  **Open App:** Go to `http://localhost:3000`.
2.  **Sign Up/In:** Create an account (or log in). You should be redirected to the Dashboard.
3.  **Navigate:** Click on the **"Medical Results"** (or similar) tab.
4.  **Test Upload:**
    -   Locate the sample file: `apps/api/dummy.pdf` (or `test_blood_work.pdf`).
    -   Drag & Drop it into the upload zone.
5.  **Observe Magic:**
    -   Spinner "Analyzing..." should appear.
    -   The file goes: Browser -> Node (`:3001`) -> Python (`:8000`).
    -   Python extracts data (e.g., "Ferritin: 50.5").
    -   Node returns JSON to Browser.
    -   **Result:** A card for "Ferritin" should appear with value `50.5` and status `Optimal`.

## Troubleshooting

-   **Upload fails?** Check Terminal B (Node) logs.
-   **"Connection Refused"?** Ensure Python (Terminal A) is running on port 8000.
-   **"Auth Error"?** Ensure you are logged in on the frontend.
