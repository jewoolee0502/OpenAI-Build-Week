# ImagineLab — Product Requirements Document

## 1. Product Summary

ImagineLab is an Android-first platform that lets elementary-school students turn natural-language ideas into small, playable browser games. Children use a React Native Expo app designed for phones and tablets. A student describes a game, the platform generates a self-contained HTML, CSS, and JavaScript game, and the student can continue refining it by chat. When ready, the student publishes the game to a public HTML link hosted by the product's server.

A separate responsive parent website shows guardians the child's projects and creative process. It can generate evidence-based AI observations about how a specific project developed, including creative exploration, iteration, problem solving, follow-through, communication, and supported interest signals. These observations are conversation aids, not scores, rankings, diagnoses, or predictions of a child's fixed abilities or potential.

The product introduces young students to creative problem-solving and the core loop of software creation: imagine, build, test, improve, and share. It is inspired by the accessibility of AI creation tools, but its first release is deliberately limited to basic games appropriate for elementary-aged users.

## 2. Problem

Young students are naturally curious and creative, with ideas that can become playful and sometimes unexpectedly ambitious games. They may not yet have the programming skills, desktop tooling, or technical knowledge to turn those ideas into something playable. Modern agentic tools can help bridge that gap: a child can describe an idea in everyday language and turn it into a real product they can play and share.

The product also makes the creative process itself part of the learning. As children imagine a game, build it, test it, notice what could improve, and ask for changes, they practice problem-solving and experience the core programming loop without needing to begin by writing code.

## 3. Goals

- Let a child create a basic browser game from a natural-language description on Android.
- Let the child play the generated game immediately in the app.
- Let the child refine an existing game with follow-up natural-language requests.
- Let the child publish a game to a public, shareable HTML link.
- Give a linked guardian visibility into their child's projects and development activity.
- Give a guardian evidence-based, project-specific AI observations and conversation starters.
- Let anyone with a published game link, including a guardian, play the game without creating an account.

## 4. Non-goals for the Hackathon MVP

- Native Android game export or app-store publishing.
- Multiplayer games, chat, comments, likes, or social feeds.
- A visual block editor, custom asset uploads, or manual source-code editing.
- Games beyond a simple single-page HTML/CSS/JavaScript bundle.
- Teacher/classroom administration features.
- Payments, subscriptions, or advertising.
- An open child social network with comments, direct messages, follower counts, or competitive rankings.

### Post-MVP direction

- A moderated project gallery may let children discover and play approved public games.
- Remixing an approved game may be explored as a learning and inspiration tool.
- Community identity, publishing approval, moderation, reporting, and guardian controls must be defined before implementation.

## 5. Users and Roles

| Role | Description | Core capabilities |
| --- | --- | --- |
| Child | An elementary-aged student with their own account linked to a guardian. | Create, edit, play, publish, and view their own games. |
| Guardian | A parent or guardian with an account linked to one or more child accounts. | View their linked child's work and development activity; generate project-based AI observations; play any game received through a public link. |
| Public visitor | Anyone opening a published game link. | Play the published game without an account. |

## 6. MVP User Stories

### Child

- As a child, I can create an account and link it to a guardian account.
- As a child, I can write an idea such as “make a game where a frog catches flies” and receive a playable game.
- As a child, I can hold a talk button, describe a game or change aloud, and receive editable transcribed text.
- As a child, I can play my game inside the mobile app.
- As a child, I can ask for a change such as “make it faster” or “add three lives,” then preview the updated game.
- As a child, I can save a draft game.
- As a child, I can publish a saved game and copy or share its public link.

### Guardian

- As a guardian, I can create an account and link it with my child's account.
- As a guardian, I can see the child's projects and a chronological record of creation and edit events.
- As a guardian, I can generate an evidence-based AI summary of a project and receive questions I can use to discuss it with my child.
- As a guardian, I can open a public game link shared with me and play it without being required to sign in.

### Public visitor

- As a visitor, I can open a public game URL in a browser and play the game.

## 7. Primary User Flows

### Create and refine a game

1. A child signs in to the Expo mobile app.
2. The child chooses **Create game** and types an idea or holds the talk button to describe it aloud.
3. For voice input, the app records until release, the backend transcribes the bounded audio request, and the app places the result in the editable prompt field.
4. The backend generates a basic game as HTML, CSS, and JavaScript.
5. The app opens a preview in a sandboxed web view.
6. The child types or speaks an edit request in natural language.
7. The backend updates the game bundle, saves a new version, and returns a refreshed preview.
8. The child saves the game as a draft or publishes it.

### Publish and play

1. A child selects **Publish** from a saved game.
2. The backend creates or updates a public slug for the latest approved version.
3. The app shows a copy/shareable public URL.
4. A visitor opens the URL and plays the game in a browser.

