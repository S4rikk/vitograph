# TASK: Domain Migration to vitograph.com

**Required Skills:**
- Read `C:\store\ag_skills\skills\senior-architect\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\nodejs-backend-patterns\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\nextjs-app-router-patterns\SKILL.md` before coding.

**Architecture Context:**
We are migrating the production domain from `vg.sanderok.uk` to `vitograph.com`. 
DNS records are already set up in Cloudflare (A records for `@` and `www` pointing to `69.12.79.201`).
Cloudflare SSL is set to "Full (strict)".
Server uses Caddy as a reverse proxy.

Reference: `C:\project\kOSI\docs\infrastructure\domain_migration.md`

**Implementation Steps:**

1. **Update Frontend Config**:
   - Modify `C:\project\VITOGRAPH\apps\web\next.config.ts`.
   - Update `allowedDevOrigins` to include `vitograph.com` and `www.vitograph.com`.

2. **Update Server Proxy (Caddy)**:
   - Connect to the server via SSH (if your tools allow, or provide the exact content for the user to update).
   - Update `/etc/caddy/Caddyfile` on the VPS.
   - The new configuration must handle `vitograph.com` and `www.vitograph.com`.
   - **CRITICAL**: Maintain the direct route for `/api/v1/*` to port `3001` with `response_header_timeout 300s` to avoid 30s timeouts on long AI requests.
   - Add a redirect from `vg.sanderok.uk` to `https://vitograph.com`.

Proposed Caddyfile structure:
```caddy
vitograph.com, www.vitograph.com {
    handle_path /api/v1/* {
        reverse_proxy localhost:3001 {
            transport http {
                response_header_timeout 300s
            }
        }
    }
    reverse_proxy localhost:3000
}

vg.sanderok.uk {
    redir https://vitograph.com{uri}
}
```

3. **Reload Services**:
   - Reload Caddy: `systemctl reload caddy`.
   - Restart PM2 apps to ensure they pick up any environment changes if applicable: `pm2 restart all`.

4. **Verification**:
   - Verify that `https://vitograph.com` is accessible and has a valid SSL certificate.
   - Verify that `https://vg.sanderok.uk` redirects to the new domain.
   - Verify that a long-running AI API call (like lab analysis) doesn't time out after 30s.

**Workflow Reminder**: Use `@[/auto_deploy_vg]` after code changes to push and restart.
