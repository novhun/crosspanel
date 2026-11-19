<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Keep Website and Service as dedicated leaf routes using shared CrossPanel navigation and in-memory demo state; these management screens remain UI-only until APIs are requested.
- Keep service inventory, settings and activity in ServiceWorkspace with browser-safe service-data samples; isolated in-memory drafts never inspect files, reload processes or install packages.
- Keep Website browsing and tabbed hosting/HTTPS forms, including reverse-proxy target/path/Host/WebSocket settings, in WebsiteWorkspace; certificate and site controls only update in-memory previews and never contact targets or change real hosting.
- Keep per-website server configuration overrides isolated by engine, with browser-safe demo templates in website-server-config; templates are not full production configurations and no syntax checking or reload is performed.
- Keep website environment drafts, sample database links and project-folder previews in WebsiteProjectTools with site-local in-memory state; never read real files, collect database credentials or imply a live connection.
- Use shared AppVersionActions for application version selection and version-specific demo actions; sample versions and custom tags must not imply real downloads or installations.
- Keep Applications browsing, installed-app controls and custom-source forms in ApplicationsWorkspace with in-memory previews; source submissions never fetch, deploy or execute Compose.
- Keep tunnel installation, routing and activity in TunnelsWorkspace with browser-safe tunnel-data helpers and no provider credentials; provider changes reset preview connection status and no action contacts origins or installs clients.
- Keep automation task definitions, schedules and simulated run history in AutomationWorkspace with browser-safe automation-data helpers; reuse cron command restrictions and never execute scripts, contact hosts or transmit credentials.
- Keep file explorer navigation and operations in FilesWorkspace with browser-safe file-data samples; copy/move use validated in-memory trees, uploads read filenames only and no operation touches real files.
- Keep backups, users and cron in dedicated leaf routes with demo-only state; use DemoEditor for shared user/script forms and CronWorkspace with browser-safe cron-data helpers for scheduling, safety validation and import/export so displayed roles and schedules never grant access or execute commands.
- Keep timezone selection in Settings as a demo preference until APIs are connected; do not change server time or existing task schedules from this control.
- Keep database installation, configuration and backups in DatabasesWorkspace with browser-safe database-data helpers and DemoEditor records; versions, access and restores remain isolated in-memory previews.
- Keep dashboard resource reports in SystemReports with browser-safe demo data in report-data; simulated rates must be labeled as demo until monitoring APIs are provided.
- Keep Logs on a dedicated leaf route with browser-safe sample events and category/source filtering; refresh and export operate only on demo data until collection APIs are requested.
- Keep Settings security dialogs UI-only; clear password inputs on close, never persist or transmit them, and keep the login path as non-navigable in-memory preview state until auth APIs are requested.
- Keep WAF in a dedicated leaf route with in-memory views and mounted DemoEditor rule forms; engine eligibility comes from supportsWaf, and no preview control inspects or blocks real traffic.
- Keep Sub Accounts as a dedicated UI-only route using shared quota/limit helpers; user-area previews show allocated sample resources only and never imply real login or permission isolation.
- Keep AI as a dedicated UI-only workspace with a browser-safe tool specification catalog; chat replies, skills, model profiles, quota and ChatOps are labeled previews with no execution, credentials or external calls.
- Keep deployment project settings in unnested dynamic leaf routes with a browser-safe in-memory store keyed by project ID, so navigation retains isolated previews without storing credentials or changing real hosting.
