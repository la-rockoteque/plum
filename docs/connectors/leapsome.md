# Leapsome — research

Question: can a Plum user track their skill progress in Leapsome and turn it into goals?

## Two ways in

| | Leapsome MCP | Leapsome public REST API |
|---|---|---|
| Who connects | each employee, from their AI client (Claude, ChatGPT, Notion AI, Copilot agents, custom agents) | a company, with an admin-created API key exchanged for a JWT (`GET /token`) |
| Auth | OAuth sign-in; personal access token for clients without OAuth | bearer JWT, company scope |
| Sees | exactly what the user sees in Leapsome ("never widens access"; visibility and anonymity rules apply) | whatever the company key allows |
| Goals | **create and update personal goals**, edit common fields, update progress and progress status, comment | `GET /goals`, `GET /goals/{id}`, `GET /goals/{id}/comments`, `POST /goals/{id}/key-results/{krId}`, `POST /goals/{id}/initiatives/{id}` — **no goal creation** |
| Writes | each write action goes through a confirmation step before it is saved | direct |
| Enablement | a super admin turns MCP on, picks allowed scopes and user groups; employees then connect and approve scopes | admin creates the key |
| Hosting | EU-hosted, GDPR, ISO 27001 | same |

Other REST endpoints (for completeness): reviews, employees, employments, timesheets, payroll cycles, absences,
feedback (`POST /feedback/praise`, `/feedback/instant`, `/feedback/private-note`), documents, access roles.

## Verdict

**Use the MCP, not the REST API.** Plum is a personal tool; the MCP is per-user, needs no secrets in Plum, respects
Leapsome's permissions, can create personal goals, and puts a confirmation step in front of every write. The REST
API needs a company-wide admin key and can't create goals — it only fits a future org-level integration (e.g. HR
analytics), which is out of Plum's scope.

## What we couldn't verify

- **Exact MCP tool names and argument schemas.** The claude.ai Leapsome connector exposes only `authenticate` until
  a user signs in, and the help-centre article blocks automated reading. The connector skill therefore discovers
  tools at run time (anything under `mcp__*leapsome*` whose description mentions goals) instead of hard-coding names.
  **Next step:** someone with Leapsome access connects it once and records the goal tools' names and fields here.
- Whether personal goals can be made **private** (visible only to the owner) or always follow the company's default
  visibility. This matters: progress written to Leapsome is likely visible to a manager.
- Whether goals can carry **measurable key results** created through MCP, or only a progress percentage + status.

## Sources

- Leapsome MCP product page — https://www.leapsome.com/product/mcp
- Leapsome MCP help article — https://help.leapsome.com/hc/en-us/articles/37637705235229-Leapsome-MCP-Model-Context-Protocol
- Update goals and key results via API — https://help.leapsome.com/hc/en-us/articles/27607742571933
- Content API access — https://help.leapsome.com/hc/en-us/articles/9251417820061
- Public API reference (Swagger) — https://api.leapsome.com/v1/api-docs/
