# ImagineLab — Product Requirements Document

## 1. Product Summary

ImagineLab is an Android-first mobile platform that lets elementary-school students turn natural-language ideas into small, playable browser games. A student describes a game, the platform generates a self-contained HTML, CSS, and JavaScript game, and the student can continue refining it by chat. When ready, the student publishes the game to a public HTML link hosted by the product's server.

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
- Let anyone with a published game link, including a guardian, play the game without creating an account.

## 4. Non-goals for the Hackathon MVP

- Native Android game export or app-store publishing.
- Multiplayer games, chat, comments, likes, or social feeds.
- A visual block editor, custom asset uploads, or manual source-code editing.
- Games beyond a simple single-page HTML/CSS/JavaScript bundle.
- Teacher/classroom administration features.
- Payments, subscriptions, or advertising.

## 5. Users and Roles

| Role | Description | Core capabilities |
| --- | --- | --- |
| Child | An elementary-aged student with their own account linked to a guardian. | Create, edit, play, publish, and view their own games. |
| Guardian | A parent or guardian with an account linked to one or more child accounts. | View their linked child's work and development activity; play any game received through a public link. |
| Public visitor | Anyone opening a published game link. | Play the published game without an account. |

## 6. MVP User Stories

### Child

- As a child, I can create an account and link it to a guardian account.
- As a child, I can write an idea such as “make a game where a frog catches flies” and receive a playable game.
- As a child, I can play my game inside the Android app.
- As a child, I can ask for a change such as “make it faster” or “add three lives,” then preview the updated game.
- As a child, I can save a draft game.
- As a child, I can publish a saved game and copy or share its public link.

### Guardian

- As a guardian, I can create an account and link it with my child's account.
- As a guardian, I can see the child's projects and a chronological record of creation and edit events.
- As a guardian, I can open a public game link shared with me and play it without being required to sign in.

### Public visitor

- As a visitor, I can open a public game URL in a browser and play the game.

## 7. Primary User Flows

### Create and refine a game

1. A child signs in to the Android app.
2. The child chooses **Create game** and describes an idea in natural language.
3. The backend generates a basic game as HTML, CSS, and JavaScript.
4. The app opens a preview in a sandboxed web view.
5. The child enters an edit request in natural language.
6. The backend updates the game bundle, saves a new version, and returns a refreshed preview.
7. The child saves the game as a draft or publishes it.

### Publish and play

1. A child selects **Publish** from a saved game.
2. The backend creates or updates a public slug for the latest approved version.
3. The app shows a copy/shareable public URL.
4. A visitor opens the URL and plays the game in a browser.

### Guardian oversight

1. A guardian signs in to the app.
2. The guardian opens the linked child's profile.
3. The guardian sees projects, their publish status, and creation/edit activity.
4. The guardian opens a project preview or a public link.

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
- Generate a self-contained, basic HTML/CSS/JavaScript game bundle.
- Restrict generated games to a documented, safe browser capability set.
- Display a playable preview in the Android app.
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

## 9. Technical Stack

The selected stack optimizes for a small Android-first hackathon build: one primary language on the backend, managed authentication and data services, a secure server-side boundary for OpenAI, and a straightforward way to serve public game links.

| Area | Selected technology | Why it is selected |
| --- | --- | --- |
| Android app | Kotlin, Jetpack Compose | Native Android UI with a fast modern development workflow. |
| In-app game preview | Android WebView | Runs the generated HTML game inside the app. |
| Authentication | Firebase Authentication | Supports email/password and Google Sign-In without building authentication infrastructure. |
| App data | Cloud Firestore | Managed document data for users, guardian links, projects, versions, and activity. |
| Game bundle storage | Cloud Storage for Firebase | Stores generated HTML/CSS/JavaScript bundles and optional thumbnails. |
| Backend API | TypeScript, Node.js, Fastify, deployed on Google Cloud Run | Keeps the OpenAI API key off devices; handles generation, authorization, publishing, and public serving. |
| AI integration | Official OpenAI server SDK using the Responses API | Provides server-side generation and iterative editing behind a single API boundary. The exact model ID must be selected from current official documentation during implementation. |
| Public game delivery | Cloud Run public route plus Cloud Storage | Serves a stable `https://<domain>/g/<slug>` link from the product's own backend while game files remain in managed storage. |
| Android/backend communication | HTTPS JSON API with Firebase ID tokens | Lets the backend verify the signed-in user and enforce project permissions. |
| Observability | Cloud Logging | Captures backend errors and generation failures for the MVP. |
| Source control and CI | GitHub and GitHub Actions | Stores source code and runs build/lint/test checks on pull requests. |