### Guardian oversight

1. A guardian signs in to the parent website.
2. The guardian opens the linked child's profile.
3. The guardian sees projects, their publish status, and creation/edit activity.
4. The guardian opens a project preview or a public link.
5. The guardian requests an AI child insight and sees portfolio-wide observations, supporting project evidence, interest signals, and conversation starters.

## 8. Functional Requirements

### Accounts and access

- Support email/password registration and Google Sign-In.
- Support separate child and guardian accounts.
- Store a child-to-guardian relationship and enforce it in backend authorization checks.
- A child may access only their own projects.
- A guardian may access only projects and activity belonging to linked children.
- A public visitor may access only the published game artifact addressed by a valid public slug.

### Game generation and editing

- Accept a short natural-language game brief.
- Support push-to-talk input for creation and edit prompts: hold to record, release to transcribe, and keep the resulting text editable before submission.
- Limit each voice recording to 30 seconds and do not persist the raw audio after transcription.
- Generate a self-contained, basic HTML/CSS/JavaScript game bundle.
- Restrict generated games to a documented, safe browser capability set.
- Display a playable preview in the Expo mobile app.
- Persist the source bundle and immutable versions for each generation or edit.
- Accept natural-language edits against an existing project and return an updated playable version.
- Show a clear error and allow retry when generation fails.

### Projects and publishing

- List a child's saved projects with title, thumbnail or placeholder, last-updated time, and publish status.
- Support draft and published states.
- Generate a stable public URL for a published project.
- Serve the latest published version at that URL.
- Allow a project to be unpublished so its public URL no longer serves a game.

### Guardian dashboard

- List linked children.
- For each child, list projects and their current status.
- Display an activity timeline containing at least create, edit, publish, and unpublish events.

### Parent AI child insights

- Generate a child-level portfolio insight only for a guardian who is linked to that child.
- Analyze prompts, immutable version history, and supported activity events across all of the child's available projects; do not infer from unrelated account or personal data.
- Return a plain-language portfolio summary, two to five supported observation dimensions, possible interest signals, and two to four conversation starters.
- Attach concrete, named project/version evidence to every observation dimension and identify which projects contributed to the snapshot.
- Use bounded language such as “across the available projects,” “may suggest,” and “there is not yet enough evidence.”
- Never score, rank, diagnose, compare with other children, predict a career, or assert fixed traits, intelligence, or potential.
- Do not attribute AI-generated implementation quality to the child; use only child-originated prompts, edits, playtests, and reflections as evidence.
- Label every report as a portfolio-based observation of available creative work rather than a psychological, educational, or skills assessment.

## 9. Technical Stack

The selected stack optimizes for a small Android-first hackathon build: one primary language on the backend, managed authentication and data services, a secure server-side boundary for OpenAI, and a straightforward way to serve public game links.

| Area | Selected technology | Why it is selected |
| --- | --- | --- |
| Mobile app | React Native, TypeScript, Expo, Expo Router | Android-first delivery with a fast hackathon workflow and one maintainable mobile codebase. |
| In-app game preview | `react-native-webview` | Runs the generated HTML game inside the Expo app on Android and iOS. |
| Voice recording | `expo-audio` | Provides Expo Go-compatible microphone recording for bounded push-to-talk requests. |
| Parent website | React, TypeScript, Vite | Keeps the guardian experience responsive and easy to demo on a laptop without adding parent-only screens to the child app. |
| Authentication and app data | Local PostgreSQL-backed application services | Keeps account, guardian-link, project, version, activity, and insight data in one local relational store. |
| Game bundle storage | Local PostgreSQL | Stores versioned HTML/CSS/JavaScript bundles with their project-version records for the MVP. |
| Backend API | TypeScript, Node.js, Fastify | Keeps the OpenAI API key off devices; handles generation, authorization, publishing, and public serving. |
| AI integration | Official OpenAI server SDK using the Responses API and Audio Transcriptions API | Provides server-side generation, iterative editing, insights, and speech-to-text without exposing credentials to either client. |
| Public game delivery | Fastify public route | Serves a stable `https://<domain>/g/<slug>` link from the product's own backend. |
| Client/backend communication | HTTPS JSON API with application authentication | Lets the backend authenticate the signed-in user and enforce project permissions for both clients. |
| Observability | Cloud Logging | Captures backend errors and generation failures for the MVP. |
| Source control and CI | GitHub and GitHub Actions | Stores source code and runs build/lint/test checks on pull requests. |

### Architecture

```text
Child Expo app (React Native / TypeScript, phone + tablet) ─┐
Parent website (React / TypeScript / Vite) ─────────────────┼─ Fastify API
                                                           │   ├─ authenticates requests and enforces role/link permissions
                                                           │   ├─ calls OpenAI for generation, edits, parent insights, and transcription
                                                           │   ├─ writes versions/bundles to local PostgreSQL
                                                           │   └─ serves public route: /g/:slug
                                                           │        └─ sandboxed browser page loads published game bundle
Local PostgreSQL ───────────────────────────────────────────┘
```

