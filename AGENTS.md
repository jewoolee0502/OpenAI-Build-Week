# ImagineLab — Build Context

Read `PRD.md` before making product or architecture decisions. It is the source of truth for this repository.

## Product

- ImagineLab is an Android-first platform for elementary-aged children to create, edit, play, and publish **basic browser games** from natural-language prompts.
- A game is a self-contained HTML/CSS/JavaScript bundle. It runs in Android preview and at a public hosted HTML link.
- Children have their own accounts linked to guardian accounts.
- Guardians use a separate website to view linked children's projects and development activity. Anyone with a public game link can play it without an account.
- The MVP includes generation, iterative natural-language edits, drafts, publishing/unpublishing, public links, and guardian oversight.

## Chosen Stack

- Mobile: React Native + TypeScript + Expo, Android-first; preview games with `react-native-webview`.
- Parent portal: React + TypeScript + Vite responsive website.
- Auth, data, storage: local PostgreSQL-backed application services.
- Backend: TypeScript/Node.js/Fastify.
- AI: OpenAI server SDK, Responses API, and Audio Transcriptions API, called only by the backend.
- Public games: Fastify route (`/g/:slug`) serving a published game bundle.

## Non-negotiable Constraints

- Never put an OpenAI API key, PostgreSQL credential, or any secret in the Expo app, parent website, a game bundle, or client-visible source.
- Route child voice recordings through the authenticated backend and do not retain raw audio after transcription.
- Authenticate backend requests and enforce child/guardian/project permissions server-side.
- A child can access only their own projects; a guardian only their linked children's projects; public visitors only published game artifacts.
- Treat generated HTML/JS as untrusted. Validate it before saving/publishing and isolate it from the parent page, account data, credentials, and arbitrary external network access.
- Version every generated or edited project bundle; retain activity events for create, edit, publish, and unpublish.
- Do not expand the MVP into native game export, multiplayer, social features, teacher tools, payments, ads, a block editor, custom asset upload, or source-code editing unless explicitly requested.

## Decision Rule

Do not invent product policy. Ask the user before deciding any item not confirmed in `PRD.md`, especially guardian-linking/approval flow, child age and launch geography, content rules, public-link controls, exact activity detail, or allowed game capabilities.

## Engineering Rule

Keep changes scoped to the request. Run relevant available checks after changes and report any checks that could not run.