### Architecture

```text
Android app (Kotlin / Compose)
  ├─ Firebase Authentication
  ├─ Firestore (user-facing project metadata)
  └─ Cloud Run API (authenticated HTTPS)
       ├─ verifies Firebase ID token and role/link permissions
       ├─ calls OpenAI for generation and edits
       ├─ writes versions/bundles to Firestore + Cloud Storage
       └─ serves public route: /g/:slug
            └─ sandboxed browser page loads published game bundle
```

### Why this stack, rather than alternatives

- A native Kotlin app is the most direct fit for the Android-only first release.
- Firebase avoids spending hackathon time building email login, Google login, a database, and file storage from scratch.
- A TypeScript Cloud Run API creates a hard boundary: the Android client never receives the OpenAI API key and cannot bypass authorization rules.
- Generated games remain portable static web artifacts, even though the product serves them through its backend.

## 10. Data Model (MVP)

| Collection / resource | Key fields |
| --- | --- |
| `users` | `id`, `role` (`child` or `guardian`), `displayName`, `email`, `createdAt` |
| `guardianLinks` | `childUserId`, `guardianUserId`, `status`, `createdAt` |
| `projects` | `id`, `childUserId`, `title`, `status` (`draft` or `published`), `currentVersionId`, `publicSlug`, `createdAt`, `updatedAt` |
| `projectVersions` | `id`, `projectId`, `versionNumber`, `prompt`, `bundleStoragePath`, `createdAt` |
| `activityEvents` | `id`, `childUserId`, `projectId`, `type`, `createdAt`, `metadata` |
| Cloud Storage game bundle | Versioned `index.html`, CSS, JavaScript, and approved static assets |

## 11. Safety and Security Requirements

- Never place the OpenAI API key in the Android app or a public game bundle.
- Require Firebase ID-token verification on every authenticated backend endpoint.
- Enforce child/guardian/project authorization in the backend; do not rely only on Firestore client rules or UI visibility.
- Render generated games inside a sandboxed iframe on the public page. The game must not gain access to the parent page, account data, backend credentials, or arbitrary external network destinations.
- Do not allow generated code to embed secrets or backend credentials.
- Validate and constrain generated output before saving or publishing it.
- Record server-side audit events for project creation, edits, publishing, and unpublishing.

## 12. Acceptance Criteria

- A child can sign up with email/password or Google, create a game from text, and play it in Android.
- The child can submit at least one natural-language edit and see the changed game.
- The child can save a draft and publish it.
- A published game opens and plays at a public browser URL without authentication.
- A guardian linked to the child can sign in and view the child's project list and activity timeline.
- An unrelated signed-in user cannot read or edit the child's project through either the app or backend API.
- The Android client contains no OpenAI API key.

## 13. Open Decisions — Must Be Confirmed Before Implementation

The following are intentionally not assumed in this PRD:

1. **Child-to-guardian linking flow:** invite code, guardian email invitation, or another verification flow.
2. **Guardian approval rule:** whether a child can create an active account or publish a game before the guardian link is confirmed.
3. **Public-link controls:** whether a public game can be unlisted, expire, be password-protected, or only be fully public.
4. **Content policy:** which game themes, language, images, and external links are allowed; what happens when a prompt or generated game is disallowed.
5. **Minimum child age and geographic launch scope:** required to define the applicable privacy and consent obligations.
6. **Guardian activity detail:** whether the timeline shows prompts and generated-game versions, or only high-level event names and timestamps.
7. **Game capability limits:** whether generated games may use sound, external images, or network requests.

## 14. Suggested Hackathon Delivery Order

1. Set up Firebase Authentication, Firestore, Cloud Storage, and the Kotlin Android shell.
2. Build child account creation, sign-in, and a project list.
3. Build the Cloud Run generation endpoint and store a versioned HTML game bundle.
4. Add WebView preview and natural-language edits.
5. Add publish/unpublish and the public `/g/:slug` route.
6. Add guardian linking, dashboard, and activity timeline.
7. Add generated-code validation, sandboxing, and end-to-end permission tests.