### Why this stack, rather than alternatives

- Expo and React Native reduce mobile setup time for the hackathon while keeping Android as the primary launch target and preserving an iOS path from the same codebase.
- Local PostgreSQL keeps the MVP's relational account, guardian-link, project, version, and activity data together during development.
- A TypeScript Fastify API creates a hard boundary: neither client receives the OpenAI API key or bypasses authorization rules.
- Generated games remain portable static web artifacts, even though the product serves them through its backend.

## 10. Data Model (MVP)

| Collection / resource | Key fields |
| --- | --- |
| `users` | `id`, `role` (`child` or `guardian`), `displayName`, `email`, `createdAt` |
| `guardianLinks` | `childUserId`, `guardianUserId`, `status`, `createdAt` |
| `projects` | `id`, `childUserId`, `title`, `status` (`draft` or `published`), `currentVersionId`, `publishedVersionId`, `publicSlug`, `createdAt`, `updatedAt` |
| `projectVersions` | `id`, `projectId`, `versionNumber`, `prompt`, `bundleStoragePath`, `createdAt` |
| `activityEvents` | `id`, `childUserId`, `projectId`, `type`, `createdAt`, `metadata` |
| `childInsights` | `id`, `childUserId`, `scope`, `sourceProjectIds`, `sourceVersionIds`, `summary`, `dimensions`, `interests`, `conversationStarters`, `createdAt` |
| PostgreSQL project bundle | Versioned `index.html`, CSS, JavaScript, and approved static assets |

## 11. Safety and Security Requirements

- Never place the OpenAI API key in the Expo app, parent website, or a public game bundle.
- Send voice recordings only to the authenticated backend transcription endpoint; do not persist raw child audio in project data or activity history.
- Require server-side authentication on every authenticated backend endpoint.
- Enforce child/guardian/project authorization in the backend; do not rely only on client-side checks or UI visibility.
- Render generated games inside a sandboxed iframe on the public page. The game must not gain access to the parent page, account data, backend credentials, or arbitrary external network destinations.
- Do not allow generated code to embed secrets or backend credentials.
- Validate and constrain generated output before saving or publishing it.
- Record server-side audit events for project creation, edits, publishing, and unpublishing.
- Treat parent AI insights as sensitive child-related data: authorize them server-side, keep supporting evidence scoped to the linked child's portfolio, and avoid unsupported developmental claims.

## 12. Acceptance Criteria

- A child can sign up with email/password or Google, create a game from text, and play it in the Android Expo app.
- The child can hold a voice button, speak a project or edit request, release, and receive editable transcribed text.
- The child can submit at least one natural-language edit and see the changed game.
- The child can save a draft and publish it.
- A published game opens and plays at a public browser URL without authentication.
- A guardian linked to the child can sign in to the parent website and view the child's project list and activity timeline.
- The linked guardian can generate one child-level insight across the child's available portfolio that includes project evidence and conversation starters and clearly states that it is not an assessment.
- An unrelated signed-in user cannot read or edit the child's project through either the app or backend API.
- The Expo client contains no OpenAI API key.

## 13. Open Decisions — Must Be Confirmed Before Implementation

The following are intentionally not assumed in this PRD:

1. **Child-to-guardian linking flow:** invite code, guardian email invitation, or another verification flow.
2. **Guardian approval rule:** whether a child can create an active account or publish a game before the guardian link is confirmed.
3. **Public-link controls:** whether a public game can be unlisted, expire, be password-protected, or only be fully public.
4. **Content policy:** which game themes, language, images, and external links are allowed; what happens when a prompt or generated game is disallowed.
5. **Minimum child age and geographic launch scope:** required to define the applicable privacy and consent obligations.
6. **Guardian activity detail:** child insight generation may use prompts and versions across the portfolio, but the exact prompt/version evidence displayed to the guardian must be confirmed.
7. **Game capability limits:** whether generated games may use sound, external images, or network requests.

## 14. Suggested Hackathon Delivery Order

1. Set up local PostgreSQL and the React Native Expo shell.
2. Build child account creation, sign-in, and a project list.
3. Build the Fastify generation endpoint and store a versioned HTML game bundle.
4. Add WebView preview and natural-language edits.
5. Add publish/unpublish and the public `/g/:slug` route.
6. Add the parent website with guardian linking, dashboard, activity timeline, and a child-level portfolio insight demo.
7. Add generated-code validation, sandboxing, and end-to-end permission tests.
8. If time remains, prototype a read-only, moderated community gallery without child-to-child messaging.
