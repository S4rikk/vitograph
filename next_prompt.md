# TASK: Fix Missing Python Backend Restart in deploy.sh

**Required Skills:**
- Read `C:\store\ag_skills\skills\senior-architect\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\python-pro\SKILL.md` before coding.

**Architecture Context:**
The `deploy.sh` script currently deployed on the server and located in the root of the repository checks out `main`, builds the Next.js frontend, and the Node.js backend. It concludes with:
`pm2 restart vitograph vitograph-ai`.

However, it ignores the Python Core Engine completely (`vitograph-api`). Because of this, the server's Python instance has an uptime of 19 days and lacks newly merged endpoints like `/parse-image-batch`, which causes a `404 Not Found` error when the Node.js backend attempts to call it.

**Implementation Steps:**
1. Open the file `C:\project\VITOGRAPH\deploy.sh`.
2. Add a new stage for the Python Engine (FastAPI) just before the restart command:
   ```bash
   # Обновление Python Core
   echo "Updating Python Engine..."
   cd apps/api
   pip install -r requirements.txt
   cd ../..
   ```
3. Update the final `pm2 restart` command so that it restarts ALL THREE processes to ensure this desync never happens again:
   ```bash
   pm2 restart vitograph vitograph-ai vitograph-api
   ```
4. Add a comment in `deploy.sh` explaining that ALL THREE components (NextJS, Node API, Python Core) MUST be restarted on every deploy to keep versions in sync.
5. Create a short report `next_report.md` stating what was done. Do NOT attempt to run `deploy_to_server_vg.bat` automatically!

Использованные скиллы: `senior-architect`, `python-pro`
